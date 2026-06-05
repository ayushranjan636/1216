import type { DeviceSlot } from '@/types';

export const ACCOUNTS: Record<
  string,
  { slot: DeviceSlot; password: string; displayName: string }
> = {
  Ayush: { slot: 'ayush', password: 'Ayushka@1216', displayName: 'Ayush' },
  Anushka: { slot: 'partner', password: 'Ayushka@1216', displayName: 'Anushka' },
};

export const DEVICE_SLOTS = {
  ayush: { userId: 'user-ayush', displayName: 'Ayush' },
  partner: { userId: 'user-partner', displayName: 'Anushka' },
} as const;

export const APP_CONFIG = {
  name: '1216',
  conversationId: '1216-private-chat',
  relationshipStart: import.meta.env.VITE_RELATIONSHIP_START ?? '2022-08-17',
  stunServers: [{ urls: 'stun:stun.l.google.com:19302' }],
} as const;

export const isDemoMode = () => import.meta.env.VITE_DEMO_MODE === 'true';

/** In dev, use Vite proxy (same origin). In prod, use env URL. */
export const API_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export const WS_URL = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000').replace(/\/$/, '');

export function resolveAccount(username: string) {
  const normalized = username.trim().toLowerCase();
  if (normalized === 'partner') {
    return { username: 'Anushka', ...ACCOUNTS.Anushka };
  }
  const key = Object.keys(ACCOUNTS).find((k) => k.toLowerCase() === normalized);
  return key ? { username: key, ...ACCOUNTS[key] } : null;
}

export function resolveLoginAccount(username: string, password: string, legacySlot?: DeviceSlot) {
  const account = resolveAccount(username);
  if (account && password === account.password) return account;
  if (
    username.trim().toLowerCase() === 'ayushka1216' &&
    password === 'Ayushka@1216' &&
    legacySlot
  ) {
    const name = legacySlot === 'ayush' ? 'Ayush' : 'Anushka';
    return { username: name, ...ACCOUNTS[name] };
  }
  return null;
}
