import { NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp/whatsappService';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const to = (body.to || body.phone || body.to_phone || body.recipient_phone || body.numero || '').toString().trim();
    const message = (body.message || body.texto || body.conteudo || '').toString().trim();
    const triggerType = body.triggerType || body.trigger_type || 'manual';
    const recipientName = body.recipientName || body.recipient_name || body.name || body.nome || '';

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: informe o telefone de destino e o conteúdo da mensagem.' },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppMessage(
      to,
      message,
      triggerType,
      recipientName
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Falha no envio da mensagem' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      messageId: result.messageId,
      message: 'Mensagem enviada com sucesso!'
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar disparo de WhatsApp' },
      { status: 500 }
    );
  }
}
