import { Pt, Mat3, solveHomography, applyH, invertH, cylWarp, cylUnwarp, quadAspect } from "./geometry";

export interface AreaCfg {
    quad: number[][]; // 4 cantos normalizados (0..1): sup-esq, sup-dir, inf-dir, inf-esq
    curvature: number;
    aspect_ratio: number | null;
    cover_label: boolean;
    base_color: string | null;
}

/**
 * Transformação da arte no "plano" da área: largura da área = 1, altura = 1/proporção.
 * cx/cy = centro da arte nesse plano.
 */
export interface ArtTransform {
    cx: number;
    cy: number;
    scale: number;     // largura da arte (fração da largura da área)
    sx: number;        // esticar largura (1 = proporção original)
    sy: number;        // esticar altura
    rotation: number;  // graus
    opacity: number;   // 0..1
    perspX: number;    // -0.6..0.6 (inclina a arte horizontalmente)
    perspY: number;    // -0.6..0.6 (inclina a arte verticalmente)
    curvature: number; // 0..1 (curvatura da superfície)
}

type Canvasish = HTMLCanvasElement | HTMLImageElement | ImageBitmap;

export function areaAspect(area: AreaCfg, photoW: number, photoH: number): number {
    if (area.aspect_ratio && area.aspect_ratio > 0) return area.aspect_ratio;
    return quadAspect(area.quad.map(([x, y]) => [x * photoW, y * photoH] as Pt));
}

export function defaultTransform(area: AreaCfg, photoW: number, photoH: number, art: { width: number; height: number } | null): ArtTransform {
    const A = areaAspect(area, photoW, photoH);
    const ph = 1 / A;
    let scale = 0.7;
    if (art) {
        const artAspect = art.width / art.height; // w/h
        // cabe em 80% da largura e 80% da altura da área
        scale = Math.min(0.8, (0.8 * ph) * artAspect);
    }
    return { cx: 0.5, cy: ph / 2, scale, sx: 1, sy: 1, rotation: 0, opacity: 1, perspX: 0, perspY: 0, curvature: area.curvature || 0 };
}

function hexToRgb(hex: string): [number, number, number] {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return [200, 200, 200];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
}

/** Reduz a arte em passos de 50% até ficar perto do tamanho necessário (evita serrilhado). */
function prepareArt(art: HTMLCanvasElement, targetW: number): HTMLCanvasElement {
    let cur = art;
    while (cur.width * 0.5 >= targetW && cur.width > 8) {
        const next = makeCanvas(cur.width / 2, cur.height / 2);
        const ctx = next.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(cur, 0, 0, next.width, next.height);
        cur = next;
    }
    return cur;
}

/** Quatro cantos da arte no plano (largura da área = 1), já com escala, perspectiva, rotação e posição. */
export function artPlaneCorners(t: ArtTransform, art: { width: number; height: number }): Pt[] {
    const aw = t.scale * t.sx;
    const ah = t.scale * t.sy * (art.height / art.width);
    const hw = aw / 2, hh = ah / 2;
    // perspectiva: encolhe um lado
    const kx = Math.max(-0.7, Math.min(0.7, t.perspX));
    const ky = Math.max(-0.7, Math.min(0.7, t.perspY));
    let c: Pt[] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    // perspX > 0 → lado superior mais estreito; < 0 → lado inferior mais estreito
    c = c.map(([x, y]) => [x * (1 - kx * (-y / hh) * 0.5), y] as Pt);
    // perspY > 0 → lado esquerdo mais baixo (inclinação vertical)
    c = c.map(([x, y]) => [x, y * (1 - ky * (x / hw) * 0.5)] as Pt);
    const r = (t.rotation * Math.PI) / 180;
    const cos = Math.cos(r), sin = Math.sin(r);
    return c.map(([x, y]) => [t.cx + x * cos - y * sin, t.cy + x * sin + y * cos] as Pt);
}

export interface RenderOptions {
    photo: Canvasish;
    photoW: number;
    photoH: number;
    area: AreaCfg;
    art: HTMLCanvasElement | null;
    t: ArtTransform;
    outWidth: number;
    draft?: boolean;
}

export interface Mapper {
    A: number;
    Hq: Mat3;       // quadrado unitário -> pixels da saída
    HqInv: Mat3;
    curvature: number;
}

export function buildMapper(area: AreaCfg, curvature: number, outW: number, outH: number, photoW: number, photoH: number): Mapper {
    const quadPx = area.quad.map(([x, y]) => [x * outW, y * outH] as Pt);
    const Hq = solveHomography([[0, 0], [1, 0], [1, 1], [0, 1]], quadPx);
    return { A: areaAspect(area, photoW, photoH), Hq, HqInv: invertH(Hq), curvature };
}

/** Ponto da imagem (px da saída) -> plano da área (largura 1). Retorna null se não for invertível. */
export function imageToPlane(m: Mapper, x: number, y: number): Pt {
    const [us, v] = applyH(m.HqInv, x, y);
    const u = cylUnwarp(us, m.curvature);
    return [u, v / m.A];
}

function affineFromTriangles(s: Pt[], d: Pt[]): [number, number, number, number, number, number] | null {
    const ux = s[1][0] - s[0][0], uy = s[1][1] - s[0][1];
    const vx = s[2][0] - s[0][0], vy = s[2][1] - s[0][1];
    const det = ux * vy - vx * uy;
    if (Math.abs(det) < 1e-9) return null;
    const iu = [vy / det, -vx / det, -uy / det, ux / det]; // inversa de [[ux vx],[uy vy]]
    const Ux = d[1][0] - d[0][0], Uy = d[1][1] - d[0][1];
    const Vx = d[2][0] - d[0][0], Vy = d[2][1] - d[0][1];
    const a = Ux * iu[0] + Vx * iu[2];
    const c = Ux * iu[1] + Vx * iu[3];
    const b = Uy * iu[0] + Vy * iu[2];
    const dd = Uy * iu[1] + Vy * iu[3];
    const e = d[0][0] - a * s[0][0] - c * s[0][1];
    const f = d[0][1] - b * s[0][0] - dd * s[0][1];
    return [a, b, c, dd, e, f];
}

function expandTriangle(p: Pt[], by: number): Pt[] {
    const cx = (p[0][0] + p[1][0] + p[2][0]) / 3, cy = (p[0][1] + p[1][1] + p[2][1]) / 3;
    return p.map(([x, y]) => {
        const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1;
        return [x + (dx / l) * by, y + (dy / l) * by] as Pt;
    });
}

/**
 * Compõe a arte sobre a fotografia original:
 *  1. (opcional) cobre o rótulo antigo com a cor da superfície;
 *  2. deforma a arte com perspectiva + curvatura (malha de triângulos);
 *  3. reaplica a iluminação da foto (sombras, brilho, textura) para parecer impresso.
 */
export function renderComposite(o: RenderOptions): HTMLCanvasElement {
    const scale = o.outWidth / o.photoW;
    const W = Math.round(o.photoW * scale), H = Math.round(o.photoH * scale);
    const out = makeCanvas(W, H);
    const ctx = out.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(o.photo as CanvasImageSource, 0, 0, W, H);
    if (!o.art && !o.area.cover_label) return out;

    const mapper = buildMapper(o.area, o.t.curvature, W, H, o.photoW, o.photoH);
    const quadPx = o.area.quad.map(([x, y]) => [x * W, y * H] as Pt);
    const xs = quadPx.map((p) => p[0]), ys = quadPx.map((p) => p[1]);
    const bx = Math.max(0, Math.floor(Math.min(...xs)) - 2), by = Math.max(0, Math.floor(Math.min(...ys)) - 2);
    const bw = Math.min(W - bx, Math.ceil(Math.max(...xs)) - bx + 4), bh = Math.min(H - by, Math.ceil(Math.max(...ys)) - by + 4);
    if (bw < 2 || bh < 2) return out;

    const orig = ctx.getImageData(bx, by, bw, bh);

    // máscara da área
    const maskC = makeCanvas(bw, bh);
    const mctx = maskC.getContext("2d", { willReadFrequently: true })!;
    mctx.fillStyle = "#fff";
    mctx.beginPath();
    quadPx.forEach(([x, y], i) => (i ? mctx.lineTo(x - bx, y - by) : mctx.moveTo(x - bx, y - by)));
    mctx.closePath();
    mctx.fill();
    const mask = mctx.getImageData(0, 0, bw, bh).data;

    // luminância suavizada (iluminação da superfície sem os detalhes do rótulo antigo)
    const lum = new Float32Array(bw * bh);
    for (let i = 0, p = 0; i < lum.length; i++, p += 4) lum[i] = 0.299 * orig.data[p] + 0.587 * orig.data[p + 1] + 0.114 * orig.data[p + 2];
    const blurC = makeCanvas(bw, bh);
    {
        const small = makeCanvas(Math.max(3, bw / 5), Math.max(3, bh / 5));
        const sctx = small.getContext("2d")!;
        sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = "high";
        const src = makeCanvas(bw, bh);
        src.getContext("2d")!.putImageData(orig, 0, 0);
        sctx.drawImage(src, 0, 0, small.width, small.height);
        const bctx = blurC.getContext("2d")!;
        bctx.imageSmoothingEnabled = true; bctx.imageSmoothingQuality = "high";
        bctx.drawImage(small, 0, 0, bw, bh);
    }
    const bl = blurC.getContext("2d")!.getImageData(0, 0, bw, bh).data;
    const lblur = new Float32Array(bw * bh);
    let sum = 0, cnt = 0;
    for (let i = 0, p = 0; i < lblur.length; i++, p += 4) {
        lblur[i] = 0.299 * bl[p] + 0.587 * bl[p + 1] + 0.114 * bl[p + 2];
        if (mask[p] > 128) { sum += lblur[i]; cnt++; }
    }
    const lmean = Math.max(20, cnt ? sum / cnt : 128);

    // camada de cobertura do rótulo antigo
    let coverData: Uint8ClampedArray | null = null;
    let cornerShade: number[] | null = null;
    if (o.area.cover_label) {
        let rgb: [number, number, number];
        if (o.area.base_color) rgb = hexToRgb(o.area.base_color);
        else {
            // cor média logo fora da área
            const cxq = xs.reduce((a, b) => a + b, 0) / 4, cyq = ys.reduce((a, b) => a + b, 0) / 4;
            const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
            let r = 0, g = 0, b = 0, n = 0;
            for (let e = 0; e < 4; e++) {
                const p0 = quadPx[e], p1 = quadPx[(e + 1) % 4];
                for (let k = 1; k < 10; k++) {
                    const px = p0[0] + ((p1[0] - p0[0]) * k) / 10, py = p0[1] + ((p1[1] - p0[1]) * k) / 10;
                    const dx = px - cxq, dy = py - cyq, l = Math.hypot(dx, dy) || 1;
                    const sx = Math.round(px + (dx / l) * diag * 0.06 - bx), sy = Math.round(py + (dy / l) * diag * 0.06 - by);
                    if (sx < 0 || sy < 0 || sx >= bw || sy >= bh) continue;
                    const idx = (sy * bw + sx) * 4;
                    if (mask[idx] > 128) continue;
                    r += orig.data[idx]; g += orig.data[idx + 1]; b += orig.data[idx + 2]; n++;
                }
            }
            rgb = n ? [r / n, g / n, b / n] : [235, 235, 235];
        }
        // iluminação nos cantos (tendência suave de claro/escuro ao redor), sem vazar o desenho do rótulo antigo
        {
            const cxq = xs.reduce((a, b) => a + b, 0) / 4, cyq = ys.reduce((a, b) => a + b, 0) / 4;
            const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
            const lumAt = (px: number, py: number): number | null => {
                const sx = Math.round(px - bx), sy = Math.round(py - by);
                if (sx < 0 || sy < 0 || sx >= bw || sy >= bh) return null;
                const idx = sy * bw + sx;
                return lblur[idx];
            };
            const vals = quadPx.map(([px, py]) => {
                const dx = px - cxq, dy = py - cyq, l = Math.hypot(dx, dy) || 1;
                return lumAt(px + (dx / l) * diag * 0.05, py + (dy / l) * diag * 0.05);
            });
            const ok = vals.filter((v): v is number => v != null);
            const mean = ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : 0;
            cornerShade = vals.map((v) => (v == null || mean < 1 ? 1 : Math.max(0.88, Math.min(1.1, 1 + 0.5 * (v / mean - 1)))));
        }
        const cc = makeCanvas(bw, bh);
        const cctx = cc.getContext("2d", { willReadFrequently: true })!;
        cctx.fillStyle = `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`;
        cctx.beginPath();
        quadPx.forEach(([x, y], i) => (i ? cctx.lineTo(x - bx, y - by) : cctx.moveTo(x - bx, y - by)));
        cctx.closePath();
        cctx.fill();
        coverData = cctx.getImageData(0, 0, bw, bh).data;
    }

    // camada da arte deformada
    let artData: Uint8ClampedArray | null = null;
    if (o.art) {
        const corners = artPlaneCorners(o.t, o.art);
        const aw = o.art.width, ah = o.art.height;
        const Ha = solveHomography([[0, 0], [aw, 0], [aw, ah], [0, ah]], corners);
        const HaInv = invertH(Ha);
        // largura aproximada da arte em px da saída → escolhe a resolução da textura
        const quadW = (Math.hypot(quadPx[1][0] - quadPx[0][0], quadPx[1][1] - quadPx[0][1]) + Math.hypot(quadPx[2][0] - quadPx[3][0], quadPx[2][1] - quadPx[3][1])) / 2;
        const prep = prepareArt(o.art, Math.max(16, o.t.scale * o.t.sx * quadW * 1.2));
        const ps = prep.width / aw;

        const layer = makeCanvas(bw, bh);
        const lctx = layer.getContext("2d", { willReadFrequently: true })!;
        lctx.imageSmoothingEnabled = true;
        lctx.imageSmoothingQuality = o.draft ? "low" : "high";
        lctx.save();
        lctx.beginPath();
        quadPx.forEach(([x, y], i) => (i ? lctx.lineTo(x - bx, y - by) : lctx.moveTo(x - bx, y - by)));
        lctx.closePath();
        lctx.clip();

        const N = o.draft ? 22 : 56, M = o.draft ? 12 : 36;
        const A = mapper.A;
        const dst: Pt[][] = [], srcA: Pt[][] = [];
        for (let j = 0; j <= M; j++) {
            dst.push([]); srcA.push([]);
            for (let i = 0; i <= N; i++) {
                const u = i / N, v = j / M;
                const us = cylWarp(u, mapper.curvature);
                const [px, py] = applyH(mapper.Hq, us, v);
                dst[j].push([px - bx, py - by]);
                srcA[j].push(applyH(HaInv, u, v / A));
            }
        }
        const drawTri = (s: Pt[], d: Pt[]) => {
            const minx = Math.min(s[0][0], s[1][0], s[2][0]), maxx = Math.max(s[0][0], s[1][0], s[2][0]);
            const miny = Math.min(s[0][1], s[1][1], s[2][1]), maxy = Math.max(s[0][1], s[1][1], s[2][1]);
            if (maxx < 0 || maxy < 0 || minx > aw || miny > ah) return;
            const af = affineFromTriangles(s, d);
            if (!af) return;
            const sx0 = Math.max(0, Math.floor(minx) - 1), sy0 = Math.max(0, Math.floor(miny) - 1);
            const sx1 = Math.min(aw, Math.ceil(maxx) + 1), sy1 = Math.min(ah, Math.ceil(maxy) + 1);
            const sw = sx1 - sx0, sh = sy1 - sy0;
            if (sw <= 0 || sh <= 0) return;
            const ed = expandTriangle(d, o.draft ? 0.9 : 0.6);
            lctx.save();
            lctx.beginPath();
            lctx.moveTo(ed[0][0], ed[0][1]); lctx.lineTo(ed[1][0], ed[1][1]); lctx.lineTo(ed[2][0], ed[2][1]);
            lctx.closePath();
            lctx.clip();
            lctx.setTransform(af[0] / ps, af[1] / ps, af[2] / ps, af[3] / ps, af[4], af[5]);
            lctx.drawImage(prep, sx0 * ps, sy0 * ps, sw * ps, sh * ps, sx0 * ps, sy0 * ps, sw * ps, sh * ps);
            lctx.restore();
        };
        for (let j = 0; j < M; j++) {
            for (let i = 0; i < N; i++) {
                const d00 = dst[j][i], d10 = dst[j][i + 1], d01 = dst[j + 1][i], d11 = dst[j + 1][i + 1];
                const s00 = srcA[j][i], s10 = srcA[j][i + 1], s01 = srcA[j + 1][i], s11 = srcA[j + 1][i + 1];
                drawTri([s00, s10, s01], [d00, d10, d01]);
                drawTri([s10, s11, s01], [d10, d11, d01]);
            }
        }
        lctx.restore();
        artData = lctx.getImageData(0, 0, bw, bh).data;
    }

    // composição final com a iluminação da foto
    const res = orig.data;
    const keepDetail = !o.area.cover_label; // sem cobrir o rótulo, a textura da foto continua visível
    const op = Math.max(0, Math.min(1, o.t.opacity));
    const cs = cornerShade;
    const th = mapper.curvature * Math.PI * 0.92;
    const cosEdge = Math.cos(th / 2);
    const shadeOf = (i: number) => {
        if (cs) {
            // modo "cobrir rótulo": iluminação suave (gradiente dos cantos + sombreado cilíndrico), sem detalhes do rótulo antigo
            const px = (i % bw) + bx + 0.5, py = Math.floor(i / bw) + by + 0.5;
            const [us, v] = applyH(mapper.HqInv, px, py);
            const uu = Math.max(0, Math.min(1, us)), vv = Math.max(0, Math.min(1, v));
            const top = cs[0] * (1 - uu) + cs[1] * uu, bot = cs[3] * (1 - uu) + cs[2] * uu;
            let g = top * (1 - vv) + bot * vv;
            if (th > 0.01) {
                const u = cylUnwarp(uu, mapper.curvature);
                const nz = Math.cos((u - 0.5) * th);
                g *= 0.8 + 0.2 * ((nz - cosEdge) / (1 - cosEdge + 1e-6));
            }
            return { f: g, spec: 0 };
        }
        const s = Math.max(0.8, Math.min(1.16, lblur[i] / lmean));
        const spec = Math.max(0, lblur[i] - lmean * 1.15) * 0.55;
        const detail = keepDetail ? Math.max(-0.06, Math.min(0.06, ((lum[i] - lblur[i]) / 255) * 0.25)) : 0;
        return { f: s * (1 + detail), spec };
    };
    for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
        const { f, spec } = shadeOf(i);
        if (coverData) {
            const a = coverData[p + 3] / 255;
            if (a > 0) {
                res[p] = res[p] * (1 - a) + Math.min(255, coverData[p] * f + spec) * a;
                res[p + 1] = res[p + 1] * (1 - a) + Math.min(255, coverData[p + 1] * f + spec) * a;
                res[p + 2] = res[p + 2] * (1 - a) + Math.min(255, coverData[p + 2] * f + spec) * a;
            }
        }
        if (artData) {
            const a = (artData[p + 3] / 255) * op;
            if (a > 0.002) {
                const rr = Math.min(255, artData[p] * f + spec * 0.8);
                const gg = Math.min(255, artData[p + 1] * f + spec * 0.8);
                const bb = Math.min(255, artData[p + 2] * f + spec * 0.8);
                res[p] = res[p] * (1 - a) + rr * a;
                res[p + 1] = res[p + 1] * (1 - a) + gg * a;
                res[p + 2] = res[p + 2] * (1 - a) + bb * a;
            }
        }
    }
    ctx.putImageData(orig, bx, by);
    return out;
}


/**
 * "Desenrola" a área marcada da foto original (rótulo antigo) numa imagem plana, já corrigida de
 * perspectiva e curvatura. Serve para recortar elementos do rótulo e movê-los como camadas.
 * O canvas retornado cobre o plano da área: largura = 1, altura = 1/proporção.
 */
export function extractLabel(photo: CanvasImageSource, photoW: number, photoH: number, area: AreaCfg, outW = 900): HTMLCanvasElement {
    const A = areaAspect(area, photoW, photoH);
    const W = Math.round(outW), H = Math.max(2, Math.round(outW / A));
    const src = makeCanvas(photoW, photoH);
    const sctx = src.getContext("2d", { willReadFrequently: true })!;
    sctx.drawImage(photo, 0, 0, photoW, photoH);
    const sd = sctx.getImageData(0, 0, photoW, photoH).data;
    const mapper = buildMapper(area, area.curvature || 0, photoW, photoH, photoW, photoH);
    const out = makeCanvas(W, H);
    const octx = out.getContext("2d")!;
    const od = octx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
        const v = (y + 0.5) / H;
        for (let x = 0; x < W; x++) {
            const u = (x + 0.5) / W;
            const [px, py] = applyH(mapper.Hq, cylWarp(u, mapper.curvature), v);
            const fx = Math.max(0, Math.min(photoW - 1.001, px - 0.5)), fy = Math.max(0, Math.min(photoH - 1.001, py - 0.5));
            const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
            const i00 = (y0 * photoW + x0) * 4, i10 = i00 + 4, i01 = i00 + photoW * 4, i11 = i01 + 4;
            const o = (y * W + x) * 4;
            for (let c = 0; c < 3; c++) {
                od.data[o + c] = (sd[i00 + c] * (1 - tx) + sd[i10 + c] * tx) * (1 - ty) + (sd[i01 + c] * (1 - tx) + sd[i11 + c] * tx) * ty;
            }
            od.data[o + 3] = 255;
        }
    }
    octx.putImageData(od, 0, 0);
    return out;
}
