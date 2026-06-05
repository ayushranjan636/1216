import { useState } from 'react';
import type { Message } from '@/types';
import { formatMessageTime } from '@/utils/date';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewOnceMedia } from './ViewOnceMedia';
import { ReactionPicker } from './ReactionPicker';
import { ReactionIcon, IconCheck, IconChecks } from './Icons';
import { resolveMediaUrl, downloadMedia } from '@/utils/media';
import type { ReactionType } from '@/types';

interface Props {
  message: Message;
  isOwn: boolean;
  userId: string;
  onReact: (type: ReactionType) => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onFavorite?: () => void;
}

export function MessageBubble({ message, isOwn, userId, onReact, onReply, onEdit, onDelete }: Props) {
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (message.deletedAt) return null;

  const hasViewOnce = message.viewOnce && (message.type === 'image' || message.type === 'video');
  const showRegularMedia = message.mediaUrl && !hasViewOnce;
  const mediaSrc = resolveMediaUrl(message.mediaUrl);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bubble-row ${isOwn ? 'own' : 'other'}`}
    >
      <div
        className={`bubble glass-bubble ${isOwn ? 'own' : ''}`}
        onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }}
      >
        {message.replyToPreview && (
          <div className="reply-preview">{message.replyToPreview}</div>
        )}

        {hasViewOnce && (
          <ViewOnceMedia message={message} userId={userId} isOwn={isOwn} />
        )}

        {showRegularMedia && message.type === 'image' && mediaSrc && (
          <div className="bubble-media-wrap">
            <img src={mediaSrc} alt="" className="bubble-media" />
            <button
              type="button"
              className="bubble-save-btn"
              onClick={() => downloadMedia(message.mediaUrl!, `1216-${message.id}.jpg`)}
            >
              Save
            </button>
          </div>
        )}
        {showRegularMedia && message.type === 'video' && mediaSrc && (
          <video src={mediaSrc} controls className="bubble-media" />
        )}

        {message.text && !hasViewOnce && (
          <p className="bubble-text">
            {message.text}
            {message.editedAt && <span className="edited-tag">edited</span>}
          </p>
        )}

        <div className="bubble-meta">
          <span>{formatMessageTime(message.createdAt)}</span>
          {isOwn && (
            <span className="read-status">
              {message.status === 'seen' ? <IconChecks size={12} /> : <IconCheck size={12} />}
            </span>
          )}
        </div>

        {message.reactions.length > 0 && (
          <div className="bubble-reactions">
            {message.reactions.map((r) => (
              <span key={r.userId} className="reaction-chip glass">
                <ReactionIcon type={r.type} size={12} />
              </span>
            ))}
          </div>
        )}

        <AnimatePresence>
          {showReactions && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <ReactionPicker onSelect={onReact} onClose={() => setShowReactions(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bubble-actions">
        <button className="bubble-action-btn" onClick={() => setShowReactions(!showReactions)} title="React">React</button>
        {onReply && <button className="bubble-action-btn" onClick={onReply}>Reply</button>}
        {onEdit && <button className="bubble-action-btn" onClick={onEdit}>Edit</button>}
        {onDelete && <button className="bubble-action-btn" onClick={onDelete}>Delete</button>}
      </div>

      {showMenu && (
        <div className="context-menu glass" onMouseLeave={() => setShowMenu(false)}>
          <button onClick={() => { setShowReactions(true); setShowMenu(false); }}>React</button>
          {onReply && <button onClick={() => { onReply(); setShowMenu(false); }}>Reply</button>}
          {onEdit && <button onClick={() => { onEdit(); setShowMenu(false); }}>Edit</button>}
          {onDelete && <button onClick={() => { onDelete(); setShowMenu(false); }}>Delete</button>}
        </div>
      )}
    </motion.div>
  );
}
