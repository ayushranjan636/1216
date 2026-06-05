import type { CallSignal, CallSession, CallType } from '@/types';
import { isSupabaseMode } from '@/lib/supabase';
import { isDemoMode } from '@/config/app.config';
import {
  demoBridgeRead,
  demoBridgeWrite,
  demoBridgeSubscribe,
  CALLS_KEY,
  SIGNALS_KEY,
} from './demoBridge';
import * as localApi from './http';
import * as sbExtras from './supabaseExtras';

const TOKEN_KEY = '1216_token';

async function localApiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await localApi.apiFetch(path, {
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

const demoSignaling = {
  createCall(callerId: string, calleeId: string, type: CallType): string {
    const id = `call-${Date.now()}`;
    const call: CallSession = {
      id, callerId, calleeId, type, status: 'ringing', startedAt: Date.now(),
    };
    const calls = demoBridgeRead<CallSession>(CALLS_KEY);
    calls.unshift(call);
    demoBridgeWrite(CALLS_KEY, calls);
    return id;
  },
  updateCallStatus(callId: string, status: CallSession['status']) {
    const calls = demoBridgeRead<CallSession>(CALLS_KEY).map((c) =>
      c.id === callId ? { ...c, status, endedAt: status === 'ended' ? Date.now() : c.endedAt } : c,
    );
    demoBridgeWrite(CALLS_KEY, calls);
  },
  subscribeToIncomingCalls(userId: string, cb: (call: CallSession | null) => void) {
    const refresh = () => {
      const call = demoBridgeRead<CallSession>(CALLS_KEY).find(
        (c) => c.calleeId === userId && c.status === 'ringing',
      ) ?? null;
      cb(call);
    };
    refresh();
    return demoBridgeSubscribe(refresh);
  },
  sendSignal(callId: string, from: string, to: string, type: CallSignal['type'], payload: string) {
    const signals = demoBridgeRead<CallSignal>(SIGNALS_KEY);
    signals.push({ id: `sig-${Date.now()}`, callId, from, to, type, payload, createdAt: Date.now() });
    demoBridgeWrite(SIGNALS_KEY, signals);
  },
  subscribeToSignals(callId: string, userId: string, cb: (signal: CallSignal) => void) {
    let since = Date.now();
    const refresh = () => {
      for (const s of demoBridgeRead<CallSignal>(SIGNALS_KEY)) {
        if (s.callId === callId && s.to === userId && s.createdAt > since) {
          since = s.createdAt;
          cb(s);
        }
      }
    };
    refresh();
    return demoBridgeSubscribe(refresh);
  },
  cleanupSignals(callId: string) {
    demoBridgeWrite(SIGNALS_KEY, demoBridgeRead<CallSignal>(SIGNALS_KEY).filter((s) => s.callId !== callId));
  },
  getCallHistory(userId: string) {
    return demoBridgeRead<CallSession>(CALLS_KEY).filter(
      (c) => c.callerId === userId || c.calleeId === userId,
    );
  },
};

function mode() {
  if (isSupabaseMode()) return 'supabase';
  if (isDemoMode()) return 'demo';
  return 'local';
}

export async function createCall(callerId: string, calleeId: string, type: CallType) {
  if (mode() === 'supabase') return sbExtras.createCall(callerId, calleeId, type);
  if (mode() === 'demo') return demoSignaling.createCall(callerId, calleeId, type);
  const { id } = await localApiFetch<{ id: string }>('/calls', {
    method: 'POST',
    body: JSON.stringify({ callerId, calleeId, type, status: 'ringing' }),
  });
  return id;
}

export async function updateCallStatus(callId: string, status: CallSession['status']) {
  if (mode() === 'supabase') return sbExtras.updateCallStatus(callId, status);
  if (mode() === 'demo') return demoSignaling.updateCallStatus(callId, status);
  return localApiFetch(`/calls/${callId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export function subscribeToIncomingCalls(userId: string, cb: (call: CallSession | null) => void) {
  if (mode() === 'supabase') return sbExtras.subscribeToIncomingCalls(userId, cb);
  if (mode() === 'demo') return demoSignaling.subscribeToIncomingCalls(userId, cb);
  const poll = setInterval(async () => {
    try {
      const call = await localApiFetch<CallSession | null>(`/calls/incoming/${userId}`);
      cb(call);
    } catch { /* ignore */ }
  }, 2000);
  return () => clearInterval(poll);
}

export async function sendSignal(callId: string, from: string, to: string, type: CallSignal['type'], payload: string) {
  if (mode() === 'supabase') return sbExtras.sendSignal(callId, from, to, type, payload);
  if (mode() === 'demo') return demoSignaling.sendSignal(callId, from, to, type, payload);
  return localApiFetch('/calls/signals', {
    method: 'POST',
    body: JSON.stringify({ callId, fromId: from, toId: to, type, payload }),
  });
}

export function subscribeToSignals(callId: string, userId: string, cb: (signal: CallSignal) => void) {
  if (mode() === 'supabase') return sbExtras.subscribeToSignals(callId, userId, cb);
  if (mode() === 'demo') return demoSignaling.subscribeToSignals(callId, userId, cb);
  let since = Date.now();
  const poll = setInterval(async () => {
    try {
      const signals = await localApiFetch<CallSignal[]>(
        `/calls/signals?callId=${callId}&to=${userId}&since=${since}`,
      );
      for (const s of signals) { since = Math.max(since, s.createdAt); cb(s); }
    } catch { /* ignore */ }
  }, 1000);
  return () => clearInterval(poll);
}

export async function cleanupSignals(callId: string) {
  if (mode() === 'supabase') return sbExtras.cleanupSignals(callId);
  if (mode() === 'demo') return demoSignaling.cleanupSignals(callId);
  return localApiFetch(`/calls/signals/${callId}`, { method: 'DELETE' });
}

export async function getCallHistory(userId: string): Promise<CallSession[]> {
  if (mode() === 'supabase') return sbExtras.getCallHistory(userId);
  if (mode() === 'demo') return demoSignaling.getCallHistory(userId);
  return localApiFetch<CallSession[]>(`/calls/history/${userId}`);
}

export { demoSignaling };
