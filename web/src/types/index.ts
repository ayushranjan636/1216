export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'seen';
export type MessageType = 'text' | 'image' | 'video' | 'snap' | 'daily_note';
export type ReactionType = 'heart' | 'like' | 'haha' | 'wow' | 'emphasize';
export type DeviceSlot = 'ayush' | 'partner';
export type CallType = 'voice' | 'video';
export type CallStatus = 'ringing' | 'connecting' | 'active' | 'ended' | 'missed' | 'declined';
export type ThemeMode = 'dark' | 'light';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  isOnline: boolean;
  lastSeen: number;
  createdAt: number;
}

export interface Reaction {
  type: ReactionType;
  userId: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  mediaThumbnail?: string;
  replyToId?: string;
  replyToPreview?: string;
  reactions: Reaction[];
  status: MessageStatus;
  viewOnce?: boolean;
  viewedBy?: string[];
  editedAt?: number;
  deletedAt?: number;
  createdAt: number;
  readBy: string[];
}

export interface Conversation {
  id: string;
  participantIds: string[];
  lastMessage?: string;
  lastMessageAt?: number;
  lastMessageSenderId?: string;
  unreadCount: Record<string, number>;
}

export interface CallSession {
  id: string;
  callerId: string;
  calleeId: string;
  type: CallType;
  status: CallStatus;
  startedAt?: number;
  endedAt?: number;
  duration?: number;
}

export interface CallSignal {
  id: string;
  callId: string;
  from: string;
  to: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: string;
  createdAt: number;
}

export interface Memory {
  id: string;
  title: string;
  description?: string;
  mediaUrl: string;
  mediaType: 'photo' | 'video';
  createdBy: string;
  createdAt: number;
}

export interface DailyNote {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
  date: string;
}

export interface FavoriteMessage {
  id: string;
  messageId: string;
  savedBy: string;
  preview: string;
  createdAt: number;
}

export interface AuthSession {
  token: string;
  user: { uid: string; username: string; displayName: string; email: string };
  expiresAt: number;
}

export const REACTION_OPTIONS: { type: ReactionType; label: string }[] = [
  { type: 'heart', label: 'Love' },
  { type: 'like', label: 'Like' },
  { type: 'haha', label: 'Haha' },
  { type: 'wow', label: 'Wow' },
  { type: 'emphasize', label: 'Emphasize' },
];
