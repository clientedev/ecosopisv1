import { Pool } from 'pg';

let pool: Pool | null = null;
let isDbAvailable: boolean | null = null;

export function getDbPool(): Pool | null {
  if (isDbAvailable === false) return null;

  if (!pool) {
    const connectionString = 
      process.env.DATABASE_URL || 
      process.env.POSTGRES_URL || 
      process.env.DATABASE_PUBLIC_URL;

    if (!connectionString) {
      isDbAvailable = false;
      return null;
    }

    const cleanUrl = connectionString.replace('postgresql+psycopg2://', 'postgresql://');

    pool = new Pool({
      connectionString: cleanUrl,
      ssl: cleanUrl && !cleanUrl.includes('localhost') && !cleanUrl.includes('127.0.0.1')
        ? { rejectUnauthorized: false }
        : false,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 3000, // Máximo 3s para não travar o Baileys
    });

    pool.on('error', (err) => {
      console.warn('PostgreSQL WhatsApp Pool Warning (usando fallback em memória):', err.message);
    });
  }
  return pool;
}

export async function checkDbConnection(): Promise<boolean> {
  const p = getDbPool();
  if (!p) return false;
  try {
    const client = await Promise.race([
      p.connect(),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 2500))
    ]);
    if (client) {
      (client as any).release();
      isDbAvailable = true;
      return true;
    }
    return false;
  } catch (e) {
    console.warn('PostgreSQL não acessível no frontend, ativando fallback em memória.');
    isDbAvailable = false;
    return false;
  }
}
