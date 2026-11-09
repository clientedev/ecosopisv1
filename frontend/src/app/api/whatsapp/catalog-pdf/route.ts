import { NextResponse } from 'next/server';
import { ensureCommerceTables, getActiveCatalogProducts } from '@/lib/whatsapp/whatsappCommerce';
import { generateCatalogPdfBuffer } from '@/lib/whatsapp/catalogPdfGenerator';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureCommerceTables();
    const products = await getActiveCatalogProducts();
    const pdfBuffer = await generateCatalogPdfBuffer(products);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Catalogo-Ecosopis-Cosmeticos-Naturais.pdf"',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err: any) {
    console.error('[WhatsApp Catalog PDF Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao gerar PDF do catálogo.' },
      { status: 500 }
    );
  }
}

