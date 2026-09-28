import { NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp/whatsappService';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, message, triggerType, recipientName } = body;

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: "to" (telefone) e "message" (conteúdo da mensagem).' },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppMessage(
      to,
      message,
      triggerType || 'manual',
      recipientName || ''
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
