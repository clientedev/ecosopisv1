import { NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp/whatsappService';

export const dynamic = 'force-dynamic';

interface RecipientInput {
  phone: string;
  name?: string;
  vars?: Record<string, string>;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      recipients, 
      messageTemplate, 
      triggerType = 'manual_bulk',
      delayMs = 1200 
    } = body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum destinatário informado para o envio.' },
        { status: 400 }
      );
    }

    if (!messageTemplate || typeof messageTemplate !== 'string' || messageTemplate.trim() === '') {
      return NextResponse.json(
        { error: 'O texto da mensagem é obrigatório.' },
        { status: 400 }
      );
    }

    const results: Array<{
      phone: string;
      name?: string;
      success: boolean;
      error?: string;
    }> = [];

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient: RecipientInput = recipients[i];
      const rawPhone = recipient.phone ? String(recipient.phone).trim() : '';

      if (!rawPhone || rawPhone.length < 8) {
        results.push({
          phone: rawPhone,
          name: recipient.name,
          success: false,
          error: 'Telefone inválido ou não cadastrado'
        });
        failedCount++;
        continue;
      }

      // Substitui variáveis no template
      let personalized = messageTemplate;
      const clientName = recipient.name && recipient.name.trim() !== '' ? recipient.name.trim() : 'Cliente';
      personalized = personalized.replace(/\{cliente\}/gi, clientName);
      personalized = personalized.replace(/\{nome\}/gi, clientName);

      if (recipient.vars) {
        for (const [key, val] of Object.entries(recipient.vars)) {
          const regex = new RegExp(`\\{${key}\\}`, 'gi');
          personalized = personalized.replace(regex, String(val));
        }
      }

      // Envia via serviço central do WhatsApp Baileys
      const res = await sendWhatsAppMessage(rawPhone, personalized, triggerType, clientName);

      if (res.success) {
        sentCount++;
        results.push({
          phone: rawPhone,
          name: clientName,
          success: true
        });
      } else {
        failedCount++;
        results.push({
          phone: rawPhone,
          name: clientName,
          success: false,
          error: res.error || 'Erro no envio'
        });
      }

      // Delay seguro entre mensagens para proteger o número (anti-spam Baileys)
      if (i < recipients.length - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return NextResponse.json({
      success: true,
      total: recipients.length,
      sent_count: sentCount,
      failed_count: failedCount,
      results
    });

  } catch (error: any) {
    console.error('Erro no disparo em massa /api/whatsapp/bulk-send:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar disparo em massa' },
      { status: 500 }
    );
  }
}
