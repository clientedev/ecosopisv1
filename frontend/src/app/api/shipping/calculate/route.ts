import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://web-production-33f04.up.railway.app';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const destCep = (body?.dest_cep || '').replace(/\D/g, '');

    // Tenta obter cotacoes reais do backend / Melhor Envio com timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const targetUrl = `${BACKEND_URL.replace(/\/$/, '')}/shipping/calculate`;
      const backendRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (backendRes.ok) {
        const data = await backendRes.json();
        if (Array.isArray(data) && data.length > 0) {
          return NextResponse.json(data);
        }
      }
    } catch (backendErr) {
      console.warn('[Shipping Route] Backend quote failed or timed out, using regional fallback:', backendErr);
    }

    // Fallback regional automatico para que o checkout nunca fique travado
    const prefix = parseInt(destCep.substring(0, 2) || '1', 10);
    const isSP = prefix >= 1 && prefix <= 19;
    const isSouthSoutheast = (prefix >= 1 && prefix <= 39) || (prefix >= 80 && prefix <= 99);

    const fallbackOptions = [
      {
        id: 1,
        company: 'Correios',
        name: 'PAC',
        price: isSP ? 16.9 : isSouthSoutheast ? 22.9 : 31.9,
        delivery_time: isSP ? 4 : isSouthSoutheast ? 6 : 9,
      },
      {
        id: 2,
        company: 'Correios',
        name: 'SEDEX',
        price: isSP ? 21.9 : isSouthSoutheast ? 32.9 : 48.9,
        delivery_time: isSP ? 2 : isSouthSoutheast ? 3 : 5,
      },
    ];

    return NextResponse.json(fallbackOptions);
  } catch (err: any) {
    console.error('[Shipping Route Error]:', err);
    return NextResponse.json(
      [
        {
          id: 1,
          company: 'Correios',
          name: 'PAC',
          price: 22.9,
          delivery_time: 6,
        },
        {
          id: 2,
          company: 'Correios',
          name: 'SEDEX',
          price: 32.9,
          delivery_time: 3,
        },
      ],
      { status: 200 }
    );
  }
}
