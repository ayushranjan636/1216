import { API_URL, WS_URL as ENV_WS_URL } from '@/config/app.config';

export class NetworkError extends Error {
  constructor() {
    super('Server offline — run: cd server && npm start');
    this.name = 'NetworkError';
  }
}

export async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, opts);
  } catch {
    throw new NetworkError();
  }
}

export function wsUrl(): string {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}`;
  }
  return ENV_WS_URL;
}
