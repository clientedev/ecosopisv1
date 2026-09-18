/**
 * Utilitários para links do Google Drive
 */

/**
 * Detecta se uma URL é do Google Drive
 */
export function isGoogleDriveUrl(url: string): boolean {
    if (!url) return false;
    return url.includes("drive.google.com");
}

/**
 * Extrai o File ID de um link do Google Drive em qualquer formato:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 */
export function extractGoogleDriveFileId(url: string): string | null {
    if (!url) return null;

    // Formato: /file/d/FILE_ID/
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) return fileMatch[1];

    // Formato: id=FILE_ID
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) return idMatch[1];

    return null;
}

/**
 * Converte qualquer link do Google Drive para URL de preview (embed) para iframe com autoplay
 * Retorna: https://drive.google.com/file/d/FILE_ID/preview
 */
export function getGoogleDriveEmbedUrl(url: string, autoplay: boolean = true): string | null {
    const fileId = extractGoogleDriveFileId(url);
    if (!fileId) return null;
    return `https://drive.google.com/file/d/${fileId}/preview${autoplay ? '?autoplay=1' : ''}`;
}

/**
 * Retorna link de streaming do vídeo do Google Drive através do proxy local da API
 * Garante que a tag <video> receba stream legítimo video/mp4 com Accept-Ranges e sem bloqueio de CORS.
 */
export function getGoogleDriveDirectStreamUrl(url: string): string | null {
    const fileId = extractGoogleDriveFileId(url);
    if (!fileId) return null;
    return `/api/products/drive-stream/${fileId}`;
}

/**
 * Retorna a URL de thumbnail do Google Drive (imagem estática do primeiro frame)
 * Funciona para arquivos de vídeo públicos.
 */
export function getGoogleDriveThumbnailUrl(url: string): string | null {
    const fileId = extractGoogleDriveFileId(url);
    if (!fileId) return null;
    // O Google Drive não oferece thumbnail de vídeo publicamente de forma confiável,
    // mas a URL abaixo funciona para thumbnails de arquivos de vídeo públicos:
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
}
