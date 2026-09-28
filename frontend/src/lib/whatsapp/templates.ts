import { getDbPool } from './db';
import { sendWhatsAppMessage } from './whatsappService';

export interface WhatsAppTemplateItem {
  id: number;
  trigger_type: string;
  title: string;
  message_template: string;
  is_enabled: boolean;
  delay_minutes: number;
}

const DEFAULT_TEMPLATES: WhatsAppTemplateItem[] = [
  {
    id: 1,
    trigger_type: 'order_paid',
    title: 'Pagamento Confirmado',
    message_template: 'Olá {cliente}! Seu pagamento do pedido #{pedido} no valor de R$ {valor} foi confirmado com sucesso! Itens: {itens}. Em breve enviaremos as atualizações de envio. 🌿',
    is_enabled: true,
    delay_minutes: 0
  },
  {
    id: 2,
    trigger_type: 'order_created_pix',
    title: 'Pedido Gerado (Chave PIX)',
    message_template: 'Olá {cliente}! Seu pedido #{pedido} foi registrado com sucesso. Copie a chave PIX abaixo para pagar com rapidez e garantir seus produtos naturais:\n\n{pix_copia_cola}',
    is_enabled: true,
    delay_minutes: 0
  },
  {
    id: 3,
    trigger_type: 'order_shipped',
    title: 'Pedido Despachado (Rastreio)',
    message_template: 'Boas notícias, {cliente}! Seu pedido #{pedido} da ECOSOPIS já foi despachado para entrega. Acompanhe pelo código de rastreio: {codigo_rastreio} 🚚📦',
    is_enabled: true,
    delay_minutes: 0
  },
  {
    id: 4,
    trigger_type: 'abandoned_cart',
    title: 'Recuperação de Carrinho',
    message_template: 'Olá {cliente}, notamos que você deixou seus cosméticos favoritos no carrinho! Conclua agora com o cupom {desconto} e ganhe desconto especial: {link_carrinho}',
    is_enabled: true,
    delay_minutes: 60
  },
  {
    id: 5,
    trigger_type: 'promotion',
    title: 'Aproveite a Promoção',
    message_template: 'Olá {cliente}! Temos novidades exclusivas de autocuidado natural para você na ECOSOPIS. Use o cupom {cupom} e aproveite agora: {link}',
    is_enabled: true,
    delay_minutes: 0
  }
];

let inMemoryTemplates: WhatsAppTemplateItem[] = [...DEFAULT_TEMPLATES];

/**
 * Busca todos os templates configurados
 */
export async function getWhatsAppTemplates(): Promise<WhatsAppTemplateItem[]> {
  try {
    const pool = getDbPool();
    if (pool) {
      const res = await pool.query(
        `SELECT id, trigger_type, title, message_template, is_enabled, delay_minutes 
         FROM whatsapp_templates 
         ORDER BY id ASC`
      );
      if (res.rows && res.rows.length > 0) {
        return res.rows;
      }
    }
  } catch (e) {
    console.warn('PostgreSQL indisponível para templates, usando padrão em memória:', (e as any).message);
  }
  return inMemoryTemplates;
}

/**
 * Atualiza um template de mensagem
 */
export async function updateWhatsAppTemplate(
  triggerType: string,
  messageTemplate: string,
  isEnabled: boolean,
  delayMinutes: number = 0
) {
  // Atualiza em memória
  const item = inMemoryTemplates.find(t => t.trigger_type === triggerType);
  if (item) {
    item.message_template = messageTemplate;
    item.is_enabled = isEnabled;
    item.delay_minutes = delayMinutes;
  }

  try {
    const pool = getDbPool();
    if (pool) {
      await pool.query(
        `UPDATE whatsapp_templates 
         SET message_template = $1, is_enabled = $2, delay_minutes = $3, updated_at = NOW() 
         WHERE trigger_type = $4`,
        [messageTemplate, isEnabled, delayMinutes, triggerType]
      );
    }
  } catch (e) {
    console.warn('Aviso ao persistir template no banco:', (e as any).message);
  }
  return { success: true };
}

/**
 * Busca o histórico das últimas mensagens enviadas
 */
export async function getWhatsAppMessageLogs(limit: number = 50) {
  try {
    const pool = getDbPool();
    if (pool) {
      const res = await pool.query(
        `SELECT id, to_phone, recipient_name, message, trigger_type, status, error, created_at 
         FROM whatsapp_message_logs 
         ORDER BY created_at DESC 
         LIMIT $1`,
        [limit]
      );
      return res.rows || [];
    }
  } catch (e) {
    console.warn('Aviso ao buscar logs no banco:', (e as any).message);
  }
  return [];
}

/**
 * Processa as tags dinâmicas de um template e retorna o texto final personalizado
 */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`{${key}}`, 'gi');
    rendered = rendered.replace(regex, String(value || ''));
  }
  return rendered;
}

/**
 * FUNÇÃO AUXILIAR REUTILIZÁVEL SOLICITADA (Item 6):
 * Dispara notificação via WhatsApp para qualquer evento do e-commerce.
 */
export async function sendWhatsAppNotification(
  phone: string,
  message: string,
  triggerType: string = 'manual',
  recipientName: string = ''
) {
  return await sendWhatsAppMessage(phone, message, triggerType, recipientName);
}
