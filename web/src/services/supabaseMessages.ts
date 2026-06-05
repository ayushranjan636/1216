import { getSupabase } from '@/lib/supabase';
import { APP_CONFIG } from '@/config/app.config';
import { toMessage } from '@/lib/mappers';
import type { Message, ReactionType } from '@/types';
import { uploadMediaFile } from './supabaseStorage';

type Listener = (messages: Message[]) => void;
const chatListeners = new Set<Listener>();
const snapListeners = new Set<Listener>();
let chatChannel: ReturnType<ReturnType<typeof getSupabase>['channel']> | null = null;

async function loadChat(): Promise<Message[]> {
  const { data, error } = await getSupabase()
    .from('messages')
    .select('*')
    .eq('conversation_id', APP_CONFIG.conversationId)
    .neq('type', 'snap')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toMessage);
}

async function loadSnaps(): Promise<Message[]> {
  const { data, error } = await getSupabase()
    .from('messages')
    .select('*')
    .eq('type', 'snap')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toMessage);
}

function notifyChat() {
  loadChat().then((m) => chatListeners.forEach((fn) => fn(m))).catch(console.error);
}

function notifySnaps() {
  loadSnaps().then((s) => snapListeners.forEach((fn) => fn(s))).catch(console.error);
}

function ensureRealtime() {
  if (chatChannel) return;
  chatChannel = getSupabase()
    .channel('messages-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      notifyChat();
      notifySnaps();
    })
    .subscribe();
}

export function subscribeMessages(cb: Listener) {
  chatListeners.add(cb);
  ensureRealtime();
  loadChat().then(cb).catch(console.error);
  return () => {
    chatListeners.delete(cb);
    if (chatListeners.size === 0 && snapListeners.size === 0 && chatChannel) {
      getSupabase().removeChannel(chatChannel);
      chatChannel = null;
    }
  };
}

export function subscribeSnaps(cb: Listener) {
  snapListeners.add(cb);
  ensureRealtime();
  loadSnaps().then(cb).catch(console.error);
  return () => {
    snapListeners.delete(cb);
    if (chatListeners.size === 0 && snapListeners.size === 0 && chatChannel) {
      getSupabase().removeChannel(chatChannel);
      chatChannel = null;
    }
  };
}

export async function sendMessage(senderId: string, text: string, extra?: Partial<Message>) {
  const { error } = await getSupabase().from('messages').insert({
    conversation_id: APP_CONFIG.conversationId,
    sender_id: senderId,
    type: extra?.type ?? 'text',
    text,
    reply_to_id: extra?.replyToId ?? null,
    reply_to_preview: extra?.replyToPreview ?? null,
    read_by: [senderId],
  });
  if (error) throw new Error(error.message);
  notifyChat();
}

export async function sendMediaMessage(senderId: string, file: File, opts?: { viewOnce?: boolean }) {
  const { publicUrl, path } = await uploadMediaFile(senderId, file);
  const type = file.type.startsWith('video/') ? 'video' : 'image';
  const { error } = await getSupabase().from('messages').insert({
    conversation_id: APP_CONFIG.conversationId,
    sender_id: senderId,
    type,
    text: type === 'image' ? 'Photo' : 'Video',
    media_url: publicUrl,
    media_path: path,
    view_once: opts?.viewOnce ?? false,
    read_by: [senderId],
  });
  if (error) throw new Error(error.message);
  notifyChat();
}

export async function sendSnapMessage(senderId: string, file: File) {
  const { publicUrl, path } = await uploadMediaFile(senderId, file);
  const { error } = await getSupabase().from('messages').insert({
    conversation_id: APP_CONFIG.conversationId,
    sender_id: senderId,
    type: 'snap',
    text: 'Snap',
    media_url: publicUrl,
    media_path: path,
    view_once: true,
    read_by: [senderId],
  });
  if (error) throw new Error(error.message);
  notifySnaps();
}

export async function markMessageViewed(id: string, userId: string) {
  const { data: row } = await getSupabase().from('messages').select('viewed_by').eq('id', id).single();
  const viewed = [...(row?.viewed_by ?? [])];
  if (!viewed.includes(userId)) viewed.push(userId);
  await getSupabase().from('messages').update({ viewed_by: viewed }).eq('id', id);
  notifyChat();
  notifySnaps();
}

export async function editMessage(id: string, text: string) {
  const { error } = await getSupabase()
    .from('messages')
    .update({ text, edited_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  notifyChat();
}

export async function deleteMessage(id: string) {
  const { error } = await getSupabase()
    .from('messages')
    .update({ deleted_at: new Date().toISOString(), text: '' })
    .eq('id', id);
  if (error) throw new Error(error.message);
  notifyChat();
}

export async function addReaction(id: string, type: ReactionType, userId: string) {
  const { data: row } = await getSupabase().from('messages').select('reactions').eq('id', id).single();
  const reactions = [...(row?.reactions ?? [])].filter((r: { userId: string }) => r.userId !== userId);
  reactions.push({ type, userId });
  await getSupabase().from('messages').update({ reactions }).eq('id', id);
  notifyChat();
}
