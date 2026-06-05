import { useState } from 'react';
import type { Message } from '@/types';
import { IconOnce } from './Icons';
import { markViewed } from '@/services/chat';
import { resolveMediaUrl } from '@/utils/media';

interface Props {
  message: Message;
  userId: string;
  isOwn: boolean;
}

export function ViewOnceMedia({ message, userId, isOwn }: Props) {
  const [revealed, setRevealed] = useState(false);
  const viewed = message.viewedBy?.includes(userId);
  const expired = message.viewOnce && !isOwn && viewed;

  if (!message.mediaUrl || !message.viewOnce) return null;

  const mediaSrc = resolveMediaUrl(message.mediaUrl);
  if (!mediaSrc) return null;

  if (isOwn) {
    return (
      <div className="view-once-own glass">
        <IconOnce size={16} />
        <span>{viewed ? 'Opened' : 'Delivered'}</span>
        <span className="view-once-type">{message.type === 'video' ? 'Video' : 'Photo'}</span>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="view-once-expired glass">
        <IconOnce size={18} />
        <span>Opened</span>
      </div>
    );
  }

  if (!revealed) {
    return (
      <button
        className="view-once-tap glass"
        onClick={async () => {
          setRevealed(true);
          await markViewed(message.id, userId);
        }}
      >
        <IconOnce size={22} />
        <span>Tap to view</span>
        <small>View once</small>
      </button>
    );
  }

  if (message.type === 'video') {
    return (
      <video src={mediaSrc} controls autoPlay className="view-once-media" onEnded={() => setRevealed(false)} />
    );
  }

  return <img src={mediaSrc} alt="" className="view-once-media" />;
}
