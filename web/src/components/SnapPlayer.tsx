import { useEffect, useState } from 'react';
import type { Message } from '@/types';
import { markViewed } from '@/services/chat';
import { IconClose } from './Icons';
import { resolveMediaUrl } from '@/utils/media';

interface Props {
  snap: Message;
  userId: string;
  onClose: () => void;
}

export function SnapPlayer({ snap, userId, onClose }: Props) {
  const [progress, setProgress] = useState(100);
  const isOwn = snap.senderId === userId;
  const alreadyViewed = snap.viewedBy?.includes(userId);

  useEffect(() => {
    if (isOwn || alreadyViewed) return;
    markViewed(snap.id, userId);
    const start = Date.now();
    const duration = 5000;
    const timer = setInterval(() => {
      const left = Math.max(0, 100 - ((Date.now() - start) / duration) * 100);
      setProgress(left);
      if (left <= 0) {
        clearInterval(timer);
        onClose();
      }
    }, 50);
    return () => clearInterval(timer);
  }, [snap.id, userId, isOwn, alreadyViewed, onClose]);

  const mediaSrc = resolveMediaUrl(snap.mediaUrl);

  return (
    <div className="snap-player">
      <div className="snap-progress" style={{ width: `${progress}%` }} />
      <button className="snap-close" onClick={onClose} aria-label="Close"><IconClose size={22} /></button>
      {mediaSrc && (
        <img src={mediaSrc} alt="" className="snap-player-image" />
      )}
    </div>
  );
}
