import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getDbPool } from './db';
import { CatalogProduct, getEffectivePrice } from './whatsappCommerce';
import { PRODUCT_STATIC_DATA } from '@/lib/productData';

interface CachedPdf {
  buffer: Buffer;
  signature: string;
  createdAt: number;
}

const g = globalThis as unknown as {
  __ecosopisCatalogPdfCacheV2?: CachedPdf;
};

// Mapa de caracteres especiais Unicode (> 255) para códigos Windows-1252 (WinAnsiEncoding)
const UNICODE_TO_WINANSI: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201c: 0x93, // “
  0x201d: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
};

/**
 * Converte uma string UTF-8 em literal PDF (...) codificado em WinAnsiEncoding (Windows-1252 / Latin-1)
 * usando escapes octais \ddd para todos os acentos em português.
 * Isso garante renderização 100% nítida com as fontes nativas /Helvetica e /Helvetica-Bold do PDF,
 * sem depender de nenhuma fonte instalada no servidor Linux!
 */
function pdfWinAnsiString(text: string): string {
  const clean = String(text || '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let out = '(';
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);

    if (code === 0x28) {
      out += '\\(';
    } else if (code === 0x29) {
      out += '\\)';
    } else if (code === 0x5c) {
      out += '\\\\';
    } else if (code >= 0x20 && code <= 0x7e) {
      out += clean.charAt(i);
    } else if (code >= 0xa0 && code <= 0xff) {
      // Latin-1 Supplement (á, é, í, ó, ú, ã, õ, â, ê, ô, ç, Á, É, Ç, etc.)
      out += '\\' + code.toString(8).padStart(3, '0');
    } else if (UNICODE_TO_WINANSI[code] !== undefined) {
      out += '\\' + UNICODE_TO_WINANSI[code].toString(8).padStart(3, '0');
    } else {
      // Ignora emojis ou caracteres fora do WinAnsi para nunca gerar glifo inválido
      out += '';
    }
  }
  out += ')';
  return out;
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const clean = String(text || '')
    // Remove emojis mantendo acentos latinos, números e pontuação
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[•*]/g, '')
    .trim();
  if (!clean) return [];

  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        if (lines.length >= maxLines) {
          const last = lines[lines.length - 1];
          lines[lines.length - 1] =
            last.length > maxCharsPerLine - 3 ? `${last.slice(0, maxCharsPerLine - 3)}...` : `${last}...`;
          return lines;
        }
      }
      current = word.length > maxCharsPerLine ? word.slice(0, maxCharsPerLine) : word;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

function formatBRL(val: number): string {
  return `R$ ${Number(val || 0).toFixed(2).replace('.', ',')}`;
}

async function fetchProductRawImage(imageUrl: string): Promise<Buffer | null> {
  if (!imageUrl) return null;
  const trimmed = imageUrl.trim();

  // 1. StoredImage no PostgreSQL (/api/images/123 ou /images/123)
  const dbMatch = trimmed.match(/\/(?:api\/)?images\/(\d+)/i);
  if (dbMatch) {
    const imageId = Number(dbMatch[1]);
    const pool = getDbPool();
    if (pool && imageId > 0) {
      try {
        const res = await pool.query(`SELECT data FROM stored_images WHERE id = $1 LIMIT 1`, [imageId]);
        const data = res?.rows?.[0]?.data;
        if (data && Buffer.isBuffer(data) && data.length > 0) {
          return data;
        }
      } catch {}
    }
  }

  // 2. Arquivo local dentro de public/
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    const cleanRel = trimmed.replace(/^\/+/, '').replace(/^static\//, '');
    const candidates = [
      path.join(process.cwd(), 'public', cleanRel),
      path.join(process.cwd(), 'public', trimmed.replace(/^\/+/, '')),
    ];
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return fs.readFileSync(candidate);
        }
      } catch {}
    }
  }

  // 3. Busca HTTP remota (URL absoluta ou relativa à loja)
  try {
    const baseUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.FRONTEND_URL ||
      'https://www.ecosopis.com.br'
    ).replace(/\/$/, '');
    const fullUrl = trimmed.startsWith('http')
      ? trimmed
      : `${baseUrl}/${trimmed.replace(/^\/+/, '')}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch(fullUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (resp.ok) {
      const arr = await resp.arrayBuffer();
      if (arr.byteLength > 0) {
        return Buffer.from(arr);
      }
    }
  } catch {}

  // 4. Fallback imagem padrão da loja em public/
  try {
    const fallbackCandidates = [
      path.join(
        process.cwd(),
        'public',
        'attached_assets',
        'generated_images',
        'natural_soap_bars_photography_lifestyle.png'
      ),
      path.join(process.cwd(), 'public', 'logo_final.png'),
    ];
    for (const fb of fallbackCandidates) {
      if (fs.existsSync(fb)) {
        return fs.readFileSync(fb);
      }
    }
  } catch {}

  return null;
}

/**
 * Gera um buffer JPEG 480x290 da foto do produto (sem nenhum <text> em SVG para não depender de fontes do SO).
 */
async function buildProductJpegThumbnail(
  product: CatalogProduct,
  width = 480,
  height = 290
): Promise<{ jpeg: Buffer; width: number; height: number }> {
  const raw = await fetchProductRawImage(product.image_url);
  if (raw) {
    try {
      const jpeg = await sharp(raw)
        .resize(width, height, { fit: 'cover', position: 'center' })
        .flatten({ background: '#f8fafc' })
        .jpeg({ quality: 86, chromaSubsampling: '4:2:0' })
        .toBuffer();
      return { jpeg, width, height };
    } catch {}
  }

  // Fallback puramente geométrico (folha botânica estilizada sem <text> no SVG)
  const fallbackSvg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#f0fdf4"/>
      <circle cx="${Math.round(width / 2)}" cy="${Math.round(height / 2)}" r="64" fill="#dcfce7"/>
      <path d="M ${Math.round(width / 2)} ${Math.round(height / 2 - 36)} C ${Math.round(width / 2 + 36)} ${Math.round(height / 2 - 36)}, ${Math.round(width / 2 + 36)} ${Math.round(height / 2 + 24)}, ${Math.round(width / 2)} ${Math.round(height / 2 + 38)} C ${Math.round(width / 2 - 36)} ${Math.round(height / 2 + 24)}, ${Math.round(width / 2 - 36)} ${Math.round(height / 2 - 36)}, ${Math.round(width / 2)} ${Math.round(height / 2 - 36)} Z" fill="#4B8411"/>
    </svg>`
  );
  const jpeg = await sharp(fallbackSvg).jpeg({ quality: 85 }).toBuffer();
  return { jpeg, width, height };
}

/**
 * Gera um PDF 1.4 nativo de alta definição com:
 * - Fontes vetoriais nativas do PDF (/Helvetica e /Helvetica-Bold com /WinAnsiEncoding) — NUNCA gera "xxxx" em containers Linux
 * - Fotos reais dos produtos embutidas como XObjects JPEG (/DCTDecode)
 * - Layout idêntico aos cards da loja Ecosopis (2x2 cards por página A4)
 */
export async function generateCatalogPdfBuffer(products: CatalogProduct[]): Promise<Buffer> {
  const signature = products
    .map((p) => `${p.id}:${p.name}:${getEffectivePrice(p)}:${p.image_url}`)
    .join('|');

  const now = Date.now();
  if (
    g.__ecosopisCatalogPdfCacheV2 &&
    g.__ecosopisCatalogPdfCacheV2.signature === signature &&
    now - g.__ecosopisCatalogPdfCacheV2.createdAt < 10 * 60 * 1000
  ) {
    return g.__ecosopisCatalogPdfCacheV2.buffer;
  }

  const pageW = 595.28; // A4 width pt
  const pageH = 841.89; // A4 height pt
  const yFromTop = (top: number) => Number((pageH - top).toFixed(2));

  // Pré-carrega miniaturas JPEG de todos os produtos
  const productThumbs = await Promise.all(
    products.map((prod) => buildProductJpegThumbnail(prod, 480, 290))
  );

  const cardsPerPage = 4;
  const totalPages = Math.max(1, Math.ceil(products.length / cardsPerPage));

  // Estrutura de objetos PDF:
  // 1: Catalog
  // 2: Pages
  // 3: Font /F1 (Helvetica WinAnsiEncoding)
  // 4: Font /F2 (Helvetica-Bold WinAnsiEncoding)
  // 5 .. 4 + products.length: Image XObjects (/Im1 .. /ImN)
  // Em seguida, para cada página p (0 .. totalPages - 1):
  //   pageObjId = 5 + products.length + p * 2
  //   contentObjId = 6 + products.length + p * 2
  const firstImageObjId = 5;
  const firstPageObjId = firstImageObjId + products.length;
  const totalObjects = 4 + products.length + totalPages * 2;

  const chunks: Buffer[] = [];
  const offsets: number[] = new Array(totalObjects + 1).fill(0);
  let currentOffset = 0;

  const pushBuffer = (buf: Buffer) => {
    chunks.push(buf);
    currentOffset += buf.length;
  };

  const pushString = (str: string) => {
    pushBuffer(Buffer.from(str, 'binary'));
  };

  // Cabeçalho PDF 1.4
  pushBuffer(Buffer.from('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n', 'binary'));

  // Obj 1: Catalog
  offsets[1] = currentOffset;
  pushString(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  // Obj 2: Pages
  const kidsRefs = Array.from({ length: totalPages }, (_, p) => `${firstPageObjId + p * 2} 0 R`).join(' ');
  offsets[2] = currentOffset;
  pushString(`2 0 obj\n<< /Type /Pages /Kids [ ${kidsRefs} ] /Count ${totalPages} >>\nendobj\n`);

  // Obj 3: Font /F1 (Helvetica normal com suporte completo a acentos PT-BR via WinAnsiEncoding)
  offsets[3] = currentOffset;
  pushString(
    `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`
  );

  // Obj 4: Font /F2 (Helvetica-Bold com suporte completo a acentos PT-BR via WinAnsiEncoding)
  offsets[4] = currentOffset;
  pushString(
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`
  );

  // Objs de Imagens dos Produtos (/Im1 .. /ImN)
  for (let i = 0; i < productThumbs.length; i++) {
    const thumb = productThumbs[i];
    const objId = firstImageObjId + i;
    offsets[objId] = currentOffset;
    pushString(
      `${objId} 0 obj\n` +
        `<< /Type /XObject /Subtype /Image /Width ${thumb.width} /Height ${thumb.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${thumb.jpeg.length} >>\n` +
        `stream\n`
    );
    pushBuffer(thumb.jpeg);
    pushString(`\nendstream\nendobj\n`);
  }

  // Helper para desenhar texto em coordenadas (x, topY)
  const drawText = (
    font: 'F1' | 'F2',
    size: number,
    r: number,
    gCol: number,
    b: number,
    x: number,
    topY: number,
    text: string
  ): string => {
    const pdfY = yFromTop(topY);
    return (
      `BT\n` +
      `/${font} ${size} Tf\n` +
      `${r.toFixed(3)} ${gCol.toFixed(3)} ${b.toFixed(3)} rg\n` +
      `1 0 0 1 ${x.toFixed(2)} ${pdfY.toFixed(2)} Tm\n` +
      `${pdfWinAnsiString(text)} Tj\n` +
      `ET\n`
    );
  };

  // Helper para desenhar retângulo preenchido (e opcionalmente contornado) usando coordenadas de topo
  const drawRect = (
    x: number,
    topY: number,
    w: number,
    h: number,
    fillRgb: [number, number, number],
    strokeRgb?: [number, number, number],
    lineWidth = 1
  ): string => {
    const pdfY = yFromTop(topY + h);
    let cmd = `${fillRgb[0].toFixed(3)} ${fillRgb[1].toFixed(3)} ${fillRgb[2].toFixed(3)} rg\n`;
    if (strokeRgb) {
      cmd += `${strokeRgb[0].toFixed(3)} ${strokeRgb[1].toFixed(3)} ${strokeRgb[2].toFixed(3)} RG\n`;
      cmd += `${lineWidth.toFixed(2)} w\n`;
      cmd += `${x.toFixed(2)} ${pdfY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re B\n`;
    } else {
      cmd += `${x.toFixed(2)} ${pdfY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`;
    }
    return cmd;
  };

  // Construção de cada Página A4
  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const startIdx = pageIdx * cardsPerPage;
    const pageProducts = products.slice(startIdx, startIdx + cardsPerPage);
    let stream = '';

    // 1. Fundo geral da página (#f8fafc)
    stream += drawRect(0, 0, pageW, pageH, [0.973, 0.98, 0.988]);

    // 2. Cabeçalho Institucional Ecosopis (#1a3a16) + faixa verde vibrante (#4B8411)
    stream += drawRect(0, 0, pageW, 86, [0.102, 0.227, 0.086]);
    stream += drawRect(0, 82, pageW, 4, [0.294, 0.518, 0.067]);

    stream += drawText('F2', 20, 1, 1, 1, 28, 30, 'ECOSOPIS');
    stream += drawText(
      'F2',
      10,
      0.733,
      0.969,
      0.816,
      28,
      48,
      'CATALOGO OFICIAL • COSMETICOS NATURAIS & VEGANOS'
    );
    stream += drawText(
      'F1',
      9.5,
      0.941,
      0.992,
      0.957,
      28,
      66,
      'Gostou de um produto? Digite o NOME DELE na conversa do WhatsApp para comprar!'
    );

    // Selo de Página no topo direito
    stream += drawRect(pageW - 118, 22, 90, 26, [0.176, 0.353, 0.153], [0.294, 0.518, 0.067], 1);
    stream += drawText(
      'F2',
      9.5,
      1,
      1,
      1,
      pageW - 103,
      39,
      `Pagina ${pageIdx + 1} de ${totalPages}`
    );

    // 3. Grid 2x2 de Cards de Produtos
    const xObjectRefs: string[] = [];

    for (let i = 0; i < pageProducts.length; i++) {
      const prod = pageProducts[i];
      const globalProdIdx = startIdx + i;
      const imgObjId = firstImageObjId + globalProdIdx;
      const imgName = `/Im${globalProdIdx + 1}`;
      xObjectRefs.push(`${imgName} ${imgObjId} 0 R`);

      const col = i % 2;
      const row = Math.floor(i / 2);

      const cardX = col === 0 ? 28 : 304;
      const cardTop = row === 0 ? 102 : 442;
      const cardW = 263;
      const cardH = 326;

      // Sombra suave + Corpo branco do Card
      stream += drawRect(cardX + 2, cardTop + 3, cardW, cardH, [0.886, 0.91, 0.941]);
      stream += drawRect(cardX, cardTop, cardW, cardH, [1, 1, 1], [0.82, 0.855, 0.902], 1);

      // Foto do Produto (243 x 145 pt)
      const photoX = cardX + 10;
      const photoTop = cardTop + 10;
      const photoW = 243;
      const photoH = 145;
      const photoPdfY = yFromTop(photoTop + photoH);

      stream += `q\n${photoW.toFixed(2)} 0 0 ${photoH.toFixed(2)} ${photoX.toFixed(2)} ${photoPdfY.toFixed(2)} cm\n${imgName} Do\nQ\n`;

      // Moldura fina ao redor da foto
      stream += `0.886 0.910 0.941 RG 0.8 w ${photoX.toFixed(2)} ${photoPdfY.toFixed(2)} ${photoW.toFixed(2)} ${photoH.toFixed(2)} re S\n`;

      // Badge de Categoria sobre o canto superior esquerdo da foto
      const categoryLabel = (prod.category || 'Cosmetico Natural').toUpperCase().slice(0, 22);
      const badgeW = Math.min(photoW - 16, Math.max(78, categoryLabel.length * 4.8 + 14));
      stream += drawRect(photoX + 6, photoTop + 6, badgeW, 16, [0.102, 0.227, 0.086]);
      stream += drawText('F2', 7, 1, 1, 1, photoX + 12, photoTop + 17, categoryLabel);

      const effPrice = getEffectivePrice(prod);
      const hasDiscount = prod.is_on_sale && prod.sale_price && prod.price > effPrice;
      if (hasDiscount) {
        stream += drawRect(photoX + photoW - 56, photoTop + 6, 50, 16, [0.961, 0.62, 0.043]);
        stream += drawText('F2', 7, 0.102, 0.227, 0.086, photoX + photoW - 47, photoTop + 17, 'OFERTA');
      }

      // Dados estáticos ricos (Ativos & Benefícios)
      const staticInfo = PRODUCT_STATIC_DATA[prod.slug];
      const rawActives = staticInfo?.ativos || prod.ingredients || '';
      const rawBenefits =
        staticInfo?.beneficios ||
        prod.benefits ||
        prod.description ||
        'Formula 100% natural, vegana e artesanal de alta performance.';

      const titleLines = wrapText(prod.name, 30, 2);
      const activesLines = rawActives ? wrapText(`Ativos: ${rawActives}`, 48, 2) : [];
      const benefitLines = wrapText(rawBenefits, 48, 3);

      // Título do Produto
      let cursorTop = cardTop + 172;
      for (const line of titleLines) {
        stream += drawText('F2', 11.5, 0.102, 0.227, 0.086, cardX + 12, cursorTop, line);
        cursorTop += 14;
      }

      // Ativos
      if (activesLines.length > 0) {
        cursorTop += 2;
        for (const line of activesLines) {
          stream += drawText('F2', 7.8, 0.294, 0.518, 0.067, cardX + 12, cursorTop, line);
          cursorTop += 10.5;
        }
      }

      // Benefícios / Descrição
      cursorTop += 3;
      for (const line of benefitLines) {
        if (cursorTop < cardTop + cardH - 54) {
          stream += drawText('F1', 8.3, 0.278, 0.333, 0.412, cardX + 12, cursorTop, line);
          cursorTop += 11;
        }
      }

      // Linha divisória inferior do Card
      const dividerTop = cardTop + cardH - 46;
      const dividerPdfY = yFromTop(dividerTop);
      stream += `0.925 0.941 0.961 RG 1 w ${(cardX + 12).toFixed(2)} ${dividerPdfY.toFixed(2)} m ${(cardX + cardW - 12).toFixed(2)} ${dividerPdfY.toFixed(2)} l S\n`;

      // Preço à esquerda
      if (hasDiscount) {
        stream += drawText(
          'F1',
          7.5,
          0.58,
          0.639,
          0.722,
          cardX + 12,
          dividerTop + 14,
          `De ${formatBRL(prod.price)}`
        );
        stream += drawText(
          'F2',
          14,
          0.176,
          0.353,
          0.153,
          cardX + 12,
          dividerTop + 31,
          formatBRL(effPrice)
        );
      } else {
        stream += drawText(
          'F2',
          6.8,
          0.392,
          0.455,
          0.545,
          cardX + 12,
          dividerTop + 14,
          'VALOR UNITARIO'
        );
        stream += drawText(
          'F2',
          14,
          0.176,
          0.353,
          0.153,
          cardX + 12,
          dividerTop + 31,
          formatBRL(effPrice)
        );
      }

      // Botão Verde à direita ("DIGITE NO CHAT: [Nome]")
      const btnW = 128;
      const btnH = 30;
      const btnX = cardX + cardW - btnW - 10;
      const btnTop = dividerTop + 8;
      stream += drawRect(btnX, btnTop, btnW, btnH, [0.176, 0.353, 0.153]);

      const shortName = prod.name.length > 22 ? `${prod.name.slice(0, 20)}...` : prod.name;
      stream += drawText('F2', 6.5, 0.863, 0.988, 0.906, btnX + 8, btnTop + 11, 'PARA COMPRAR DIGITE:');
      stream += drawText('F2', 7.3, 1, 1, 1, btnX + 8, btnTop + 23, shortName);
    }

    // 4. Rodapé da Página
    stream += drawRect(28, 782, pageW - 56, 40, [0.941, 0.992, 0.957], [0.733, 0.969, 0.816], 1);
    stream += drawText(
      'F2',
      9,
      0.086,
      0.396,
      0.204,
      62,
      798,
      'Frete Gratis Sul e Sudeste acima de R$ 148,90 • Atacado 45% OFF a partir de 10 unidades'
    );
    stream += drawText(
      'F1',
      8.5,
      0.176,
      0.353,
      0.153,
      76,
      813,
      'Para comprar qualquer item deste catalogo, envie o NOME DO PRODUTO no WhatsApp!'
    );

    const contentBuf = Buffer.from(stream, 'binary');
    const pageObjId = firstPageObjId + pageIdx * 2;
    const contentObjId = pageObjId + 1;

    // Objeto da Página
    offsets[pageObjId] = currentOffset;
    pushString(
      `${pageObjId} 0 obj\n` +
        `<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)} ] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xObjectRefs.join(' ')} >> >> ` +
        `/Contents ${contentObjId} 0 R >>\n` +
        `endobj\n`
    );

    // Objeto do Stream de Conteúdo da Página
    offsets[contentObjId] = currentOffset;
    pushString(`${contentObjId} 0 obj\n<< /Length ${contentBuf.length} >>\nstream\n`);
    pushBuffer(contentBuf);
    pushString(`\nendstream\nendobj\n`);
  }

  // Tabela Xref
  const xrefOffset = currentOffset;
  pushString(`xref\n0 ${totalObjects + 1}\n`);
  pushString(`0000000000 65535 f \n`);
  for (let objId = 1; objId <= totalObjects; objId++) {
    const padded = String(offsets[objId]).padStart(10, '0');
    pushString(`${padded} 00000 n \n`);
  }

  // Trailer
  pushString(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  const pdfBuffer = Buffer.concat(chunks);
  g.__ecosopisCatalogPdfCacheV2 = {
    buffer: pdfBuffer,
    signature,
    createdAt: now,
  };
  return pdfBuffer;
}
