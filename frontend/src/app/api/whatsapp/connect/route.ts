import { NextResponse } from 'next/server';
import { connectWhatsApp } from '@/lib/whatsapp/whatsappService';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await connectWhatsApp();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao iniciar conexão do WhatsApp' },
      { status: 500 }
    );
  }
}
