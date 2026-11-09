import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getFallbackOptions(destCep: string) {
  const prefix = parseInt(destCep.substring(0, 2) || '1', 10);
  const isSP = prefix >= 1 && prefix <= 19;
  const isSouthSoutheast = (prefix >= 1 && prefix <= 39) || (prefix >= 80 && prefix <= 99);

  return [
    {
      id: 31,
      company: 'Loggi',
      name: 'Express',
      price: isSP ? 9.85 : isSouthSoutheast ? 15.9 : 24.9,
      delivery_time: isSP ? 2 : isSouthSoutheast ? 4 : 6,
    },
    {
      id: 34,
      company: 'Loggi',
      name: 'Loggi Ponto',
      price: isSP ? 10.47 : isSouthSoutheast ? 16.5 : 25.5,
      delivery_time: isSP ? 3 : isSouthSoutheast ? 5 : 7,
    },
    {
      id: 33,
      company: 'JeT',
      name: 'Standard',
      price: isSP ? 14.9 : isSouthSoutheast ? 19.9 : 28.9,
      delivery_time: isSP ? 2 : isSouthSoutheast ? 4 : 6,
    },
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
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const destCep = (body?.dest_cep || '').replace(/\D/g, '');

    if (destCep.length !== 8) {
      return NextResponse.json({ error: 'CEP inválido' }, { status: 400 });
    }

    // Normaliza os itens com dimensoes seguras para o schema do backend / Melhor Envio
    const normalizedItems = Array.isArray(body?.items) && body.items.length > 0
      ? body.items.map((item: any, idx: number) => ({
          id: String(item?.id || idx + 1),
          name: item?.name || `Produto ${idx + 1}`,
          width: Number(item?.width) || 16,
          height: Number(item?.height) || 12,
          length: Number(item?.length) || 20,
          weight: Number(item?.weight) || 0.3,
          price: Number(item?.price) || 25,
          quantity: Number(item?.quantity) || 1,
        }))
      : [
          {
            id: '1',
            name: 'Produto',
            width: 16,
            height: 12,
            length: 20,
            weight: 0.3,
            price: 25,
            quantity: 1,
          },
        ];

    const payload = {
      dest_cep: destCep,
      items: normalizedItems,
    };

    // Prioriza o backend de producao no Railway, depois variaveis de ambiente
    const candidateBases = [
      'https://web-production-33f04.up.railway.app',
      process.env.BACKEND_URL,
      process.env.API_URL,
      process.env.NEXT_PUBLIC_API_URL,
    ]
      .filter(Boolean)
      .map((url) => String(url).replace(/\/$/, ''))
      .filter((url, index, self) => self.indexOf(url) === index);

    // Remove localhost/127.0.0.1 em ambiente de producao do Next.js
    const isProd = process.env.NODE_ENV === 'production';
    const targetBases = isProd
      ? candidateBases.filter((url) => !url.includes('localhost') && !url.includes('127.0.0.1'))
      : candidateBases;

    for (const base of targetBases) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const targetUrl = `${base}/shipping/calculate`;
        const backendRes = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
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
        // Tenta proxima base ou segue para o fallback
      }
    }

    // Fallback completo com todas as transportadoras (Loggi, J&T, Correios)
    return NextResponse.json(getFallbackOptions(destCep));
  } catch (err: any) {
    console.error('[Shipping Route Error]:', err);
    return NextResponse.json(getFallbackOptions('01001000'), { status: 200 });
  }
}
