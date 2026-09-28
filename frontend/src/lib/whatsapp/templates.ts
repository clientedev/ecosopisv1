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

/**
 * Busca todos os templates configurados
 */
export async function getWhatsAppTemplates(): Promise<WhatsAppTemplateItem[]> {
  const pool = getDbPool();
  try {
    const res = await pool.query(
      `SELECT id, trigger_type, title, message_template, is_enabled, delay_minutes 
       FROM whatsapp_templates 
       ORDER BY id ASC`
    );
    return res.rows;
  } catch (e) {
    console.error('Erro ao buscar templates do WhatsApp:', e);
    return [];
  }
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
  const pool = getDbPool();
  await pool.query(
    `UPDATE whatsapp_templates 
     SET message_template = $1, is_enabled = $2, delay_minutes = $3, updated_at = NOW() 
     WHERE trigger_type = $4`,
    [messageTemplate, isEnabled, delayMinutes, triggerType]
  );
  return { success: true };
}

/**
 * Busca o histórico das últimas mensagens enviadas
 */
export async function getWhatsAppMessageLogs(limit: number = 50) {
  const pool = getDbPool();
  try {
    const res = await pool.query(
      `SELECT id, to_phone, recipient_name, message, trigger_type, status, error, created_at 
       FROM whatsapp_message_logs 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  } catch (e) {
    console.error('Erro ao buscar logs do WhatsApp:', e);
    return [];
  }
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
