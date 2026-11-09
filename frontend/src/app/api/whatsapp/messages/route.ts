import { NextResponse } from 'next/server';
import { getWhatsAppMessageLogs } from '@/lib/whatsapp/templates';
import { getQueueStatus, setQueuePaused, sendSingleMessageByIdNow } from '@/lib/whatsapp/whatsappService';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const [logs, queueStatus] = await Promise.all([
      getWhatsAppMessageLogs(limit),
      getQueueStatus()
    ]);
    return NextResponse.json({
      messages: logs,
      queuePaused: queueStatus.paused,
      queuedCount: queueStatus.queuedCount,
      pausedCount: queueStatus.pausedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar mensagens de WhatsApp' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body.action === 'send_single' && body.logId) {
      const singleRes = await sendSingleMessageByIdNow(Number(body.logId));
      if (!singleRes.success) {
        return NextResponse.json(
          { error: singleRes.error || 'Falha ao disparar mensagem individualmente' },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        status: 'SENT',
        messageId: singleRes.messageId,
      });
    }

    const shouldPause =
      body.action === 'pause'
        ? true
        : body.action === 'resume'
          ? false
          : Boolean(body.paused);

    const result = await setQueuePaused(shouldPause);
    return NextResponse.json({
      success: true,
      queuePaused: result.paused,
      affectedCount: result.affectedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao alterar estado da fila de WhatsApp' },
      { status: 500 }
    );
  }
}
