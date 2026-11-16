import { NextResponse } from 'next/server';
import { guardAdmin } from '@/lib/whatsapp/adminAuth';
import { disconnectWhatsApp } from '@/lib/whatsapp/whatsappService';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const logout = body.logout !== false; // default to true
    const result = await disconnectWhatsApp('default', logout);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao desconectar WhatsApp' },
      { status: 500 }
    );
  }
}
