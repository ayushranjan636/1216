import { useState, useEffect } from 'react';
import { APP_CONFIG } from '@/config/app.config';
import { logout, fetchStats, updateDisplayName } from '@/services/api';
import { relationshipDuration } from '@/utils/date';
import { useAuthStore } from '@/stores';
import { useThemeStore } from '@/stores/themeStore';
import { useNavigate } from 'react-router-dom';
import { getNotificationPermission, requestNotificationPermission } from '@/services/notifications';
import { IconSun, IconMoon } from '@/components/Icons';

export function ProfilePage() {
  const { profile, partner, session, setProfile, setSession } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const navigate = useNavigate();
  const dur = relationshipDuration(APP_CONFIG.relationshipStart);
  const [stats, setStats] = useState({ totalMessages: 0, totalCalls: 0, totalMemories: 0 });
  const [notifStatus, setNotifStatus] = useState(getNotificationPermission());
  const [nameDraft, setNameDraft] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (!profile) return;
    fetchStats(profile.uid).then(setStats).catch(console.error);
  }, [profile?.uid]);

  useEffect(() => {
    if (profile) setNameDraft(profile.displayName);
  }, [profile?.displayName]);

  const saveName = async () => {
    if (!profile) return;
    setNameSaving(true);
    setNameError('');
    try {
      const updated = await updateDisplayName(profile.uid, nameDraft);
      setProfile(updated);
      if (session) {
        setSession({
          ...session,
          user: { ...session.user, displayName: updated.displayName, username: updated.displayName },
        });
      }
      setEditingName(false);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Could not save name');
    } finally {
      setNameSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="profile-hero">
        <img src="/logo.png" alt="" className="profile-avatar" />
        {editingName ? (
          <div className="name-edit-block">
            <input
              className="name-edit-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Your display name"
              maxLength={40}
              autoFocus
            />
            <div className="name-edit-actions">
              <button className="btn-primary" disabled={nameSaving || !nameDraft.trim()} onClick={saveName}>
                {nameSaving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-ghost" disabled={nameSaving} onClick={() => {
                setEditingName(false);
                setNameDraft(profile?.displayName ?? '');
                setNameError('');
              }}>
                Cancel
              </button>
            </div>
            {nameError && <p className="name-edit-error">{nameError}</p>}
          </div>
        ) : (
          <>
            <h2>{profile?.displayName}</h2>
            <button className="btn-ghost name-edit-btn" onClick={() => setEditingName(true)}>
              Edit name
            </button>
          </>
        )}
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
