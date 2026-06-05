import { isSupabaseMode } from '@/lib/supabase';
import { isDemoMode } from '@/config/app.config';
import type { Message, ReactionType } from '@/types';
import { demo } from './api';
import * as localMessages from './messages';
import * as sbMessages from './supabaseMessages';

function useSupabase() {
  return isSupabaseMode();
}

function useDemo() {
  return isDemoMode() && !isSupabaseMode();
}

export function subscribeMessages(cb: (messages: Message[]) => void) {
  if (useDemo()) return demo.subscribeChatMessages(cb);
  if (useSupabase()) return sbMessages.subscribeMessages(cb);
  return localMessages.subscribeMessages(cb);
}

export function subscribeSnaps(cb: (messages: Message[]) => void) {
  if (useDemo()) return demo.subscribeSnaps(cb);
  if (useSupabase()) return sbMessages.subscribeSnaps(cb);
  return localMessages.subscribeSnaps(cb);
}

export async function sendTextMessage(senderId: string, text: string, extra?: Partial<Message>) {
  if (useDemo()) { demo.sendMessage(senderId, text, extra); return; }
  if (useSupabase()) return sbMessages.sendMessage(senderId, text, extra);
  return localMessages.sendMessage(senderId, text, extra);
}

export async function sendFileMessage(senderId: string, file: File, viewOnce = false) {
  if (useDemo()) {
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video/') ? 'video' : 'image';
    demo.sendMedia(senderId, file, url, type, viewOnce);
    return;
  }
  if (useSupabase()) return sbMessages.sendMediaMessage(senderId, file, { viewOnce });
  return localMessages.sendMediaMessage(senderId, file, { viewOnce });
}

export async function sendSnapMessage(senderId: string, dataUrl: string) {
  if (useDemo()) { demo.sendSnap(senderId, dataUrl); return; }
  if (useSupabase()) {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `snap-${Date.now()}.jpg`, { type: 'image/jpeg' });
    return sbMessages.sendSnapMessage(senderId, file);
  }
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], `snap-${Date.now()}.jpg`, { type: 'image/jpeg' });
  return localMessages.sendSnapMessage(senderId, file);
}

export async function markViewed(id: string, userId: string) {
  if (useDemo()) return demo.markViewed(id, userId);
  if (useSupabase()) return sbMessages.markMessageViewed(id, userId);
  return localMessages.markMessageViewed(id, userId);
}

export async function editMessage(id: string, text: string) {
  if (useDemo()) return demo.editMessage(id, text);
  if (useSupabase()) return sbMessages.editMessage(id, text);
  return localMessages.editMessage(id, text);
}

export async function deleteMessage(id: string) {
  if (useDemo()) return demo.deleteMessage(id);
  if (useSupabase()) return sbMessages.deleteMessage(id);
  return localMessages.deleteMessage(id);
}

export async function addReaction(id: string, type: ReactionType, userId: string) {
  if (useDemo()) return demo.addReaction(id, type, userId);
  if (useSupabase()) return sbMessages.addReaction(id, type, userId);
  return localMessages.addReaction(id, type, userId);
}
