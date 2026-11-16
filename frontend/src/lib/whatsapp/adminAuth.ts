import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * Proteção das rotas /api/whatsapp/* que só o painel admin (ou o próprio backend) deve usar.
 *
 * - Painel admin: envia "Authorization: Bearer <token>" (ou ?token= no stream SSE, que não aceita headers).
 *   O token é validado no backend (/api/auth/me) e precisa ser de um usuário com role "admin".
 * - Backend (avisos de pedido): envia o header "X-Internal-Key" igual à variável INTERNAL_API_KEY.
 *   Enquanto INTERNAL_API_KEY não estiver definida neste serviço, o caminho "interno" continua liberado
 *   (somente na rota de envio), para permitir um rollout sem derrubar nenhuma notificação.
 */
const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://web-production-33f04.up.railway.app'
    : process.env.BACKEND_URL && !process.env.BACKEND_URL.includes('localhost') && !process.env.BACKEND_URL.includes('127.0.0.1')
      ? process.env.BACKEND_URL
      : 'https://web-production-33f04.up.railway.app';

const cache = new Map<string, { ok: boolean; exp: number }>();

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

async function isAdminToken(token: string): Promise<boolean> {
  const now = Date.now();
  const hit = cache.get(token);
  if (hit && hit.exp > now) return hit.ok;
  let ok = false;
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.ok) {
      const me = await res.json();
      ok = me?.role === 'admin';
    }
  } catch {
    ok = false;
  }
  if (cache.size > 200) cache.clear();
  cache.set(token, { ok, exp: now + (ok ? 60_000 : 10_000) });
  return ok;
}

export async function guardAdmin(
  req: Request,
  opts: { allowInternal?: boolean } = {}
): Promise<Response | null> {
  if (opts.allowInternal) {
    const key = process.env.INTERNAL_API_KEY || '';
    if (!key) return null; // rollout: ainda não ativado neste serviço
    const sent = req.headers.get('x-internal-key') || '';
    if (sent && safeEqual(sent, key)) return null;
  }

  const header = req.headers.get('authorization') || '';
  let token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    try {
      token = new URL(req.url).searchParams.get('token') || '';
    } catch {
      token = '';
    }
  }
  if (token && (await isAdminToken(token))) return null;

  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
}
