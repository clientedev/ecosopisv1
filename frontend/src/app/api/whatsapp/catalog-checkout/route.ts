import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDbPool } from '@/lib/whatsapp/db';
import {
  ensureCommerceTables,
  getActiveCatalogProducts,
  buildCatalogMessage,
} from '@/lib/whatsapp/whatsappCommerce';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureCommerceTables();
    const products = await getActiveCatalogProducts();
    const catalogPreview = buildCatalogMessage(products);

    const pool = getDbPool();
    let recentCheckouts: any[] = [];
    if (pool) {
      const res = await pool
        .query(
          `SELECT token, phone, customer_name, customer_email, cep, items_json, status, order_id, created_at
           FROM whatsapp_commerce_checkouts
           ORDER BY created_at DESC
           LIMIT 25`
        )
        .catch(() => null);
      if (res?.rows) {
        recentCheckouts = res.rows.map((r: any) => {
          let items = [];
          try {
            items = JSON.parse(r.items_json || '[]');
          } catch {}
          return {
            ...r,
            items,
          };
        });
      }
    }

    return NextResponse.json({
      products,
      catalogPreview,
      recentCheckouts,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro ao carregar catálogo WhatsApp.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureCommerceTables();
    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Banco de dados indisponível.' }, { status: 503 });
    }

    const body = await req.json();
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Selecione ao menos um produto para gerar o link de compra.' },
        { status: 400 }
      );
    }

    const shortId = crypto.randomBytes(8).toString('hex');
    const token = `wa-${Date.now().toString(36)}-${shortId}`;

    const cepClean = String(body.cep || body.address?.postal_code || '').replace(/\D/g, '');
    const addressObj = {
      street: body.address?.street || '',
      number: body.address?.number || '',
      complement: body.address?.complement || '',
      neighborhood: body.address?.neighborhood || '',
      city: body.address?.city || '',
      state: body.address?.state || '',
      postal_code: cepClean,
      cep: cepClean,
      email: body.customer_email || '',
    };

    await pool.query(
      `INSERT INTO whatsapp_commerce_checkouts (
         token, phone, customer_name, customer_email, customer_cpf, cep,
         address_json, items_json, coupon_code, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_review', NOW(), NOW())`,
      [
        token,
        String(body.phone || '').replace(/\D/g, ''),
        body.customer_name || '',
        body.customer_email || '',
        String(body.customer_cpf || '').replace(/\D/g, ''),
        cepClean,
        JSON.stringify(addressObj),
        JSON.stringify(items),
        body.coupon_code || null,
      ]
    );

    const baseUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.FRONTEND_URL ||
      'https://www.ecosopis.com.br'
    ).replace(/\/$/, '');

    return NextResponse.json({
      token,
      checkoutUrl: `${baseUrl}/finalizar-compra/${token}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro ao gerar link de finalização de compra.' },
      { status: 500 }
    );
  }
}

