import { API_URL } from '@/config/app.config';

/** Turn stored media paths into loadable URLs (fixes localhost-only upload links). */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith('/uploads/')) {
        return import.meta.env.DEV ? parsed.pathname : `${API_URL}${parsed.pathname}`;
      }
    } catch {
      return url;
    }
    return url;
  }

  if (import.meta.env.DEV && url.startsWith('/uploads/')) return url;

  return `${API_URL}${url.startsWith('/') ? url : `/${url}`}`;
}

export function downloadMedia(url: string, filename = '1216-photo.jpg') {
  const resolved = resolveMediaUrl(url);
  if (!resolved) return;
  const link = document.createElement('a');
  link.href = resolved;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
