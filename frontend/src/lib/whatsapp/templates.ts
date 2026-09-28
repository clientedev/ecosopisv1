import { getDbPool } from './db';
import { sendWhatsAppMessage } from './whatsappService';

export interface WhatsAppTemplateItem {
  id: number;
  trigger_type: string;
  title: string;
  category?: string;
  message_template: string;
  is_enabled: boolean;
  delay_minutes: number;
}

const DEFAULT_TEMPLATES: WhatsAppTemplateItem[] = [
  {
    id: 1,
    trigger_type: 'order_paid',
    title: 'Pagamento Confirmado',
    category: 'Vendas',
    message_template: 'Olá {cliente}! Seu pagamento do pedido #{pedido} no valor de R$ {valor} foi confirmado com sucesso! Itens: {itens}. Em breve enviaremos as atualizações de envio. 🌿✨',
    is_enabled: true,
    delay_minutes: 0
  },
  {
    id: 2,
    trigger_type: 'order_shipped',
    title: 'Pedido Despachado (Rastreio)',
    category: 'Logística',
    message_template: 'Boas notícias, {cliente}! Seu pedido #{pedido} da ECOSOPIS já foi despachado para entrega. Acompanhe seu pacote pelo código de rastreio: {codigo_rastreio} 🚚📦',
    is_enabled: true,
    delay_minutes: 0
  },
  {
    id: 3,
    trigger_type: 'order_delivered',
    title: 'Pedido Entregue & Avaliação',
    category: 'Pós-Venda',
    message_template: 'Oi {cliente}! Consta que seu pedido #{pedido} da ECOSOPIS acabou de chegar! Esperamos que ame seus cosméticos. Quando puder, conta pra gente o que achou avaliando no site: {link_avaliacao} ⭐🌿',
    is_enabled: true,
    delay_minutes: 60
  },
  {
    id: 4,
    trigger_type: 'abandoned_cart',
    title: 'Recuperação de Carrinho Abandonado',
    category: 'Conversão',
    message_template: 'Olá {cliente}! Notamos que você separou produtos incríveis na Ecosopis: {itens}. Para te dar uma ajudinha, liberamos o cupom especial {desconto} para você concluir com desconto exclusivo: {link_carrinho} 💚',
    is_enabled: true,
    delay_minutes: 60
  },
  {
    id: 5,
    trigger_type: 'welcome_new_user',
    title: 'Boas-Vindas ao Novo Cadastro',
    category: 'Relacionamento',
    message_template: 'Seja muito bem-vindo(a) à ECOSOPIS, {cliente}! 🌱 Estamos felizes em ter você conosco na nossa jornada de autocuidado natural e vegano. Use o cupom {cupom} para 10% OFF no seu 1º pedido: {link}',
    is_enabled: true,
    delay_minutes: 0
  },
  {
    id: 6,
    trigger_type: 'post_purchase_care',
    title: 'Protocolo & Dicas de Uso',
    category: 'Pós-Venda',
    message_template: 'Oi {cliente}! Preparando seu momento de autocuidado com o {itens}? Dica de ouro da Ecosopis: aplique sobre a pele úmida em movimentos circulares para potencializar a ação dos ativos amazônicos! Qualquer dúvida, estamos aqui. 🧴✨',
    is_enabled: true,
    delay_minutes: 4320 // 3 dias
  },
  {
    id: 7,
    trigger_type: 'repurchase_reminder',
    title: 'Lembrete de Reposição (Recompra)',
    category: 'Retenção',
    message_template: 'Olá {cliente}! Seu estoque de autocuidado da ECOSOPIS deve estar chegando ao fim. Que tal repor seus queridinhos antes que acabem? Ganhe frete especial com o cupom {cupom}: {link}',
    is_enabled: true,
    delay_minutes: 43200 // 30 dias
  },
  {
    id: 8,
    trigger_type: 'cashback_expiring',
    title: 'Saldo de Cashback Expirando',
    category: 'Fidelização',
    message_template: 'Atenção {cliente}! Você possui R$ {valor} em saldo de cashback disponível na sua conta Ecosopis que vai expirar em breve. Aproveite para resgatar nas suas compras hoje: {link}',
    is_enabled: true,
    delay_minutes: 0
  },
  {
    id: 9,
    trigger_type: 'birthday_special',
    title: 'Presente de Aniversário',
    category: 'Relacionamento',
    message_template: 'Parabéns pelo seu dia, {cliente}! 🎂🎉 A ECOSOPIS deseja muita saúde, luz e momentos de paz. Preparamos um presente exclusivo para você: use o cupom {cupom} e ganhe 15% de desconto no seu mês: {link} 🎁',
    is_enabled: true,
    delay_minutes: 0
  },
  {
    id: 10,
    trigger_type: 'promotion',
    title: 'Promoção & Cupom Especial',
    category: 'Vendas',
    message_template: 'Olá {cliente}! Temos uma novidade imperdível de beleza sustentável para você na ECOSOPIS. Use o cupom {cupom} e garanta condições exclusivas por tempo limitado: {link} 🌿🛍️',
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
      // Remove permanentemente o template de Chave PIX se existir no banco
      pool.query(`DELETE FROM whatsapp_templates WHERE trigger_type = 'order_created_pix'`).catch(() => {});

      // Semeia novos templates que ainda não existem
      for (const tmpl of DEFAULT_TEMPLATES) {
        await pool.query(
          `INSERT INTO whatsapp_templates (trigger_type, title, message_template, is_enabled, delay_minutes)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (trigger_type) DO NOTHING`,
          [tmpl.trigger_type, tmpl.title, tmpl.message_template, tmpl.is_enabled, tmpl.delay_minutes]
        ).catch(() => {});
      }

      const res = await pool.query(
        `SELECT id, trigger_type, title, message_template, is_enabled, delay_minutes 
         FROM whatsapp_templates 
         WHERE trigger_type != 'order_created_pix'
         ORDER BY id ASC`
      );
      if (res.rows && res.rows.length > 0) {
        return res.rows;
      }
    }
  } catch (e) {
    console.warn('PostgreSQL indisponível para templates, usando padrão em memória:', (e as any).message);
  }
  return inMemoryTemplates.filter(t => t.trigger_type !== 'order_created_pix');
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
    console.warn('Erro ao persistir template no banco:', (e as any).message);
  }
}

/**
 * Dispara uma notificação automática baseada no gatilho
 */
export async function triggerWhatsAppAutomation(
  triggerType: string,
  phone: string,
  variables: Record<string, string | number>,
  recipientName: string = ''
) {
  try {
    const templates = await getWhatsAppTemplates();
    const template = templates.find(t => t.trigger_type === triggerType && t.is_enabled);

    if (!template) {
      console.log(`[WhatsApp Automation]: Gatilho '${triggerType}' desativado ou não configurado.`);
      return { success: false, reason: 'Template desativado ou inexistente' };
    }

    let message = template.message_template;
    for (const [key, val] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      message = message.replace(regex, String(val));
    }

    // Se houver delay configurado
    if (template.delay_minutes > 0) {
      console.log(`[WhatsApp Automation]: Agendando envio de '${triggerType}' para ${phone} em ${template.delay_minutes} minutos...`);
      setTimeout(() => {
        sendWhatsAppMessage(phone, message, triggerType, recipientName).catch(console.error);
      }, template.delay_minutes * 60 * 1000);
      return { success: true, delayed: true, delayMinutes: template.delay_minutes };
    }

    // Envio imediato
    return await sendWhatsAppMessage(phone, message, triggerType, recipientName);
  } catch (err: any) {
    console.error(`Erro ao disparar automação '${triggerType}':`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Consulta o histórico de mensagens enviadas
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
      if (res.rows) return res.rows;
    }
  } catch (e) {
    console.warn('Erro ao carregar logs de mensagens do banco:', (e as any).message);
  }
  return [];
}
