import { isSupabaseMode } from '@/lib/supabase';
import { isDemoMode } from '@/config/app.config';
import { demo } from './apiDemo';
import * as sbExtras from './supabaseExtras';
import type { Memory, FavoriteMessage } from '@/types';

function mode() {
  if (isSupabaseMode()) return 'supabase';
  if (isDemoMode()) return 'demo';
  return 'local';
}

export async function getMemories(): Promise<Memory[]> {
  if (mode() === 'supabase') return sbExtras.getMemories();
  return demo.getMemories();
}

export async function addMemory(m: Omit<Memory, 'id'>) {
  if (mode() === 'supabase') return sbExtras.addMemory(m);
  demo.addMemory(m);
}

export async function addDailyNote(senderId: string, text: string) {
  if (mode() === 'supabase') return sbExtras.addDailyNote(senderId, text);
  const today = new Date().toISOString().split('T')[0];
  demo.addNote({ senderId, text, date: today, createdAt: Date.now() });
  demo.sendMessage(senderId, text, { type: 'daily_note' });
}

export async function getFavorites(userId: string): Promise<FavoriteMessage[]> {
  if (mode() === 'supabase') return sbExtras.getFavorites(userId);
  return demo.getFavorites();
}

export async function addFavorite(f: Omit<FavoriteMessage, 'id'>) {
  if (mode() === 'supabase') return sbExtras.addFavorite(f);
  demo.addFavorite(f);
}
