import type {
  Message, Conversation, Memory, DailyNote, FavoriteMessage,
  UserProfile, AuthSession, DeviceSlot, CallSession,
} from '@/types';
import { ACCOUNTS, DEVICE_SLOTS, APP_CONFIG } from '@/config/app.config';
import {
  demoBridgeRead, demoBridgeWrite, demoBridgeSubscribe, CALLS_KEY, MESSAGES_KEY,
} from './demoBridge';

const TOKEN_KEY = '1216_token';
const SLOT_KEY = '1216_slot';

function loadMessages(): Message[] {
  const stored = demoBridgeRead<Message>(MESSAGES_KEY);
  if (stored.length > 0) return stored;
  return [
    {
      id: '1', conversationId: APP_CONFIG.conversationId, senderId: 'user-partner',
      type: 'text', text: 'Hey love. Welcome to 1216.',
      reactions: [{ type: 'heart', userId: 'user-ayush' }], status: 'seen',
      createdAt: Date.now() - 3600000, readBy: ['user-ayush', 'user-partner'],
    },
    {
      id: '2', conversationId: APP_CONFIG.conversationId, senderId: 'user-ayush',
      type: 'text', text: 'Our private space on the web.',
      reactions: [], status: 'seen',
      createdAt: Date.now() - 1800000, readBy: ['user-ayush', 'user-partner'],
    },
  ];
}

let messages: Message[] = loadMessages();
let memories: Memory[] = [];
let notes: DailyNote[] = [];
let favorites: FavoriteMessage[] = [];
const listeners = new Set<(msgs: Message[]) => void>();
const snapListeners = new Set<(msgs: Message[]) => void>();

function persistMessages() { demoBridgeWrite(MESSAGES_KEY, messages); }
function reloadFromStorage() { messages = loadMessages(); }
function chatMessages() {
  return [...messages].filter((m) => !m.deletedAt && m.type !== 'snap').sort((a, b) => a.createdAt - b.createdAt);
}
function snapMessages() {
  return [...messages].filter((m) => !m.deletedAt && m.type === 'snap').sort((a, b) => b.createdAt - a.createdAt);
}
function notifyChat() { listeners.forEach((cb) => cb(chatMessages())); }
function notifySnaps() { snapListeners.forEach((cb) => cb(snapMessages())); }
function notify() { notifyChat(); notifySnaps(); }

demoBridgeSubscribe(() => { reloadFromStorage(); notify(); });

function profileFor(slot: DeviceSlot): UserProfile {
  const meta = DEVICE_SLOTS[slot];
  return {
    uid: meta.userId,
    email: slot === 'ayush' ? 'ayush@1216.app' : 'anushka@1216.app',
    displayName: meta.displayName,
    isOnline: true, lastSeen: Date.now(), createdAt: Date.now() - 86400000 * 30,
  };
}

function partnerFor(slot: DeviceSlot): UserProfile {
  return profileFor(slot === 'ayush' ? 'partner' : 'ayush');
}

export { ACCOUNTS, DEVICE_SLOTS };

export const demo = {
  login(slot: DeviceSlot, username: string): AuthSession {
    const p = profileFor(slot);
    localStorage.setItem(TOKEN_KEY, 'demo');
    localStorage.setItem(SLOT_KEY, slot);
    return {
      token: 'demo',
      user: { uid: p.uid, username, displayName: p.displayName, email: p.email },
      expiresAt: Date.now() + 30 * 86400000,
    };
  },
  restore(): AuthSession | null {
    const token = localStorage.getItem(TOKEN_KEY);
    const slot = localStorage.getItem(SLOT_KEY) as DeviceSlot | null;
    if (!token || !slot) return null;
    const account = Object.entries(ACCOUNTS).find(([, v]) => v.slot === slot);
    return demo.login(slot, account?.[0] ?? slot);
  },
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SLOT_KEY);
  },
  getProfile(uid: string) {
    return uid === 'user-ayush' ? profileFor('ayush') : profileFor('partner');
  },
  getPartner(uid: string) {
    return uid === 'user-ayush' ? partnerFor('ayush') : partnerFor('partner');
  },
  getConversation(): Conversation {
    const last = messages.filter((m) => !m.deletedAt).at(-1);
    return {
      id: APP_CONFIG.conversationId,
      participantIds: ['user-ayush', 'user-partner'],
      lastMessage: last?.text,
      lastMessageAt: last?.createdAt,
      lastMessageSenderId: last?.senderId,
      unreadCount: {},
    };
  },
  subscribeChatMessages(cb: (msgs: Message[]) => void) {
    reloadFromStorage();
    listeners.add(cb);
    notifyChat();
    return () => { listeners.delete(cb); };
  },
  subscribeSnaps(cb: (msgs: Message[]) => void) {
    reloadFromStorage();
    snapListeners.add(cb);
    notifySnaps();
    return () => { snapListeners.delete(cb); };
  },
  sendMessage(senderId: string, text: string, extra?: Partial<Message>) {
    messages.push({
      id: `m-${Date.now()}`, conversationId: APP_CONFIG.conversationId, senderId,
      type: 'text', text, reactions: [], status: 'sent', createdAt: Date.now(),
      readBy: [senderId], ...extra,
    });
    persistMessages();
    notify();
  },
  sendMedia(senderId: string, _file: File, previewUrl: string, type: 'image' | 'video' = 'image', viewOnce = false) {
    messages.push({
      id: `m-${Date.now()}`, conversationId: APP_CONFIG.conversationId, senderId,
      type, mediaUrl: previewUrl, text: type === 'image' ? 'Photo' : 'Video',
      reactions: [], status: 'sent', viewOnce, viewedBy: [], createdAt: Date.now(), readBy: [senderId],
    });
    persistMessages();
    notify();
  },
  sendSnap(senderId: string, dataUrl: string) {
    messages.push({
      id: `snap-${Date.now()}`, conversationId: APP_CONFIG.conversationId, senderId,
      type: 'snap', mediaUrl: dataUrl, text: 'Snap', reactions: [], status: 'sent',
      viewOnce: true, viewedBy: [], createdAt: Date.now(), readBy: [senderId],
    });
    persistMessages();
    notify();
  },
  markViewed(id: string, userId: string) {
    messages = messages.map((m) => {
      if (m.id !== id) return m;
      const viewedBy = [...(m.viewedBy ?? [])];
      if (!viewedBy.includes(userId)) viewedBy.push(userId);
      return { ...m, viewedBy };
    });
    persistMessages();
    notify();
  },
  editMessage(id: string, text: string) {
    messages = messages.map((m) => (m.id === id ? { ...m, text, editedAt: Date.now() } : m));
    persistMessages();
    notify();
  },
  deleteMessage(id: string) {
    messages = messages.map((m) => (m.id === id ? { ...m, deletedAt: Date.now(), text: '' } : m));
    persistMessages();
    notify();
  },
  addReaction(id: string, type: import('@/types').ReactionType, userId: string) {
    messages = messages.map((m) => {
      if (m.id !== id) return m;
      return { ...m, reactions: [...m.reactions.filter((r) => r.userId !== userId), { type, userId }] };
    });
    persistMessages();
    notify();
  },
  getMemories: () => memories,
  addMemory: (m: Omit<Memory, 'id'>) => { memories.unshift({ ...m, id: `mem-${Date.now()}` }); },
  getNotes: () => notes,
  addNote: (n: Omit<DailyNote, 'id'>) => { notes.unshift({ ...n, id: `n-${Date.now()}` }); },
  getFavorites: () => favorites,
  addFavorite: (f: Omit<FavoriteMessage, 'id'>) => { favorites.unshift({ ...f, id: `f-${Date.now()}` }); },
  getStats: () => ({
    totalMessages: messages.filter((m) => !m.deletedAt).length,
    totalCalls: demoBridgeRead<CallSession>(CALLS_KEY).length,
    totalMemories: memories.length,
  }),
};
