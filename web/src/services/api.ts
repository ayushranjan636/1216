import type { AuthSession, UserProfile } from '@/types';
import { isSupabaseMode } from '@/lib/supabase';
import { isDemoMode } from '@/config/app.config';
import {
  supabaseLogin,
  supabaseRestoreSession,
  supabaseLogout,
  fetchPartnerProfile,
  fetchMyProfile,
  fetchStats as sbFetchStats,
  trackOnline,
  updateDisplayName as sbUpdateDisplayName,
} from './supabaseAuth';
import { apiFetch } from './http';
import { demo, ACCOUNTS, DEVICE_SLOTS } from './apiDemo';

export { demo, ACCOUNTS, DEVICE_SLOTS };

async function localApi<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('1216_token');
  const res = await apiFetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers as Record<string, string>),
    },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Request failed');
  return res.json();
}

export function isDemoModeExport() {
  return isDemoMode() && !isSupabaseMode();
}

export async function login(email: string, password: string): Promise<AuthSession> {
  if (isSupabaseMode()) return supabaseLogin(email, password);
  if (isDemoMode()) {
    const key = Object.keys(ACCOUNTS).find((k) => k.toLowerCase() === email.trim().toLowerCase());
    if (!key || password !== ACCOUNTS[key as keyof typeof ACCOUNTS].password) {
      throw new Error('Invalid credentials');
    }
    return demo.login(ACCOUNTS[key as keyof typeof ACCOUNTS].slot, key);
  }
  throw new Error(
    'Supabase is not configured in this deployment. In Vercel, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then Redeploy (not just save).',
  );
}

export async function restoreSession(): Promise<AuthSession | null> {
  if (isSupabaseMode()) return supabaseRestoreSession();
  if (isDemoMode()) return demo.restore();
  const token = localStorage.getItem('1216_token');
  if (!token) return null;
  try {
    return await localApi<AuthSession>('/auth/me');
  } catch {
    localStorage.removeItem('1216_token');
    return null;
  }
}

export function logout() {
  if (isSupabaseMode()) return supabaseLogout();
  demo.logout();
  localStorage.removeItem('1216_token');
  localStorage.removeItem('1216_slot');
}

export async function fetchPartner(uid: string): Promise<UserProfile> {
  if (isSupabaseMode()) return fetchPartnerProfile(uid);
  if (isDemoMode()) return demo.getPartner(uid);
  return localApi<UserProfile>(`/users/partner/${uid}`);
}

export async function loadProfile(uid: string): Promise<UserProfile> {
  if (isSupabaseMode()) return fetchMyProfile(uid);
  return demo.getProfile(uid);
}

export async function fetchStats(uid: string) {
  if (isSupabaseMode()) return sbFetchStats(uid);
  if (isDemoMode()) return demo.getStats();
  return localApi<{ totalMessages: number; totalCalls: number; totalMemories: number }>('/stats');
}

export { trackOnline };

export async function updateDisplayName(uid: string, displayName: string): Promise<UserProfile> {
  if (isSupabaseMode()) return sbUpdateDisplayName(uid, displayName);
  throw new Error('Display name can only be updated in Supabase mode');
}

export { isDemoMode } from '@/config/app.config';
