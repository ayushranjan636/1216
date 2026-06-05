import { IconPhone, IconVideo } from '@/components/Icons';

export function CallLogsPage() {
  return (
    <div className="page">
      <h1 className="page-title">Calls</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
        Voice and video calls are private and not saved
      </p>

      <div className="empty-state glass">
        <span className="call-log-icon" style={{ marginBottom: 12 }}>
          <IconVideo size={28} />
        </span>
        <p>Start a call from Messages</p>
        <span>Use the phone or video button in chat. Call history is not recorded.</span>
        <div style={{ display: 'flex', gap: 16, marginTop: 16, justifyContent: 'center', opacity: 0.6 }}>
          <IconPhone size={18} />
          <IconVideo size={18} />
        </div>
      </div>
    </div>
  );
}
