import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/whatsapp/db';
import { ensureCommerceTables, getActiveCatalogProducts } from '@/lib/whatsapp/whatsappCommerce';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = (params?.token || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Token de checkout não informado.' }, { status: 400 });
    }

    await ensureCommerceTables();
    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Banco de dados indisponível.' }, { status: 503 });
    }

    const res = await pool.query(
      `SELECT
         token, jid, phone, customer_name, customer_email, customer_cpf, cep,
         address_json, items_json, coupon_code, shipping_method, shipping_service_id,
         shipping_price, status, order_id, guest_access_token, created_at, updated_at
       FROM whatsapp_commerce_checkouts
       WHERE token = $1`,
      [token]
    );

    if (!res?.rows || res.rows.length === 0) {
      return NextResponse.json(
        { error: 'Link de compra não encontrado ou expirado.' },
        { status: 404 }
      );
    }

    const row = res.rows[0];
    const catalog = await getActiveCatalogProducts();

    let items: any[] = [];
    let address: any = {};
    try {
      items = JSON.parse(row.items_json || '[]');
    } catch {}
    try {
      address = JSON.parse(row.address_json || '{}');
    } catch {}

    return NextResponse.json({
      token: row.token,
      phone: row.phone || '',
      customer_name: row.customer_name || '',
      customer_email: row.customer_email || '',
      customer_cpf: row.customer_cpf || '',
      cep: row.cep || address.postal_code || address.cep || '',
      address,
      items,
      coupon_code: row.coupon_code || '',
      shipping_method: row.shipping_method || '',
      shipping_service_id: row.shipping_service_id || null,
      shipping_price: Number(row.shipping_price || 0),
      status: row.status || 'pending_review',
      order_id: row.order_id || null,
      guest_access_token: row.guest_access_token || null,
      created_at: row.created_at,
      catalog,
    });
  } catch (err: any) {
    console.error('[WhatsApp Catalog Checkout GET Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao carregar dados do pedido.' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = (params?.token || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 400 });
    }

    await ensureCommerceTables();
    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Banco de dados indisponível.' }, { status: 503 });
    }

    const body = await req.json();

    const checkRes = await pool.query(
      `SELECT token, address_json, items_json FROM whatsapp_commerce_checkouts WHERE token = $1`,
      [token]
    );
    if (!checkRes?.rows || checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Link de compra não encontrado.' }, { status: 404 });
    }

    const existing = checkRes.rows[0];
    const itemsJson = body.items ? JSON.stringify(body.items) : existing.items_json;
    const addressJson = body.address ? JSON.stringify(body.address) : existing.address_json;

    await pool.query(
      `UPDATE whatsapp_commerce_checkouts SET
         customer_name = COALESCE($1, customer_name),
         customer_email = COALESCE($2, customer_email),
         customer_cpf = COALESCE($3, customer_cpf),
         phone = COALESCE($4, phone),
         cep = COALESCE($5, cep),
         address_json = $6,
         items_json = $7,
         coupon_code = COALESCE($8, coupon_code),
         shipping_method = COALESCE($9, shipping_method),
         shipping_service_id = COALESCE($10, shipping_service_id),
         shipping_price = COALESCE($11, shipping_price),
         status = COALESCE($12, status),
         order_id = COALESCE($13, order_id),
         guest_access_token = COALESCE($14, guest_access_token),
         updated_at = NOW()
       WHERE token = $15`,
      [
        body.customer_name ?? null,
        body.customer_email ?? null,
        body.customer_cpf ? String(body.customer_cpf).replace(/\D/g, '') : null,
        body.phone ?? null,
        body.cep ? String(body.cep).replace(/\D/g, '') : null,
        addressJson,
        itemsJson,
        body.coupon_code !== undefined ? body.coupon_code : null,
        body.shipping_method ?? null,
        body.shipping_service_id ?? null,
        body.shipping_price !== undefined ? Number(body.shipping_price) : null,
        body.status ?? null,
        body.order_id ?? null,
        body.guest_access_token ?? null,
        token,
      ]
    );

    return NextResponse.json({ status: 'success', token });
  } catch (err: any) {
    console.error('[WhatsApp Catalog Checkout PUT Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao atualizar revisão do pedido.' },
      { status: 500 }
    );
  }
}

