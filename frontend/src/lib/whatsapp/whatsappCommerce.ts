import crypto from 'crypto';
import { getDbPool } from './db';
import { generateCatalogPdfBuffer } from './catalogPdfGenerator';
import { PRODUCT_STATIC_DATA } from '@/lib/productData';

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
  shippingMethod?: string;
  shippingServiceId?: number | null;
  shippingPrice?: number;
  shippingDeliveryTime?: number | null;
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
 * Enfileira o envio do Catálogo Oficial em PDF (com prints dos cards e fotos de todos os produtos)
 * mantendo a mesma cadência humanizada anti-ban.
 */
function enqueueSafeCommerceCatalogPdf(
  sock: any,
  remoteJid: string,
  products: CatalogProduct[],
  customerName: string = 'Cliente WhatsApp'
) {
  replyQueue.tasks.push(async () => {
    try {
      const elapsed = Date.now() - replyQueue.lastSentAt;
      const minGapMs = 5500 + Math.floor(Math.random() * 2000);
      if (elapsed < minGapMs) {
        await sleep(minGapMs - elapsed);
      }

      try {
        await sock.sendPresenceUpdate('composing', remoteJid);
      } catch {}

      const pdfBuffer = await generateCatalogPdfBuffer(products);

      const typingDuration = 1800 + Math.floor(Math.random() * 1000);
      await sleep(typingDuration);

      try {
        await sock.sendPresenceUpdate('paused', remoteJid);
      } catch {}

      const caption =
        `📗 *CATÁLOGO OFICIAL ECOSOPIS (PDF)*\n` +
        `_Abra o PDF acima para ver as fotos, benefícios e valores de todos os nossos produtos!_ ✨\n\n` +
        `🛍️ *Gostou de algum produto?*\n` +
        `👉 Basta digitar aqui na conversa o *NOME DO PRODUTO* que você deseja comprar (ex: *Sabonete de Açafrão*, *Óleo de Rosa Mosqueta*, *Kit Clareamento*...)!\n\n` +
        `💬 _Ou, se preferir, me conte o que você procura tratar na sua pele ou cabelo que eu te indico as melhores opções!_`;

      try {
        await sock.sendMessage(remoteJid, {
          document: pdfBuffer,
          mimetype: 'application/pdf',
          fileName: 'Catalogo-Ecosopis-Cosmeticos-Naturais.pdf',
          caption,
        });
      } catch (docErr) {
        console.warn('[WhatsApp Commerce] Falha ao enviar PDF como documento, enviando catálogo em texto:', docErr);
        const fallbackText = buildCatalogMessage(products);
        await sock.sendMessage(remoteJid, { text: fallbackText });
      }

      replyQueue.lastSentAt = Date.now();

      const pool = getDbPool();
      if (pool) {
        const cleanPhone = remoteJid.split('@')[0].replace(/\D/g, '');
        pool
          .query(
            `INSERT INTO whatsapp_message_logs (whatsapp_id, to_phone, recipient_name, message, trigger_type, status)
             VALUES ('default', $1, $2, $3, 'whatsapp_commerce', 'SENT')`,
            [cleanPhone, customerName, `[PDF Catálogo Ecosopis enviado] ${caption}`]
          )
          .catch(() => {});
      }
    } catch (err: any) {
      console.error('[WhatsApp Commerce PDF Reply Error]:', err?.message || err);
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
 * Saudação consultiva inicial da IA (Lia) quando o cliente inicia uma compra.
 * Em vez de despejar a lista completa, pergunta o que a pessoa procura e oferece a opção VER CATÁLOGO (PDF).
 */
export function buildConsultativeGreetingMessage(customerName?: string): string {
  const firstName = customerName ? customerName.trim().split(/\s+/)[0] : '';
  const greetingName = firstName && firstName.length >= 2 ? `, *${firstName}*` : '';

  let msg = `🌿 Olá${greetingName}! Que alegria ter você na *ECOSOPIS Cosméticos Naturais*! ✨\n`;
  msg += `Eu sou a *Lia*, sua consultora de beleza natural.\n\n`;
  msg += `Me conta: *o que você procura hoje?* 😊\n`;
  msg += `Você pode me falar o que gostaria de cuidar na sua pele ou cabelo (ex: *manchas, foliculite, acne e oleosidade, pele seca, queda capilar, cuidados íntimos, pés rachados, relaxamento...*) que eu te sugiro os produtos ideais!\n\n`;
  msg += `📖 *Prefere ver todos os produtos com fotos?*\n`;
  msg += `👉 Digite *VER CATÁLOGO* que eu envio agora mesmo aqui na conversa um *PDF com prints de todos os nossos produtos* e valores!`;
  return msg;
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
  msg += `👉 Responda com o *nome do produto* (ou o *número* de 1 a ${products.length}).\n`;
  msg += `📖 _Para receber o PDF com fotos de todos os produtos, digite *VER CATÁLOGO*._\n`;
  msg += `_(A qualquer momento digite *CANCELAR* para sair ou *ATENDIMENTO* para falar com nossa equipe)_`;
  return msg;
}

/**
 * Monta a explicação consultiva do produto selecionado + pergunta de quantidade
 */
function buildProductExplanationMessage(product: CatalogProduct): string {
  const price = getEffectivePrice(product);
  const staticInfo = PRODUCT_STATIC_DATA[product.slug];
  const cleanDesc = (product.description || 'Cosmético natural formulado com ativos vegetais puros.')
    .replace(/<[^>]+>/g, '')
    .trim();
  const cleanBenefits = (staticInfo?.beneficios || product.benefits || '')
    .replace(/<[^>]+>/g, '')
    .trim();
  const cleanActives = (staticInfo?.ativos || product.ingredients || '')
    .replace(/<[^>]+>/g, '')
    .trim();

  let msg = `✨ *${product.name}*\n`;
  if (product.category) {
    msg += `🏷️ _Categoria: ${product.category}_\n`;
  }
  if (cleanActives && cleanActives.length > 3) {
    msg += `🧪 *Ativos:* ${cleanActives}\n`;
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
  msg += `👉 Digite apenas a *quantidade* (ex: *1*, *2*, *3*...) ou digite *VER CATÁLOGO* para ver outros produtos.`;
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

export interface WhatsAppShippingOption {
  id: number;
  name: string;
  company: string;
  price: number;
  effectivePrice: number;
  delivery_time: number;
  isFreeShipping: boolean;
}

function getFreeShippingThresholdByCep(cepDigits: string): number {
  const clean = (cepDigits || '').replace(/\D/g, '');
  if (clean.length !== 8) return 248.9;
  const prefix = parseInt(clean.substring(0, 2), 10);
  // SP(01-19), RJ(20-28), ES(29), MG(30-39), PR(80-87), SC(88-89), RS(90-99)
  if ((prefix >= 1 && prefix <= 39) || (prefix >= 80 && prefix <= 99)) {
    return 148.9;
  }
  return 248.9;
}

/**
 * Calcula o frete para exibir diretamente na conversa do WhatsApp e pré-selecionar no link de pagamento.
 * Utiliza a rota oficial /api/shipping/calculate (Melhor Envio) + regra de Frete Grátis da loja.
 */
async function calculateShippingForWhatsApp(
  cepDigits: string,
  cart: CommerceCartItem[]
): Promise<{
  options: WhatsAppShippingOption[];
  selected: WhatsAppShippingOption;
  appliesFreeShipping: boolean;
}> {
  const cleanCep = (cepDigits || '').replace(/\D/g, '');
  const { subtotal, isWholesaleUnlocked } = calculateCartTotals(cart);
  const threshold = getFreeShippingThresholdByCep(cleanCep);
  const appliesFreeShipping = subtotal >= threshold;

  const reqPayload = {
    dest_cep: cleanCep,
    items: cart.map((item) => {
      const lowerName = (item.name || '').toLowerCase().trim();
      let unitWeight = 0.1;
      if (lowerName.includes('sabonete') && (lowerName.includes('líquido') || lowerName.includes('liquido'))) {
        unitWeight = 0.3;
      }
      const unitPrice =
        isWholesaleUnlocked && item.isWholesale
          ? Math.round(item.price * 0.55 * 100) / 100
          : item.price;
      return {
        id: String(item.id),
        name: item.name,
        width: 16,
        height: 12,
        length: 20,
        weight: unitWeight,
        price: unitPrice,
        quantity: item.quantity,
      };
    }),
  };

  const baseCandidates = [
    process.env.BACKEND_URL,
    process.env.API_URL,
    process.env.NEXT_PUBLIC_API_URL,
    'https://web-production-33f04.up.railway.app',
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.FRONTEND_URL,
    'https://www.ecosopis.com.br',
    'http://127.0.0.1:8000',
  ]
    .filter(Boolean)
    .map((u) => String(u).replace(/\/$/, ''));

  let rawOptions: any[] = [];

  for (const base of baseCandidates) {
    try {
      const endpoint = base.endsWith('/api')
        ? `${base}/shipping/calculate`
        : `${base}/api/shipping/calculate`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqPayload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          rawOptions = data;
          break;
        }
      }
    } catch {}
  }

  // Fallback regional caso a API externa demore ou esteja indisponível no momento
  if (rawOptions.length === 0) {
    const prefix = parseInt(cleanCep.substring(0, 2) || '1', 10);
    const isSP = prefix >= 1 && prefix <= 19;
    const isSouthSoutheast = (prefix >= 1 && prefix <= 39) || (prefix >= 80 && prefix <= 99);
    rawOptions = [
      {
        id: 1,
        company: 'Correios',
        name: 'PAC',
        price: isSP ? 16.9 : isSouthSoutheast ? 22.9 : 31.9,
        delivery_time: isSP ? 4 : isSouthSoutheast ? 6 : 9,
      },
      {
        id: 2,
        company: 'Correios',
        name: 'SEDEX',
        price: isSP ? 21.9 : isSouthSoutheast ? 32.9 : 48.9,
        delivery_time: isSP ? 2 : isSouthSoutheast ? 3 : 5,
      },
    ];
  }

  // Ordena do mais econômico para o mais caro
  const sorted = [...rawOptions].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  const cheapestId = sorted[0]?.id;

  const formatted: WhatsAppShippingOption[] = sorted.map((opt, idx) => {
    const basePrice = Number(opt.price || 0);
    const isCheapest = opt.id !== undefined ? opt.id === cheapestId : idx === 0;
    const isFree = appliesFreeShipping && isCheapest;
    return {
      id: Number(opt.id || idx + 1),
      name: String(opt.name || 'Entrega Padrão'),
      company: String(opt.company || 'Correios'),
      price: basePrice,
      effectivePrice: isFree ? 0 : basePrice,
      delivery_time: Number(opt.delivery_time || 5),
      isFreeShipping: isFree,
    };
  });

  return {
    options: formatted,
    selected: formatted[0],
    appliesFreeShipping,
  };
}

function buildShippingSummaryForWhatsApp(
  quotes: WhatsAppShippingOption[],
  selected: WhatsAppShippingOption,
  subtotal: number
): string {
  let msg = `🚚 *Frete calculado para o seu CEP:*\n`;
  quotes.slice(0, 3).forEach((q) => {
    const isSel = q.id === selected.id && q.name === selected.name;
    const priceLabel =
      q.effectivePrice === 0
        ? `*FRETE GRÁTIS* 🎉 _(de ${formatBRL(q.price)})_`
        : `*${formatBRL(q.effectivePrice)}*`;
    const eta = q.delivery_time ? ` — até ${q.delivery_time} dias úteis` : '';
    msg += `${isSel ? '✅' : '•'} *${q.company} (${q.name}):* ${priceLabel}${eta}\n`;
  });

  const totalWithShipping = Math.round((subtotal + selected.effectivePrice) * 100) / 100;
  msg += `💰 *Total do Pedido com Frete:* *${formatBRL(totalWithShipping)}*\n`;
  if (quotes.length > 1) {
    msg += `_(Deixamos a opção mais econômica pré-selecionada, e você também poderá trocar no link de pagamento se preferir!)_`;
  }
  return msg;
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
        address_json, items_json, shipping_method, shipping_service_id, shipping_price,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending_review', NOW(), NOW())`,
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
        session.customer.shippingMethod || null,
        session.customer.shippingServiceId ?? null,
        session.customer.shippingPrice !== undefined ? Number(session.customer.shippingPrice) : 0,
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

function isCatalogPdfRequest(norm: string): boolean {
  return (
    norm === 'ver catalogo' ||
    norm === 'catalogo' ||
    norm === 'pdf' ||
    norm === 'catalogo pdf' ||
    norm === 'ver todos' ||
    norm === 'todos os produtos' ||
    norm.includes('ver catalogo') ||
    norm.includes('mandar catalogo') ||
    norm.includes('enviar catalogo') ||
    norm.includes('mostrar catalogo') ||
    norm.includes('catalogo em pdf')
  );
}

/**
 * Identifica se o cliente digitou diretamente o NOME de um produto específico (ou seu número),
 * diferenciando de quando ele descreve um sintoma, necessidade ou categoria ampla ("manchas", "foliculite", "sabonetes").
 */
function matchSpecificProductByName(
  rawText: string,
  products: CatalogProduct[]
): CatalogProduct | undefined {
  const norm = normalizeStr(rawText);
  if (!norm) return undefined;

  // 1. Número direto do item no catálogo ("1", "2"...)
  const numMatch = norm.match(/^(\d+)$/);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < products.length) {
      return products[idx];
    }
  }

  // Remove prefixos conversacionais de escolha ("quero o ", "vou levar o ", "escolho ", etc.)
  const cleaned = norm
    .replace(
      /^(?:eu\s+)?(?:quero\s+comprar\s+|quero\s+levar\s+|quero\s+|gostaria\s+de\s+comprar\s+|gostaria\s+do\s+|gostaria\s+da\s+|me\s+ve\s+|escolho\s+|vou\s+querer\s+|prefiro\s+)?(?:o\s+|a\s+|os\s+|as\s+|um\s+|uma\s+)?/i,
      ''
    )
    .replace(/[?.!]+$/g, '')
    .trim();

  // 2. Match exato pelo nome ou slug do produto
  const exact = products.find(
    (p) =>
      normalizeStr(p.name) === norm ||
      normalizeStr(p.name) === cleaned ||
      normalizeStr(p.slug) === norm ||
      normalizeStr(p.slug) === cleaned
  );
  if (exact) return exact;

  // 3. Se a frase tem estrutura de dúvida/necessidade ("o que tem para...", "tenho manchas", "algo para acne")
  // ou é apenas um termo genérico de sintoma/categoria, tratamos como busca consultiva (retorna undefined aqui)
  const isConsultativeQuestion =
    /\b(o que|qual|quais|algum|alguma|algo para|algo pra|bom para|bom pra|serve para|indica|indicar|sugere|sugestao|tenho|estou com|minha pele|meu cabelo|tratamento|como clarear|preciso de algo|procuro|ajuda para|cuidar)\b/.test(
      norm
    );

  const genericNeedOrCategoryTerms = new Set([
    'mancha',
    'manchas',
    'melasma',
    'clarear',
    'clareamento',
    'foliculite',
    'pelo encravado',
    'pelos encravados',
    'acne',
    'espinha',
    'espinhas',
    'cravo',
    'cravos',
    'oleosidade',
    'pele oleosa',
    'pele seca',
    'pele ressecada',
    'pele sensivel',
    'pele madura',
    'hidratacao',
    'hidratar',
    'hidratante',
    'cabelo',
    'cabelos',
    'queda de cabelo',
    'queda capilar',
    'crescimento capilar',
    'frizz',
    'intimo',
    'cuidado intimo',
    'higiene intima',
    'corrimento',
    'pes',
    'pe rachado',
    'pes rachados',
    'rachadura',
    'rachaduras',
    'calcanhar',
    'ansiedade',
    'sono',
    'insonia',
    'dormir',
    'relaxar',
    'relaxamento',
    'aromaterapia',
    'estrias',
    'cicatriz',
    'rugas',
    'sabonete',
    'sabonetes',
    'sabonete natural',
    'sabonetes naturais',
    'oleo',
    'oleos',
    'oleo vegetal',
    'oleos vegetais',
    'oleo essencial',
    'oleos essenciais',
    'creme',
    'cremes',
    'kit',
    'kits',
    'atacado',
    'revenda',
  ]);

  if (genericNeedOrCategoryTerms.has(cleaned) || genericNeedOrCategoryTerms.has(norm)) {
    return undefined;
  }

  // 4. Mapa de apelidos/nomes diretos de produtos específicos da Ecosopis
  const specificSlugAliases: Array<{ slug: string; aliases: string[] }> = [
    {
      slug: 'kit-clareamento',
      aliases: ['kit clareamento', 'kit clareador', 'kit super clareador'],
    },
    {
      slug: 'kit-acne',
      aliases: ['kit acne', 'kit anti acne', 'kit para acne', 'kit oleosidade'],
    },
    {
      slug: 'kit-acafrao-argila',
      aliases: ['kit acafrao', 'kit acafrao e argila', 'kit sabonetes'],
    },
    {
      slug: 'sabonete-acafrao-dolomita',
      aliases: [
        'sabonete de acafrao',
        'sabonete acafrao',
        'acafrao e dolomita',
        'acafrao dolomita',
        'sabonete curcuma',
      ],
    },
    {
      slug: 'sabonete-clareador-argila-branca',
      aliases: [
        'sabonete clareador',
        'sabonete super clareador',
        'sabonete de argila branca',
        'sabonete argila branca',
        'argila branca',
      ],
    },
    {
      slug: 'sabonete-argila-verde',
      aliases: ['sabonete de argila verde', 'sabonete argila verde', 'argila verde'],
    },
    {
      slug: 'sabonete-carvao-ativado',
      aliases: ['sabonete de carvao', 'sabonete carvao ativado', 'carvao ativado', 'carvao e calendula'],
    },
    {
      slug: 'sabonete-rosa-mosqueta-argila-rosa',
      aliases: [
        'sabonete de rosa mosqueta',
        'sabonete rosa mosqueta',
        'sabonete de argila rosa',
        'sabonete argila rosa',
        'argila rosa',
      ],
    },
    {
      slug: 'sabonete-liquido-barbatimao',
      aliases: ['sabonete liquido', 'sabonete liquido barbatimao', 'sabonete liquido de barbatimao'],
    },
    {
      slug: 'sabonete-intimo-barbatimao',
      aliases: ['sabonete intimo', 'sabonete de barbatimao', 'sabonete barbatimao'],
    },
    {
      slug: 'creme-pes-de-anjo',
      aliases: ['pes de anjo', 'creme pes de anjo', 'creme para os pes', 'creme para rachaduras'],
    },
    {
      slug: 'creme-oleosidade-acne',
      aliases: [
        'creme facial',
        'creme anti oleosidade',
        'creme para oleosidade',
        'creme oleosidade e acne',
        'creme de acne',
      ],
    },
    {
      slug: 'desodorante-clareador-solido',
      aliases: ['desodorante', 'desodorante clareador', 'desodorante solido', 'desodorante natural'],
    },
    {
      slug: 'tonico-facial-antioxidante',
      aliases: ['tonico', 'tonico facial', 'tonico antioxidante'],
    },
    {
      slug: 'manteiga-ojon',
      aliases: ['manteiga de ojon', 'manteiga ojon', 'ojon'],
    },
    {
      slug: 'refil-rosa-mosqueta',
      aliases: ['refil rosa mosqueta', 'refil de rosa mosqueta'],
    },
    {
      slug: 'oleo-rosa-mosqueta-20ml',
      aliases: ['rosa mosqueta 20ml', 'oleo rosa mosqueta 20ml', 'rosa mosqueta canina'],
    },
    {
      slug: 'oleo-rosa-mosqueta-puro',
      aliases: [
        'oleo de rosa mosqueta',
        'oleo rosa mosqueta',
        'rosa mosqueta puro',
        'rosa mosqueta rubiginosa',
        'rosa mosqueta',
      ],
    },
    {
      slug: 'oleo-alecrim',
      aliases: ['oleo de alecrim', 'oleo alecrim', 'oleo vegetal de alecrim'],
    },
    {
      slug: 'oleo-ricino',
      aliases: ['oleo de ricino', 'oleo ricino', 'ricino'],
    },
    {
      slug: 'oleo-abacate',
      aliases: ['oleo de abacate', 'oleo abacate'],
    },
    {
      slug: 'oleo-argan',
      aliases: ['oleo de argan', 'oleo argan', 'argan'],
    },
    {
      slug: 'oleo-semente-uva',
      aliases: ['oleo de semente de uva', 'semente de uva', 'oleo semente de uva'],
    },
    {
      slug: 'oe-lavanda',
      aliases: ['oleo essencial de lavanda', 'oleo de lavanda', 'oe lavanda', 'lavanda francesa', 'lavanda'],
    },
    {
      slug: 'oe-melaleuca',
      aliases: ['oleo essencial de melaleuca', 'oleo de melaleuca', 'oe melaleuca', 'melaleuca', 'tea tree'],
    },
    {
      slug: 'oe-menta',
      aliases: ['oleo essencial de menta', 'oleo de menta', 'menta piperita', 'oe menta', 'menta'],
    },
    {
      slug: 'oe-laranja',
      aliases: ['oleo essencial de laranja', 'oleo de laranja', 'laranja doce', 'oe laranja'],
    },
  ];

  if (!isConsultativeQuestion) {
    for (const entry of specificSlugAliases) {
      if (entry.aliases.some((alias) => cleaned === alias || cleaned.includes(alias))) {
        const found = products.find((p) => normalizeStr(p.slug) === entry.slug);
        if (found) return found;
      }
    }

    // 5. Match aproximado pelo nome de qualquer produto cadastrado no banco
    const stopWords = new Set(['de', 'da', 'do', 'dos', 'das', 'para', 'com', 'sem', 'puro', 'natural']);
    const userTokens = cleaned.split(/\s+/).filter((w) => w.length >= 3 && !stopWords.has(w));
    if (userTokens.length >= 1) {
      // Se o nome do produto contém o texto limpo (e o texto tem pelo menos 5 letras e aponta para 1 único produto)
      const substringMatches = products.filter(
        (p) =>
          cleaned.length >= 5 &&
          (normalizeStr(p.name).includes(cleaned) ||
            userTokens.every((t) => normalizeStr(p.name).includes(t)))
      );
      if (substringMatches.length === 1) {
        return substringMatches[0];
      }
    }
  }

  return undefined;
}

/**
 * Motor Consultivo da IA (Lia): analisa o que a pessoa procura (necessidade, sintoma, tipo de pele ou categoria)
 * e sugere os melhores produtos com explicação personalizada + opção de digitar o nome do produto ou VER CATÁLOGO (PDF).
 */
function buildConsultativeRecommendationMessage(
  rawText: string,
  products: CatalogProduct[]
): string {
  const norm = normalizeStr(rawText);

  interface NeedProfile {
    label: string;
    intro: string;
    slugs: string[];
    keywords: string[];
  }

  const profiles: NeedProfile[] = [
    {
      label: 'Foliculite & Pelos Encravados',
      intro:
        'Para cuidar de *foliculite, pelos encravados e irritações pós-depilação*, estas são as nossas fórmulas naturais mais amadas:',
      slugs: ['sabonete-acafrao-dolomita', 'kit-acafrao-argila', 'sabonete-clareador-argila-branca'],
      keywords: ['foliculite', 'pelo', 'encravado', 'depilacao', 'depilar', 'virilha', 'bumbum', 'barba', 'acafrao', 'curcuma'],
    },
    {
      label: 'Clareamento de Manchas & Melasma',
      intro:
        'Para *clarear manchas, melasma, marcas de acne ou áreas escurecidas* e devolver o viço à pele, recomendo:',
      slugs: [
        'sabonete-clareador-argila-branca',
        'oleo-rosa-mosqueta-puro',
        'kit-clareamento',
        'desodorante-clareador-solido',
      ],
      keywords: ['mancha', 'manchas', 'clarear', 'clareamento', 'clareador', 'melasma', 'uniformizar', 'escura', 'escurecida'],
    },
    {
      label: 'Acne, Espinhas & Controle de Oleosidade',
      intro:
        'Para *controlar a oleosidade, secar espinhas e desobstruir os poros* sem efeito rebote, indico:',
      slugs: [
        'sabonete-argila-verde',
        'sabonete-carvao-ativado',
        'creme-oleosidade-acne',
        'oe-melaleuca',
        'kit-acne',
      ],
      keywords: ['acne', 'espinha', 'espinhas', 'cravo', 'cravos', 'oleosidade', 'oleosa', 'poros', 'brilho'],
    },
    {
      label: 'Hidratação, Pele Seca, Sensível ou Madura',
      intro:
        'Para *nutrir profundamente, regenerar peles secas/maduras e suavizar linhas finas*, estas opções são perfeitas:',
      slugs: [
        'sabonete-rosa-mosqueta-argila-rosa',
        'oleo-rosa-mosqueta-puro',
        'oleo-semente-uva',
        'oleo-abacate',
        'tonico-facial-antioxidante',
      ],
      keywords: ['seca', 'ressecada', 'ressecamento', 'hidratar', 'hidratacao', 'hidratante', 'madura', 'sensivel', 'rugas', 'linhas', 'estrias', 'cicatriz', 'dermatite'],
    },
    {
      label: 'Cuidado Capilar, Queda & Crescimento dos Fios',
      intro:
        'Para *fortalecer os cabelos, combater a queda, estimular o crescimento e nutrir os fios*, indico:',
      slugs: ['oleo-alecrim', 'oleo-ricino', 'manteiga-ojon', 'oleo-argan', 'oleo-abacate'],
      keywords: ['cabelo', 'cabelos', 'capilar', 'queda', 'crescimento', 'crescer', 'fio', 'fios', 'frizz', 'couro cabeludo', 'sobrancelha', 'umectacao'],
    },
    {
      label: 'Cuidado Íntimo Natural & Barbatimão',
      intro:
        'Para o *cuidado íntimo diário com pH equilibrado, frescor e proteção natural*, temos:',
      slugs: ['sabonete-intimo-barbatimao', 'sabonete-liquido-barbatimao'],
      keywords: ['intimo', 'intima', 'barbatimao', 'corrimento', 'coceira', 'ginecologico'],
    },
    {
      label: 'Pés Rachados & Ressecamento Intenso',
      intro:
        'Para *recuperar calcanhares rachados e hidratar profundamente os pés*, este produto é transformador:',
      slugs: ['creme-pes-de-anjo', 'oleo-abacate'],
      keywords: ['pe', 'pes', 'rachadura', 'rachaduras', 'calcanhar', 'calcanhares', 'aspero'],
    },
    {
      label: 'Desodorante Natural & Clareamento de Axilas',
      intro:
        'Para *proteger contra odores por 24h sem alumínio e clarear as axilas naturalmente*, indico:',
      slugs: ['desodorante-clareador-solido', 'sabonete-clareador-argila-branca'],
      keywords: ['axila', 'axilas', 'suor', 'odor', 'transpiracao', 'aluminio', 'desodorante'],
    },
    {
      label: 'Relaxamento, Sono, Bem-Estar & Aromaterapia',
      intro:
        'Para *relaxar, melhorar o sono, aliviar a ansiedade ou aromatizar seu ambiente*, recomendo nossos Óleos Essenciais 100% puros:',
      slugs: ['oe-lavanda', 'oe-laranja', 'oe-menta', 'oe-melaleuca'],
      keywords: ['relaxar', 'relaxamento', 'sono', 'dormir', 'insonia', 'ansiedade', 'estresse', 'foco', 'respiracao', 'difusor', 'aroma', 'aromaterapia', 'essencial', 'essenciais'],
    },
    {
      label: 'Sabonetes Naturais & Fitoterápicos',
      intro:
        'Nossos *Sabonetes Botânicos* são os queridinhos da Ecosopis! Veja qual combina mais com a sua pele:',
      slugs: [
        'sabonete-acafrao-dolomita',
        'sabonete-clareador-argila-branca',
        'sabonete-argila-verde',
        'sabonete-rosa-mosqueta-argila-rosa',
        'sabonete-intimo-barbatimao',
      ],
      keywords: ['sabonete', 'sabonetes', 'banho', 'rosto', 'limpeza'],
    },
    {
      label: 'Óleos Vegetais 100% Puros',
      intro:
        'Nossos *Óleos Vegetais 100% Puros* prensados a frio são riquíssimos em nutrientes para pele e cabelos:',
      slugs: ['oleo-rosa-mosqueta-puro', 'oleo-alecrim', 'oleo-semente-uva', 'oleo-ricino', 'oleo-argan'],
      keywords: ['oleo', 'oleos', 'vegetal', 'vegetais'],
    },
    {
      label: 'Kits de Tratamento Completo',
      intro:
        'Nossos *Kits de Tratamento* reúnem as melhores combinações com desconto especial:',
      slugs: ['kit-clareamento', 'kit-acafrao-argila', 'kit-acne'],
      keywords: ['kit', 'kits', 'combo', 'rotina', 'completo'],
    },
  ];

  let matchedProfile: NeedProfile | null = null;
  let bestHitCount = 0;

  for (const prof of profiles) {
    const hits = prof.keywords.filter((kw) => norm.includes(kw)).length;
    if (hits > bestHitCount) {
      bestHitCount = hits;
      matchedProfile = prof;
    }
  }

  let suggestedProducts: CatalogProduct[] = [];
  let introText = '';

  if (matchedProfile) {
    introText = matchedProfile.intro;
    for (const slug of matchedProfile.slugs) {
      const p = products.find((item) => normalizeStr(item.slug) === slug);
      if (p && !suggestedProducts.some((s) => s.id === p.id)) {
        suggestedProducts.push(p);
      }
    }
  }

  // Se não caiu em um perfil predefinido, pontua produtos por palavras da mensagem em nome/benefícios/ingredientes/descrição
  if (suggestedProducts.length === 0) {
    const tokens = norm.split(/\s+/).filter((w) => w.length >= 3);
    const scored = products
      .map((p) => {
        const staticInfo = PRODUCT_STATIC_DATA[p.slug];
        const haystack = normalizeStr(
          `${p.name} ${p.category} ${p.description} ${p.benefits} ${p.ingredients} ${staticInfo?.ativos || ''} ${staticInfo?.beneficios || ''}`
        );
        let score = 0;
        for (const t of tokens) {
          if (haystack.includes(t)) score += 2;
        }
        return { product: p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      suggestedProducts = scored.slice(0, 4).map((x) => x.product);
      introText = `Encontrei estas opções perfeitas na *ECOSOPIS* para o que você procura:`;
    }
  }

  // Fallback para os Campeões de Vendas caso a mensagem seja muito aberta (ex: "me indica algum", "qual o mais vendido")
  if (suggestedProducts.length === 0) {
    const bestSellers = [
      'sabonete-acafrao-dolomita',
      'sabonete-clareador-argila-branca',
      'oleo-rosa-mosqueta-puro',
      'sabonete-argila-verde',
    ];
    for (const slug of bestSellers) {
      const p = products.find((item) => normalizeStr(item.slug) === slug);
      if (p) suggestedProducts.push(p);
    }
    if (suggestedProducts.length === 0) {
      suggestedProducts = products.slice(0, 4);
    }
    introText = `Separei os nossos *campeões de vendas da ECOSOPIS* para você conhecer:`;
  }

  suggestedProducts = suggestedProducts.slice(0, 4);

  let msg = `🌿 ${introText}\n\n`;
  suggestedProducts.forEach((p) => {
    const price = getEffectivePrice(p);
    const staticInfo = PRODUCT_STATIC_DATA[p.slug];
    const benefitText = (
      staticInfo?.frase_decisao ||
      staticInfo?.beneficios ||
      p.benefits ||
      p.description ||
      'Cosmético 100% natural e vegano.'
    )
      .replace(/\r?\n+/g, ' ')
      .replace(/[•*]/g, '')
      .trim();
    const shortBenefit = benefitText.length > 125 ? `${benefitText.slice(0, 122)}...` : benefitText;

    msg += `✨ *${p.name}* — *${formatBRL(price)}*\n`;
    msg += `   _${shortBenefit}_\n\n`;
  });

  const exampleName = suggestedProducts[0]?.name || 'Sabonete de Açafrão';
  msg += `🛍️ *Gostou de alguma dessas opções?*\n`;
  msg += `👉 Para comprar, basta digitar aqui o *nome do produto* (ex: *${exampleName}*)!\n\n`;
  msg += `💬 _Se quiser outra sugestão, me conte mais sobre o que procura._\n`;
  msg += `📖 *Quer ver todos os produtos com fotos?* Digite *VER CATÁLOGO* que eu te envio o *PDF com prints de todos os produtos*!`;

  return msg;
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
  if (pushName && !session.customer.name && pushName.length >= 3) {
    session.customer.name = pushName;
  }

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
        `✅ Seu atendimento de compra foi encerrado e o carrinho limpo.\n\nSempre que quiser fazer um novo pedido pelo WhatsApp, basta enviar *COMPRAR* ou *VER CATÁLOGO*! 🌿`,
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

  // Se o cliente pediu explicitamente para VER CATÁLOGO / PDF em qualquer momento
  const wantsPdfCatalog = isCatalogPdfRequest(norm);
  if (wantsPdfCatalog) {
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

    enqueueSafeCommerceCatalogPdf(sock, remoteJid, products, session.customer.name);
    return true;
  }

  // Gatilhos para iniciar compra com a IA consultiva ("O que você procura?")
  const isBuyTrigger =
    norm === 'comprar' ||
    norm === 'produtos' ||
    norm === 'cardapio' ||
    norm === 'loja' ||
    norm === 'menu' ||
    norm === 'quero comprar' ||
    norm === 'fazer pedido' ||
    norm.startsWith('comprar ') ||
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

    // Se a pessoa já escreveu "comprar sabonete de açafrão", tenta identificar o produto direto
    if (norm.startsWith('comprar ') && norm.length > 9) {
      const restQuery = rawText.replace(/^\s*comprar\s+/i, '').trim();
      const directProd = matchSpecificProductByName(restQuery, products);
      if (directProd) {
        session.selectedProductId = directProd.id;
        session.step = 'AWAITING_QUANTITY';
        await saveSession(session);
        enqueueSafeCommerceReply(
          sock,
          remoteJid,
          buildProductExplanationMessage(directProd),
          session.customer.name
        );
        return true;
      }
    }

    const greeting = buildConsultativeGreetingMessage(session.customer.name);
    enqueueSafeCommerceReply(sock, remoteJid, greeting, session.customer.name);
    return true;
  }

  // Se o cliente não está em uma sessão ativa de compra, deixa o fluxo padrão responder
  if (session.step === 'IDLE') {
    return false;
  }

  const products = await getActiveCatalogProducts();

  // ── ETAPA 1: CONSULTORIA IA ("O QUE VOCÊ PROCURA?") OU ESCOLHA PELO NOME ──
  if (session.step === 'AWAITING_PRODUCT') {
    const chosen = matchSpecificProductByName(rawText, products);

    if (chosen) {
      session.selectedProductId = chosen.id;
      session.step = 'AWAITING_QUANTITY';
      await saveSession(session);

      const explanation = buildProductExplanationMessage(chosen);
      enqueueSafeCommerceReply(sock, remoteJid, explanation, session.customer.name);
      return true;
    }

    // Não foi o nome exato de 1 produto: a IA atua como consultora sugerindo produtos para o que a pessoa procura!
    const suggestionReply = buildConsultativeRecommendationMessage(rawText, products);
    enqueueSafeCommerceReply(sock, remoteJid, suggestionReply, session.customer.name);
    return true;
  }

  // ── ETAPA 2: ESCOLHA DA QUANTIDADE ─────────────────────────────────────────
  if (session.step === 'AWAITING_QUANTITY') {
    if (norm === 'voltar' || norm === '0' || norm === 'outro' || norm === 'trocar') {
      session.step = 'AWAITING_PRODUCT';
      session.selectedProductId = null;
      await saveSession(session);
      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        `🌿 Sem problemas! Me conte *o que você procura* ou digite o *nome de outro produto* (ou envie *VER CATÁLOGO* para receber o PDF com fotos de todos os produtos):`,
        session.customer.name
      );
      return true;
    }

    // Se em vez de número o cliente digitou o nome de outro produto, troca para o novo produto!
    const switchedProduct = matchSpecificProductByName(rawText, products);
    if (switchedProduct && !/^\d+$/.test(norm)) {
      session.selectedProductId = switchedProduct.id;
      session.step = 'AWAITING_QUANTITY';
      await saveSession(session);
      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        buildProductExplanationMessage(switchedProduct),
        session.customer.name
      );
      return true;
    }

    const qtyMatch = norm.match(/(\d+)/);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : NaN;
    if (!qty || isNaN(qty) || qty < 1 || qty > 200) {
      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        `🔢 Por favor, digite apenas a *quantidade desejada* em números (ex: *1*, *2*, *3*...) ou digite *VER CATÁLOGO* para escolher outro produto.`,
        session.customer.name
      );
      return true;
    }

    const product = products.find(p => p.id === session.selectedProductId);
    if (!product) {
      session.step = 'AWAITING_PRODUCT';
      await saveSession(session);
      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        buildConsultativeGreetingMessage(session.customer.name),
        session.customer.name
      );
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
      `2️⃣ Digite *2* (ou *MAIS*) para buscar outro produto ou ver o catálogo`;

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
      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        `🌿 *Ótimo! O que mais você gostaria de adicionar ao seu pedido?*\n\n👉 Digite o *nome do produto*, me conte *o que procura cuidar* para eu te sugerir opções, ou digite *VER CATÁLOGO* para receber o *PDF com fotos de todos os produtos*!`,
        session.customer.name
      );
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

    // Se o cliente digitou diretamente o nome de outro produto nessa etapa, já seleciona!
    const directMoreProduct = matchSpecificProductByName(rawText, products);
    if (directMoreProduct) {
      session.selectedProductId = directMoreProduct.id;
      session.step = 'AWAITING_QUANTITY';
      await saveSession(session);
      enqueueSafeCommerceReply(
        sock,
        remoteJid,
        buildProductExplanationMessage(directMoreProduct),
        session.customer.name
      );
      return true;
    }

    enqueueSafeCommerceReply(
      sock,
      remoteJid,
      `Por favor, escolha uma opção:\n1️⃣ Digite *1* para *FECHAR O PEDIDO*\n2️⃣ Digite *2* para *ADICIONAR MAIS PRODUTOS* (ou digite *VER CATÁLOGO* para ver o PDF completo)`,
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

  // ── ETAPA 4B: CEP DE ENTREGA + CÁLCULO DE FRETE NO WHATSAPP ────────────────
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
    const [lookedUp, shippingCalc] = await Promise.all([
      lookupCep(cepDigits),
      calculateShippingForWhatsApp(cepDigits, session.cart),
    ]);

    const bestShipping = shippingCalc.selected;
    session.customer.shippingMethod = `${bestShipping.company} - ${bestShipping.name}`;
    session.customer.shippingServiceId = bestShipping.id;
    session.customer.shippingPrice = bestShipping.effectivePrice;
    session.customer.shippingDeliveryTime = bestShipping.delivery_time;

    const { subtotal } = calculateCartTotals(session.cart);
    const shippingText = buildShippingSummaryForWhatsApp(
      shippingCalc.options,
      bestShipping,
      subtotal
    );

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
        `🏠 *Endereço localizado:*\n*${lookedUp.street} - ${lookedUp.neighborhood}, ${lookedUp.city}/${lookedUp.state}*\n\n${shippingText}\n\n👉 Digite agora o *Número da residência* (e complemento, se houver — ex: *150, Apto 42*):`,
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
      `📍 CEP *${cepDigits}* registrado!\n\n${shippingText}\n\n👉 Por favor, envie em uma única mensagem sua *Rua, Número e Bairro* (ex: *Rua das Flores, 120, Centro*):`,
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

    // Garante que o frete esteja calculado caso ainda não tenha sido preenchido
    if (session.customer.shippingPrice === undefined && session.customer.cep) {
      const calc = await calculateShippingForWhatsApp(session.customer.cep, session.cart);
      session.customer.shippingMethod = `${calc.selected.company} - ${calc.selected.name}`;
      session.customer.shippingServiceId = calc.selected.id;
      session.customer.shippingPrice = calc.selected.effectivePrice;
      session.customer.shippingDeliveryTime = calc.selected.delivery_time;
    }

    const { checkoutUrl } = await createWhatsAppCheckoutToken(session);
    const summary = buildCartSummaryText(session.cart);
    const { subtotal } = calculateCartTotals(session.cart);
    const shipPrice = Number(session.customer.shippingPrice || 0);
    const shipMethod = session.customer.shippingMethod || 'Correios';
    const shipEta = session.customer.shippingDeliveryTime
      ? ` _(até ${session.customer.shippingDeliveryTime} dias úteis)_`
      : '';
    const shipDisplay = shipPrice === 0 ? `*FRETE GRÁTIS* 🎉` : `*${formatBRL(shipPrice)}*`;
    const totalWithShip = Math.round((subtotal + shipPrice) * 100) / 100;

    // Reseta a sessão após gerar o link para que o cliente possa iniciar nova compra quando quiser
    const finalName = session.customer.name || 'Cliente';
    session.step = 'IDLE';
    session.selectedProductId = null;
    session.cart = [];
    await saveSession(session);

    const finalMessage =
      `🎉 *Pedido Pronto para Revisão e Pagamento, ${finalName}!*\n\n` +
      `${summary}\n` +
      `🚚 *Frete (${shipMethod}):* ${shipDisplay}${shipEta}\n` +
      `💰 *Total Final (Produtos + Frete):* *${formatBRL(totalWithShip)}*\n\n` +
      `👤 *Cliente:* ${finalName}\n` +
      `📍 *Entrega:* ${session.customer.street}, ${session.customer.number}${session.customer.complement ? ` (${session.customer.complement})` : ''} - ${session.customer.neighborhood}, ${session.customer.city}/${session.customer.state} (CEP ${session.customer.cep})\n\n` +
      `🔒 *Acesse seu Link Exclusivo da Ecosopis abaixo para revisar o pedido e finalizar o pagamento (PIX, Cartão em até 12x, PIX + Cartão ou Boleto):*\n` +
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

    if (session.customer.shippingPrice === undefined && session.customer.cep) {
      const calc = await calculateShippingForWhatsApp(session.customer.cep, session.cart);
      session.customer.shippingMethod = `${calc.selected.company} - ${calc.selected.name}`;
      session.customer.shippingServiceId = calc.selected.id;
      session.customer.shippingPrice = calc.selected.effectivePrice;
      session.customer.shippingDeliveryTime = calc.selected.delivery_time;
    }

    const { checkoutUrl } = await createWhatsAppCheckoutToken(session);
    const summary = buildCartSummaryText(session.cart);
    const { subtotal } = calculateCartTotals(session.cart);
    const shipPrice = Number(session.customer.shippingPrice || 0);
    const shipMethod = session.customer.shippingMethod || 'Correios';
    const shipEta = session.customer.shippingDeliveryTime
      ? ` _(até ${session.customer.shippingDeliveryTime} dias úteis)_`
      : '';
    const shipDisplay = shipPrice === 0 ? `*FRETE GRÁTIS* 🎉` : `*${formatBRL(shipPrice)}*`;
    const totalWithShip = Math.round((subtotal + shipPrice) * 100) / 100;

    const finalName = session.customer.name || 'Cliente';
    session.step = 'IDLE';
    session.selectedProductId = null;
    session.cart = [];
    await saveSession(session);

    const finalMessage =
      `🎉 *Pedido Pronto para Revisão e Pagamento, ${finalName}!*\n\n` +
      `${summary}\n` +
      `🚚 *Frete (${shipMethod}):* ${shipDisplay}${shipEta}\n` +
      `💰 *Total Final (Produtos + Frete):* *${formatBRL(totalWithShip)}*\n\n` +
      `👤 *Cliente:* ${finalName}\n` +
      `📍 *Entrega:* ${session.customer.street}, ${session.customer.number} - ${session.customer.neighborhood}, ${session.customer.city}/${session.customer.state} (CEP ${session.customer.cep})\n\n` +
      `🔒 *Acesse seu Link Exclusivo da Ecosopis abaixo para revisar seus dados e finalizar o pagamento (PIX, Cartão em até 12x, PIX + Cartão ou Boleto):*\n` +
      `👉 ${checkoutUrl}\n\n` +
      `_Assim que o pagamento for confirmado, você receberá a confirmação e o código de rastreio automaticamente por aqui!_ 🌿✨`;

    enqueueSafeCommerceReply(sock, remoteJid, finalMessage, finalName);
    return true;
  }

  return false;
}

