/**
 * Utilitários para detectar e converter links/embed codes do Instagram Reels
 * para URLs de iframe incorporáveis.
 */

/**
 * Extrai o Reel ID de:
 * - URL direta:  https://www.instagram.com/reel/DXsW1z-DqE2/
 * - Embed code:  <blockquote data-instgrm-permalink="https://www.instagram.com/reel/DXsW1z-DqE2/?...">
 * - URL com /p/: https://www.instagram.com/p/DXsW1z-DqE2/
 */
export function extractInstagramId(input: string): string | null {
    if (!input) return null;
    // Tenta data-instgrm-permalink primeiro (embed code)
    const permalinkMatch = input.match(/data-instgrm-permalink="([^"]+)"/);
    const source = permalinkMatch ? permalinkMatch[1] : input;
    // Extrai ID de /reel/ ou /p/
    const reelMatch = source.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
    return reelMatch ? reelMatch[1] : null;
}

/**
 * Retorna o link direto para visualização do Reel no Instagram
 */
export function extractInstagramPermalink(input: string): string | null {
    const id = extractInstagramId(input);
    if (!id) return null;
    return `https://www.instagram.com/reel/${id}/`;
}

/**
 * Retorna true se a string for uma URL do Instagram ou um embed code do Instagram.
 */
export function isInstagramContent(input: string): boolean {
    if (!input) return false;
    return input.includes("instagram.com") || input.includes("instagram-media");
}

/**
 * Converte qualquer input Instagram (URL ou embed code) para a URL de embed iframe.
 * Retorna null se não for detectado como conteúdo Instagram.
 */
export function getInstagramEmbedUrl(input: string): string | null {
    const id = extractInstagramId(input);
    if (!id) return null;
    return `https://www.instagram.com/reel/${id}/embed/`;
}

/**
 * Normaliza o valor salvo no campo video_url:
 * - Se for embed code do Instagram → extrai e salva só a URL embed
 * - Caso contrário → retorna o input sem modificação
 */
export function normalizeVideoUrl(input: string): string {
    if (!input) return input;
    if (isInstagramContent(input)) {
        const embedUrl = getInstagramEmbedUrl(input);
        if (embedUrl) return embedUrl;
    }
    return input;
}
