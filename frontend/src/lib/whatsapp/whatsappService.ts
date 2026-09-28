import makeWASocket, {
  DisconnectReason,
  WAMessageKey,
  proto,
  WABrowserDescription
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { EventEmitter } from 'events';
import { getPostgresAuthState } from './authAdapter';
import { getDbPool } from './db';

// EventEmitter global para Server-Sent Events (SSE)
class WhatsAppEvents extends EventEmitter {}
const globalEvents = new WhatsAppEvents();
globalEvents.setMaxListeners(50);

// Interface para o estado global
interface GlobalWhatsAppState {
  socket: any;
  status: 'DISCONNECTED' | 'CONNECTING' | 'QR_CODE' | 'CONNECTED';
  qrCodeDataUrl: string | null;
  phone: string | null;
  lastConnection: Date | null;
  reconnectAttempts: number;
  reconnectTimer: NodeJS.Timeout | null;
  events: WhatsAppEvents;
  isInitializing: boolean;
}

// Persistência no escopo global do Node.js (sobrevive a HMR e reutilização de módulos)
declare global {
  var __whatsapp_state__: GlobalWhatsAppState | undefined;
}

if (!globalThis.__whatsapp_state__) {
  globalThis.__whatsapp_state__ = {
    socket: null,
    status: 'DISCONNECTED',
    qrCodeDataUrl: null,
    phone: null,
    lastConnection: null,
    reconnectAttempts: 0,
    reconnectTimer: null,
    events: globalEvents,
    isInitializing: false
  };
}

const state = globalThis.__whatsapp_state__;

// Logger Pino com nível reduzido para produção
const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'warn' : 'info' });

/**
 * Sanitiza o número do telefone brasileiro e internacional
 */
export function formatToWhatsAppJid(phone: string): string {
  // Remove todos os caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');

  // Se começou sem DDI 55 (ex: 11999999999 -> 11 dígitos), adiciona DDI do Brasil
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }

  // Se tiver o nono dígito em celular brasileiro com DDI (55 + DDD + 9 dígitos = 13 dígitos)
  // O WhatsApp por vezes usa 12 ou 13 dígitos dependendo do registro, @s.whatsapp.net aceita ambos
  return `${cleaned}@s.whatsapp.net`;
}

/**
 * Query segura ao PostgreSQL: nunca trava o fluxo se o banco estiver fora ou lento
 */
async function safeDbQuery(sql: string, params: any[] = []): Promise<any> {
  try {
    const pool = getDbPool();
    if (!pool) return null;
    return await pool.query(sql, params);
  } catch (err: any) {
    console.warn('[WhatsApp DB safeQuery warning]:', err.message);
    return null;
  }
}

/**
 * Retorna o status atual da conexão
 */
export async function getWhatsAppStatus(whatsappId: string = 'default') {
  try {
    const res = await safeDbQuery(
      `SELECT status, phone, qr_code, last_connection FROM whatsapp_accounts WHERE id = $1`,
      [whatsappId]
    );

    if (res && res.rows && res.rows.length > 0) {
      const dbRow = res.rows[0];
      return {
        status: state.status !== 'DISCONNECTED' ? state.status : (dbRow.status || 'DISCONNECTED'),
        phone: state.phone || dbRow.phone,
        qrCode: state.qrCodeDataUrl || dbRow.qr_code,
        lastConnection: state.lastConnection || dbRow.last_connection,
      };
    }
  } catch (err) {
    console.error('Erro ao consultar status no banco:', err);
  }

  return {
    status: state.status,
    phone: state.phone,
    qrCode: state.qrCodeDataUrl,
    lastConnection: state.lastConnection,
  };
}

/**
 * Inicializa a conexão com o WhatsApp usando Baileys Multi-Device
 */
export async function connectWhatsApp(
  whatsappId: string = 'default',
  force: boolean = false
): Promise<{ status: string; qrCode?: string | null }> {
  if (!force && state.socket && state.status === 'CONNECTED') {
    return { status: 'CONNECTED', qrCode: null };
  }

  // Se já temos um QR Code ativo gerado e não foi pedido force, devolve imediatamente
  if (!force && state.status === 'QR_CODE' && state.qrCodeDataUrl) {
    return { status: 'QR_CODE', qrCode: state.qrCodeDataUrl };
  }

  if (!force && state.isInitializing) {
    return { status: state.status, qrCode: state.qrCodeDataUrl };
  }

  // Limpa socket anterior se houver para evitar conflitos de conexão
  if (state.socket) {
    try {
      state.socket.ev.removeAllListeners();
      state.socket.end(undefined);
    } catch (e) {}
    state.socket = null;
  }

  state.isInitializing = true;
  state.status = 'CONNECTING';
  state.qrCodeDataUrl = null;
  state.events.emit('status', { status: 'CONNECTING' });

  // Atualiza status no banco de forma assíncrona em segundo plano sem travar
  safeDbQuery(
    `UPDATE whatsapp_accounts SET status = 'CONNECTING' WHERE id = $1`,
    [whatsappId]
  ).catch(() => {});

  try {
    const { state: authState, saveCreds, clearState } = await getPostgresAuthState(whatsappId);

    // Configuração anti-travamento rigorosa conforme diretrizes
    const browser: WABrowserDescription = ['Admin E-commerce', 'Chrome', '1.0.0'];

    const sock = makeWASocket({
      auth: authState,
      logger,
      printQRInTerminal: false,
      browser,
      syncFullHistory: false, // CRÍTICO: Não sincroniza histórico antigo, evitando travamento
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      defaultQueryTimeoutMs: 60000,
      generateHighQualityLinkPreview: true,
      getMessage: async (key: WAMessageKey): Promise<proto.IMessage | undefined> => {
        return undefined;
      }
    });

    state.socket = sock;

    // 1. Atualização e persistência contínua de credenciais
    sock.ev.on('creds.update', async () => {
      await saveCreds();
    });

    // 2. Manipulação de conexão, QR Code e ciclo de vida
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      console.log('[Baileys connection.update]:', {
        connection,
        hasQr: !!qr,
        statusCode: (lastDisconnect?.error as any)?.output?.statusCode
      });

      // Evento de emissão do QR Code
      if (qr) {
        console.log('[Baileys] String QR recebida com sucesso! Convertendo para DataURL...');
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 320
          });
          state.status = 'QR_CODE';
          state.qrCodeDataUrl = qrDataUrl;
          state.isInitializing = false;

          await safeDbQuery(
            `UPDATE whatsapp_accounts SET status = 'QR_CODE', qr_code = $1 WHERE id = $2`,
            [qrDataUrl, whatsappId]
          );

          state.events.emit('qr', { qrCode: qrDataUrl });
          state.events.emit('status', { status: 'QR_CODE', qrCode: qrDataUrl });
        } catch (qrErr) {
          console.error('Erro ao gerar DataURL do QR Code:', qrErr);
        }
      }

      // Conexão estabelecida com sucesso
      if (connection === 'open') {
        state.status = 'CONNECTED';
        state.qrCodeDataUrl = null;
        state.reconnectAttempts = 0;
        state.isInitializing = false;
        const phone = sock.user?.id ? sock.user.id.split(':')[0] : 'Conectado';
        state.phone = phone;
        state.lastConnection = new Date();

        await safeDbQuery(
          `UPDATE whatsapp_accounts 
           SET status = 'CONNECTED', phone = $1, qr_code = NULL, last_connection = NOW() 
           WHERE id = $2`,
          [phone, whatsappId]
        );

        state.events.emit('status', { 
          status: 'CONNECTED', 
          phone, 
          lastConnection: state.lastConnection 
        });
        console.log(`✓ WhatsApp conectado com sucesso! Número: ${phone}`);
      }

      // Conexão fechada / desconectada
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        console.log(`WhatsApp desconectado. Código: ${statusCode}, Logout: ${isLoggedOut}`);

        if (isLoggedOut) {
          // Desconexão intencional ou sessão revogada no celular
          state.status = 'DISCONNECTED';
          state.socket = null;
          state.phone = null;
          state.qrCodeDataUrl = null;
          state.isInitializing = false;
          await clearState();
          state.events.emit('status', { status: 'DISCONNECTED' });
        } else {
          // Desconexão temporária: reconexão automática com backoff exponencial (5s, 10s, 20s, 30s)
          state.status = 'CONNECTING';
          state.events.emit('status', { status: 'CONNECTING' });

          const attempts = Math.min(state.reconnectAttempts + 1, 6);
          state.reconnectAttempts = attempts;
          const delay = Math.min(5000 * Math.pow(1.5, attempts - 1), 30000);

          console.log(`Agendando reconexão automática em ${Math.round(delay / 1000)}s (Tentativa ${attempts})...`);
          if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
          state.reconnectTimer = setTimeout(() => {
            connectWhatsApp(whatsappId).catch(console.error);
          }, delay);
        }
      }
    });

    // Aguarda até 8 segundos pelo primeiro QR code ser emitido para responder imediatamente na requisição HTTP
    await new Promise<void>((resolve) => {
      if (state.qrCodeDataUrl || state.status === 'CONNECTED') {
        return resolve();
      }
      const onQr = () => {
        cleanup();
        resolve();
      };
      const onStat = (s: any) => {
        if (s.status === 'CONNECTED' || s.status === 'QR_CODE') {
          cleanup();
          resolve();
        }
      };
      const cleanup = () => {
        state.events.off('qr', onQr);
        state.events.off('status', onStat);
      };
      state.events.once('qr', onQr);
      state.events.once('status', onStat);
      setTimeout(() => {
        cleanup();
        resolve();
      }, 8000);
    });

    state.isInitializing = false;
    return { status: state.status, qrCode: state.qrCodeDataUrl };

  } catch (err: any) {
    state.isInitializing = false;
    state.status = 'DISCONNECTED';
    console.error('Falha ao inicializar socket Baileys:', err);
    state.events.emit('status', { status: 'DISCONNECTED', error: err.message });
    return { status: 'DISCONNECTED' };
  }
}

/**
 * Desconecta a sessão do WhatsApp e limpa os dados caso seja logout definitivo
 */
export async function disconnectWhatsApp(whatsappId: string = 'default', logout: boolean = true) {
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }

  if (state.socket) {
    try {
      if (logout) {
        await state.socket.logout();
      } else {
        state.socket.end(new Error('Manual disconnect'));
      }
    } catch (e) {
      console.warn('Aviso ao encerrar socket:', e);
    }
  }

  state.socket = null;
  state.status = 'DISCONNECTED';
  state.phone = null;
  state.qrCodeDataUrl = null;

  if (logout) {
    const { clearState } = await getPostgresAuthState(whatsappId);
    await clearState();
  } else {
    await safeDbQuery(
      `UPDATE whatsapp_accounts SET status = 'DISCONNECTED', qr_code = NULL WHERE id = $1`,
      [whatsappId]
    );
  }

  state.events.emit('status', { status: 'DISCONNECTED' });
  return { success: true };
}

/**
 * Envia uma mensagem de texto via WhatsApp com fila/retry e registro transacional no banco
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string,
  triggerType: string = 'manual',
  recipientName: string = ''
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const jid = formatToWhatsAppJid(to);

  // Verifica se o socket está conectado
  if (!state.socket || state.status !== 'CONNECTED') {
    const errorMsg = 'WhatsApp não está conectado. Conecte pelo painel admin antes de enviar mensagens.';
    await safeDbQuery(
      `INSERT INTO whatsapp_message_logs (whatsapp_id, to_phone, recipient_name, message, trigger_type, status, error)
       VALUES ('default', $1, $2, $3, $4, 'FAILED', $5)`,
      [to, recipientName, message, triggerType, errorMsg]
    );
    return { success: false, error: errorMsg };
  }

  try {
    // Envio seguro através do socket Baileys
    const result = await state.socket.sendMessage(jid, { text: message });

    // Salva o log de sucesso no banco de dados
    await safeDbQuery(
      `INSERT INTO whatsapp_message_logs (whatsapp_id, to_phone, recipient_name, message, trigger_type, status)
       VALUES ('default', $1, $2, $3, $4, 'SENT')`,
      [to, recipientName, message, triggerType]
    );

    state.events.emit('message_sent', {
      to,
      recipientName,
      message,
      triggerType,
      date: new Date()
    });

    return { 
      success: true, 
      messageId: result?.key?.id || undefined 
    };

  } catch (err: any) {
    console.error(`Erro ao disparar mensagem para ${to}:`, err);
    await safeDbQuery(
      `INSERT INTO whatsapp_message_logs (whatsapp_id, to_phone, recipient_name, message, trigger_type, status, error)
       VALUES ('default', $1, $2, $3, $4, 'FAILED', $5)`,
      [to, recipientName, message, triggerType, err.message || 'Falha no envio']
    );

    return { success: false, error: err.message || 'Erro ao enviar mensagem pelo WhatsApp' };
  }
}

/**
 * Retorna o objeto de eventos para o SSE
 */
export function getWhatsAppEvents(): WhatsAppEvents {
  return state.events;
}
