// Utilitários de SEO usados apenas no servidor (metadata, sitemap, JSON-LD).
import { getStaticProductData } from "@/lib/productData";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ecosopis.com.br").replace(/\/$/, "");
export const SITE_NAME = "Ecosopis";
export const SITE_ALTERNATE_NAMES = ["ECOSOPIS", "Ecosopis Cosméticos Naturais"];
export const DEFAULT_TITLE = "Ecosopis | Cosméticos Naturais, Veganos e Artesanais";
export const DEFAULT_DESCRIPTION =
    "Cosméticos naturais, veganos e artesanais: sabonetes naturais, óleos essenciais 100% puros, óleos vegetais, manteigas, cremes e tônicos capilares. Compre online com entrega para todo o Brasil.";
export const DEFAULT_OG_IMAGE = "/logo_final.png";
export const INSTAGRAM_URL = "https://www.instagram.com/ecosopis/";

// Backend acessado direto do servidor Next (mesma regra do next.config.js)
export const BACKEND_URL =
    process.env.SEO_BACKEND_URL ? process.env.SEO_BACKEND_URL
    : process.env.NODE_ENV === "production"
        ? "https://web-production-33f04.up.railway.app"
        : process.env.BACKEND_URL && !/localhost|127\.0\.0\.1/.test(process.env.BACKEND_URL)
            ? process.env.BACKEND_URL
            : "https://web-production-33f04.up.railway.app";

/** URL de imagem do produto -> caminho público do site (mesma lógica da página de produto). */
export function productImagePath(url?: string | null): string {
    if (!url) return "/static/attached_assets/generated_images/natural_soap_bars_photography_lifestyle.png";
    if (url.startsWith("http")) return url;
    if (url.startsWith("//")) return `https:${url}`;
    if (url.startsWith("/api/") || url.startsWith("/static/")) return url;
    if (url.startsWith("/images/")) return `/api${url}`;
    if (url.startsWith("images/")) return `/api/${url}`;
    if (url.startsWith("/attached_assets/") || url.startsWith("/uploads/")) return `/static${url}`;
    if (url.startsWith("attached_assets/") || url.startsWith("uploads/")) return `/static/${url}`;
    return url.startsWith("/") ? url : `/${url}`;
}

export function absUrl(path: string): string {
    if (!path) return SITE_URL;
    if (/^https?:\/\//.test(path)) return path;
    return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Remove HTML/markdown e encurta para descrição de busca (~155 caracteres). */
export function plainText(text?: string | null, limit = 155): string {
    const t = String(text || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/[*_#>`~]+/g, "")
        .replace(/\s+/g, " ")
        .trim();
    if (t.length <= limit) return t;
    const cut = t.slice(0, limit - 1);
    return cut.slice(0, Math.max(cut.lastIndexOf(" "), limit - 20)).replace(/[\s,.;:]+$/, "") + "…";
}

function toArray(v: any): any[] {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
        try {
            const r = JSON.parse(v);
            return Array.isArray(r) ? r : [];
        } catch {
            return [];
        }
    }
    return [];
}

/** Mesma normalização que a página de produto faz no navegador. */
export function normalizeProduct(raw: any): any {
    if (!raw) return raw;
    const data = { ...raw, images: toArray(raw.images), tags: toArray(raw.tags), story_videos: toArray(raw.story_videos) };
    const staticData = getStaticProductData(data.slug);
    if (staticData) {
        data.ingredients = staticData.ativos;
        data.benefits = staticData.beneficios;
        data.frase_decisao = staticData.frase_decisao;
        data.details = {
            ...(data.details || {}),
            modo_de_uso: staticData.modo_de_uso,
            ingredientes: staticData.ativos,
            beneficios: staticData.beneficios,
        };
    }
    return data;
}

/** null = erro/indisponível; undefined = 404 (não existe). */
async function backendJson(path: string, revalidate = 300): Promise<any | null | undefined> {
    try {
        const res = await fetch(`${BACKEND_URL}${path}`, {
            next: { revalidate },
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8000),
        });
        if (res.status === 404) return undefined;
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/** Produto normalizado; undefined se não existe; null se o backend falhou. */
export async function getProduct(slug: string): Promise<any | null | undefined> {
    const raw = await backendJson(`/api/products/${encodeURIComponent(slug)}`, 300);
    if (raw === undefined) return undefined;
    return raw ? normalizeProduct(raw) : null;
}

export async function getProducts(): Promise<any[]> {
    const list = await backendJson(`/api/products`, 600);
    return Array.isArray(list) ? list.map(normalizeProduct) : [];
}

// Palavras que não ajudam a identificar o produto ao comparar slugs
const SLUG_STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "100", "puro", "pura", "natural", "oe"]);

function slugTokens(text: string): string[] {
    return String(text || "")
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter((t) => t && !SLUG_STOPWORDS.has(t));
}

/**
 * Encontra o produto certo para um slug que não existe (links antigos, catálogo da Meta,
 * Google ou digitação), comparando as palavras do slug com o nome/slug de cada produto.
 * Só devolve quando a correspondência é inequívoca.
 */
export async function resolveProductSlug(slug: string): Promise<string | null> {
    const wanted = slugTokens(slug);
    if (!wanted.length) return null;
    const products = await getProducts();
    const scored = products
        .filter((p) => p?.slug && p.is_active !== false)
        .map((p) => {
            const have = new Set([...slugTokens(p.name), ...slugTokens(p.slug)]);
            const hits = wanted.filter((t) => have.has(t)).length;
            return { slug: String(p.slug), hits, score: hits / wanted.length, size: have.size };
        })
        .filter((s) => s.score >= 0.75)
        .sort((a, b) => b.score - a.score || a.size - b.size);
    if (!scored.length) return null;
    if (scored.length > 1 && scored[1].score === scored[0].score && scored[1].size === scored[0].size) return null;
    return scored[0].slug !== slug ? scored[0].slug : null;
}

export async function getApprovedReviews(productId: number): Promise<any[]> {
    const list = await backendJson(`/api/reviews/approved?product_id=${productId}`, 900);
    return Array.isArray(list) ? list : [];
}

export async function getNews(): Promise<any[]> {
    const list = await backendJson(`/api/news`, 1800);
    return Array.isArray(list) ? list : [];
}

export function currentPrice(p: any): number {
    const base = Number(p?.price || 0);
    const sale = Number(p?.sale_price || 0);
    return p?.is_on_sale && sale > 0 && (sale < base || !base) ? sale : base;
}

/** Serializa JSON-LD de forma segura para <script>. */
export function jsonLd(data: unknown): string {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Páginas privadas: fora do Google. */
export const NOINDEX = { index: false, follow: false, googleBot: { index: false, follow: false } } as const;
