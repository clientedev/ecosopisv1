import makeWASocket, {
  DisconnectReason,
  WAMessageKey,
  proto,
  WABrowserDescription,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { EventEmitter } from 'events';
import dns from 'dns';
import { getPostgresAuthState, hasValidSavedSession } from './authAdapter';
import { getDbPool } from './db';

// Desativa bufferutil nativo para evitar o erro "e.mask is not a function" causado pelo empacotamento do Webpack no Next.js
process.env.WS_NO_BUFFER_UTIL = '1';
process.env.WS_NO_UTF_8_VALIDATE = '1';

// Força resolução IPv4 prioritária no Node.js para evitar timeout em conexões de WebSocket no Docker/Railway
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

// Logger silencioso estilo wa-central que não bloqueia o event loop
function makeLogger() {
  return {
    level: 'silent' as const,
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: (msg: any, ...args: any[]) => {
      const err = msg?.err || msg?.error || msg;
      console.warn('[Baileys Error]:', err?.message || err, ...args);
    },
    trace: () => {},
    fatal: (msg: any, ...args: any[]) => {
      const err = msg?.err || msg?.error || msg;
      console.error('[Baileys Fatal]:', err?.message || err, ...args);
    },
    child: () => makeLogger(),
  };
}

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
  isDestroying: boolean;
  connectionGeneration: number;
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
    isInitializing: false,
    isDestroying: false,
    connectionGeneration: 0,
  };
}

const state = globalThis.__whatsapp_state__;
if (typeof state.connectionGeneration !== 'number') {
  state.connectionGeneration = 0;
}

// Armazenamento em memória para controle de frequência de auto-resposta (anti-flood)
const autoReplyCooldown = new Map<string, number>();

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
 * Agenda reconexão automática com backoff exponencial (estilo wa-central)
 */
function scheduleReconnect(whatsappId: string = 'default', customDelayMs?: number) {
  if (state.isDestroying) return;

  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }

  const attempts = state.reconnectAttempts + 1;
  state.reconnectAttempts = attempts;
  const delay = customDelayMs ?? Math.min(2500 * Math.pow(1.25, attempts - 1), 25000);

  state.status = 'CONNECTING';
  state.isInitializing = false;
  state.events.emit('status', { status: 'CONNECTING' });

  console.log(`[WhatsApp] Agendando reconexão (tentativa ${attempts}) em ${Math.round(delay / 1000)}s...`);

  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    if (!state.isDestroying) {
      connectWhatsApp(whatsappId, false).catch(err => {
        console.error('[WhatsApp Reconnect Error]:', err?.message || err);
      });
    }
  }, delay);
}

/**
 * Retorna o status atual da conexão (leitura segura, nunca altera banco para DISCONNECTED)
 */
export async function getWhatsAppStatus(whatsappId: string = 'default') {
  try {
    const res = await safeDbQuery(
      `SELECT status, phone, qr_code, last_connection FROM whatsapp_accounts WHERE id = $1`,
      [whatsappId]
    );
    const hasSaved = await hasValidSavedSession(whatsappId);

    if (res && res.rows && res.rows.length > 0) {
      const dbRow = res.rows[0];
      let currentStatus = state.status;

      // Se o processo reiniciou (deploy/redeploy) e não temos socket ativo na memória:
      if (!state.isDestroying && !state.socket && !state.isInitializing && !state.reconnectTimer) {
        if (hasSaved || dbRow.status === 'CONNECTED') {
          console.log(`[WhatsApp Status] Detectado reinício/deploy com sessão salva no banco. Reconectando automaticamente...`);
          currentStatus = 'CONNECTING';
          state.status = 'CONNECTING';
          connectWhatsApp(whatsappId, false).catch(err => {
            console.warn('[WhatsApp Auto-Connect Error]:', err?.message || err);
          });
        }
      } else if (hasSaved && currentStatus === 'DISCONNECTED' && (state.reconnectTimer || state.isInitializing)) {
        currentStatus = 'CONNECTING';
      }

      return {
        status: currentStatus,
        phone: state.phone || dbRow.phone,
        qrCode: state.qrCodeDataUrl || (currentStatus === 'QR_CODE' ? dbRow.qr_code : null),
        lastConnection: state.lastConnection || dbRow.last_connection,
      };
    }

    if (hasSaved && !state.isDestroying && !state.socket && !state.isInitializing && !state.reconnectTimer) {
      state.status = 'CONNECTING';
      connectWhatsApp(whatsappId, false).catch(() => {});
      return {
        status: 'CONNECTING',
        phone: state.phone,
        qrCode: null,
        lastConnection: state.lastConnection,
      };
    }
  } catch (err) {
    console.error('Erro ao consultar status no banco:', err);
  }

  let fallbackStatus = state.status;
  if (!state.socket && !state.isInitializing && !state.reconnectTimer && fallbackStatus !== 'CONNECTED' && fallbackStatus !== 'QR_CODE') {
    fallbackStatus = 'DISCONNECTED';
  }

  return {
    status: fallbackStatus,
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
  state.isDestroying = false;

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

  // Cancela qualquer timer de reconexão anterior
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }

  // Incrementa geração de conexão para invalidar eventos atrasados de sockets anteriores (estilo wa-central)
  const generation = (state.connectionGeneration || 0) + 1;
  state.connectionGeneration = generation;

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
    const auth = await getPostgresAuthState(whatsappId);
    // CRÍTICO: NUNCA chamamos auth.clearState() dentro de connectWhatsApp!
    // No wa-central, as credenciais JAMAIS são apagadas em tentativas de conexão/reconexão.
    // Somente disconnectWhatsApp(whatsappId, true) (botão manual Desconectar) pode apagar credenciais.
    const { state: authState, saveCreds, isRestoredSession } = auth;
    
    let version: [number, number, number] | undefined = undefined;
    try {
      const v = await Promise.race([
        fetchLatestBaileysVersion(),
        new Promise<{ version: [number, number, number] }>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 2500)
        )
      ]);
      version = v.version;
    } catch (e) {}

    const browser: WABrowserDescription = ['ECOSOPIS Admin', 'Chrome', '1.0.0'];

    const sock = makeWASocket({
      version,
      auth: {
        creds: authState.creds,
        keys: makeCacheableSignalKeyStore(authState.keys, makeLogger()),
      },
      logger: makeLogger(),
      printQRInTerminal: false,
      browser,
      markOnlineOnConnect: false, // CRÍTICO: Evita colisão de presença inicial no celular
      syncFullHistory: false, // CRÍTICO: Não sincroniza histórico antigo, evitando travamento
      shouldIgnoreJid: (jid: string) => !jid || jid.includes('@newsletter') || jid === 'status@broadcast' || false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      defaultQueryTimeoutMs: 60000,
      retryRequestDelayMs: 500,
      generateHighQualityLinkPreview: true,
      getMessage: async (key: WAMessageKey): Promise<proto.IMessage | undefined> => {
        return undefined;
      }
    });

    // Intercepta e responde stanzas w:sync:app:state imediatamente para evitar
    // que o WhatsApp do celular fique travado na tela "Conectando..."
    const originalQuery = sock.query.bind(sock);
    sock.query = async (node: any, timeoutMs?: number) => {
      if (node?.attrs?.xmlns === 'w:sync:app:state') {
        return { tag: 'iq', attrs: { type: 'result', id: node?.attrs?.id }, content: [] };
      }
      return originalQuery(node, timeoutMs);
    };
    (sock as any).resyncAppState = async () => {};

    state.socket = sock;
    const isCurrentSocket = () =>
      !state.isDestroying && state.socket === sock && state.connectionGeneration === generation;

    // 1. Atualização e persistência contínua de credenciais
    sock.ev.on('creds.update', async () => {
      if (!isCurrentSocket()) return;
      await saveCreds();
    });

    // 2. Manipulação de conexão, QR Code e ciclo de vida
    sock.ev.on('connection.update', async (update) => {
      if (!isCurrentSocket()) return;

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
        if (!isCurrentSocket()) return;

        // Salva credenciais imediatamente ao abrir para garantir que todas as chaves pós-handshake estejam no PostgreSQL
        await saveCreds().catch(() => {});

        state.status = 'CONNECTED';
        state.qrCodeDataUrl = null;
        state.reconnectAttempts = 0;
        state.isInitializing = false;
        const phone = sock.user?.id ? sock.user.id.split(':')[0] : 'Conectado';
        state.phone = phone;
        const connectedAt = new Date();
        state.lastConnection = connectedAt;

        await safeDbQuery(
          `UPDATE whatsapp_accounts 
           SET status = 'CONNECTED', phone = $1, qr_code = NULL, last_connection = $2 
           WHERE id = $3`,
          [phone, connectedAt.toISOString(), whatsappId]
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
        if (!isCurrentSocket()) return;

        // Limpa socket atual antes de tentar reconectar
        const closedSocket = state.socket;
        state.socket = null;
        state.qrCodeDataUrl = null;
        if (closedSocket) {
          try { (closedSocket.ev as any).removeAllListeners(); } catch {}
          try { (closedSocket as any).end?.(undefined); } catch {}
        }

        if (state.isDestroying) {
          console.log('[WhatsApp] Conexão encerrada intencionalmente para deploy (isDestroying).');
          return;
        }

        const err = lastDisconnect?.error as any;
        const statusCode = err?.output?.statusCode;
        const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
        const isConnectionReplaced = statusCode === DisconnectReason.connectionReplaced || statusCode === 440;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        console.log(`[WhatsApp connection.close] Código: ${statusCode}, isLoggedOut: ${isLoggedOut}, Motivo: ${err?.message || 'Conexão encerrada'}`);

        // 1. QR Code escaneado com sucesso: Baileys envia 515 (restartRequired) para reiniciar o stream
        if (isRestartRequired) {
          console.log(`[Baileys] Código 515 (restartRequired) recebido! Reconectando imediatamente...`);
          state.reconnectAttempts = Math.max(0, state.reconnectAttempts - 1);
          scheduleReconnect(whatsappId, 800);
          return;
        }

        // 2. Conexão substituída por nova instância (código 440 - connectionReplaced):
        // Durante um rolling deploy no Railway, o container NOVO conecta antes do container ANTIGO receber SIGTERM.
        // O container ANTIGO recebe 440. Se o container ANTIGO reconectar, ele derruba o container NOVO!
        // Portanto, aguardamos 20s e verificamos no PostgreSQL se outra instância já assumiu e atualizou last_connection.
        if (isConnectionReplaced) {
          const myLastConn = state.lastConnection ? new Date(state.lastConnection).getTime() : 0;
          const attempts = Math.min(state.reconnectAttempts + 1, 25);
          state.reconnectAttempts = attempts;
          const delay = Math.min(20000 * attempts, 60000);

          console.log(`[Baileys] Código 440 (connectionReplaced) recebido. Verificando handoff de deploy em ${Math.round(delay / 1000)}s...`);
          state.status = 'CONNECTING';
          state.isInitializing = false;
          state.events.emit('status', { status: 'CONNECTING' });

          if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
          state.reconnectTimer = setTimeout(async () => {
            state.reconnectTimer = null;
            if (state.isDestroying) return;

            try {
              const checkRes = await safeDbQuery(
                `SELECT status, last_connection FROM whatsapp_accounts WHERE id = $1`,
                [whatsappId]
              );
              const dbRow = checkRes?.rows?.[0];
              const dbLastConn = dbRow?.last_connection ? new Date(dbRow.last_connection).getTime() : 0;

              // Se o banco mostra CONNECTED com um timestamp mais recente que o deste processo,
              // significa que o NOVO container do deploy já assumiu a sessão com sucesso!
              if (dbRow?.status === 'CONNECTED' && myLastConn > 0 && dbLastConn > myLastConn + 1000) {
                console.log('[WhatsApp] Novo container já assumiu a sessão no PostgreSQL. Encerrando instância antiga silenciosamente.');
                state.isDestroying = true;
                return;
              }
            } catch (e) {}

            if (!state.isDestroying) {
              connectWhatsApp(whatsappId, false).catch(console.error);
            }
          }, delay);
          return;
        }

        // 3. Qualquer outro fechamento (incluindo 401 transitório em deploy, 408, 428, 500, 503):
        // Se há credenciais salvas no PostgreSQL e não esgotou 25 tentativas, SEMPRE reconecta!
        // (Idêntico ao wa-central: nunca desloga no primeiro erro de rede/deploy)
        const hasCreds = await hasValidSavedSession(whatsappId);
        if (hasCreds && state.reconnectAttempts < 25) {
          scheduleReconnect(whatsappId);
          return;
        } else if (!isLoggedOut && state.reconnectAttempts < 25) {
          scheduleReconnect(whatsappId);
          return;
        }

        // 4. Somente se não houver credenciais salvas no banco OU se esgotaram 25 tentativas:
        // Nota: NUNCA chamamos clearState() aqui para não destruir o backup caso seja queda prolongada do WhatsApp.
        state.status = 'DISCONNECTED';
        state.phone = null;
        state.isInitializing = false;
        if (state.reconnectTimer) {
          clearTimeout(state.reconnectTimer);
          state.reconnectTimer = null;
        }
        await safeDbQuery(
          `UPDATE whatsapp_accounts SET status = 'DISCONNECTED', qr_code = NULL WHERE id = $1`,
          [whatsappId]
        );
        state.events.emit('status', { status: 'DISCONNECTED' });
        console.log(`[WhatsApp] Sessão desconectada após esgotar tentativas.`);
      }
    });

    // 3. Resposta automática oficial Ecosopis para mensagens recebidas
    const autoReplyText = 
      `🌿 *ECOSOPIS Cosméticos Naturais*\n\n` +
      `Olá! Este número é utilizado exclusivamente para *notificações automáticas de pedidos* e não recebe nem responde mensagens.\n\n` +
      `Para falar com nossa equipe de atendimento oficial, por favor nos chame pelo WhatsApp:\n` +
      `📱 *WhatsApp Atendimento:* (11) 95155-9212\n` +
      `👉 *Clique aqui para conversar:* https://wa.me/5511951559212\n\n` +
      `Será um prazer te atender! ✨`;

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return;

      for (const msg of messages) {
        try {
          // Ignora mensagens enviadas por nós mesmos
          if (!msg || msg.key?.fromMe) continue;

          const remoteJid = msg.key?.remoteJid;
          if (!remoteJid) continue;

          // Ignora status de broadcast, newsletters ou grupos
          if (
            remoteJid === 'status@broadcast' ||
            remoteJid.includes('@broadcast') ||
            remoteJid.includes('@newsletter') ||
            remoteJid.endsWith('@g.us')
          ) {
            continue;
          }

          // Ignora mensagens antigas recebidas em sincronizações (mais velhas que 2 minutos)
          const msgTimestamp = typeof msg.messageTimestamp === 'number'
            ? msg.messageTimestamp
            : Number(msg.messageTimestamp || 0);
          if (msgTimestamp && (Date.now() / 1000 - msgTimestamp) > 120) {
            continue;
          }

          // Anti-flood: evita responder mais de 1 vez a cada 5 minutos ao mesmo contato
          const now = Date.now();
          const lastReply = autoReplyCooldown.get(remoteJid);
          if (lastReply && (now - lastReply) < 5 * 60 * 1000) {
            continue;
          }

          // Limpa histórico de cooldown antigo se a lista crescer muito
          if (autoReplyCooldown.size > 500) {
            const oneHourAgo = now - 60 * 60 * 1000;
            for (const [jid, time] of autoReplyCooldown.entries()) {
              if (time < oneHourAgo) autoReplyCooldown.delete(jid);
            }
          }

          autoReplyCooldown.set(remoteJid, now);

          console.log(`[WhatsApp Auto-Reply] Respondendo automaticamente para ${remoteJid}...`);
          await sock.sendMessage(remoteJid, { text: autoReplyText });

          // Envia também o cartão de contato do WhatsApp de Atendimento Oficial
          try {
            const vcard =
              'BEGIN:VCARD\n' +
              'VERSION:3.0\n' +
              'FN:Atendimento Ecosopis\n' +
              'ORG:ECOSOPIS Cosméticos Naturais;\n' +
              'TEL;type=CELL;type=VOICE;waid=5511951559212:+55 11 95155-9212\n' +
              'END:VCARD';

            await sock.sendMessage(remoteJid, {
              contacts: {
                displayName: 'Atendimento Ecosopis',
                contacts: [{ vcard }]
              }
            });
          } catch (vcardErr) {
            // Silencioso se o formato vcard não for suportado pelo cliente remoto
          }
        } catch (err: any) {
          console.error('[WhatsApp Auto-Reply Error]:', err?.message || err);
        }
      }
    });

    // Se a sessão já estava pareada/registrada previamente (restauração pós-deploy):
    const isAlreadyRegistered = isRestoredSession || Boolean(authState.creds?.registered || authState.creds?.me);

    if (isAlreadyRegistered) {
      console.log(`[Baileys] Restaurando sessão salva do WhatsApp... Conectando em segundo plano sem necessidade de QR Code.`);
      state.isInitializing = false;
      // Dá uma breve janela de até 4s caso conecte instantaneamente
      for (let i = 0; i < 20; i++) {
        const currentStatus = (state as GlobalWhatsAppState).status;
        if (currentStatus === 'CONNECTED') break;
        await new Promise(r => setTimeout(r, 200));
      }
      const finalStatus = (state as GlobalWhatsAppState).status;
      return { 
        status: finalStatus === 'CONNECTED' ? 'CONNECTED' : 'CONNECTING',
        qrCode: null 
      };
    }

    // Se é uma nova conexão que precisa de leitura de QR Code:
    for (let i = 0; i < 50; i++) {
      const currentStatus = (state as GlobalWhatsAppState).status;
      if (state.qrCodeDataUrl || currentStatus === 'CONNECTED') {
        break;
      }
      await new Promise(r => setTimeout(r, 300));
    }

    state.isInitializing = false;

    const currentStatus = (state as GlobalWhatsAppState).status;
    if (!state.qrCodeDataUrl && currentStatus !== 'CONNECTED') {
      // Se há sessão salva, NUNCA force 'DISCONNECTED' no banco após 15s de espera!
      const hasSaved = await hasValidSavedSession(whatsappId);
      if (hasSaved || isRestoredSession) {
        console.log('[WhatsApp] Sessão salva em restauração no background. Mantendo status CONNECTING...');
        state.isInitializing = false;
        return { status: 'CONNECTING', qrCode: null };
      }

      state.status = 'DISCONNECTED';
      await safeDbQuery(`UPDATE whatsapp_accounts SET status = 'DISCONNECTED', qr_code = NULL WHERE id = $1`, [whatsappId]);
      state.events.emit('status', { status: 'DISCONNECTED' });
      return { status: 'DISCONNECTED', qrCode: null };
    }

    return { status: (state as GlobalWhatsAppState).status, qrCode: state.qrCodeDataUrl };

  } catch (err: any) {
    state.isInitializing = false;
    console.error('Falha ao inicializar socket Baileys:', err);
    if (!state.isDestroying) {
      scheduleReconnect(whatsappId);
      return { status: 'CONNECTING', qrCode: null };
    }
    return { status: 'DISCONNECTED' };
  }
}

/**
 * Desconecta a sessão do WhatsApp e limpa os dados caso seja logout definitivo
 */
export async function disconnectWhatsApp(whatsappId: string = 'default', logout: boolean = true) {
  state.isDestroying = false;
  state.connectionGeneration = (state.connectionGeneration || 0) + 1;

  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }

  if (state.socket) {
    try {
      state.socket.ev.removeAllListeners();
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
  state.reconnectAttempts = 0;

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
 * Encerramento gracioso do socket ao receber SIGTERM do orquestrador (ex: deploy Railway)
 * Fecha o socket Baileys e streams SSE sem dar logout e sem alterar status para DISCONNECTED no banco.
 */
export async function gracefulShutdown() {
  state.isDestroying = true;
  state.connectionGeneration = (state.connectionGeneration || 0) + 1;
  queueControl.stopped = true;

  if (queueControl.interval) {
    clearInterval(queueControl.interval);
    queueControl.interval = null;
  }
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }

  // Notifica todos os streams SSE abertos (/api/whatsapp/events) para fecharem imediatamente,
  // evitando que o servidor HTTP do container antigo fique preso aguardando conexões keep-alive!
  try {
    state.events.emit('shutdown');
  } catch (e) {}

  if (state.socket) {
    try {
      state.socket.ev.removeAllListeners();
      try {
        state.socket.ws?.close();
      } catch {}
      state.socket.end(undefined);
    } catch (e) {}
    state.socket = null;
  }
  state.isInitializing = false;
  console.log('[WhatsApp] Socket encerrado graciosamente para deploy/redeploy.');
}

/**
 * Conecta automaticamente caso haja sessão salva no PostgreSQL (usado no boot/deploy do servidor).
 * Tenta várias vezes caso o banco ainda não esteja disponível no arranque e inicia o watchdog + fila.
 */
export async function autoConnectIfSaved(whatsappId: string = 'default') {
  state.isDestroying = false;
  queueControl.stopped = false;
  startWatchdog(whatsappId);

  // Mensagens que ficaram "enviando" quando o container anterior foi encerrado voltam para a fila
  await safeDbQuery(`UPDATE whatsapp_message_logs SET status = 'QUEUED' WHERE status = 'SENDING'`);

  for (let attempt = 0; attempt < 12; attempt++) {
    if (state.isDestroying || state.socket || state.isInitializing || state.status === 'CONNECTED') break;
    try {
      const hasSaved = await hasValidSavedSession(whatsappId);
      if (hasSaved) {
        console.log(`[WhatsApp Auto-Boot] Sessão válida encontrada no PostgreSQL! Restaurando conexão do WhatsApp para ${whatsappId}...`);
        await connectWhatsApp(whatsappId, false);
        break;
      }
    } catch (err: any) {
      console.warn('[WhatsApp Auto-Boot Error]:', err?.message || err);
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  processQueue().catch(() => {});
}

/**
 * Watchdog: a cada 30s garante que a sessão salva esteja conectada e que a fila seja processada.
 */
function startWatchdog(whatsappId: string) {
  if (queueControl.interval) return;
  queueControl.interval = setInterval(async () => {
    try {
      if (!state.isDestroying && !state.socket && !state.isInitializing && !state.reconnectTimer) {
        if (await hasValidSavedSession(whatsappId)) {
          console.log('[WhatsApp Watchdog] Sem socket ativo mas há sessão salva no PostgreSQL. Reconectando...');
          connectWhatsApp(whatsappId, false).catch(() => {});
        }
      }
      processQueue().catch(() => {});
    } catch (e) {}
  }, 30000);
}

// ---------------------------------------------------------------------------
// Fila de envio: UMA mensagem por vez, com intervalo mínimo de 30s entre elas.
// A fila vive no PostgreSQL (status QUEUED) e sobrevive a redeploys.
// ---------------------------------------------------------------------------
export const WHATSAPP_SEND_GAP_MS = 30000;

const queueControl: { running: boolean; stopped: boolean; lastSentAt: number; interval: NodeJS.Timeout | null } =
  ((globalThis as any).__wa_queue_control__ ||= { running: false, stopped: false, lastSentAt: 0, interval: null });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function processQueue() {
  if (queueControl.running) return;
  queueControl.running = true;
  try {
    while (!queueControl.stopped) {
      const peek = await safeDbQuery(`SELECT id FROM whatsapp_message_logs WHERE status = 'QUEUED' LIMIT 1`);
      if (!peek || !peek.rows || peek.rows.length === 0) break;

      // Aguarda conexão (a sessão salva é restaurada em segundo plano)
      if (!state.socket || state.status !== 'CONNECTED') {
        if (!state.isDestroying && !state.socket && !state.isInitializing && !state.reconnectTimer && (await hasValidSavedSession())) {
          connectWhatsApp('default', false).catch(() => {});
        }
        await sleep(5000);
        continue;
      }

      // Intervalo mínimo de 30s desde o último envio (considera também envios de outro container)
      let sinceLast = Date.now() - queueControl.lastSentAt;
      const lastDb = await safeDbQuery(
        `SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) * 1000 AS ago FROM whatsapp_message_logs WHERE status = 'SENT'`
      );
      const agoDb = lastDb?.rows?.[0]?.ago;
      if (agoDb !== null && agoDb !== undefined) sinceLast = Math.min(sinceLast, Number(agoDb));
      if (sinceLast < WHATSAPP_SEND_GAP_MS) {
        await sleep(Math.min(WHATSAPP_SEND_GAP_MS - sinceLast + 200, WHATSAPP_SEND_GAP_MS));
        continue;
      }

      // Reivindica atomicamente a próxima mensagem
      const claim = await safeDbQuery(
        `UPDATE whatsapp_message_logs SET status = 'SENDING'
         WHERE id = (
           SELECT id FROM whatsapp_message_logs WHERE status = 'QUEUED'
           ORDER BY created_at ASC, id ASC LIMIT 1 FOR UPDATE SKIP LOCKED
         )
         RETURNING id, to_phone, recipient_name, message, trigger_type`
      );
      const row = claim?.rows?.[0];
      if (!row) break;

      try {
        const result = await state.socket.sendMessage(formatToWhatsAppJid(row.to_phone), { text: row.message });
        queueControl.lastSentAt = Date.now();
        await safeDbQuery(
          `UPDATE whatsapp_message_logs SET status = 'SENT', error = NULL, created_at = NOW() WHERE id = $1`,
          [row.id]
        );
        state.events.emit('message_sent', {
          to: row.to_phone,
          recipientName: row.recipient_name,
          message: row.message,
          triggerType: row.trigger_type,
          date: new Date(),
          messageId: result?.key?.id
        });
      } catch (err: any) {
        console.error(`Erro ao disparar mensagem para ${row.to_phone}:`, err);
        queueControl.lastSentAt = Date.now();
        await safeDbQuery(
          `UPDATE whatsapp_message_logs SET status = 'FAILED', error = $1 WHERE id = $2`,
          [err?.message || 'Falha no envio', row.id]
        );
      }
    }
  } finally {
    queueControl.running = false;
  }
}

/**
 * Enfileira uma mensagem de WhatsApp. O envio real ocorre em segundo plano, sempre uma por vez
 * e com 30s de intervalo. O histórico mostra a mensagem com status QUEUED (na fila) até ser enviada.
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string,
  triggerType: string = 'manual',
  recipientName: string = '',
  existingLogId?: number
): Promise<{ success: boolean; messageId?: string; error?: string; queued?: boolean; logId?: number }> {
  queueControl.stopped = false;
  let logId = existingLogId;

  if (existingLogId) {
    const upd = await safeDbQuery(
      `UPDATE whatsapp_message_logs SET status = 'QUEUED', error = NULL, created_at = NOW() WHERE id = $1`,
      [existingLogId]
    );
    if (!upd) return { success: false, error: 'Banco de dados indisponível para enfileirar a mensagem.' };
  } else {
    const ins = await safeDbQuery(
      `INSERT INTO whatsapp_message_logs (whatsapp_id, to_phone, recipient_name, message, trigger_type, status)
       VALUES ('default', $1, $2, $3, $4, 'QUEUED') RETURNING id`,
      [to, recipientName, message, triggerType]
    );
    logId = ins?.rows?.[0]?.id;
    if (!logId) return { success: false, error: 'Banco de dados indisponível para enfileirar a mensagem.' };
  }

  if (!state.isDestroying && !state.socket && !state.isInitializing && !state.reconnectTimer) {
    hasValidSavedSession().then(ok => {
      if (ok) connectWhatsApp('default', false).catch(() => {});
    }).catch(() => {});
  }

  processQueue().catch(() => {});
  return { success: true, queued: true, logId };
}

/**
 * Retorna o objeto de eventos para o SSE
 */
export function getWhatsAppEvents(): WhatsAppEvents {
  return state.events;
}
