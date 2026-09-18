/**
 * Utilitários para detectar e converter links/embed codes do Instagram (Posts, Reels, TV)
 * para URLs de iframe incorporáveis e renderização completa no blog e stories.
 */

/**
 * Extrai o ID do Instagram de:
 * - URL direta de Reel: https://www.instagram.com/reel/DXsW1z-DqE2/
 * - URL com /p/ (post): https://www.instagram.com/p/DXsW1z-DqE2/
 * - URL com /reels/ ou /tv/: https://www.instagram.com/reels/DXsW1z-DqE2/ ou /tv/...
 * - Embed code: <blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/reel/DXsW1z-DqE2/?...">
 */
export function extractInstagramId(input: string): string | null {
    if (!input || typeof input !== "string") return null;

    // Tenta data-instgrm-permalink primeiro (se for código embed HTML copiado do Instagram)
    const permalinkMatch = input.match(/data-instgrm-permalink=["']([^"']+)["']/i);
    const source = permalinkMatch ? permalinkMatch[1] : input;

    // Extrai ID de /reel/, /reels/, /p/ ou /tv/
    const match = source.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
    if (match && match[1]) {
        return match[1];
    }

    // Se já for só o ID direto
    const trimmed = input.trim();
    if (/^[A-Za-z0-9_-]{9,16}$/.test(trimmed)) {
        return trimmed;
    }

    return null;
}

/**
 * Retorna o link direto para visualização da publicação no Instagram
 */
export function extractInstagramPermalink(input: string): string | null {
    const id = extractInstagramId(input);
    if (!id) return null;
    return `https://www.instagram.com/p/${id}/`;
}

/**
 * Retorna true se a string for uma URL do Instagram ou um código embed do Instagram.
 */
export function isInstagramContent(input?: string | null): boolean {
    if (!input || typeof input !== "string") return false;
    return (
        input.includes("instagram.com") ||
        input.includes("instagr.am") ||
        input.includes("instagram-media") ||
        input.includes("data-instgrm")
    );
}

/**
 * Converte qualquer input Instagram para a URL de embed do player de Reel (usado nos stories).
 */
export function getInstagramEmbedUrl(input: string): string | null {
    const id = extractInstagramId(input);
    if (!id) return null;
    return `https://www.instagram.com/reel/${id}/embed/`;
}

/**
 * Retorna a URL de embed oficial do Instagram para exibição de POST COMPLETO no blog,
 * com foto/vídeo, legenda, autor, contagem de curtidas e comentários.
 */
export function getInstagramPostEmbedUrl(input: string, captioned: boolean = true): string | null {
    const id = extractInstagramId(input);
    if (!id) return null;
    return `https://www.instagram.com/p/${id}/embed/${captioned ? "captioned/" : ""}`;
}

/**
 * Retorna metadados estruturados do Instagram a partir de qualquer link/embed.
 */
export function extractInstagramEmbedData(input: string) {
    const id = extractInstagramId(input);
    if (!id) return null;

    const isReel = /reel/i.test(input);
    return {
        id,
        permalink: `https://www.instagram.com/p/${id}/`,
        postEmbedUrl: `https://www.instagram.com/p/${id}/embed/captioned/`,
        cleanEmbedUrl: `https://www.instagram.com/p/${id}/embed/`,
        streamUrl: `/api/products/instagram-stream/${id}`,
        isReel
    };
}

/**
 * Retorna o endpoint de stream direto do MP4 do Reel através da API (permite autoplay nativo).
 */
export function getInstagramDirectStreamUrl(input: string): string | null {
    const id = extractInstagramId(input);
    if (!id) return null;
    return `/api/products/instagram-stream/${id}`;
}

/**
 * Normaliza o valor salvo no campo video_url ou media_url:
 * - Se for embed code do Instagram → extrai o link limpo da publicação
 * - Caso contrário → retorna o input sem modificação
 */
export function normalizeVideoUrl(input: string): string {
    if (!input) return input;
    if (isInstagramContent(input)) {
        const permalink = extractInstagramPermalink(input);
        if (permalink) return permalink;
    }
    return input;
}

