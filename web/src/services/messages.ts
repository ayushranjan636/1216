import { API_URL, isDemoMode, APP_CONFIG } from '@/config/app.config';
import type { Message, ReactionType } from '@/types';
import { apiFetch, wsUrl } from './http';

const TOKEN_KEY = '1216_token';

type MessageListener = (messages: Message[]) => void;
const chatListeners = new Set<MessageListener>();
const snapListeners = new Set<MessageListener>();
let ws: WebSocket | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
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

async function fetchChatMessages(): Promise<Message[]> {
  return api<Message[]>(`/conversations/${APP_CONFIG.conversationId}/messages?channel=chat`);
}

async function fetchSnapsList(): Promise<Message[]> {
  return api<Message[]>('/snaps');
}

function refreshChat() {
  return fetchChatMessages()
    .then((msgs) => chatListeners.forEach((fn) => fn(msgs)))
    .catch(console.error);
}

function refreshSnaps() {
  return fetchSnapsList()
    .then((snaps) => snapListeners.forEach((fn) => fn(snaps)))
    .catch(console.error);
}

function refreshAll() {
  return Promise.all([refreshChat(), refreshSnaps()]);
}

function connectWs() {
  const token = localStorage.getItem(TOKEN_KEY);
  const base = wsUrl();
  if (!token || !base || ws) return;
  ws = new WebSocket(`${base}/ws?token=${encodeURIComponent(token)}`);
  ws.onmessage = (ev) => {
    try {
      const { type } = JSON.parse(ev.data);
      if (type?.startsWith('message:')) refreshAll();
    } catch {
      // ignore
    }
  };
  ws.onclose = () => {
    ws = null;
    setTimeout(connectWs, 3000);
  };
}

function ensureRealtime() {
  if (isDemoMode()) return;
  connectWs();
  if (!pollTimer) {
    pollTimer = setInterval(() => { refreshAll(); }, 3000);
  }
}

function maybeStopRealtime() {
  if (chatListeners.size === 0 && snapListeners.size === 0) {
    ws?.close();
    ws = null;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function subscribeMessages(cb: MessageListener) {
  chatListeners.add(cb);
  ensureRealtime();
  fetchChatMessages().then(cb).catch(console.error);
  return () => {
    chatListeners.delete(cb);
    maybeStopRealtime();
  };
}

export function subscribeSnaps(cb: MessageListener) {
  snapListeners.add(cb);
  ensureRealtime();
  fetchSnapsList().then(cb).catch(console.error);
  return () => {
    snapListeners.delete(cb);
    maybeStopRealtime();
  };
}

export { refreshChat, refreshSnaps, refreshAll };

export async function sendMessage(senderId: string, text: string, extra?: Partial<Message>): Promise<Message> {
  const msg = await api<Message>(`/conversations/${APP_CONFIG.conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ senderId, type: 'text', text, ...extra }),
  });
  await refreshAll();
  return msg;
}

export async function sendMediaMessage(
  senderId: string,
  file: File,
  opts?: { caption?: string; viewOnce?: boolean },
): Promise<Message> {
  const form = new FormData();
  form.append('file', file);
  const token = localStorage.getItem(TOKEN_KEY);
  let uploadRes: Response;
  try {
    uploadRes = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  } catch {
    throw new Error('Server offline — run: cd server && npm start');
  }
  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error ?? 'Upload failed — is the server running?');
  }
  const { url } = await uploadRes.json();
  const type = file.type.startsWith('video/') ? 'video' : 'image';
  const msg = await api<Message>(`/conversations/${APP_CONFIG.conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      senderId,
      type,
      text: opts?.caption ?? (type === 'image' ? 'Photo' : 'Video'),
      mediaUrl: url,
      viewOnce: opts?.viewOnce ?? false,
    }),
  });
  await refreshAll();
  return msg;
}

export async function sendSnapMessage(senderId: string, file: File): Promise<Message> {
  const form = new FormData();
  form.append('file', file);
  const token = localStorage.getItem(TOKEN_KEY);
  let uploadRes: Response;
  try {
    uploadRes = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  } catch {
    throw new Error('Server offline — run: cd server && npm start');
  }
  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error ?? 'Snap upload failed — is the server running?');
  }
  const { url } = await uploadRes.json();
  const msg = await api<Message>(`/conversations/${APP_CONFIG.conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ senderId, type: 'snap', text: 'Snap', mediaUrl: url, viewOnce: true }),
  });
  await refreshSnaps();
  return msg;
}

export async function markMessageViewed(id: string, userId: string) {
  const msg = await api<Message>(`/messages/${id}/view`, { method: 'POST', body: JSON.stringify({ userId }) });
  await refreshAll();
  return msg;
}

export async function editMessage(id: string, text: string) {
  const msg = await api<Message>(`/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ text }) });
  await refreshChat();
  return msg;
}

export async function deleteMessage(id: string) {
  await api(`/messages/${id}`, { method: 'DELETE' });
  await refreshChat();
}

export async function addReaction(id: string, type: ReactionType, userId: string) {
  const msg = await api<Message>(`/messages/${id}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ type, userId }),
  });
  await refreshChat();
  return msg;
}
