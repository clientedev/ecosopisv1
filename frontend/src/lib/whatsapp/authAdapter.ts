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
  const dbConnected = await checkDbConnection();
  const pool = dbConnected ? getDbPool() : null;

  let creds: AuthenticationCreds;

  if (pool) {
    try {
      // 1. Garante que a conta existe no banco
      await pool.query(
        `INSERT INTO whatsapp_accounts (id, name, status) 
         VALUES ($1, 'WhatsApp Principal E-commerce', 'DISCONNECTED')
         ON CONFLICT (id) DO NOTHING`,
        [whatsappId]
      );

      // 2. Busca credenciais salvas
      const credsRes = await pool.query(
        `SELECT data FROM baileys_auth_state WHERE whatsapp_id = $1 AND data_id = 'creds'`,
        [whatsappId]
      );

      if (credsRes.rows.length > 0 && credsRes.rows[0].data) {
        creds = JSON.parse(credsRes.rows[0].data, BufferJSON.reviver);
      } else {
        creds = memoryStore.creds || initAuthCreds();
      }
    } catch (e) {
      console.warn('Falha ao ler creds do banco, usando memória:', e);
      creds = memoryStore.creds || initAuthCreds();
    }
  } else {
    creds = memoryStore.creds || initAuthCreds();
  }

  memoryStore.creds = creds;

  const saveCreds = async () => {
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
      } catch (err) {
        console.warn('Não foi possível persistir creds no PostgreSQL (salvo em memória):', (err as any).message);
      }
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
      } catch (err) {
        console.warn('Erro ao limpar estado no banco:', err);
      }
    }
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [key: string]: any } = {};
          if (ids.length === 0) return data;

          // Primeiro consulta memória
          for (const id of ids) {
            const memKey = `${type}-${id}`;
            if (memoryStore.keys[memKey] !== undefined) {
              data[id] = memoryStore.keys[memKey];
            }
          }

          // Se tiver banco, complementa
          if (pool) {
            try {
              const dataIds = ids.map(id => `${type}-${id}`);
              const res = await pool.query(
                `SELECT data_id, data FROM baileys_auth_state 
                 WHERE whatsapp_id = $1 AND data_id = ANY($2::text[])`,
                [whatsappId, dataIds]
              );

              for (const row of res.rows) {
                const id = row.data_id.replace(`${type}-`, '');
                try {
                  let value = JSON.parse(row.data, BufferJSON.reviver);
                  if (type === 'app-state-sync-key' && value) {
                    value = proto.Message.AppStateSyncKeyData.fromObject(value);
                  }
                  data[id] = value;
                  memoryStore.keys[row.data_id] = value;
                } catch (err) {}
              }
            } catch (e) {}
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

          // Salva no banco em segundo plano se disponível
          if (pool) {
            try {
              const client = await pool.connect();
              try {
                await client.query('BEGIN');
                for (const category of Object.keys(dataset)) {
                  const catData = dataset[category as keyof SignalDataTypeMap];
                  if (!catData) continue;

                  for (const [id, value] of Object.entries(catData)) {
                    const dataId = `${category}-${id}`;
                    if (value) {
                      const serialized = JSON.stringify(value, BufferJSON.replacer);
                      const uid = crypto.randomUUID();
                      await client.query(
                        `INSERT INTO baileys_auth_state (id, whatsapp_id, data_id, data) 
                         VALUES ($1, $2, $3, $4)
                         ON CONFLICT (whatsapp_id, data_id) 
                         DO UPDATE SET data = EXCLUDED.data`,
                        [uid, whatsappId, dataId, serialized]
                      );
                    } else {
                      await client.query(
                        `DELETE FROM baileys_auth_state WHERE whatsapp_id = $1 AND data_id = $2`,
                        [whatsappId, dataId]
                      );
                    }
                  }
                }
                await client.query('COMMIT');
              } catch (e) {
                await client.query('ROLLBACK');
              } finally {
                client.release();
              }
            } catch (err) {}
          }
        }
      }
    },
    saveCreds,
    clearState
  };
}
