export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/api/') || url.startsWith('/static/')) return url;
  if (url.startsWith('/')) return url;
  return `/api/${url.replace(/^\/+/, '')}`;
}

export function resolveAvatarUrl(picture?: string | null): string | null {
  if (!picture) return null;
  if (picture.startsWith('http')) return picture;
  if (picture.startsWith('/')) return picture;
  return `/api/${picture.replace(/^\/+/, '')}`;
}

export function formatCommentTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function getInitials(name?: string | null) {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
