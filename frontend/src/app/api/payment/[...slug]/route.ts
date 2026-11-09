import { NextResponse, NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_BASE = 'https://web-production-33f04.up.railway.app';

async function proxyPaymentRequest(req: NextRequest, { params }: { params: { slug: string[] } }) {
  try {
    const slug = params?.slug ? params.slug.join('/') : '';
    const search = req.nextUrl.search || '';
    const targetUrl = `${BACKEND_BASE}/api/payment/${slug}${search}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    const authHeader = req.headers.get('authorization');
    if (authHeader) headers['Authorization'] = authHeader;

    const contentType = req.headers.get('content-type');
    if (contentType) headers['Content-Type'] = contentType;

    let body: any = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        body = await req.text();
      } catch {
        body = undefined;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const backendRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseContentType = backendRes.headers.get('content-type') || '';
    if (responseContentType.includes('application/json')) {
      const data = await backendRes.json();
      return NextResponse.json(data, {
        status: backendRes.status,
      });
    }

    const textData = await backendRes.text();
    return new NextResponse(textData, {
      status: backendRes.status,
      headers: {
        'content-type': responseContentType || 'text/plain',
      },
    });
  } catch (err: any) {
    console.error('[Payment API Proxy Error]:', err);
    return NextResponse.json(
      {
        detail: err?.message || 'Falha de comunicação com o servidor de pagamento. Tente novamente.',
        error: true,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, ctx: any) {
  return proxyPaymentRequest(req, ctx);
}

export async function POST(req: NextRequest, ctx: any) {
  return proxyPaymentRequest(req, ctx);
}

export async function PUT(req: NextRequest, ctx: any) {
  return proxyPaymentRequest(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: any) {
  return proxyPaymentRequest(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: any) {
  return proxyPaymentRequest(req, ctx);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
