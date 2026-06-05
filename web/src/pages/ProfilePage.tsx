import { useState, useEffect } from 'react';
import { APP_CONFIG } from '@/config/app.config';
import { logout, fetchStats } from '@/services/api';
import { relationshipDuration } from '@/utils/date';
import { useAuthStore } from '@/stores';
import { useThemeStore } from '@/stores/themeStore';
import { useNavigate } from 'react-router-dom';
import { getNotificationPermission, requestNotificationPermission } from '@/services/notifications';
import { IconSun, IconMoon } from '@/components/Icons';

export function ProfilePage() {
  const { profile, partner } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const navigate = useNavigate();
  const dur = relationshipDuration(APP_CONFIG.relationshipStart);
  const [stats, setStats] = useState({ totalMessages: 0, totalCalls: 0, totalMemories: 0 });
  const [notifStatus, setNotifStatus] = useState(getNotificationPermission());

  useEffect(() => {
    if (!profile) return;
    fetchStats(profile.uid).then(setStats).catch(console.error);
  }, [profile?.uid]);

  return (
    <div className="page">
      <div className="profile-hero">
        <img src="/logo.png" alt="" className="profile-avatar" />
        <h2>{profile?.displayName}</h2>
        <p className="profile-partner">& {partner?.displayName}</p>
        <p className="muted-text">Together since August 17, 2022</p>
      </div>

      <div className="counter-card glass">
        <h3>Together</h3>
        <div className="counter-row">
          <div><strong>{dur.years}</strong><span>Years</span></div>
          <div><strong>{dur.months}</strong><span>Months</span></div>
          <div><strong>{dur.days}</strong><span>Days</span></div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card glass"><strong>{stats.totalMessages}</strong><span>Messages</span></div>
        <div className="stat-card glass"><strong>{stats.totalCalls}</strong><span>Calls</span></div>
        <div className="stat-card glass"><strong>{stats.totalMemories}</strong><span>Memories</span></div>
      </div>

      <button className="settings-row glass" onClick={toggle}>
        {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        <span>{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</span>
      </button>

      {notifStatus !== 'granted' && notifStatus !== 'unsupported' && (
        <button className="btn-primary settings-action" onClick={async () => {
          const ok = await requestNotificationPermission(true);
          setNotifStatus(ok ? 'granted' : getNotificationPermission());
        }}>
          Enable Notifications
        </button>
      )}
      {notifStatus === 'granted' && (
        <p className="notif-ok">Notifications enabled</p>
      )}

      <button className="btn-ghost sign-out-btn" onClick={() => { logout(); navigate('/login'); }}>
        Sign Out
      </button>
    </div>
  );
}
