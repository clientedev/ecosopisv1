import { NextResponse } from 'next/server';
import { getWhatsAppMessageLogs } from '@/lib/whatsapp/templates';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const logs = await getWhatsAppMessageLogs(limit);
    return NextResponse.json({ messages: logs });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar mensagens de WhatsApp' },
      { status: 500 }
    );
  }
}
