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

let tablesInitialized = false;

/**
 * Garante que todas as tabelas de autenticação e a conta padrão existam antes de qualquer operação
 */
async function ensureAuthTables(whatsappId: string = 'default'): Promise<void> {
  const pool = getDbPool();
  if (!pool) return;
  try {
    if (!tablesInitialized) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS whatsapp_accounts (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL DEFAULT 'WhatsApp Principal E-commerce',
          status VARCHAR(64) NOT NULL DEFAULT 'DISCONNECTED',
          phone VARCHAR(64),
          qr_code TEXT,
          last_connection TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS baileys_auth_state (
          id VARCHAR(64) PRIMARY KEY,
          whatsapp_id VARCHAR(64) NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
          data_id VARCHAR(255) NOT NULL,
          data TEXT NOT NULL,
          CONSTRAINT uq_baileys_key UNIQUE (whatsapp_id, data_id)
        );

        CREATE TABLE IF NOT EXISTS baileys_auth_state_backup (
          id VARCHAR(64) PRIMARY KEY,
          whatsapp_id VARCHAR(64) NOT NULL,
          data_id VARCHAR(255) NOT NULL,
          data TEXT NOT NULL,
          CONSTRAINT uq_baileys_key_backup UNIQUE (whatsapp_id, data_id)
        );
      `);
      tablesInitialized = true;
    }

    await pool.query(
      `INSERT INTO whatsapp_accounts (id, name, status)
       VALUES ($1, 'WhatsApp Principal E-commerce', 'CONNECTING')
       ON CONFLICT (id) DO NOTHING`,
      [whatsappId]
    );
  } catch (err: any) {
    console.warn('[Baileys Auth] Aviso ao garantir tabelas:', err?.message || err);
  }
}

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
        if (parsed?.registered || parsed?.me || parsed?.account || parsed?.noiseKey) return true;
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
        if (parsedBackup?.registered || parsedBackup?.me || parsedBackup?.account || parsedBackup?.noiseKey) return true;
      } catch (e) {}
    }

    // 3. Fallback seguro estilo wa-central: se houver chaves de autenticação salvas para esta conta
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM baileys_auth_state WHERE whatsapp_id = $1`,
      [whatsappId]
    ).catch(() => null);
    const count = parseInt(countRes?.rows?.[0]?.count || '0', 10);
    if (count > 1) return true;

    const backupCountRes = await pool.query(
      `SELECT COUNT(*) FROM baileys_auth_state_backup WHERE whatsapp_id = $1`,
      [whatsappId]
    ).catch(() => null);
    const backupCount = parseInt(backupCountRes?.rows?.[0]?.count || '0', 10);
    if (backupCount > 1) return true;

    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Adaptador transacional de autenticação do Baileys com persistência direta no PostgreSQL (arquitetura idêntica ao wa-central).
 * Sempre lê credenciais e chaves frescas do PostgreSQL ao abrir o socket (sem cache global obsoleto entre deploys),
 * utilizando o makeCacheableSignalKeyStore do próprio Baileys por socket e espelhamento em tabela de backup.
 */
export async function getPostgresAuthState(whatsappId: string = 'default'): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearState: () => Promise<void>;
  isRestoredSession: boolean;
}> {
  const pool = getDbPool();
  await ensureAuthTables(whatsappId);

  let isRestoredSession = false;
  let creds: AuthenticationCreds | null = null;

  // Sempre busca credenciais frescas do PostgreSQL ao iniciar o socket (como no wa-central)
  if (pool) {
    try {
      // 1. Tenta da tabela principal
      const credsRes = await pool.query(
        `SELECT data FROM baileys_auth_state WHERE whatsapp_id = $1 AND data_id = 'creds'`,
        [whatsappId]
      );
      if (credsRes?.rows?.length > 0 && credsRes.rows[0].data) {
        creds = JSON.parse(credsRes.rows[0].data, BufferJSON.reviver);
        if (creds?.registered || creds?.me || creds?.account) {
          isRestoredSession = true;
          console.log(`[Baileys Auth] Sessão recuperada do PostgreSQL com sucesso para ${whatsappId}!`);
        }
      }

      // 2. Fallback de emergência: se a tabela principal não tinha sessão registrada, verifica o backup automático
      if (!isRestoredSession) {
        try {
          const backupRes = await pool.query(
            `SELECT data FROM baileys_auth_state_backup WHERE whatsapp_id = $1 AND data_id = 'creds'`,
            [whatsappId]
          );
          if (backupRes?.rows?.length > 0 && backupRes.rows[0].data) {
            const backupCreds = JSON.parse(backupRes.rows[0].data, BufferJSON.reviver);
            if (backupCreds?.registered || backupCreds?.me || backupCreds?.account) {
              creds = backupCreds;
              isRestoredSession = true;
              console.log(`[Baileys Auth] SESSÃO RECUPERADA DO BACKUP AUTOMÁTICO para ${whatsappId}! Restaurando chaves ativas...`);
              await pool.query(
                `INSERT INTO baileys_auth_state (id, whatsapp_id, data_id, data)
                 SELECT id, whatsapp_id, data_id, data FROM baileys_auth_state_backup WHERE whatsapp_id = $1
                 ON CONFLICT (whatsapp_id, data_id) DO UPDATE SET data = EXCLUDED.data`,
                [whatsappId]
              ).catch(() => {});
            } else if (!creds) {
              creds = backupCreds;
            }
          }
        } catch (bkErr) {}
      }

      // 3. Mesmo que creds.registered ainda não esteja true mas já existam chaves salvas no banco
      if (!isRestoredSession && creds) {
        const countRes = await pool.query(
          `SELECT COUNT(*) FROM baileys_auth_state WHERE whatsapp_id = $1`,
          [whatsappId]
        ).catch(() => null);
        const count = parseInt(countRes?.rows?.[0]?.count || '0', 10);
        if (count > 1) {
          isRestoredSession = true;
        }
      }
    } catch (e: any) {
      console.warn('[Baileys Auth Warning]: Falha ao ler credenciais do PostgreSQL:', e?.message || e);
    }
  }

  // Apenas gera novas credenciais se NENHUMA existir salva no banco nem no backup
  if (!creds) {
    console.log('[Baileys Auth] Nenhuma credencial existente encontrada no PostgreSQL. Gerando novas credenciais para QR Code...');
    creds = initAuthCreds();
  }

  const writeData = async (dataId: string, data: any) => {
    if (!pool) return;
    try {
      const serialized = JSON.stringify(data, BufferJSON.replacer);
      const uid = crypto.randomUUID();
      await Promise.all([
        pool.query(
          `INSERT INTO baileys_auth_state (id, whatsapp_id, data_id, data) 
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (whatsapp_id, data_id) 
           DO UPDATE SET data = EXCLUDED.data`,
          [uid, whatsappId, dataId, serialized]
        ),
        pool.query(
          `INSERT INTO baileys_auth_state_backup (id, whatsapp_id, data_id, data) 
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (whatsapp_id, data_id) 
           DO UPDATE SET data = EXCLUDED.data`,
          [uid, whatsappId, dataId, serialized]
        ).catch(() => {})
      ]);
    } catch (err: any) {
      console.error(`[Baileys Auth] Erro ao persistir ${dataId} no PostgreSQL:`, err?.message || err);
    }
  };

  const removeData = async (dataId: string) => {
    if (!pool) return;
    try {
      await Promise.all([
        pool.query(
          `DELETE FROM baileys_auth_state WHERE whatsapp_id = $1 AND data_id = $2`,
          [whatsappId, dataId]
        ).catch(() => {}),
        pool.query(
          `DELETE FROM baileys_auth_state_backup WHERE whatsapp_id = $1 AND data_id = $2`,
          [whatsappId, dataId]
        ).catch(() => {})
      ]);
    } catch (err: any) {
      console.error(`[Baileys Auth] Erro ao remover ${dataId} do PostgreSQL:`, err?.message || err);
    }
  };

  const saveCreds = async () => {
    if (!creds) return;
    await writeData('creds', creds);
  };

  const clearState = async () => {
    console.warn(`[Baileys Auth] clearState() chamado explicitamente para ${whatsappId}`);
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
          if (ids.length === 0 || !pool) return data;

          try {
            const dbKeys = ids.map(id => `${type}-${id}`);
            const res = await pool.query(
              `SELECT data_id, data FROM baileys_auth_state WHERE whatsapp_id = $1 AND data_id = ANY($2)`,
              [whatsappId, dbKeys]
            );

            const foundKeys = new Set<string>();
            if (res?.rows) {
              for (const row of res.rows) {
                if (row.data) {
                  foundKeys.add(row.data_id);
                  const rawVal = JSON.parse(row.data, BufferJSON.reviver);
                  const cleanId = row.data_id.slice(`${type}-`.length);
                  data[cleanId] = type === 'app-state-sync-key' && rawVal
                    ? proto.Message.AppStateSyncKeyData.fromObject(rawVal)
                    : rawVal;
                }
              }
            }

            // Fallback na tabela de backup caso alguma chave não tenha sido encontrada na principal
            const missingDbKeys = dbKeys.filter(k => !foundKeys.has(k));
            if (missingDbKeys.length > 0) {
              const backupRes = await pool.query(
                `SELECT data_id, data FROM baileys_auth_state_backup WHERE whatsapp_id = $1 AND data_id = ANY($2)`,
                [whatsappId, missingDbKeys]
              ).catch(() => null);

              if (backupRes?.rows) {
                for (const row of backupRes.rows) {
                  if (row.data) {
                    const rawVal = JSON.parse(row.data, BufferJSON.reviver);
                    const cleanId = row.data_id.slice(`${type}-`.length);
                    data[cleanId] = type === 'app-state-sync-key' && rawVal
                      ? proto.Message.AppStateSyncKeyData.fromObject(rawVal)
                      : rawVal;
                  }
                }
              }
            }
          } catch (e: any) {
            console.warn('[Baileys Auth] Erro ao recuperar chaves em lote:', e?.message || e);
          }

          return data;
        },
        set: async (dataset) => {
          if (!pool) return;
          const tasks: Promise<any>[] = [];

          for (const category of Object.keys(dataset)) {
            const catData = dataset[category as keyof SignalDataTypeMap];
            if (!catData) continue;

            for (const [id, value] of Object.entries(catData)) {
              const dataId = `${category}-${id}`;
              if (value) {
                tasks.push(writeData(dataId, value));
              } else {
                tasks.push(removeData(dataId));
              }
            }
          }

          if (tasks.length > 0) {
            await Promise.all(tasks);
          }
        }
      }
    },
    saveCreds,
    clearState
  };
}
