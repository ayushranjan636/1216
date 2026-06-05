import { getSupabase } from '@/lib/supabase';
import { toCall, toSignal, toMemory, toFavorite } from '@/lib/mappers';
import type { CallSession, CallType, CallSignal, Memory, FavoriteMessage } from '@/types';

let callsChannel: ReturnType<ReturnType<typeof getSupabase>['channel']> | null = null;
let signalsChannel: ReturnType<ReturnType<typeof getSupabase>['channel']> | null = null;

export async function createCall(callerId: string, calleeId: string, type: CallType): Promise<string> {
  const { data, error } = await getSupabase()
    .from('calls')
    .insert({ caller_id: callerId, callee_id: calleeId, type, status: 'ringing', started_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to create call');
  return data.id;
}

export async function updateCallStatus(callId: string, status: CallSession['status']) {
  const patch: Record<string, unknown> = { status };
  if (status === 'active') patch.started_at = new Date().toISOString();
  if (status === 'ended' || status === 'missed' || status === 'declined') {
    patch.ended_at = new Date().toISOString();
  }
  await getSupabase().from('calls').update(patch).eq('id', callId);
}

export function subscribeToIncomingCalls(userId: string, cb: (call: CallSession | null) => void) {
  const sb = getSupabase();
  const refresh = async () => {
    const { data } = await sb
      .from('calls')
      .select('*')
      .eq('callee_id', userId)
      .eq('status', 'ringing')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    cb(data ? toCall(data) : null);
  };

  refresh();
  if (!callsChannel) {
    callsChannel = sb
      .channel('calls-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => refresh())
      .subscribe();
  }

  const poll = setInterval(refresh, 2000);
  return () => clearInterval(poll);
}

export async function sendSignal(callId: string, from: string, to: string, type: CallSignal['type'], payload: string) {
  await getSupabase().from('call_signals').insert({
    call_id: callId,
    from_id: from,
    to_id: to,
    type,
    payload,
  });
}

export function subscribeToSignals(
  callId: string,
  userId: string,
  cb: (signal: CallSignal) => void,
) {
  const sb = getSupabase();
  let since = Date.now();

  const poll = async () => {
    const { data } = await sb
      .from('call_signals')
      .select('*')
      .eq('call_id', callId)
      .eq('to_id', userId)
      .gt('created_at', new Date(since).toISOString())
      .order('created_at', { ascending: true });
    for (const row of data ?? []) {
      since = Math.max(since, Date.parse(row.created_at));
      cb(toSignal(row));
    }
  };

  poll();
  const interval = setInterval(poll, 1000);

  if (!signalsChannel) {
    signalsChannel = sb
      .channel('signals-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals' }, () => poll())
      .subscribe();
  }

  return () => clearInterval(interval);
}

export async function cleanupSignals(callId: string) {
  await getSupabase().from('call_signals').delete().eq('call_id', callId);
}

export async function getCallHistory(userId: string): Promise<CallSession[]> {
  const { data } = await getSupabase()
    .from('calls')
    .select('*')
    .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map(toCall);
}

export async function getMemories(): Promise<Memory[]> {
  const { data } = await getSupabase().from('memories').select('*').order('created_at', { ascending: false });
  return (data ?? []).map(toMemory);
}

export async function addMemory(m: Omit<Memory, 'id'>) {
  await getSupabase().from('memories').insert({
    title: m.title,
    description: m.description ?? null,
    media_url: m.mediaUrl,
    media_type: m.mediaType,
    created_by: m.createdBy,
  });
}

export async function addDailyNote(senderId: string, text: string) {
  const today = new Date().toISOString().split('T')[0];
  await getSupabase().from('daily_notes').insert({ sender_id: senderId, text, note_date: today });
  await getSupabase().from('messages').insert({
    conversation_id: '1216-private-chat',
    sender_id: senderId,
    type: 'daily_note',
    text,
    read_by: [senderId],
  });
}

export async function getFavorites(userId: string): Promise<FavoriteMessage[]> {
  const { data } = await getSupabase()
    .from('favorites')
    .select('*')
    .eq('saved_by', userId)
    .order('created_at', { ascending: false });
  return (data ?? []).map(toFavorite);
}

export async function addFavorite(f: Omit<FavoriteMessage, 'id'>) {
  await getSupabase().from('favorites').insert({
    message_id: f.messageId,
    saved_by: f.savedBy,
    preview: f.preview,
  });
}
