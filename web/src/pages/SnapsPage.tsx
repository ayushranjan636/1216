import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores';
import { SnapCamera } from '@/components/SnapCamera';
import { SnapPlayer } from '@/components/SnapPlayer';
import { subscribeSnaps, sendSnapMessage } from '@/services/chat';
import { formatRelative } from '@/utils/date';
import { resolveMediaUrl } from '@/utils/media';
import type { Message } from '@/types';
import { IconSnap } from '@/components/Icons';

export function SnapsPage() {
  const { profile, partner } = useAuthStore();
  const [snaps, setSnaps] = useState<Message[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [playing, setPlaying] = useState<Message | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => subscribeSnaps(setSnaps), []);

  const onCapture = async (dataUrl: string) => {
    if (!profile || sending) return;
    setSending(true);
    setError('');
    try {
      await sendSnapMessage(profile.uid, dataUrl);
      setShowCamera(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send snap');
    } finally {
      setSending(false);
    }
  };

  const canPlay = (snap: Message) => {
    if (!profile) return false;
    if (snap.senderId === profile.uid) return true;
    return !snap.viewedBy?.includes(profile.uid);
  };

  return (
    <div className="page snaps-page">
      <header className="snaps-header">
        <div>
          <h1 className="page-title">Snaps</h1>
          <p className="muted-text">With {partner?.displayName}</p>
        </div>
        <button className="btn-primary snaps-new-btn" onClick={() => setShowCamera(true)} disabled={sending}>
          New Snap
        </button>
      </header>

      {error && <p className="upload-error">{error}</p>}

      {snaps.length === 0 ? (
        <div className="empty-state glass">
          <IconSnap size={40} />
          <p>No snaps yet</p>
          <span>Send a snap that can only be viewed once</span>
        </div>
      ) : (
        <div className="snaps-grid">
          {snaps.map((snap) => {
            const isOwn = snap.senderId === profile?.uid;
            const opened = snap.viewedBy?.some((id) => id !== snap.senderId);
            const playable = canPlay(snap);
            const thumb = isOwn ? resolveMediaUrl(snap.mediaUrl) : undefined;
            return (
              <button
                key={snap.id}
                className={`snap-card glass ${playable ? 'unopened' : 'opened'}`}
                onClick={() => playable && setPlaying(snap)}
                disabled={!playable && !isOwn}
              >
                <div className="snap-card-inner">
                  {thumb ? (
                    <img src={thumb} alt="" className="snap-card-thumb" />
                  ) : playable ? (
                    <span className="snap-label">Tap to view</span>
                  ) : (
                    <span className="snap-label muted">{isOwn ? (opened ? 'Opened' : 'Delivered') : 'Opened'}</span>
                  )}
                  {!thumb && <IconSnap size={28} />}
                </div>
                <footer>
                  <small>{isOwn ? 'You' : partner?.displayName}</small>
                  <small>{formatRelative(snap.createdAt)}</small>
                </footer>
              </button>
            );
          })}
        </div>
      )}

      {showCamera && <SnapCamera onClose={() => setShowCamera(false)} onCapture={onCapture} />}
      {playing && profile && (
        <SnapPlayer snap={playing} userId={profile.uid} onClose={() => setPlaying(null)} />
      )}
    </div>
  );
}
