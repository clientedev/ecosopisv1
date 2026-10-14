import { NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp/whatsappService';
import { getDbPool } from '@/lib/whatsapp/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const logId = body.logId ? parseInt(body.logId, 10) : undefined;
    let to = (body.to || body.to_phone || body.phone || '').toString().trim();
    let message = (body.message || '').toString().trim();
    let triggerType = body.trigger_type || body.triggerType || 'manual_retry';
    let recipientName = body.recipient_name || body.recipientName || '';

    const pool = getDbPool();

    // Se temos logId e faltam dados, busca diretamente na tabela whatsapp_message_logs
    if (logId && pool && (!to || !message)) {
      const res = await pool.query(
        `SELECT to_phone, message, trigger_type, recipient_name FROM whatsapp_message_logs WHERE id = $1`,
        [logId]
      );
      if (res?.rows && res.rows.length > 0) {
        const row = res.rows[0];
        to = to || row.to_phone;
        message = message || row.message;
        triggerType = triggerType || row.trigger_type;
        recipientName = recipientName || row.recipient_name || '';
      }
    }

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Não foi possível identificar o destinatário ou conteúdo da mensagem para reenvio.' },
        { status: 400 }
      );
    }

    // Dispara via Baileys passando o logId para que atualize o log original no banco
    const result = await sendWhatsAppMessage(
      to,
      message,
      triggerType,
      recipientName,
      logId
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Falha ao tentar reenviar mensagem' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: 'Mensagem reenviada com sucesso!',
      messageId: result.messageId
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar reenvio da mensagem' },
      { status: 500 }
    );
  }
}
