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

/**
 * Adaptador transacional customizado de autenticação do Baileys com persistência direta no PostgreSQL.
 * NUNCA salva arquivos em disco (compatível com Railway, Docker e ambientes efêmeros).
 */
export async function getPostgresAuthState(whatsappId: string = 'default'): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearState: () => Promise<void>;
}> {
  const pool = getDbPool();

  // 1. Garante que a conta existe no banco
  await pool.query(
    `INSERT INTO whatsapp_accounts (id, name, status) 
     VALUES ($1, 'WhatsApp Principal E-commerce', 'DISCONNECTED')
     ON CONFLICT (id) DO NOTHING`,
    [whatsappId]
  );

  // 2. Busca ou inicializa as credenciais principais (creds)
  const credsRes = await pool.query(
    `SELECT data FROM baileys_auth_state WHERE whatsapp_id = $1 AND data_id = 'creds'`,
    [whatsappId]
  );

  let creds: AuthenticationCreds;
  if (credsRes.rows.length > 0 && credsRes.rows[0].data) {
    try {
      creds = JSON.parse(credsRes.rows[0].data, BufferJSON.reviver);
    } catch (e) {
      console.error('Erro ao deserializar creds do WhatsApp, reinicializando:', e);
      creds = initAuthCreds();
    }
  } else {
    creds = initAuthCreds();
  }

  // 3. Função para salvar credenciais
  const saveCreds = async () => {
    const serialized = JSON.stringify(creds, BufferJSON.replacer);
    const keyId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO baileys_auth_state (id, whatsapp_id, data_id, data) 
       VALUES ($1, $2, 'creds', $3)
       ON CONFLICT (whatsapp_id, data_id) 
       DO UPDATE SET data = EXCLUDED.data`,
      [keyId, whatsappId, serialized]
    );
  };

  // 4. Limpeza total de credenciais (Logout ou Reset)
  const clearState = async () => {
    await pool.query(
      `DELETE FROM baileys_auth_state WHERE whatsapp_id = $1`,
      [whatsappId]
    );
    await pool.query(
      `UPDATE whatsapp_accounts SET status = 'DISCONNECTED', phone = NULL, qr_code = NULL, last_connection = NULL WHERE id = $1`,
      [whatsappId]
    );
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [key: string]: any } = {};
          if (ids.length === 0) return data;

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
            } catch (err) {
              console.error(`Erro ao deserializar chave ${row.data_id}:`, err);
            }
          }
          return data;
        },
        set: async (data) => {
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            for (const category of Object.keys(data)) {
              const catData = data[category as keyof SignalDataTypeMap];
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
            throw e;
          } finally {
            client.release();
          }
        }
      }
    },
    saveCreds,
    clearState
  };
}
