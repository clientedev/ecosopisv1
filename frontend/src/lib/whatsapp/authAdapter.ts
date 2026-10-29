import { 
  AuthenticationCreds, 
  AuthenticationState, 
  SignalDataTypeMap, 
  initAuthCreds, 
  BufferJSON, 
  proto 
} from '@whiskeysockets/baileys';
import { getDbPool } from './db';
import crypto from 'crypto';

// Armazenamento em memória para rápido acesso sem latência de I/O
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
 * Verifica rapidamente se o PostgreSQL possui credenciais de pareamento salvas
 */
export async function hasValidSavedSession(whatsappId: string = 'default'): Promise<boolean> {
  const pool = getDbPool();
  if (!pool) return false;
  try {
    // 1. Tenta credenciais na tabela principal
    const res = await pool.query(
      `SELECT data FROM baileys_auth_state WHERE whatsapp_id = $1 AND data_id = 'creds' LIMIT 1`,
      [whatsappId]
    );
    if (res?.rows?.length > 0 && res.rows[0].data) {
      try {
        const parsed = JSON.parse(res.rows[0].data, BufferJSON.reviver);
        if (parsed?.registered || parsed?.me || parsed?.account) return true;
      } catch (e) {}
    }

    // 2. Tenta credenciais na tabela de backup espelho
    const backupRes = await pool.query(
      `SELECT data FROM baileys_auth_state_backup WHERE whatsapp_id = $1 AND data_id = 'creds' LIMIT 1`,
      [whatsappId]
    ).catch(() => null);
    if (backupRes?.rows?.length > 0 && backupRes.rows[0].data) {
      try {
        const parsedBackup = JSON.parse(backupRes.rows[0].data, BufferJSON.reviver);
        if (parsedBackup?.registered || parsedBackup?.me || parsedBackup?.account) return true;
      } catch (e) {}
    }

    // 3. Fallback seguro estilo wa-central: se houver chaves de autenticação salvas para esta conta
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM baileys_auth_state WHERE whatsapp_id = $1`,
      [whatsappId]
    ).catch(() => null);
    const count = parseInt(countRes?.rows?.[0]?.count || '0', 10);
    if (count > 0) return true;

    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Adaptador transacional customizado de autenticação do Baileys com persistência direta no PostgreSQL.
 * Garante que a sessão persista entre deploys, reinicializações e atualizações do Next.js.
 */
export async function getPostgresAuthState(whatsappId: string = 'default'): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearState: () => Promise<void>;
  isRestoredSession: boolean;
}> {
  const pool = getDbPool();
  let isRestoredSession = false;

  let creds: AuthenticationCreds | null = memoryStore.creds;

  // Se ainda não estiver em memória, recupera do banco de dados PostgreSQL
  if (!creds && pool) {
    try {
      // 1. Tenta da tabela principal
      const credsRes = await pool.query(
        `SELECT data FROM baileys_auth_state WHERE whatsapp_id = $1 AND data_id = 'creds'`,
        [whatsappId]
      );
      if (credsRes?.rows?.length > 0 && credsRes.rows[0].data) {
        creds = JSON.parse(credsRes.rows[0].data, BufferJSON.reviver);
        if (creds?.registered || creds?.me) {
          isRestoredSession = true;
          console.log(`[Baileys Auth] Sessão recuperada do PostgreSQL com sucesso para ${whatsappId}!`);
        }
      }

      // 2. Fallback de emergência: se a tabela principal foi zerada, tenta recuperar do backup automático
      if (!isRestoredSession) {
        try {
          const backupRes = await pool.query(
            `SELECT data FROM baileys_auth_state_backup WHERE whatsapp_id = $1 AND data_id = 'creds'`,
            [whatsappId]
          );
          if (backupRes?.rows?.length > 0 && backupRes.rows[0].data) {
            const backupCreds = JSON.parse(backupRes.rows[0].data, BufferJSON.reviver);
            if (backupCreds?.registered || backupCreds?.me) {
              creds = backupCreds;
              isRestoredSession = true;
              console.log(`[Baileys Auth] SESSÃO RECUPERADA DO BACKUP AUTOMÁTICO para ${whatsappId}! Restaurando chaves ativas...`);
              await pool.query(
                `INSERT INTO baileys_auth_state (id, whatsapp_id, data_id, data)
                 SELECT id, whatsapp_id, data_id, data FROM baileys_auth_state_backup WHERE whatsapp_id = $1
                 ON CONFLICT (whatsapp_id, data_id) DO UPDATE SET data = EXCLUDED.data`,
                [whatsappId]
              ).catch(() => {});
            }
          }
        } catch (bkErr) {}
      }
    } catch (e: any) {
      console.warn('[Baileys Auth Warning]: Falha ao ler credenciais do PostgreSQL:', e?.message || e);
    }
  } else if (creds && (creds.registered || creds.me)) {
    isRestoredSession = true;
  }

  // Apenas gera novas credenciais se NENHUMA existir salva no banco nem no backup
  if (!creds) {
    console.log('[Baileys Auth] Nenhuma credencial existente encontrada no PostgreSQL. Gerando novas credenciais para QR Code...');
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
        // Salva na tabela principal
        await pool.query(
          `INSERT INTO baileys_auth_state (id, whatsapp_id, data_id, data) 
           VALUES ($1, $2, 'creds', $3)
           ON CONFLICT (whatsapp_id, data_id) 
           DO UPDATE SET data = EXCLUDED.data`,
          [keyId, whatsappId, serialized]
        );
        // Garante e salva na tabela de backup espelho
        await pool.query(`
          CREATE TABLE IF NOT EXISTS baileys_auth_state_backup (
            id VARCHAR(64) PRIMARY KEY,
            whatsapp_id VARCHAR(64) NOT NULL,
            data_id VARCHAR(255) NOT NULL,
            data TEXT NOT NULL,
            CONSTRAINT uq_baileys_key_backup UNIQUE (whatsapp_id, data_id)
          );
        `).catch(() => {});
        await pool.query(
          `INSERT INTO baileys_auth_state_backup (id, whatsapp_id, data_id, data) 
           VALUES ($1, $2, 'creds', $3)
           ON CONFLICT (whatsapp_id, data_id) 
           DO UPDATE SET data = EXCLUDED.data`,
          [keyId, whatsappId, serialized]
        ).catch(() => {});
      } catch (err: any) {
        console.error('[Baileys Auth] Erro ao persistir creds no PostgreSQL:', err?.message || err);
      }
    }
  };

  const clearState = async () => {
    memoryStore.creds = null;
    memoryStore.keys = {};
    if (pool) {
      try {
        await pool.query(`DELETE FROM baileys_auth_state WHERE whatsapp_id = $1`, [whatsappId]);
        await pool.query(`DELETE FROM baileys_auth_state_backup WHERE whatsapp_id = $1`, [whatsappId]).catch(() => {});
        await pool.query(
          `UPDATE whatsapp_accounts SET status = 'DISCONNECTED', phone = NULL, qr_code = NULL, last_connection = NULL WHERE id = $1`,
          [whatsappId]
        );
      } catch (e) {}
    }
  };

  return {
    isRestoredSession,
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [key: string]: any } = {};
          if (ids.length === 0) return data;

          const missingIds: string[] = [];
          for (const id of ids) {
            const memKey = `${type}-${id}`;
            const val = memoryStore.keys[memKey];
            if (val !== undefined && val !== null) {
              data[id] = type === 'app-state-sync-key' ? proto.Message.AppStateSyncKeyData.fromObject(val) : val;
            } else {
              missingIds.push(id);
            }
          }

          // Busca em lote no PostgreSQL para máxima velocidade
          if (missingIds.length > 0 && pool) {
            try {
              const memKeys = missingIds.map(id => `${type}-${id}`);
              const res = await pool.query(
                `SELECT data_id, data FROM baileys_auth_state WHERE whatsapp_id = $1 AND data_id = ANY($2)`,
                [whatsappId, memKeys]
              );

              if (res?.rows) {
                for (const row of res.rows) {
                  if (row.data) {
                    const rawVal = JSON.parse(row.data, BufferJSON.reviver);
                    memoryStore.keys[row.data_id] = rawVal;
                    const cleanId = row.data_id.replace(`${type}-`, '');
                    data[cleanId] = type === 'app-state-sync-key' && rawVal
                      ? proto.Message.AppStateSyncKeyData.fromObject(rawVal)
                      : rawVal;
                  }
                }
              }
            } catch (e: any) {
              console.warn('[Baileys Auth] Erro ao recuperar chaves em lote:', e?.message || e);
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

          // Persiste no PostgreSQL com execução paralela (estilo wa-central)
          if (pool) {
            const tasks: Promise<any>[] = [];
            for (const category of Object.keys(dataset)) {
              const catData = dataset[category as keyof SignalDataTypeMap];
              if (!catData) continue;

              for (const [id, value] of Object.entries(catData)) {
                const dataId = `${category}-${id}`;
                if (value) {
                  const serialized = JSON.stringify(value, BufferJSON.replacer);
                  const uid = crypto.randomUUID();
                  tasks.push(
                    pool.query(
                      `INSERT INTO baileys_auth_state (id, whatsapp_id, data_id, data) 
                       VALUES ($1, $2, $3, $4)
                       ON CONFLICT (whatsapp_id, data_id) 
                       DO UPDATE SET data = EXCLUDED.data`,
                      [uid, whatsappId, dataId, serialized]
                    ).catch(err => {
                      console.warn(`[Baileys Auth] Erro ao salvar chave ${dataId}:`, err?.message || err);
                    })
                  );
                  tasks.push(
                    pool.query(
                      `INSERT INTO baileys_auth_state_backup (id, whatsapp_id, data_id, data) 
                       VALUES ($1, $2, $3, $4)
                       ON CONFLICT (whatsapp_id, data_id) 
                       DO UPDATE SET data = EXCLUDED.data`,
                      [uid, whatsappId, dataId, serialized]
                    ).catch(() => {})
                  );
                } else {
                  tasks.push(
                    pool.query(
                      `DELETE FROM baileys_auth_state WHERE whatsapp_id = $1 AND data_id = $2`,
                      [whatsappId, dataId]
                    ).catch(() => {})
                  );
                }
              }
            }
            if (tasks.length > 0) {
              await Promise.all(tasks);
            }
          }
        }
      }
    },
    saveCreds,
    clearState
  };
}
