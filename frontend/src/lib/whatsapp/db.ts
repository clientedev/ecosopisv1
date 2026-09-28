import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDbPool(): Pool | null {
  if (!pool) {
    const connectionString = 
      process.env.DATABASE_URL || 
      process.env.POSTGRES_URL || 
      process.env.DATABASE_PUBLIC_URL;

    if (!connectionString) {
      console.warn('[PostgreSQL WhatsApp] Nenhuma string de conexão encontrada nas variáveis de ambiente.');
      return null;
    }

    const cleanUrl = connectionString.replace('postgresql+psycopg2://', 'postgresql://');

    pool = new Pool({
      connectionString: cleanUrl,
      ssl: cleanUrl && !cleanUrl.includes('localhost') && !cleanUrl.includes('127.0.0.1')
        ? { rejectUnauthorized: false }
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // 10s para conexões em containers frios
    });

    pool.on('error', (err) => {
      console.warn('[PostgreSQL WhatsApp Pool Warning]:', err.message);
    });
  }
  return pool;
}

export async function checkDbConnection(): Promise<boolean> {
  const p = getDbPool();
  if (!p) return false;
  try {
    const client = await p.connect();
    if (client) {
      client.release();
      return true;
    }
    return false;
  } catch (e: any) {
    console.warn('[PostgreSQL WhatsApp Check Failed]:', e?.message || e);
    return false;
  }
}
