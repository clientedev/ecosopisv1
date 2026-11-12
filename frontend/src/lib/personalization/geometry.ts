export type Pt = [number, number];
export type Mat3 = number[]; // 9 valores, linha a linha

/** Homografia que leva os 4 pontos src nos 4 pontos dst. */
export function solveHomography(src: Pt[], dst: Pt[]): Mat3 {
    const A: number[][] = [];
    const b: number[] = [];
    for (let i = 0; i < 4; i++) {
        const [x, y] = src[i];
        const [u, v] = dst[i];
        A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
        b.push(u);
        A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
        b.push(v);
    }
    // eliminação de Gauss com pivotamento parcial
    const n = 8;
    for (let c = 0; c < n; c++) {
        let p = c;
        for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
        [A[c], A[p]] = [A[p], A[c]];
        [b[c], b[p]] = [b[p], b[c]];
        const d = A[c][c] || 1e-12;
        for (let r = c + 1; r < n; r++) {
            const f = A[r][c] / d;
            for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
            b[r] -= f * b[c];
        }
    }
    const h = new Array(8).fill(0);
    for (let r = n - 1; r >= 0; r--) {
        let s = b[r];
        for (let k = r + 1; k < n; k++) s -= A[r][k] * h[k];
        h[r] = s / (A[r][r] || 1e-12);
    }
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function applyH(H: Mat3, x: number, y: number): Pt {
    const w = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

export function invertH(m: Mat3): Mat3 {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C || 1e-12;
    return [
        A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
        B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
        C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
    ];
}

const CYL_MAX = Math.PI * 0.92;

/** Posição horizontal na tela (0..1) para uma posição u (0..1) ao longo da superfície cilíndrica. */
export function cylWarp(u: number, curvature: number): number {
    if (curvature < 0.001) return u;
    const th = curvature * CYL_MAX;
    return 0.5 + Math.sin((u - 0.5) * th) / (2 * Math.sin(th / 2));
}

export function cylUnwarp(us: number, curvature: number): number {
    if (curvature < 0.001) return us;
    const th = curvature * CYL_MAX;
    const k = Math.max(-1, Math.min(1, (us - 0.5) * 2 * Math.sin(th / 2)));
    return 0.5 + Math.asin(k) / th;
}

export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Proporção largura/altura estimada da área (cantos em px: sup-esq, sup-dir, inf-dir, inf-esq). */
export function quadAspect(q: Pt[]): number {
    const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
    const h = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
    return Math.max(0.05, Math.min(20, w / Math.max(h, 1e-6)));
}
