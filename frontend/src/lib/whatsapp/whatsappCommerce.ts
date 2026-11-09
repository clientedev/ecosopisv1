import crypto from 'crypto';
import { getDbPool } from './db';

export interface CatalogProduct {
  id: number;
  name: string;
  slug: string;
  description: string;
  benefits: string;
  ingredients: string;
  price: number;
  sale_price: number | null;
  is_on_sale: boolean;
  stock: number;
  category: string;
  image_url: string;
  is_wholesale: boolean;
}

export interface CommerceCartItem {
  id: number;
  name: string;
  slug: string;
  price: number;
  quantity: number;
  image_url: string;
  isWholesale: boolean;
}

export interface CommerceCustomerData {
  name?: string;
  cpf?: string;
  email?: string;
  phone?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

type SessionStep =
  | 'IDLE'
  | 'AWAITING_PRODUCT'
  | 'AWAITING_QUANTITY'
  | 'AWAITING_MORE_OR_CHECKOUT'
  | 'AWAITING_PERSONAL'
  | 'AWAITING_CEP'
  | 'AWAITING_ADDRESS_NUMBER'
  | 'AWAITING_FULL_ADDRESS';

interface CommerceSession {
  jid: string;
  step: SessionStep;
  selectedProductId: number | null;
  cart: CommerceCartItem[];
  customer: CommerceCustomerData;
  updatedAt: number;
}

let commerceTablesReady = false;
const memorySessions = new Map<string, CommerceSession>();
const lastMessageTimeByJid = new Map<string, number>();

// Fila global exclusiva para respostas conversacionais do catálogo com cadência humanizada anti-ban
const replyQueue: {
  running: boolean;
  lastSentAt: number;
  tasks: Array<() => Promise<void>>;
} = ((globalThis as any).__wa_commerce_reply_queue__ ||= {
  running: false,
  lastSentAt: 0,
  tasks: [],
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Garante as tabelas isoladas do módulo de compras via WhatsApp (sem alterar nenhuma tabela existente)
 */
export async function ensureCommerceTables(): Promise<void> {
  if (commerceTablesReady) return;
  const pool = getDbPool();
  if (!pool) return;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_commerce_sessions (
        jid VARCHAR(128) PRIMARY KEY,
        step VARCHAR(64) NOT NULL DEFAULT 'IDLE',
        selected_product_id INTEGER,
        cart_json TEXT NOT NULL DEFAULT '[]',
        customer_json TEXT NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS whatsapp_commerce_checkouts (
        token VARCHAR(96) PRIMARY KEY,
        jid VARCHAR(128),
        phone VARCHAR(64),
        customer_name VARCHAR(255),
        customer_email VARCHAR(255),
        customer_cpf VARCHAR(32),
        cep VARCHAR(32),
        address_json TEXT NOT NULL DEFAULT '{}',
        items_json TEXT NOT NULL DEFAULT '[]',
        coupon_code VARCHAR(64),
        shipping_method VARCHAR(128),
        shipping_service_id INTEGER,
        shipping_price DOUBLE PRECISION DEFAULT 0,
        status VARCHAR(64) NOT NULL DEFAULT 'pending_review',
        order_id INTEGER,
        guest_access_token VARCHAR(128),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    commerceTablesReady = true;
  } catch (err: any) {
    console.warn('[WhatsApp Commerce] Aviso ao garantir tabelas isoladas:', err?.message || err);
  }
}

/**
 * Enfileira resposta conversacional com simulação humana ("digitando...") e intervalo seguro
 * para NUNCA disparar mensagens rápidas e proteger o número contra bloqueio do WhatsApp.
 */
function enqueueSafeCommerceReply(
  sock: any,
  remoteJid: string,
  text: string,
  customerName: string = 'Cliente WhatsApp'
) {
  replyQueue.tasks.push(async () => {
    try {
      // Intervalo mínimo global entre respostas do bot (5.5s a 7.5s)
      const elapsed = Date.now() - replyQueue.lastSentAt;
      const minGapMs = 5500 + Math.floor(Math.random() * 2000);
      if (elapsed < minGapMs) {
        await sleep(minGapMs - elapsed);
      }

      // Simula presença humana "digitando..." por 2.2s a 3.4s antes de enviar
      try {
        await sock.sendPresenceUpdate('composing', remoteJid);
      } catch {}

      const typingDuration = 2200 + Math.floor(Math.random() * 1200);
      await sleep(typingDuration);

      try {
        await sock.sendPresenceUpdate('paused', remoteJid);
      } catch {}

      await sock.sendMessage(remoteJid, { text });
      replyQueue.lastSentAt = Date.now();

      // Registra no histórico do painel Admin de forma assíncrona
      const pool = getDbPool();
      if (pool) {
        const cleanPhone = remoteJid.split('@')[0].replace(/\D/g, '');
        pool
          .query(
            `INSERT INTO whatsapp_message_logs (whatsapp_id, to_phone, recipient_name, message, trigger_type, status)
             VALUES ('default', $1, $2, $3, 'whatsapp_commerce', 'SENT')`,
            [cleanPhone, customerName, text]
          )
          .catch(() => {});
      }
    } catch (err: any) {
      console.error('[WhatsApp Commerce Reply Error]:', err?.message || err);
    }
  });

  if (!replyQueue.running) {
    replyQueue.running = true;
    (async () => {
      try {
        while (replyQueue.tasks.length > 0) {
          const task = replyQueue.tasks.shift();
          if (task) await task();
        }
      } finally {
        replyQueue.running = false;
      }
    })();
  }
}

/**
 * Busca os produtos ativos no PostgreSQL para montar o catálogo
 */
export async function getActiveCatalogProducts(): Promise<CatalogProduct[]> {
  const pool = getDbPool();
  if (!pool) return [];
  try {
    const res = await pool.query(`
      SELECT
        id,
        name,
        slug,
        COALESCE(description, '') AS description,
        COALESCE(benefits, '') AS benefits,
        COALESCE(ingredients, '') AS ingredients,
        COALESCE(price, 0) AS price,
        sale_price,
        COALESCE(is_on_sale, FALSE) AS is_on_sale,
        COALESCE(stock, 0) AS stock,
        COALESCE(category, 'Cosméticos Naturais') AS category,
        COALESCE(image_url, '') AS image_url,
        COALESCE(is_wholesale, FALSE) AS is_wholesale
      FROM products
      WHERE COALESCE(is_active, TRUE) = TRUE
        AND COALESCE(buy_on_site, TRUE) = TRUE
      ORDER BY COALESCE("order", 0) ASC, id ASC
    `);
    return (res.rows || []).map((r: any) => ({
      id: Number(r.id),
      name: String(r.name || ''),
      slug: String(r.slug || ''),
      description: String(r.description || ''),
      benefits: String(r.benefits || ''),
      ingredients: String(r.ingredients || ''),
      price: Number(r.price || 0),
      sale_price: r.sale_price !== null && r.sale_price !== undefined ? Number(r.sale_price) : null,
      is_on_sale: Boolean(r.is_on_sale),
      stock: Number(r.stock ?? 10),
      category: String(r.category || 'Cosméticos Naturais'),
      image_url: String(r.image_url || ''),
      is_wholesale: Boolean(r.is_wholesale),
    }));
  } catch (err: any) {
    console.warn('[WhatsApp Commerce] Erro ao buscar catálogo de produtos:', err?.message || err);
    return [];
  }
}

export function getEffectivePrice(p: CatalogProduct): number {
  if (p.is_on_sale && p.sale_price && p.sale_price > 0) {
    return Number(p.sale_price);
  }
  return Number(p.price || 0);
}

function formatBRL(val: number): string {
  return `R$ ${Number(val || 0).toFixed(2).replace('.', ',')}`;
}

async function loadSession(jid: string): Promise<CommerceSession> {
  await ensureCommerceTables();
  const pool = getDbPool();
  const phoneDigits = jid.split('@')[0].replace(/\D/g, '');
  const localPhone = phoneDigits.startsWith('55') && phoneDigits.length >= 12 ? phoneDigits.slice(2) : phoneDigits;

  if (pool) {
    try {
      const res = await pool.query(
        `SELECT step, selected_product_id, cart_json, customer_json, updated_at
         FROM whatsapp_commerce_sessions WHERE jid = $1`,
        [jid]
      );
      if (res?.rows?.length > 0) {
        const row = res.rows[0];
        const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
        // Expira sessão inativa há mais de 12 horas
        if (Date.now() - updatedAt < 12 * 60 * 60 * 1000) {
          const s: CommerceSession = {
            jid,
            step: (row.step || 'IDLE') as SessionStep,
            selectedProductId: row.selected_product_id ? Number(row.selected_product_id) : null,
            cart: JSON.parse(row.cart_json || '[]'),
            customer: { phone: localPhone, ...JSON.parse(row.customer_json || '{}') },
            updatedAt,
          };
          memorySessions.set(jid, s);
          return s;
        }
      }
    } catch {}
  }

  const existing = memorySessions.get(jid);
  if (existing && Date.now() - existing.updatedAt < 12 * 60 * 60 * 1000) {
    return existing;
  }

  const fresh: CommerceSession = {
    jid,
    step: 'IDLE',
    selectedProductId: null,
    cart: [],
    customer: { phone: localPhone },
    updatedAt: Date.now(),
  };
  memorySessions.set(jid, fresh);
  return fresh;
}

async function saveSession(session: CommerceSession): Promise<void> {
  session.updatedAt = Date.now();
  memorySessions.set(session.jid, session);
  const pool = getDbPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO whatsapp_commerce_sessions (jid, step, selected_product_id, cart_json, customer_json, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (jid) DO UPDATE SET
         step = EXCLUDED.step,
         selected_product_id = EXCLUDED.selected_product_id,
         cart_json = EXCLUDED.cart_json,
         customer_json = EXCLUDED.customer_json,
         updated_at = NOW()`,
      [
        session.jid,
        session.step,
        session.selectedProductId,
        JSON.stringify(session.cart || []),
        JSON.stringify(session.customer || {}),
      ]
    );
  } catch {}
}

/**
 * Monta o texto consolidado do Catálogo Ecosopis em uma única mensagem (evitando múltiplos disparos)
 */
export function buildCatalogMessage(products: CatalogProduct[]): string {
  let msg = `🌿 *CATÁLOGO OFICIAL ECOSOPIS*\n`;
  msg += `_Cosméticos Naturais, Veganos & Sustentáveis_\n\n`;

  products.forEach((p, idx) => {
    const num = idx + 1;
    const price = getEffectivePrice(p);
    const promoTag = p.is_on_sale && p.sale_price ? ` _(Promoção de ${formatBRL(p.price)})_` : '';
    msg += `*${num}.* ${p.name} — *${formatBRL(price)}*${promoTag}\n`;
  });

  msg += `\n🛍️ *Qual produto você deseja conhecer ou comprar?*\n`;
  msg += `👉 Responda com o *número* (ex: *1*, *2*...) ou digite o *nome* do produto.\n`;
  msg += `_(A qualquer momento digite *CANCELAR* para sair ou *ATENDIMENTO* para falar com nossa equipe)_`;
  return msg;
}

/**
 * Monta a explicação consultiva do produto selecionado + pergunta de quantidade
 */
function buildProductExplanationMessage(product: CatalogProduct): string {
  const price = getEffectivePrice(product);
  const cleanDesc = (product.description || 'Cosmético natural formulado com ativos vegetais puros.')
    .replace(/<[^>]+>/g, '')
    .trim();
  const cleanBenefits = (product.benefits || '')
    .replace(/<[^>]+>/g, '')
    .trim();

  let msg = `✨ *${product.name}*\n`;
  if (product.category) {
    msg += `🏷️ _Categoria: ${product.category}_\n`;
  }
  msg += `\n📖 *Sobre o Produto:*\n${cleanDesc}\n`;

  if (cleanBenefits && cleanBenefits.length > 5 && cleanBenefits !== cleanDesc) {
    const shortBenefits = cleanBenefits.length > 260 ? cleanBenefits.slice(0, 257) + '...' : cleanBenefits;
    msg += `\n🌱 *Principais Benefícios:*\n${shortBenefits}\n`;
  }

  msg += `\n💰 *Valor unitário:* *${formatBRL(price)}*`;
  if (product.is_wholesale) {
    const wholesalePrice = Math.round(product.price * 0.55 * 100) / 100;
    msg += `\n📦 _Atacado (a partir de 10 un. no pedido): ${formatBRL(wholesalePrice)}/un._`;
  }
  msg += `\n\n🔢 *Quantas unidades de "${product.name}" você deseja comprar?*\n`;
  msg += `👉 Digite apenas a *quantidade* (ex: *1*, *2*, *3*...) ou digite *CATALOGO* para ver outro produto.`;
  return msg;
}

/**
 * Calcula subtotal considerando regra de atacado (10+ itens elegíveis = 45% OFF sobre preço original)
 */
export function calculateCartTotals(cart: CommerceCartItem[]) {
  const wholesaleCount = cart
    .filter(i => i.isWholesale)
    .reduce((acc, i) => acc + i.quantity, 0);
  const isWholesaleUnlocked = wholesaleCount >= 10;

  let subtotal = 0;
  for (const item of cart) {
    const unitPrice = isWholesaleUnlocked && item.isWholesale
      ? Math.round(item.price * 0.55 * 100) / 100
      : item.price;
    subtotal += unitPrice * item.quantity;
  }
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    isWholesaleUnlocked,
    totalItems: cart.reduce((acc, i) => acc + i.quantity, 0),
  };
}

function buildCartSummaryText(cart: CommerceCartItem[]): string {
  const { subtotal, isWholesaleUnlocked } = calculateCartTotals(cart);
  let text = `🛒 *Resumo do seu Pedido:*\n`;
  cart.forEach((item, i) => {
    const unitPrice = isWholesaleUnlocked && item.isWholesale
      ? Math.round(item.price * 0.55 * 100) / 100
      : item.price;
    text += `• ${item.quantity}x ${item.name} — *${formatBRL(unitPrice * item.quantity)}*\n`;
  });
  if (isWholesaleUnlocked) {
    text += `🎉 _Desconto de Atacado (45% OFF) aplicado automaticamente!_\n`;
  }
  text += `💵 *Subtotal dos produtos:* *${formatBRL(subtotal)}*`;
  return text;
}

function isValidCPF(cpf: string): boolean {
  const clean = (cpf || '').replace(/\D/g, '');
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i), 10) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(clean.charAt(9), 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i), 10) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(clean.charAt(10), 10);
}

/**
 * Extrai Nome, CPF e E-mail de uma mensagem livre (podendo vir juntos ou separados)
 */
function parsePersonalFields(text: string, current: CommerceCustomerData): CommerceCustomerData {
  const updated = { ...current };

  // 1. Extrai e-mail se presente
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    updated.email = emailMatch[0].toLowerCase().trim();
  }

  // 2. Extrai CPF (11 dígitos com ou sem pontuação)
  const cpfMatch = text.match(/(?:\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[.\s-]?\d{2}|\b\d{11}\b)/);
  if (cpfMatch) {
    const digits = cpfMatch[0].replace(/\D/g, '');
    if (digits.length === 11 && isValidCPF(digits)) {
      updated.cpf = digits;
    }
  }

  // 3. O restante do texto (removendo e-mail, CPF e rótulos) é avaliado como Nome Completo
  let remaining = text;
  if (emailMatch) remaining = remaining.replace(emailMatch[0], ' ');
  if (cpfMatch) remaining = remaining.replace(cpfMatch[0], ' ');
  remaining = remaining
    .replace(/\b(meu|minha|nome|completo|cpf|e-mail|email|segue|aqui|esta|está)\s*[:=-]?/gi, ' ')
    .replace(/[,;|/\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    remaining.length >= 3 &&
    !/^\d+$/.test(remaining) &&
    (!updated.name || /\bnome\b/i.test(text) || Boolean(emailMatch && cpfMatch))
  ) {
    updated.name = remaining;
  }

  return updated;
}

/**
 * Consulta CEP via BrasilAPI / ViaCEP com timeout curto
 */
async function lookupCep(cepDigits: string): Promise<{
  street: string;
  neighborhood: string;
  city: string;
  state: string;
} | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(t);
    if (res.ok) {
      const data = await res.json();
      if (!data.erro && data.localidade && data.uf) {
        return {
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || '',
        };
      }
    }
  } catch {}

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepDigits}`, {
      signal: controller.signal,
    });
    clearTimeout(t);
    if (res.ok) {
      const data = await res.json();
      if (data.city && data.state) {
        return {
          street: data.street || '',
          neighborhood: data.neighborhood || '',
          city: data.city || '',
          state: data.state || '',
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Salva o checkout gerado pelo WhatsApp e retorna o link exclusivo de revisão e pagamento
 */
async function createWhatsAppCheckoutToken(session: CommerceSession): Promise<{
  token: string;
  checkoutUrl: string;
}> {
  await ensureCommerceTables();
  const pool = getDbPool();
  const shortId = crypto.randomBytes(8).toString('hex');
  const token = `wa-${Date.now().toString(36)}-${shortId}`;

  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.FRONTEND_URL ||
    'https://www.ecosopis.com.br'
  ).replace(/\/$/, '');

  const addressObj = {
    street: session.customer.street || '',
    number: session.customer.number || 'S/N',
    complement: session.customer.complement || '',
    neighborhood: session.customer.neighborhood || 'Centro',
    city: session.customer.city || '',
    state: session.customer.state || 'SP',
    postal_code: (session.customer.cep || '').replace(/\D/g, ''),
    cep: (session.customer.cep || '').replace(/\D/g, ''),
    email: session.customer.email || '',
  };

  if (pool) {
    await pool.query(
      `INSERT INTO whatsapp_commerce_checkouts (
        token, jid, phone, customer_name, customer_email, customer_cpf, cep,
        address_json, items_json, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_review', NOW(), NOW())`,
      [
        token,
        session.jid,
        session.customer.phone || '',
        session.customer.name || 'Cliente',
        session.customer.email || '',
        (session.customer.cpf || '').replace(/\D/g, ''),
        (session.customer.cep || '').replace(/\D/g, ''),
        JSON.stringify(addressObj),
        JSON.stringify(session.cart || []),
      ]
    );
  }

  return {
    token,
    checkoutUrl: `${baseUrl}/finalizar-compra/${token}`,
  };
}

/**
 * Extrai o texto de qualquer formato de mensagem recebida no Baileys
 */
function extractMessageText(msg: any): string {
  const m = msg?.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  ).trim();
}

function normalizeStr(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Processa mensagens recebidas no WhatsApp conectado.
 * Retorna `true` se a mensagem fez parte do fluxo de compra/catálogo,
 * ou `false` caso não seja um comando de compra nem sessão ativa.
 */
export async function handleIncomingWhatsAppCommerceMessage(
  sock: any,
  msg: any
): Promise<boolean> {
  const remoteJid = msg?.key?.remoteJid;
  if (!remoteJid) return false;

  const rawText = extractMessageText(msg);
  if (!rawText) return false;

  // Proteção anti-flood por contato (ignora mensagens repetidas em menos de 1.5s)
  const now = Date.now();
  const lastMsgAt = lastMessageTimeByJid.get(remoteJid) || 0;
  if (now - lastMsgAt < 1500) {
    return true;
  }
  lastMessageTimeByJid.set(remoteJid, now);

  const norm = normalizeStr(rawText);
  const session = await loadSession(remoteJid);
  const pushName = msg?.pushName ? String(msg.pushName).trim() : '';
  const displayName = session.customer.name || pushName || 'Cliente';

  // Comandos de saída / cancelamento
  if (['cancelar', 'sair', 'encerrar', 'parar', 'limpar'].includes(norm)) {
    if (session.step !== 'IDLE' || session.cart.length > 0) {
      session.step = 'IDLE';
      session.selectedProductId = null;
      session.cart = [];
      await saveSession(session);
      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        `✅ Seu atendimento de compra foi encerrado e o carrinho limpo.\n\nSempre que quiser fazer um novo pedido pelo WhatsApp, basta enviar *COMPRAR* ou *CATÁLOGO*! 🌿`,
        session.customer.name
      );
      return true;
    }
    return false;
  }

  // Comando para falar com humano
  if (['atendimento', 'humano', 'atendente', 'suporte', 'ajuda'].includes(norm)) {
    session.step = 'IDLE';
    await saveSession(session);
    enqueueSafeCommerceReply(
      sock,
      remoteJid,
      `🌿 *Atendimento Humano ECOSOPIS*\n\nPara conversar diretamente com nossa equipe de atendimento oficial, clique no link abaixo:\n👉 https://wa.me/5511951559212\n\nSe desejar voltar às compras automáticas por aqui, digite *COMPRAR* a qualquer momento! ✨`,
      session.customer.name
    );
    return true;
  }

  // Gatilhos para abrir o Catálogo e iniciar compra
  const isBuyTrigger =
    norm === 'comprar' ||
    norm === 'catalogo' ||
    norm === 'produtos' ||
    norm === 'cardapio' ||
    norm === 'loja' ||
    norm === 'menu' ||
    norm === 'quero comprar' ||
    norm === 'fazer pedido' ||
    norm.startsWith('comprar ') ||
    norm.includes('ver catalogo') ||
    norm.includes('quero comprar');

  if (isBuyTrigger) {
    const products = await getActiveCatalogProducts();
    if (products.length === 0) {
      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        `🌿 Olá! No momento nosso catálogo está sendo atualizado. Você pode conferir todos os produtos diretamente em nosso site oficial:\n👉 https://www.ecosopis.com.br/produtos`,
        session.customer.name
      );
      return true;
    }

    session.step = 'AWAITING_PRODUCT';
    session.selectedProductId = null;
    await saveSession(session);

    const catalogText = buildCatalogMessage(products);
    enqueueSafeCommerceReply(sock, remoteJid, catalogText, session.customer.name);
    return true;
  }

  // Se o cliente não está em uma sessão ativa de compra, deixa o fluxo padrão responder
  // (mas o fluxo padrão agora também informa que basta digitar COMPRAR ou CATÁLOGO!)
  if (session.step === 'IDLE') {
    return false;
  }

  const products = await getActiveCatalogProducts();

  // ── ETAPA 1: ESCOLHA DO PRODUTO ────────────────────────────────────────────
  if (session.step === 'AWAITING_PRODUCT') {
    let chosen: CatalogProduct | undefined;

    // Verifica se digitou o número do item no catálogo (ex: "1", "2")
    const numMatch = norm.match(/^(\d+)$/);
    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < products.length) {
        chosen = products[idx];
      }
    }

    // Se não escolheu por número, busca por nome/slug aproximado
    if (!chosen) {
      chosen = products.find(p => normalizeStr(p.name) === norm || normalizeStr(p.slug) === norm);
      if (!chosen) {
        chosen = products.find(
          p =>
            normalizeStr(p.name).includes(norm) ||
            norm.split(/\s+/).filter(w => w.length >= 3).every(w => normalizeStr(p.name).includes(w))
        );
      }
    }

    if (!chosen) {
      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        `🤔 Não consegui identificar esse produto.\n\nPor favor, digite apenas o *número* do produto da lista (de *1* a *${products.length}*) ou digite *CATALOGO* para ver a lista novamente.`,
        session.customer.name
      );
      return true;
    }

    session.selectedProductId = chosen.id;
    session.step = 'AWAITING_QUANTITY';
    await saveSession(session);

    const explanation = buildProductExplanationMessage(chosen);
    enqueueSafeCommerceReply(sock, remoteJid, explanation, session.customer.name);
    return true;
  }

  // ── ETAPA 2: ESCOLHA DA QUANTIDADE ─────────────────────────────────────────
  if (session.step === 'AWAITING_QUANTITY') {
    if (norm === 'voltar' || norm === '0') {
      session.step = 'AWAITING_PRODUCT';
      session.selectedProductId = null;
      await saveSession(session);
      enqueueSafeCommerceReply(sock, remoteJid, buildCatalogMessage(products), session.customer.name);
      return true;
    }

    const qtyMatch = norm.match(/(\d+)/);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : NaN;
    if (!qty || isNaN(qty) || qty < 1 || qty > 200) {
      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        `🔢 Por favor, digite apenas a *quantidade desejada* em números (ex: *1*, *2*, *3*...) ou digite *CATALOGO* para escolher outro produto.`,
        session.customer.name
      );
      return true;
    }

    const product = products.find(p => p.id === session.selectedProductId);
    if (!product) {
      session.step = 'AWAITING_PRODUCT';
      await saveSession(session);
      enqueueSafeCommerceReply(sock, remoteJid, buildCatalogMessage(products), session.customer.name);
      return true;
    }

    if (product.stock > 0 && qty > product.stock) {
      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        `⚠️ Temos atualmente *${product.stock} unidades* em estoque de *${product.name}*. Por favor, informe uma quantidade até ${product.stock}:`,
        session.customer.name
      );
      return true;
    }

    const effectivePrice = getEffectivePrice(product);
    const existingIdx = session.cart.findIndex(c => c.id === product.id);
    if (existingIdx >= 0) {
      session.cart[existingIdx].quantity += qty;
    } else {
      session.cart.push({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: effectivePrice,
        quantity: qty,
        image_url: product.image_url,
        isWholesale: product.is_wholesale,
      });
    }

    session.selectedProductId = null;
    session.step = 'AWAITING_MORE_OR_CHECKOUT';
    await saveSession(session);

    const summary = buildCartSummaryText(session.cart);
    const reply =
      `✅ Adicionado: *${qty}x ${product.name}*!\n\n` +
      `${summary}\n\n` +
      `Deseja adicionar mais algum produto ou fechar a compra?\n` +
      `1️⃣ Digite *1* (ou *FECHAR*) para informar seus dados e fechar a compra\n` +
      `2️⃣ Digite *2* (ou *MAIS*) para escolher outro produto do catálogo`;

    enqueueSafeCommerceReply(sock, remoteJid, reply, session.customer.name);
    return true;
  }

  // ── ETAPA 3: ADICIONAR MAIS OU FECHAR PEDIDO ───────────────────────────────
  if (session.step === 'AWAITING_MORE_OR_CHECKOUT') {
    const wantsMore =
      norm === '2' ||
      norm === 'mais' ||
      norm.includes('adicionar') ||
      norm.includes('outro') ||
      norm.includes('continuar');

    const wantsCheckout =
      norm === '1' ||
      norm === 'fechar' ||
      norm.includes('fechar') ||
      norm.includes('finalizar') ||
      norm.includes('concluir') ||
      norm.includes('pagar');

    if (wantsMore) {
      session.step = 'AWAITING_PRODUCT';
      await saveSession(session);
      enqueueSafeCommerceReply(sock, remoteJid, buildCatalogMessage(products), session.customer.name);
      return true;
    }

    if (wantsCheckout) {
      session.step = 'AWAITING_PERSONAL';
      await saveSession(session);

      let prompt = `📋 *Perfeito! Vamos fechar o seu pedido.*\n\n`;
      prompt += `Para gerar seu link exclusivo de revisão e pagamento, envie seus dados abaixo (pode mandar tudo em uma única mensagem):\n\n`;
      prompt += `👤 *Nome Completo*\n`;
      prompt += `🪪 *CPF* (11 dígitos)\n`;
      prompt += `📧 *E-mail*\n\n`;
      prompt += `_Exemplo: Maria Silva, 123.456.789-00, maria@email.com_`;

      enqueueSafeCommerceReply(sock, remoteJid, prompt, session.customer.name);
      return true;
    }

    enqueueSafeCommerceReply(
      sock,
      remoteJid,
      `Por favor, escolha uma opção:\n1️⃣ Digite *1* para *FECHAR O PEDIDO*\n2️⃣ Digite *2* para *ADICIONAR MAIS PRODUTOS*`,
      session.customer.name
    );
    return true;
  }

  // ── ETAPA 4A: DADOS PESSOAIS (NOME, CPF, E-MAIL) ───────────────────────────
  if (session.step === 'AWAITING_PERSONAL') {
    session.customer = parsePersonalFields(rawText, session.customer);

    // Verifica se o cliente digitou um CPF inválido
    const rawDigits = rawText.replace(/\D/g, '');
    if (!session.customer.cpf && rawDigits.length === 11 && !isValidCPF(rawDigits)) {
      await saveSession(session);
      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        `⚠️ O CPF informado parece inválido. Por favor, confira os 11 números do seu *CPF* e envie novamente:`,
        session.customer.name
      );
      return true;
    }

    const missing: string[] = [];
    if (!session.customer.name || session.customer.name.trim().length < 3) missing.push('*Nome Completo*');
    if (!session.customer.cpf) missing.push('*CPF válido (11 dígitos)*');
    if (!session.customer.email) missing.push('*E-mail*');

    if (missing.length > 0) {
      await saveSession(session);
      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        `✅ Anotado! Para continuar, falta apenas informar: ${missing.join(' e ')}.`,
        session.customer.name
      );
      return true;
    }

    session.step = 'AWAITING_CEP';
    await saveSession(session);

    enqueueSafeCommerceReply(
      sock,
      remoteJid,
      `📍 Ótimo, *${session.customer.name}*!\n\nAgora digite o *CEP de entrega* (8 números, ex: *01310-100*):`,
      session.customer.name
    );
    return true;
  }

  // ── ETAPA 4B: CEP DE ENTREGA ───────────────────────────────────────────────
  if (session.step === 'AWAITING_CEP') {
    const cepDigits = rawText.replace(/\D/g, '');
    if (cepDigits.length !== 8) {
      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        `⚠️ Por favor, informe um *CEP válido com 8 dígitos* (ex: *01310-100*):`,
        session.customer.name
      );
      return true;
    }

    session.customer.cep = cepDigits;
    const lookedUp = await lookupCep(cepDigits);

    if (lookedUp && lookedUp.street) {
      session.customer.street = lookedUp.street;
      session.customer.neighborhood = lookedUp.neighborhood || 'Centro';
      session.customer.city = lookedUp.city;
      session.customer.state = lookedUp.state;
      session.step = 'AWAITING_ADDRESS_NUMBER';
      await saveSession(session);

      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        `🏠 Endereço localizado:\n*${lookedUp.street} - ${lookedUp.neighborhood}, ${lookedUp.city}/${lookedUp.state}*\n\n👉 Digite agora o *Número da residência* (e complemento, se houver — ex: *150, Apto 42*):`,
        session.customer.name
      );
      return true;
    }

    if (lookedUp && lookedUp.city) {
      session.customer.city = lookedUp.city;
      session.customer.state = lookedUp.state;
    }

    session.step = 'AWAITING_FULL_ADDRESS';
    await saveSession(session);

    enqueueSafeCommerceReply(
      sock,
      remoteJid,
      `📍 CEP *${cepDigits}* registrado!\nPor favor, envie em uma única mensagem sua *Rua, Número e Bairro* (ex: *Rua das Flores, 120, Centro*):`,
      session.customer.name
    );
    return true;
  }

  // ── ETAPA 4C: NÚMERO E COMPLEMENTO DO ENDEREÇO ─────────────────────────────
  if (session.step === 'AWAITING_ADDRESS_NUMBER') {
    const parts = rawText.split(/[,;-]/).map(s => s.trim()).filter(Boolean);
    session.customer.number = parts[0] || rawText.trim();
    if (parts.length > 1) {
      session.customer.complement = parts.slice(1).join(', ');
    }

    const { checkoutUrl } = await createWhatsAppCheckoutToken(session);
    const summary = buildCartSummaryText(session.cart);

    // Reseta a sessão após gerar o link para que o cliente possa iniciar nova compra quando quiser
    const finalName = session.customer.name || 'Cliente';
    session.step = 'IDLE';
    session.selectedProductId = null;
    session.cart = [];
    await saveSession(session);

    const finalMessage =
      `🎉 *Pedido Pronto para Revisão e Pagamento, ${finalName}!*\n\n` +
      `${summary}\n\n` +
      `👤 *Cliente:* ${finalName}\n` +
      `📍 *Entrega:* ${session.customer.street}, ${session.customer.number}${session.customer.complement ? ` (${session.customer.complement})` : ''} - ${session.customer.neighborhood}, ${session.customer.city}/${session.customer.state} (CEP ${session.customer.cep})\n\n` +
      `🔒 *Acesse seu Link Exclusivo da Ecosopis abaixo para revisar o pedido, escolher o frete e finalizar o pagamento (PIX, Cartão em até 12x, PIX + Cartão ou Boleto):*\n` +
      `👉 ${checkoutUrl}\n\n` +
      `_Assim que o pagamento for confirmado, você receberá a confirmação e o código de rastreio automaticamente por aqui!_ 🌿✨`;

    enqueueSafeCommerceReply(sock, remoteJid, finalMessage, finalName);
    return true;
  }

  // ── ETAPA 4D: ENDEREÇO COMPLETO (QUANDO CEP É GERAL DA CIDADE) ─────────────
  if (session.step === 'AWAITING_FULL_ADDRESS') {
    const parts = rawText.split(',').map(s => s.trim()).filter(Boolean);
    session.customer.street = parts[0] || rawText.trim();
    session.customer.number = parts[1] || 'S/N';
    session.customer.neighborhood = parts[2] || 'Centro';
    if (!session.customer.city) session.customer.city = 'São Paulo';
    if (!session.customer.state) session.customer.state = 'SP';

    const { checkoutUrl } = await createWhatsAppCheckoutToken(session);
    const summary = buildCartSummaryText(session.cart);

    const finalName = session.customer.name || 'Cliente';
    session.step = 'IDLE';
    session.selectedProductId = null;
    session.cart = [];
    await saveSession(session);

    const finalMessage =
      `🎉 *Pedido Pronto para Revisão e Pagamento, ${finalName}!*\n\n` +
      `${summary}\n\n` +
      `👤 *Cliente:* ${finalName}\n` +
      `📍 *Entrega:* ${session.customer.street}, ${session.customer.number} - ${session.customer.neighborhood}, ${session.customer.city}/${session.customer.state} (CEP ${session.customer.cep})\n\n` +
      `🔒 *Acesse seu Link Exclusivo da Ecosopis abaixo para revisar seus dados, escolher o frete e finalizar o pagamento (PIX, Cartão em até 12x, PIX + Cartão ou Boleto):*\n` +
      `👉 ${checkoutUrl}\n\n` +
      `_Assim que o pagamento for confirmado, você receberá a confirmação e o código de rastreio automaticamente por aqui!_ 🌿✨`;

    enqueueSafeCommerceReply(sock, remoteJid, finalMessage, finalName);
    return true;
  }

  return false;
}

