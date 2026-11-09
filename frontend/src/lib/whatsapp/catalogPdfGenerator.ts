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
  __ecosopisCatalogPdfCache?: CachedPdf;
};

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const clean = String(text || '')
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

async function buildCardPhotoBuffer(product: CatalogProduct, width = 490, height = 290): Promise<Buffer> {
  const raw = await fetchProductRawImage(product.image_url);
  const roundedMask = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="14" ry="14" fill="#ffffff"/>
    </svg>`
  );

  if (raw) {
    try {
      const resized = await sharp(raw)
        .resize(width, height, { fit: 'cover', position: 'center' })
        .composite([{ input: roundedMask, blend: 'dest-in' }])
        .png()
        .toBuffer();
      return resized;
    } catch {}
  }

  // Placeholder botânico elegante caso o produto não tenha foto
  const placeholderSvg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f0fdf4"/>
          <stop offset="100%" stop-color="#dcfce7"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" rx="14" ry="14" fill="url(#bg)"/>
      <circle cx="${Math.round(width / 2)}" cy="${Math.round(height / 2 - 15)}" r="48" fill="#bbf7d0"/>
      <text x="${Math.round(width / 2)}" y="${Math.round(height / 2 - 2)}" text-anchor="middle" font-family="sans-serif" font-size="34" font-weight="bold" fill="#166534">ECOSOPIS</text>
      <text x="${Math.round(width / 2)}" y="${Math.round(height / 2 + 58)}" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="bold" fill="#2d5a27">Cosmético 100% Natural &amp; Vegano</text>
    </svg>`
  );
  return sharp(placeholderSvg).png().toBuffer();
}

/**
 * Monta um PDF 1.4 válido em memória a partir de uma lista de páginas JPEG.
 * Cada página JPEG é embutida nativamente com /Filter /DCTDecode (100% compatível com WhatsApp iOS/Android/Web).
 */
function buildPdfFromJpegPages(pages: { jpeg: Buffer; width: number; height: number }[]): Buffer {
  const pageWidthPt = 595.28; // A4 width in points
  const pageHeightPt = 841.89; // A4 height in points

  // Objects:
  // 1: Catalog
  // 2: Pages
  // For each page i (0..N-1):
  //   pageObjId = 3 + i * 3
  //   contentObjId = 4 + i * 3
  //   imageObjId = 5 + i * 3
  const totalObjects = 2 + pages.length * 3;
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

  // Header PDF 1.4 + comentário binário
  pushBuffer(Buffer.from('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n', 'binary'));

  // Obj 1: Catalog
  offsets[1] = currentOffset;
  pushString(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  // Obj 2: Pages
  const kidsRefs = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  offsets[2] = currentOffset;
  pushString(`2 0 obj\n<< /Type /Pages /Kids [ ${kidsRefs} ] /Count ${pages.length} >>\nendobj\n`);

  // Pages, Contents & Image XObjects
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageObjId = 3 + i * 3;
    const contentObjId = 4 + i * 3;
    const imageObjId = 5 + i * 3;
    const imgName = `/Im${i + 1}`;

    const contentStream = `q\n${pageWidthPt.toFixed(2)} 0 0 ${pageHeightPt.toFixed(2)} 0 0 cm\n${imgName} Do\nQ\n`;
    const contentBuf = Buffer.from(contentStream, 'binary');

    // Page Object
    offsets[pageObjId] = currentOffset;
    pushString(
      `${pageObjId} 0 obj\n` +
        `<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(2)} ] ` +
        `/Resources << /XObject << ${imgName} ${imageObjId} 0 R >> >> ` +
        `/Contents ${contentObjId} 0 R >>\n` +
        `endobj\n`
    );

    // Content Object
    offsets[contentObjId] = currentOffset;
    pushString(`${contentObjId} 0 obj\n<< /Length ${contentBuf.length} >>\nstream\n`);
    pushBuffer(contentBuf);
    pushString(`\nendstream\nendobj\n`);

    // Image XObject (JPEG DCTDecode)
    offsets[imageObjId] = currentOffset;
    pushString(
      `${imageObjId} 0 obj\n` +
        `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\n` +
        `stream\n`
    );
    pushBuffer(page.jpeg);
    pushString(`\nendstream\nendobj\n`);
  }

  // Xref Table
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

  return Buffer.concat(chunks);
}

/**
 * Gera um PDF visual estilo vitrine ("prints" dos cards de produtos da loja Ecosopis)
 * com fotos reais, benefícios, ativos e preços de todos os produtos ativos.
 */
export async function generateCatalogPdfBuffer(products: CatalogProduct[]): Promise<Buffer> {
  const signature = products
    .map((p) => `${p.id}:${p.name}:${getEffectivePrice(p)}:${p.image_url}`)
    .join('|');

  const now = Date.now();
  if (
    g.__ecosopisCatalogPdfCache &&
    g.__ecosopisCatalogPdfCache.signature === signature &&
    now - g.__ecosopisCatalogPdfCache.createdAt < 10 * 60 * 1000
  ) {
    return g.__ecosopisCatalogPdfCache.buffer;
  }

  const pageWidth = 1240;
  const pageHeight = 1754;
  const cardsPerPage = 4; // Grid 2x2 de cards grandes estilo print da loja
  const totalPages = Math.max(1, Math.ceil(products.length / cardsPerPage));
  const renderedPages: { jpeg: Buffer; width: number; height: number }[] = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageProducts = products.slice(pageIdx * cardsPerPage, (pageIdx + 1) * cardsPerPage);
    const composites: sharp.OverlayOptions[] = [];
    let cardsSvgContent = '';

    for (let i = 0; i < pageProducts.length; i++) {
      const prod = pageProducts[i];
      const col = i % 2;
      const row = Math.floor(i / 2);

      const cardX = col === 0 ? 64 : 646;
      const cardY = row === 0 ? 226 : 936;
      const cardW = 530;
      const cardH = 670;

      const photoW = 490;
      const photoH = 290;
      const photoX = cardX + 20;
      const photoY = cardY + 20;

      const photoBuf = await buildCardPhotoBuffer(prod, photoW, photoH);
      composites.push({
        input: photoBuf,
        left: photoX,
        top: photoY,
      });

      const staticInfo = PRODUCT_STATIC_DATA[prod.slug];
      const rawBenefits =
        staticInfo?.beneficios ||
        prod.benefits ||
        prod.description ||
        'Fórmula 100% natural, vegana e artesanal de alta performance.';
      const rawActives = staticInfo?.ativos || prod.ingredients || '';

      const titleLines = wrapText(prod.name, 28, 2);
      const benefitLines = wrapText(rawBenefits, 46, 3);
      const activesLines = rawActives ? wrapText(`Ativos: ${rawActives}`, 48, 2) : [];

      const effPrice = getEffectivePrice(prod);
      const hasDiscount = prod.is_on_sale && prod.sale_price && prod.price > effPrice;
      const categoryLabel = (prod.category || 'Cosmético Natural').toUpperCase().slice(0, 26);

      // Card background & border
      cardsSvgContent += `
        <g>
          <!-- Sombra suave do Card -->
          <rect x="${cardX + 4}" y="${cardY + 6}" width="${cardW}" height="${cardH}" rx="22" ry="22" fill="#e2e8f0" opacity="0.65"/>
          <!-- Corpo branco do Card -->
          <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="22" ry="22" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
          <!-- Moldura da foto -->
          <rect x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}" rx="14" ry="14" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
      `;

      // Título do Produto
      const titleStartY = cardY + 346;
      titleLines.forEach((line, idx) => {
        cardsSvgContent += `
          <text x="${cardX + 24}" y="${titleStartY + idx * 30}" font-family="sans-serif" font-size="24" font-weight="bold" fill="#1a3a16">${escapeXml(line)}</text>
        `;
      });

      // Ativos Botânicos
      const activesStartY = titleStartY + titleLines.length * 30 + 6;
      activesLines.forEach((line, idx) => {
        cardsSvgContent += `
          <text x="${cardX + 24}" y="${activesStartY + idx * 22}" font-family="sans-serif" font-size="15.5" font-weight="bold" fill="#4B8411">${escapeXml(line)}</text>
        `;
      });

      // Benefícios / Descrição
      const benefitsStartY = activesStartY + (activesLines.length > 0 ? activesLines.length * 22 + 10 : 6);
      benefitLines.forEach((line, idx) => {
        cardsSvgContent += `
          <text x="${cardX + 24}" y="${benefitsStartY + idx * 23}" font-family="sans-serif" font-size="16.5" fill="#475569">${escapeXml(line)}</text>
        `;
      });

      // Linha divisória inferior do Card
      const footerLineY = cardY + cardH - 96;
      cardsSvgContent += `
        <line x1="${cardX + 24}" y1="${footerLineY}" x2="${cardX + cardW - 24}" y2="${footerLineY}" stroke="#f1f5f9" stroke-width="2"/>
      `;

      // Preço do Produto
      if (hasDiscount) {
        cardsSvgContent += `
          <text x="${cardX + 24}" y="${footerLineY + 32}" font-family="sans-serif" font-size="16" fill="#94a3b8" text-decoration="line-through">De ${escapeXml(formatBRL(prod.price))}</text>
          <text x="${cardX + 24}" y="${footerLineY + 66}" font-family="sans-serif" font-size="30" font-weight="bold" fill="#2d5a27">${escapeXml(formatBRL(effPrice))}</text>
        `;
      } else {
        cardsSvgContent += `
          <text x="${cardX + 24}" y="${footerLineY + 30}" font-family="sans-serif" font-size="14" font-weight="bold" fill="#64748b">VALOR UNITÁRIO</text>
          <text x="${cardX + 24}" y="${footerLineY + 66}" font-family="sans-serif" font-size="30" font-weight="bold" fill="#2d5a27">${escapeXml(formatBRL(effPrice))}</text>
        `;
      }

      // Botão visual simulando o card do site ("Peça pelo nome")
      const btnW = 230;
      const btnH = 52;
      const btnX = cardX + cardW - btnW - 22;
      const btnY = footerLineY + 22;
      cardsSvgContent += `
          <rect x="${btnX}" y="${btnY}" width="${btnW}" height="${btnH}" rx="12" ry="12" fill="#2d5a27"/>
          <text x="${btnX + Math.round(btnW / 2)}" y="${btnY + 23}" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="#dcfce7">PARA COMPRAR DIGITE:</text>
          <text x="${btnX + Math.round(btnW / 2)}" y="${btnY + 41}" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="#ffffff">${escapeXml(prod.name.length > 22 ? prod.name.slice(0, 20) + '...' : prod.name)}</text>
        </g>
      `;

      // Overlay de badge sobre a foto (adicionado como SVG composto após a foto)
      const badgeOverlaySvg = Buffer.from(
        `<svg width="${photoW}" height="${photoH}" xmlns="http://www.w3.org/2000/svg">
          <rect x="12" y="12" width="${Math.min(photoW - 24, categoryLabel.length * 10 + 28)}" height="32" rx="16" ry="16" fill="#1a3a16" opacity="0.88"/>
          <text x="26" y="33" font-family="sans-serif" font-size="13.5" font-weight="bold" fill="#ffffff">${escapeXml(categoryLabel)}</text>
          ${
            hasDiscount
              ? `<rect x="${photoW - 118}" y="12" width="106" height="32" rx="16" ry="16" fill="#f59e0b"/>
                 <text x="${photoW - 65}" y="33" text-anchor="middle" font-family="sans-serif" font-size="13.5" font-weight="bold" fill="#1a3a16">OFERTA</text>`
              : ''
          }
        </svg>`
      );
      composites.push({
        input: badgeOverlaySvg,
        left: photoX,
        top: photoY,
      });
    }

    const basePageSvg = Buffer.from(
      `<svg width="${pageWidth}" height="${pageHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="headerGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1a3a16"/>
            <stop offset="100%" stop-color="#2d5a27"/>
          </linearGradient>
        </defs>

        <!-- Fundo geral da página -->
        <rect x="0" y="0" width="${pageWidth}" height="${pageHeight}" fill="#f8fafc"/>

        <!-- Cabeçalho Oficial Ecosopis -->
        <rect x="0" y="0" width="${pageWidth}" height="186" fill="url(#headerGrad)"/>
        <text x="64" y="72" font-family="sans-serif" font-size="40" font-weight="bold" fill="#ffffff" letter-spacing="2">ECOSOPIS</text>
        <text x="64" y="108" font-family="sans-serif" font-size="20" font-weight="bold" fill="#bbf7d0">CATÁLOGO OFICIAL • COSMÉTICOS NATURAIS &amp; VEGANOS</text>
        <text x="64" y="148" font-family="sans-serif" font-size="18" fill="#f0fdf4">Gostou de um produto? Basta digitar o NOME DELE na conversa do WhatsApp!</text>

        <!-- Selo de Página no Cabeçalho -->
        <rect x="${pageWidth - 250}" y="48" width="186" height="46" rx="23" ry="23" fill="#ffffff" opacity="0.16"/>
        <text x="${pageWidth - 157}" y="78" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="bold" fill="#ffffff">Página ${pageIdx + 1} de ${totalPages}</text>

        <!-- Grid 2x2 de Cards de Produtos -->
        ${cardsSvgContent}

        <!-- Rodapé Institucional -->
        <rect x="64" y="1638" width="${pageWidth - 128}" height="76" rx="16" ry="16" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="2"/>
        <text x="${Math.round(pageWidth / 2)}" y="1672" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="bold" fill="#166534">Frete Grátis Sul e Sudeste acima de R$ 148,90 • Atacado 45% OFF a partir de 10 un.</text>
        <text x="${Math.round(pageWidth / 2)}" y="1698" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#2d5a27">Para comprar qualquer item deste catálogo, envie o NOME DO PRODUTO no WhatsApp!</text>
      </svg>`
    );

    const pageJpeg = await sharp(basePageSvg)
      .composite(composites)
      .jpeg({ quality: 88, chromaSubsampling: '4:2:0' })
      .toBuffer();

    renderedPages.push({
      jpeg: pageJpeg,
      width: pageWidth,
      height: pageHeight,
    });
  }

  const pdfBuffer = buildPdfFromJpegPages(renderedPages);
  g.__ecosopisCatalogPdfCache = {
    buffer: pdfBuffer,
    signature,
    createdAt: now,
  };
  return pdfBuffer;
}

