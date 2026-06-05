import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores';
import { getCallHistory } from '@/services/signaling';
import { formatCallDuration, formatCallTime } from '@/utils/date';
import { IconPhone, IconVideo } from '@/components/Icons';
import type { CallSession } from '@/types';

export function CallLogsPage() {
  const { profile, partner } = useAuthStore();
  const [logs, setLogs] = useState<CallSession[]>([]);

  useEffect(() => {
    if (!profile) return;
    const load = () => getCallHistory(profile.uid).then(setLogs);
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [profile?.uid]);

  const label = (call: CallSession) => {
    const outgoing = call.callerId === profile?.uid;
    const name = outgoing ? partner?.displayName : profile?.displayName;
    return `${outgoing ? 'Outgoing' : 'Incoming'} · ${name}`;
  };

  const statusLabel = (call: CallSession) => {
    if (call.status === 'ended' && call.duration) return formatCallDuration(call.duration);
    if (call.status === 'ended') return 'Completed';
    if (call.status === 'missed') return 'Missed';
    if (call.status === 'declined') return 'Declined';
    return call.status;
  };

  return (
    <div className="page">
      <h1 className="page-title">Call Logs</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
        Voice and video call history
      </p>

      {logs.length === 0 ? (
        <div className="empty-state glass">
          <p>No calls yet</p>
          <span>Start a voice or video call from Messages</span>
        </div>
      ) : (
        <div className="call-log-list">
          {logs.map((call) => (
            <div key={call.id} className="call-log-item glass">
              <div className="call-log-main">
                <span className="call-log-icon">
                  {call.type === 'video' ? <IconVideo size={18} /> : <IconPhone size={18} />}
                </span>
                <div>
                  <strong>{label(call)}</strong>
                  <p>{call.startedAt ? formatCallTime(call.startedAt) : '—'}</p>
                </div>
              </div>
              <span className={`call-log-status status-${call.status}`}>{statusLabel(call)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
