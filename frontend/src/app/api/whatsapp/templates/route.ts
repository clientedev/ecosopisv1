import { NextResponse } from 'next/server';
import { getWhatsAppTemplates, updateWhatsAppTemplate } from '@/lib/whatsapp/templates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const templates = await getWhatsAppTemplates();
    return NextResponse.json({ templates });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar templates de WhatsApp' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { trigger_type, message_template, is_enabled, delay_minutes } = body;

    if (!trigger_type) {
      return NextResponse.json(
        { error: 'Campo "trigger_type" é obrigatório.' },
        { status: 400 }
      );
    }

    await updateWhatsAppTemplate(
      trigger_type,
      message_template,
      is_enabled !== false,
      delay_minutes || 0
    );

    return NextResponse.json({
      status: 'success',
      message: 'Template atualizado com sucesso!'
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar template de WhatsApp' },
      { status: 500 }
    );
  }
}
