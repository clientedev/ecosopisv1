import { NextResponse } from 'next/server';
import { guardAdmin } from '@/lib/whatsapp/adminAuth';
import { getWhatsAppStatus } from '@/lib/whatsapp/whatsappService';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = await guardAdmin(req);
  if (denied) return denied;
  try {
    const status = await getWhatsAppStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar status do WhatsApp' },
      { status: 500 }
    );
  }
}
