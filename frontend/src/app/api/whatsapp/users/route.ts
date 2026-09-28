import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/whatsapp/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const pool = getDbPool();

    if (pool) {
      try {
        const query = `
          SELECT 
            id, 
            full_name, 
            email, 
            phone, 
            role, 
            total_compras, 
            cart_json, 
            cart_updated_at, 
            created_at
          FROM users
          ORDER BY id DESC
        `;
        const res = await pool.query(query);
        const users = res.rows.map((row: any) => ({
          id: row.id,
          name: row.full_name || 'Sem nome',
          email: row.email,
          phone: row.phone || null,
          has_phone: !!(row.phone && row.phone.trim().length >= 8),
          role: row.role || 'client',
          total_orders: row.total_compras || 0,
          created_at: row.created_at,
          cart_updated_at: row.cart_updated_at,
          has_cart: !!(row.cart_json && row.cart_json !== '[]' && row.cart_json.trim() !== '')
        }));

        return NextResponse.json({ users });
      } catch (dbErr: any) {
        console.warn('Erro ao consultar users via pool PostgreSQL, tentando fallback na API:', dbErr.message);
      }
    }

    // Fallback: consulta API FastAPI
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const authHeader = req.headers.get('authorization') || '';
    const apiRes = await fetch(`${backendUrl}/api/auth/users`, {
      headers: authHeader ? { Authorization: authHeader } : {}
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      const users = (Array.isArray(data) ? data : []).map((row: any) => ({
        id: row.id,
        name: row.full_name || 'Sem nome',
        email: row.email,
        phone: row.phone || null,
        has_phone: !!(row.phone && String(row.phone).trim().length >= 8),
        role: row.role || 'client',
        total_orders: row.total_compras || 0,
        created_at: row.created_at,
        cart_updated_at: row.cart_updated_at,
        has_cart: !!(row.cart_json && row.cart_json !== '[]' && String(row.cart_json).trim() !== '')
      }));

      return NextResponse.json({ users });
    }

    return NextResponse.json({ users: [] });
  } catch (error: any) {
    console.error('Erro na rota /api/whatsapp/users:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar lista de usuários' },
      { status: 500 }
    );
  }
}
