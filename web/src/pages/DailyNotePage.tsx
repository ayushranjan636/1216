import { useState } from 'react';
import { useAuthStore } from '@/stores';
import { useNavigate } from 'react-router-dom';
import { addDailyNote } from '@/services/extras';
import { IconNote, IconSend } from '@/components/Icons';

export function DailyNotePage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!text.trim() || !profile || sending) return;
    setSending(true);
    try {
      await addDailyNote(profile.uid, text.trim());
      navigate('/chat');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page daily-note-page">
      <img src="/logo.png" alt="" width={64} height={64} className="logo-round" />
      <h1 className="page-title"><IconNote size={28} className="page-title-icon" /> Daily Love Note</h1>
      <p className="muted-text page-subtitle">Send a sweet message to start their day</p>
      <textarea
        className="input"
        rows={6}
        placeholder="Write something from the heart…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="btn-primary send-note-btn" onClick={send} disabled={!text.trim() || sending}>
        <IconSend size={18} /> {sending ? 'Sending…' : 'Send Love Note'}
      </button>
    </div>
  );
}
