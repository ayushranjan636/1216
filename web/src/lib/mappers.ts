import type {
  Message, UserProfile, CallSession, CallSignal, Memory, DailyNote, FavoriteMessage, Reaction,
} from '@/types';

type DbMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: string;
  text: string | null;
  media_url: string | null;
  media_path: string | null;
  reply_to_id: string | null;
  reply_to_preview: string | null;
  reactions: Reaction[] | null;
  status: string;
  view_once: boolean;
  viewed_by: string[] | null;
  read_by: string[] | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

type DbProfile = {
  id: string;
  email: string;
  display_name: string;
  photo_url: string | null;
  last_seen: string | null;
  created_at: string;
};

type DbCall = {
  id: string;
  caller_id: string;
  callee_id: string;
  type: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration: number | null;
  created_at: string;
};

type DbSignal = {
  id: string;
  call_id: string;
  from_id: string;
  to_id: string;
  type: string;
  payload: string;
  created_at: string;
};

export function toMessage(row: DbMessage): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    type: row.type as Message['type'],
    text: row.text ?? undefined,
    mediaUrl: row.media_url ?? undefined,
    replyToId: row.reply_to_id ?? undefined,
    replyToPreview: row.reply_to_preview ?? undefined,
    reactions: row.reactions ?? [],
    status: row.status as Message['status'],
    viewOnce: row.view_once,
    viewedBy: row.viewed_by ?? [],
    readBy: row.read_by ?? [],
    editedAt: row.edited_at ? Date.parse(row.edited_at) : undefined,
    deletedAt: row.deleted_at ? Date.parse(row.deleted_at) : undefined,
    createdAt: Date.parse(row.created_at),
  };
}

export function toProfile(row: DbProfile, isOnline = false): UserProfile {
  return {
    uid: row.id,
    email: row.email,
    displayName: row.display_name,
    photoURL: row.photo_url ?? undefined,
    isOnline,
    lastSeen: row.last_seen ? Date.parse(row.last_seen) : Date.now(),
    createdAt: Date.parse(row.created_at),
  };
}

export function toCall(row: DbCall): CallSession {
  return {
    id: row.id,
    callerId: row.caller_id,
    calleeId: row.callee_id,
    type: row.type as CallSession['type'],
    status: row.status as CallSession['status'],
    startedAt: row.started_at ? Date.parse(row.started_at) : undefined,
    endedAt: row.ended_at ? Date.parse(row.ended_at) : undefined,
    duration: row.duration ?? undefined,
  };
}

export function toSignal(row: DbSignal): CallSignal {
  return {
    id: row.id,
    callId: row.call_id,
    from: row.from_id,
    to: row.to_id,
    type: row.type as CallSignal['type'],
    payload: row.payload,
    createdAt: Date.parse(row.created_at),
  };
}

export function toMemory(row: Record<string, unknown>): Memory {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? undefined,
    mediaUrl: row.media_url as string,
    mediaType: row.media_type as Memory['mediaType'],
    createdBy: row.created_by as string,
    createdAt: Date.parse(row.created_at as string),
  };
}

export function toDailyNote(row: Record<string, unknown>): DailyNote {
  return {
    id: row.id as string,
    senderId: row.sender_id as string,
    text: row.text as string,
    date: row.note_date as string,
    createdAt: Date.parse(row.created_at as string),
  };
}

export function toFavorite(row: Record<string, unknown>): FavoriteMessage {
  return {
    id: row.id as string,
    messageId: row.message_id as string,
    savedBy: row.saved_by as string,
    preview: row.preview as string,
    createdAt: Date.parse(row.created_at as string),
  };
}
