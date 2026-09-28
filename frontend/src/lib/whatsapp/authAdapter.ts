import { 
  AuthenticationCreds, 
  AuthenticationState, 
  SignalDataTypeMap, 
  initAuthCreds, 
  BufferJSON, 
  proto 
} from '@whiskeysockets/baileys';
import { getDbPool, checkDbConnection } from './db';
import crypto from 'crypto';

// Armazenamento em memória caso o banco de dados não esteja acessível
declare global {
  var __memory_auth_store__: {
    creds: AuthenticationCreds | null;
    keys: { [key: string]: any };
  } | undefined;
}

if (!globalThis.__memory_auth_store__) {
  globalThis.__memory_auth_store__ = {
    creds: null,
    keys: {}
  };
}

const memoryStore = globalThis.__memory_auth_store__;

/**
 * Adaptador transacional customizado de autenticação do Baileys com persistência direta no PostgreSQL
 * e fallback automático e imediato em memória (nunca trava a geração de QR Code).
 */
export async function getPostgresAuthState(whatsappId: string = 'default'): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearState: () => Promise<void>;
}> {
  const pool = getDbPool();

  let creds: AuthenticationCreds | null = memoryStore.creds;

  // Se ainda não estiver em memória, tenta recuperar credenciais salvas do banco
  if (!creds && pool) {
    try {
      const credsRes = await Promise.race([
        pool.query(
          `SELECT data FROM baileys_auth_state WHERE whatsapp_id = $1 AND data_id = 'creds'`,
          [whatsappId]
        ),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
      ]);
      if (credsRes && (credsRes as any).rows?.length > 0 && (credsRes as any).rows[0].data) {
        creds = JSON.parse((credsRes as any).rows[0].data, BufferJSON.reviver);
      }
    } catch (e) {}
  }

  // Se não houver credenciais salvas válidas, gera credenciais limpas para novo QR Code
  if (!creds) {
    creds = initAuthCreds();
  }
  memoryStore.creds = creds;

  const saveCreds = async () => {
    if (!creds) return;
    memoryStore.creds = creds;
    if (pool) {
      try {
        const serialized = JSON.stringify(creds, BufferJSON.replacer);
        const keyId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO baileys_auth_state (id, whatsapp_id, data_id, data) 
           VALUES ($1, $2, 'creds', $3)
           ON CONFLICT (whatsapp_id, data_id) 
           DO UPDATE SET data = EXCLUDED.data`,
          [keyId, whatsappId, serialized]
        );
      } catch (err) {}
    }
  };

  const clearState = async () => {
    memoryStore.creds = null;
    memoryStore.keys = {};
    if (pool) {
      try {
        await pool.query(`DELETE FROM baileys_auth_state WHERE whatsapp_id = $1`, [whatsappId]);
        await pool.query(
          `UPDATE whatsapp_accounts SET status = 'DISCONNECTED', phone = NULL, qr_code = NULL, last_connection = NULL WHERE id = $1`,
          [whatsappId]
        );
      } catch (e) {}
    }
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [key: string]: any } = {};
          if (ids.length === 0) return data;

          for (const id of ids) {
            const memKey = `${type}-${id}`;
            let val = memoryStore.keys[memKey];

            // Se não estiver em memória, tenta recuperar do banco
            if (val === undefined && pool) {
              try {
                const res = await pool.query(
                  `SELECT data FROM baileys_auth_state WHERE whatsapp_id = $1 AND data_id = $2`,
                  [whatsappId, memKey]
                );
                if (res?.rows?.length > 0 && res.rows[0].data) {
                  val = JSON.parse(res.rows[0].data, BufferJSON.reviver);
                  memoryStore.keys[memKey] = val;
                }
              } catch (e) {}
            }

            if (val !== undefined && val !== null) {
              if (type === 'app-state-sync-key' && val) {
                val = proto.Message.AppStateSyncKeyData.fromObject(val);
              }
              data[id] = val;
            }
          }
          return data;
        },
        set: async (dataset) => {
          // Atualiza memória instantaneamente
          for (const category of Object.keys(dataset)) {
            const catData = dataset[category as keyof SignalDataTypeMap];
            if (!catData) continue;
            for (const [id, value] of Object.entries(catData)) {
              const dataId = `${category}-${id}`;
              if (value) {
                memoryStore.keys[dataId] = value;
              } else {
                delete memoryStore.keys[dataId];
              }
            }
          }

          // Persiste no banco de forma assíncrona sem travar o Baileys
          if (pool) {
            setImmediate(async () => {
              try {
                for (const category of Object.keys(dataset)) {
                  const catData = dataset[category as keyof SignalDataTypeMap];
                  if (!catData) continue;

                  for (const [id, value] of Object.entries(catData)) {
                    const dataId = `${category}-${id}`;
                    if (value) {
                      const serialized = JSON.stringify(value, BufferJSON.replacer);
                      const uid = crypto.randomUUID();
                      await pool.query(
                        `INSERT INTO baileys_auth_state (id, whatsapp_id, data_id, data) 
                         VALUES ($1, $2, $3, $4)
                         ON CONFLICT (whatsapp_id, data_id) 
                         DO UPDATE SET data = EXCLUDED.data`,
                        [uid, whatsappId, dataId, serialized]
                      ).catch(() => {});
                    } else {
                      await pool.query(
                        `DELETE FROM baileys_auth_state WHERE whatsapp_id = $1 AND data_id = $2`,
                        [whatsappId, dataId]
                      ).catch(() => {});
                    }
                  }
                }
              } catch (err) {}
            });
          }
        }
      }
    },
    saveCreds,
    clearState
  };
}
