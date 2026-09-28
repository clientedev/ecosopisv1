import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    const rawUrl = 
      process.env.DATABASE_URL || 
      process.env.POSTGRES_URL || 
      process.env.DATABASE_PUBLIC_URL ||
      'postgresql://postgres:tIrQzBYwBOacJhZPNDehIOoIfltenbBz@nozomi.proxy.rlwy.net:45826/railway';
      
    // Fix dialect for pg driver if needed
    const connectionString = rawUrl.replace('postgresql+psycopg2://', 'postgresql://');

    pool = new Pool({
      connectionString,
      ssl: connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')
        ? { rejectUnauthorized: false }
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('PostgreSQL WhatsApp Pool Error:', err);
    });
  }
  return pool;
}
