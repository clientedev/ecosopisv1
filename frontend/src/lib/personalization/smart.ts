import { AreaCfg, ArtTransform, areaAspect, defaultTransform } from "./renderer";

/** Retângulo (px) do conteúdo "visível" da arte, ignorando margens transparentes ou do mesmo fundo liso. */
export function contentBox(art: HTMLCanvasElement): { x0: number; y0: number; x1: number; y1: number; hasAlpha: boolean; lum: number } {
    const w = Math.min(art.width, 400), h = Math.max(1, Math.round((art.height * w) / art.width));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(art, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let transparent = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) transparent++;
    const hasAlpha = transparent / (w * h) > 0.02;
    // cor de fundo = média dos cantos
    const corner = (x: number, y: number) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
    const cs = [corner(0, 0), corner(w - 1, 0), corner(0, h - 1), corner(w - 1, h - 1)];
    const bg = [0, 1, 2].map((k) => cs.reduce((a, p) => a + p[k], 0) / 4);
    const bgSolid = cs.every((p) => Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) < 40 && p[3] > 240);
    let x0 = w, y0 = h, x1 = -1, y1 = -1, lumSum = 0, n = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            let on: boolean;
            if (d[i + 3] < 40) on = false;
            else if (!hasAlpha && bgSolid) on = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 60;
            else on = true;
            if (on) {
                if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
                lumSum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++;
            }
        }
    }
    if (x1 < 0) return { x0: 0, y0: 0, x1: art.width, y1: art.height, hasAlpha, lum: 128 };
    const k = art.width / w;
    return { x0: x0 * k, y0: y0 * k, x1: (x1 + 1) * k, y1: (y1 + 1) * k, hasAlpha, lum: n ? lumSum / n : 128 };
}

/** Variação (desvio padrão da luminância) e cor média da superfície marcada na foto. */
export function surfaceStats(photo: CanvasImageSource, photoW: number, photoH: number, area: AreaCfg): { std: number; lum: number } {
    const w = 240, h = Math.max(1, Math.round((photoH * w) / photoW));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(photo, 0, 0, w, h);
    const q = area.quad.map(([x, y]) => [x * w, y * h]);
    const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
    const bx = Math.max(0, Math.floor(Math.min(...xs))), by = Math.max(0, Math.floor(Math.min(...ys)));
    const bw = Math.max(2, Math.min(w - bx, Math.ceil(Math.max(...xs)) - bx)), bh = Math.max(2, Math.min(h - by, Math.ceil(Math.max(...ys)) - by));
    const d = ctx.getImageData(bx, by, bw, bh).data;
    let s = 0, s2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; s += l; s2 += l * l; n++; }
    const m = s / Math.max(1, n);
    return { std: Math.sqrt(Math.max(0, s2 / Math.max(1, n) - m * m)), lum: m };
}

export interface SmartResult { t: ArtTransform; cover: boolean; notes: string[] }

/**
 * "Ajuda da I.A.": analisa a logo (margens, fundo, claridade) e a superfície do produto (rótulo antigo,
 * brilho) e devolve posição, tamanho e se deve esconder o rótulo original. Roda no navegador, sem custo.
 */
export function smartFit(art: HTMLCanvasElement, photo: CanvasImageSource, photoW: number, photoH: number, area: AreaCfg): SmartResult {
    const notes: string[] = [];
    const A = areaAspect(area, photoW, photoH);
    const ph = 1 / A;
    const box = contentBox(art);
    const cw = Math.max(1, box.x1 - box.x0), ch = Math.max(1, box.y1 - box.y0);
    // quanto da área a logo pode ocupar (deixa margem de respiro)
    const fill = 0.74;
    const contentAspect = cw / ch;
    // largura do conteúdo no plano
    let contentW = Math.min(fill, fill * ph * contentAspect);
    if (contentW < 0.12) contentW = 0.12;
    // largura da arte inteira que resulta nesse conteúdo
    const scale = contentW * (art.width / cw);
    // deslocamento do centro do conteúdo em relação ao centro da arte
    const offX = ((box.x0 + box.x1) / 2 - art.width / 2) / art.width * scale;
    const offY = ((box.y0 + box.y1) / 2 - art.height / 2) / art.width * scale;
    const base = defaultTransform(area, photoW, photoH, art);
    const t: ArtTransform = { ...base, scale, cx: 0.5 - offX, cy: ph / 2 - offY, sx: 1, sy: 1, rotation: 0, opacity: 1, perspX: 0, perspY: 0, curvature: area.curvature || 0 };
    if (cw < art.width * 0.9 || ch < art.height * 0.9) notes.push("margens vazias da arte foram ignoradas para centralizar a logo");
    notes.push(`logo ajustada para ocupar ~${Math.round(contentW * 100)}% da largura da área`);

    // rótulo antigo / superfície
    const st = surfaceStats(photo, photoW, photoH, area);
    let cover = !!area.cover_label;
    if (!box.hasAlpha && !cover) {
        notes.push("sua arte tem fundo próprio, ele já cobre o que estiver por baixo");
    } else if (st.std > 22 && !cover) {
        cover = true;
        notes.push("detectei um rótulo/estampa no produto — escondi o original para não aparecer por baixo da logo");
    }
    if (area.curvature > 0.2) notes.push("curvatura do frasco aplicada à logo");
    return { t, cover, notes };
}

/** Remove o fundo liso de um recorte (cor das bordas) com transição suave. tolerance 0..1 */
export function keyOutBackground(src: HTMLCanvasElement, tolerance: number): HTMLCanvasElement {
    const out = document.createElement("canvas");
    out.width = src.width; out.height = src.height;
    const ctx = out.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(src, 0, 0);
    if (tolerance <= 0.001) return out;
    const img = ctx.getImageData(0, 0, out.width, out.height);
    const d = img.data, w = out.width, h = out.height;
    // mediana das cores da borda
    const rs: number[] = [], gs: number[] = [], bs: number[] = [];
    const push = (x: number, y: number) => { const i = (y * w + x) * 4; rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
    const bg = [med(rs), med(gs), med(bs)];
    const lo = tolerance * 60, hi = lo + 40 + tolerance * 40;
    for (let i = 0; i < d.length; i += 4) {
        const dist = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]);
        const a = dist <= lo ? 0 : dist >= hi ? 1 : (dist - lo) / (hi - lo);
        d[i + 3] = Math.round(d[i + 3] * a);
    }
    ctx.putImageData(img, 0, 0);
    return out;
}
