import { NextResponse } from 'next/server';
import { guardAdmin } from '@/lib/whatsapp/adminAuth';
import { connectWhatsApp } from '@/lib/whatsapp/whatsappService';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  try {
    let force = false;
    try {
      const body = await req.json();
      force = !!body?.force;
    } catch (e) {}
    const result = await connectWhatsApp('default', force);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao iniciar conexão do WhatsApp' },
      { status: 500 }
    );
  }
}
