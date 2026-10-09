import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/whatsapp/db';

export const dynamic = 'force-dynamic';

function formatRelativeTime(dateStr: string | Date | null): string {
  if (!dateStr) return 'Data não informada';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'Agora mesmo';

  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `Há ${diffMins} min`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Há ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ontem';
  return `Há ${diffDays} dias`;
}

function parseCartItems(cartJson: string | null): { items: any[]; total: number; count: number } {
  if (!cartJson) return { items: [], total: 0, count: 0 };
  try {
    const raw = typeof cartJson === 'string' ? JSON.parse(cartJson) : cartJson;
    if (!Array.isArray(raw)) return { items: [], total: 0, count: 0 };

    let total = 0;
    let count = 0;

    const items = raw.map((item: any) => {
      const price = Number(item.price || item.sale_price || item.unit_price || 0);
      const qty = Number(item.quantity || item.qty || 1);
      const subtotal = price * qty;
      total += subtotal;
      count += qty;

      return {
        id: item.id || item.product_id,
        name: item.name || item.title || item.product_name || 'Produto Ecosopis',
        price,
        quantity: qty,
        subtotal,
        image_url: item.image_url || item.image || item.thumbnail || '/images/placeholder.png'
      };
    });

    return { items, total, count };
  } catch (e) {
    return { items: [], total: 0, count: 0 };
  }
}

export async function GET(req: Request) {
  try {
    const pool = getDbPool();
    let rawRows: any[] = [];

    if (pool) {
      try {
        const query = `
          SELECT 
            id, 
            full_name, 
            email, 
            phone, 
            cart_json, 
            cart_updated_at, 
            created_at
          FROM users
          WHERE cart_json IS NOT NULL 
            AND cart_json != '' 
            AND cart_json != '[]'
          ORDER BY cart_updated_at DESC NULLS LAST
        `;
        const res = await pool.query(query);
        rawRows = res.rows;
      } catch (dbErr: any) {
        console.warn('Erro ao consultar carrinhos via PostgreSQL, tentando fallback:', dbErr.message);
      }
    }

    if (rawRows.length === 0) {
      // Fallback via API backend
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const authHeader = req.headers.get('authorization') || '';
      const apiRes = await fetch(`${backendUrl}/api/auth/users`, {
        headers: authHeader ? { Authorization: authHeader } : {}
      });

      if (apiRes.ok) {
        const data = await apiRes.json();
        rawRows = (Array.isArray(data) ? data : []).filter(
          (u: any) => u.cart_json && u.cart_json !== '[]' && String(u.cart_json).trim() !== ''
        );
      }
    }

    let totalAbandonedValue = 0;
    let cartsWithPhoneCount = 0;

    const carts = rawRows
      .map((row: any) => {
        const { items, total, count } = parseCartItems(row.cart_json);
        if (items.length === 0) return null;

        totalAbandonedValue += total;
        const hasPhone = !!(row.phone && String(row.phone).trim().length >= 8);
        if (hasPhone) cartsWithPhoneCount++;

        return {
          user_id: row.id,
          name: row.full_name || 'Cliente',
          email: row.email,
          phone: row.phone || null,
          has_phone: hasPhone,
          cart_updated_at: row.cart_updated_at || row.created_at,
          time_ago: formatRelativeTime(row.cart_updated_at || row.created_at),
          items,
          items_count: count,
          total_value: total
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      carts,
      total_abandoned_value: totalAbandonedValue,
      total_carts_count: carts.length,
      carts_with_phone_count: cartsWithPhoneCount
    });

  } catch (error: any) {
    console.error('Erro na rota /api/whatsapp/abandoned-carts:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar carrinhos abandonados' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json({ error: 'user_id é obrigatório' }, { status: 400 });
    }

    const pool = getDbPool();
    if (pool) {
      try {
        await pool.query('UPDATE users SET cart_json = NULL, cart_updated_at = NULL WHERE id = $1', [userId]);
      } catch (dbErr: any) {
        console.warn('Erro ao atualizar PostgreSQL direto:', dbErr.message);
      }
    }

    // Também limpa via fallback backend se necessário
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const authHeader = req.headers.get('authorization') || '';
    try {
      await fetch(`${backendUrl}/api/cart/admin/clear/${userId}`, {
        method: 'DELETE',
        headers: authHeader ? { Authorization: authHeader } : {}
      });
    } catch {
      // Ignora erro do fallback backend
    }

    return NextResponse.json({ success: true, message: 'Carrinho excluído com sucesso' });
  } catch (error: any) {
    console.error('Erro ao excluir carrinho:', error);
    return NextResponse.json({ error: error.message || 'Erro ao excluir carrinho' }, { status: 500 });
  }
}
