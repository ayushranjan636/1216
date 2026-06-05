import { useEffect, useRef, useState } from 'react';
import { useAuthStore, useChatStore } from '@/stores';
import { MessageBubble } from '@/components/MessageBubble';
import {
  subscribeMessages,
  sendTextMessage,
  sendFileMessage,
  editMessage,
  deleteMessage,
  addReaction,
} from '@/services/chat';
import { addFavorite as saveFavorite } from '@/services/extras';
import { groupByDate } from '@/utils/date';
import { useCallContext } from '@/context/CallContext';
import { IconAttach, IconOnce, IconPhone, IconSend, IconVideo } from '@/components/Icons';
import type { Message, ReactionType } from '@/types';

export function ChatPage() {
  const { profile, partner } = useAuthStore();
  const { messages, setMessages, replyingTo, setReplyingTo, editingId, setEditingId } = useChatStore();
  const { startCall } = useCallContext();
  const [text, setText] = useState('');
  const [viewOnce, setViewOnce] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeMessages(setMessages), [setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (editingId) {
      const m = messages.find((x) => x.id === editingId);
      if (m?.text) setText(m.text);
    }
  }, [editingId, messages]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || !profile) return;
    if (editingId) {
      await editMessage(editingId, trimmed);
      setEditingId(null);
    } else {
      await sendTextMessage(profile.uid, trimmed, {
        replyToId: replyingTo?.id,
        replyToPreview: replyingTo?.text,
        type: 'text',
      } as Partial<Message>);
      setReplyingTo(null);
    }
    setText('');
  };

  const onAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadError('');
    setUploading(true);
    try {
      await sendFileMessage(profile.uid, file, viewOnce);
      setViewOnce(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to send photo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const onReact = async (msg: Message, type: ReactionType) => {
    if (!profile) return;
    await addReaction(msg.id, type, profile.uid);
  };

  const groups = groupByDate(messages);

  return (
    <div className="chat-page">
      <header className="chat-header glass">
        <img src="/logo.png" alt="" className="avatar sm" />
        <div className="chat-header-info">
          <strong>{partner?.displayName ?? 'Partner'}</strong>
          <p className={partner?.isOnline ? 'online-text' : 'muted-text'}>
            {partner?.isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
        <div className="chat-header-actions">
          <button className="icon-btn" onClick={() => startCall('voice')} title="Voice call"><IconPhone size={18} /></button>
          <button className="icon-btn" onClick={() => startCall('video')} title="Video call"><IconVideo size={18} /></button>
        </div>
      </header>

      <div className="chat-messages">
        {groups.map((g) => (
          <div key={g.date}>
            <div className="date-sep">{g.date}</div>
            {g.items.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.senderId === profile?.uid}
                userId={profile?.uid ?? ''}
                onReact={(type) => onReact(msg, type)}
                onReply={() => setReplyingTo(msg)}
                onEdit={msg.senderId === profile?.uid ? () => setEditingId(msg.id) : undefined}
                onDelete={msg.senderId === profile?.uid ? () => deleteMessage(msg.id) : undefined}
                onFavorite={() => profile && saveFavorite({ messageId: msg.id, savedBy: profile.uid, preview: msg.text ?? 'Media', createdAt: Date.now() })}
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {(replyingTo || editingId) && (
        <div className="reply-bar glass">
          {editingId ? 'Editing message' : `Replying to: ${replyingTo?.text?.slice(0, 40)}`}
          <button className="btn-ghost" onClick={() => { setReplyingTo(null); setEditingId(null); setText(''); }}>Cancel</button>
        </div>
      )}

      {uploadError && (
        <div className="upload-error-bar glass">{uploadError}</div>
      )}

      <div className="chat-input-bar glass">
        <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={onAttach} />
        <button
          className={`icon-btn ${viewOnce ? 'active' : ''}`}
          onClick={() => setViewOnce(!viewOnce)}
          title="View once"
          disabled={uploading}
        >
          <IconOnce size={18} />
        </button>
        <button className="icon-btn" onClick={() => fileRef.current?.click()} title="Attach" disabled={uploading}>
          <IconAttach size={18} />
        </button>
        <textarea
          rows={1}
          placeholder="Message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        <button className="send-btn" onClick={send} disabled={!text.trim()}><IconSend size={16} /></button>
      </div>
    </div>
  );
}
