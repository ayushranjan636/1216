import { getSupabase, syncRealtimeAuth } from '@/lib/supabase';
import { toCall } from '@/lib/mappers';
import type { CallSession, CallType, CallSignal } from '@/types';

/** WebRTC signaling via Realtime broadcast. Ring uses DB + broadcast; call rows kept for history. */

type RoomHandlerEntry = {
  userId: string;
  onSignal: (signal: CallSignal) => void;
  onPeerReady?: () => void;
  onHangup?: (status?: CallSession['status']) => void;
};

const callMeta = new Map<string, { callerId: string; calleeId: string }>();
const callRooms = new Map<string, ReturnType<ReturnType<typeof getSupabase>['channel']>>();
const roomHandlers = new Map<string, RoomHandlerEntry[]>();
const inboxSubs = new Map<string, ReturnType<ReturnType<typeof getSupabase>['channel']>>();
const inboxCallbacks = new Map<string, Set<(call: CallSession | null) => void>>();
let dbCallsChannel: ReturnType<ReturnType<typeof getSupabase>['channel']> | null = null;
const dbWatchers = new Set<string>();

function uuid() {
  return crypto.randomUUID();
}

async function subscribeChannel(ch: ReturnType<ReturnType<typeof getSupabase>['channel']>) {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Channel subscribe timeout')), 12000);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        reject(new Error(`Channel ${status}`));
      }
    });
  });
}

function dispatchInbox(userId: string, call: CallSession | null) {
  for (const cb of inboxCallbacks.get(userId) ?? []) cb(call);
}

async function refreshDbIncoming(userId: string) {
  const { data } = await getSupabase()
    .from('calls')
    .select('*')
    .eq('callee_id', userId)
    .eq('status', 'ringing')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  dispatchInbox(userId, data ? toCall(data) : null);
}

function ensureDbCallsChannel() {
  if (dbCallsChannel) return;
  dbCallsChannel = getSupabase()
    .channel('calls-db-watch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => {
      for (const userId of dbWatchers) refreshDbIncoming(userId);
    })
    .subscribe();
}

function dispatchSignal(callId: string, to: string, signal: CallSignal) {
  for (const entry of roomHandlers.get(callId) ?? []) {
    if (entry.userId === to) entry.onSignal(signal);
  }
}

function dispatchPeerReady(callId: string, fromUserId: string) {
  for (const entry of roomHandlers.get(callId) ?? []) {
    if (entry.userId !== fromUserId) entry.onPeerReady?.();
  }
}

async function persistCallStatus(callId: string, status: CallSession['status']) {
  const patch: Record<string, unknown> = { status };
  if (status === 'active') patch.started_at = new Date().toISOString();
  if (status === 'ended' || status === 'declined' || status === 'missed') {
    patch.ended_at = new Date().toISOString();
  }
  await getSupabase().from('calls').update(patch).eq('id', callId);
}

function dispatchHangup(callId: string, status?: CallSession['status']) {
  for (const entry of roomHandlers.get(callId) ?? []) {
    entry.onHangup?.(status);
  }
}

function ensureInboxChannel(userId: string) {
  if (inboxSubs.has(userId)) return;

  syncRealtimeAuth().catch(console.error);
  const sb = getSupabase();
  const channel = sb.channel(`calls-inbox-${userId}`, {
    config: { broadcast: { ack: false, self: false } },
  });

  channel.on('broadcast', { event: 'ring' }, ({ payload }) => {
    dispatchInbox(userId, {
      id: payload.callId,
      callerId: payload.callerId,
      calleeId: payload.calleeId,
      type: payload.type,
      status: 'ringing',
      startedAt: payload.startedAt,
    });
  });

  channel.on('broadcast', { event: 'cancel' }, () => dispatchInbox(userId, null));
  channel.on('broadcast', { event: 'hangup' }, () => dispatchInbox(userId, null));

  channel.subscribe();
  inboxSubs.set(userId, channel);
}

async function notifyInboxCancel(userId: string) {
  const sb = getSupabase();
  const inbox = sb.channel(`calls-inbox-${userId}`, {
    config: { broadcast: { ack: false, self: false } },
  });
  try {
    await subscribeChannel(inbox);
    await inbox.send({ type: 'broadcast', event: 'cancel', payload: {} });
  } finally {
    sb.removeChannel(inbox);
  }
}

async function sendRingBroadcast(calleeId: string, payload: Record<string, unknown>) {
  const sb = getSupabase();
  for (let attempt = 0; attempt < 3; attempt++) {
    const inbox = sb.channel(`calls-inbox-${calleeId}`, {
      config: { broadcast: { ack: false, self: false } },
    });
    try {
      await subscribeChannel(inbox);
      await inbox.send({ type: 'broadcast', event: 'ring', payload });
      sb.removeChannel(inbox);
      return;
    } catch {
      sb.removeChannel(inbox);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 400));
    }
  }
}

export async function createCall(callerId: string, calleeId: string, type: CallType): Promise<string> {
  const callId = uuid();
  callMeta.set(callId, { callerId, calleeId });
  const sb = getSupabase();
  const startedAt = Date.now();
  const payload = { callId, callerId, calleeId, type, startedAt };

  const { error } = await sb.from('calls').insert({
    id: callId,
    caller_id: callerId,
    callee_id: calleeId,
    type,
    status: 'ringing',
    started_at: new Date(startedAt).toISOString(),
  });
  if (error) throw new Error(error.message);

  await sendRingBroadcast(calleeId, payload);
  return callId;
}

export async function updateCallStatus(
  callId: string,
  status: CallSession['status'],
  userId?: string,
) {
  const ch = callRooms.get(callId);

  if (status === 'connecting' && userId && ch) {
    await ch.send({ type: 'broadcast', event: 'peer-ready', payload: { userId } });
  }

  if (status === 'active' || status === 'ended' || status === 'declined' || status === 'missed') {
    await persistCallStatus(callId, status).catch(console.error);
  }

  if (status === 'ended' || status === 'declined' || status === 'missed') {
    if (ch) {
      await ch.send({ type: 'broadcast', event: 'hangup', payload: { status } }).catch(() => {});
    }
    const meta = callMeta.get(callId);
    if (meta) {
      await Promise.all([
        notifyInboxCancel(meta.callerId),
        notifyInboxCancel(meta.calleeId),
      ]);
    }
  }
}

export function subscribeToIncomingCalls(userId: string, cb: (call: CallSession | null) => void) {
  let callbacks = inboxCallbacks.get(userId);
  if (!callbacks) {
    callbacks = new Set();
    inboxCallbacks.set(userId, callbacks);
    ensureInboxChannel(userId);
    ensureDbCallsChannel();
    dbWatchers.add(userId);
    refreshDbIncoming(userId);
  }
  callbacks.add(cb);

  const poll = setInterval(() => refreshDbIncoming(userId), 2500);

  return () => {
    clearInterval(poll);
    const set = inboxCallbacks.get(userId);
    if (!set) return;
    set.delete(cb);
    if (set.size === 0) {
      inboxCallbacks.delete(userId);
      dbWatchers.delete(userId);
      const ch = inboxSubs.get(userId);
      if (ch) {
        getSupabase().removeChannel(ch);
        inboxSubs.delete(userId);
      }
    }
  };
}

export async function joinCallRoom(
  callId: string,
  userId: string,
  handlers: {
    onSignal: (signal: CallSignal) => void;
    onPeerReady?: () => void;
    onHangup?: (status?: CallSession['status']) => void;
  },
) {
  const sb = getSupabase();
  const list = roomHandlers.get(callId) ?? [];
  list.push({ userId, ...handlers });
  roomHandlers.set(callId, list);

  if (callRooms.has(callId)) return;

  await syncRealtimeAuth();
  const ch = sb.channel(`call-room-${callId}`, {
    config: { broadcast: { ack: false, self: false } },
  });

  ch.on('broadcast', { event: 'signal' }, ({ payload }) => {
    if (payload?.to && payload?.signal) {
      dispatchSignal(callId, payload.to, payload.signal as CallSignal);
    }
  });

  ch.on('broadcast', { event: 'peer-ready' }, ({ payload }) => {
    if (payload?.userId) dispatchPeerReady(callId, payload.userId);
  });

  ch.on('broadcast', { event: 'hangup' }, ({ payload }) => dispatchHangup(callId, payload?.status));

  await subscribeChannel(ch);
  callRooms.set(callId, ch);
}

export async function sendSignal(
  callId: string,
  from: string,
  to: string,
  type: CallSignal['type'],
  payload: string,
) {
  if (!callRooms.has(callId)) {
    await joinCallRoom(callId, from, { onSignal: () => {} });
  }
  const ch = callRooms.get(callId);
  if (!ch) return;

  const signal: CallSignal = {
    id: uuid(),
    callId,
    from,
    to,
    type,
    payload,
    createdAt: Date.now(),
  };

  await ch.send({
    type: 'broadcast',
    event: 'signal',
    payload: { to, signal },
  });
}

export function subscribeToSignals(
  callId: string,
  userId: string,
  cb: (signal: CallSignal) => void,
) {
  joinCallRoom(callId, userId, { onSignal: cb }).catch(console.error);
  return () => {};
}

export async function cleanupSignals(callId: string) {
  const sb = getSupabase();
  const ch = callRooms.get(callId);
  if (ch) {
    sb.removeChannel(ch);
    callRooms.delete(callId);
    roomHandlers.delete(callId);
  }
  callMeta.delete(callId);
}

export async function getCallHistory(userId: string): Promise<CallSession[]> {
  const { data } = await getSupabase()
    .from('calls')
    .select('*')
    .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
    .neq('status', 'ringing')
    .neq('status', 'connecting')
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map(toCall);
}
