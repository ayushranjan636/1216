import { create } from 'zustand';
import type { UserProfile, AuthSession } from '@/types';

interface AuthState {
  session: AuthSession | null;
  profile: UserProfile | null;
  partner: UserProfile | null;
  isLoading: boolean;
  setSession: (session: AuthSession | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setPartner: (partner: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  partner: null,
  isLoading: true,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setPartner: (partner) => set({ partner }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ session: null, profile: null, partner: null, isLoading: false }),
}));

interface ChatState {
  messages: import('@/types').Message[];
  replyingTo: import('@/types').Message | null;
  editingId: string | null;
  isTyping: boolean;
  setMessages: (messages: import('@/types').Message[]) => void;
  setReplyingTo: (m: import('@/types').Message | null) => void;
  setEditingId: (id: string | null) => void;
  setTyping: (v: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  replyingTo: null,
  editingId: null,
  isTyping: false,
  setMessages: (messages) => set({ messages }),
  setReplyingTo: (replyingTo) => set({ replyingTo }),
  setEditingId: (editingId) => set({ editingId }),
  setTyping: (isTyping) => set({ isTyping }),
}));
