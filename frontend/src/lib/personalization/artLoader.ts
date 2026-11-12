export interface LoadedArt {
    canvas: HTMLCanvasElement;
    name: string;
    kind: "png" | "jpg" | "svg" | "pdf";
}

const MAX_DIM = 2400;
const MAX_BYTES = 25 * 1024 * 1024;

function toCanvas(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
    const k = Math.min(1, MAX_DIM / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c;
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
        img.src = url;
    });
}

async function loadSvg(file: File): Promise<HTMLCanvasElement> {
    let text = await file.text();
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) throw new Error("SVG inválido.");
    doc.querySelectorAll("script, foreignObject").forEach((n) => n.remove());
    let w = parseFloat(svg.getAttribute("width") || "");
    let h = parseFloat(svg.getAttribute("height") || "");
    const vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
    if ((!w || !h || String(svg.getAttribute("width")).includes("%")) && vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
        const ratio = vb[2] / vb[3];
        w = 1600;
        h = 1600 / ratio;
    }
    if (!w || !h) { w = 1200; h = 1200; }
    // Escala para boa resolução (SVG é vetorial)
    const k = 1600 / Math.max(w, h);
    svg.setAttribute("width", String(Math.round(w * k)));
    svg.setAttribute("height", String(Math.round(h * k)));
    text = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
    try {
        const img = await loadImage(url);
        return toCanvas(img, Math.round(w * k), Math.round(h * k));
    } finally {
        URL.revokeObjectURL(url);
    }
}

let pdfjsPromise: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
    if ((window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib);
    if (!pdfjsPromise) {
        pdfjsPromise = new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "/vendor/pdfjs/pdf.min.js";
            s.onload = () => {
                const lib = (window as any).pdfjsLib;
                if (!lib) return reject(new Error("PDF.js não carregou."));
                lib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.js";
                resolve(lib);
            };
            s.onerror = () => { pdfjsPromise = null; reject(new Error("Não foi possível carregar o leitor de PDF.")); };
            document.head.appendChild(s);
        });
    }
    return pdfjsPromise;
}

async function loadPdf(file: File): Promise<HTMLCanvasElement> {
    const lib = await loadPdfJs();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await lib.getDocument({ data }).promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, 2000 / Math.max(base.width, base.height));
    const vp = page.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = Math.round(vp.width);
    c.height = Math.round(vp.height);
    await page.render({ canvasContext: c.getContext("2d")!, viewport: vp, background: "rgba(0,0,0,0)" }).promise;
    return c;
}

export async function loadArtFile(file: File): Promise<LoadedArt> {
    if (file.size > MAX_BYTES) throw new Error("Arquivo muito grande (máximo 25 MB).");
    const name = file.name || "arte";
    const lower = name.toLowerCase();
    const type = file.type;
    if (type === "image/svg+xml" || lower.endsWith(".svg")) return { canvas: await loadSvg(file), name, kind: "svg" };
    if (type === "application/pdf" || lower.endsWith(".pdf")) return { canvas: await loadPdf(file), name, kind: "pdf" };
    if (type === "image/png" || lower.endsWith(".png")) {
        const url = URL.createObjectURL(file);
        try { const img = await loadImage(url); return { canvas: toCanvas(img, img.naturalWidth, img.naturalHeight), name, kind: "png" }; }
        finally { URL.revokeObjectURL(url); }
    }
    if (type === "image/jpeg" || /\.jpe?g$/.test(lower)) {
        const url = URL.createObjectURL(file);
        try { const img = await loadImage(url); return { canvas: toCanvas(img, img.naturalWidth, img.naturalHeight), name, kind: "jpg" }; }
        finally { URL.revokeObjectURL(url); }
    }
    throw new Error("Formato não suportado. Envie PNG, JPG, SVG ou PDF.");
}
