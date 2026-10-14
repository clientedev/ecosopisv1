import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/whatsapp/db';
import { BufferJSON } from '@whiskeysockets/baileys';
import { connectWhatsApp } from '@/lib/whatsapp/whatsappService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database pool not available' }, { status: 500 });
    }

    const res = await pool.query(
      `SELECT data_id, length(data) as len, substring(data, 1, 200) as preview 
       FROM baileys_auth_state 
       WHERE whatsapp_id = 'default'`
    );

    const credsRes = await pool.query(
      `SELECT data FROM baileys_auth_state WHERE whatsapp_id = 'default' AND data_id = 'creds'`
    );

    let credsInfo = null;
    let foundPhoneData = null;
    if (credsRes?.rows?.length > 0 && credsRes.rows[0].data) {
      try {
        const parsed = JSON.parse(credsRes.rows[0].data, BufferJSON.reviver);
        credsInfo = {
          hasMe: Boolean(parsed.me),
          meId: parsed.me?.id,
          meName: parsed.me?.name,
          registered: parsed.registered,
          pairingCode: parsed.pairingCode,
          fullKeys: Object.keys(parsed)
        };
      } catch (e: any) {
        credsInfo = { parseError: e.message };
      }
    }

    // Busca se o número de telefone está em alguma outra chave
    const phoneSearch = await pool.query(
      `SELECT data_id, length(data) as len FROM baileys_auth_state WHERE data LIKE '%5511972812234%' LIMIT 10`
    );
    foundPhoneData = phoneSearch?.rows || [];

    const accountRes = await pool.query(
      `SELECT id, status, phone, last_connection FROM whatsapp_accounts WHERE id = 'default'`
    );

    const tablesRes = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    const tables = tablesRes?.rows?.map(r => r.table_name) || [];

    return NextResponse.json({
      account: accountRes?.rows?.[0] || null,
      totalKeys: res?.rows?.length || 0,
      foundPhoneData,
      credsInfo,
      allTables: tables
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Tenta forçar reconexão usando as credenciais do banco
    const result = await connectWhatsApp('default', false);
    return NextResponse.json({ status: 'attempted_reconnect', result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
