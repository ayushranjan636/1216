import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores';
import { restoreSession, fetchPartner, loadProfile, trackOnline, isDemoMode } from '@/services/api';
import { isSupabaseMode } from '@/lib/supabase';
import { APP_CONFIG } from '@/config/app.config';
import { relationshipDuration } from '@/utils/date';
import { CallProvider } from '@/components/CallProvider';
import { useCallStore } from '@/stores/callStore';
import { useChatStore } from '@/stores';
import { useThemeStore } from '@/stores/themeStore';
import { useMessageNotifications } from '@/hooks/useMessageNotifications';
import {
  IconMessage, IconPhone, IconSnap, IconMemories, IconNote, IconStar, IconUser,
} from '@/components/Icons';
import './Layout.css';

const NAV = [
  { path: '/chat', label: 'Messages', Icon: IconMessage },
  { path: '/snaps', label: 'Snaps', Icon: IconSnap },
  { path: '/calls', label: 'Calls', Icon: IconPhone },
  { path: '/memories', label: 'Memories', Icon: IconMemories },
  { path: '/daily-note', label: 'Note', Icon: IconNote },
  { path: '/favorites', label: 'Saved', Icon: IconStar },
  { path: '/profile', label: 'Profile', Icon: IconUser },
];

const MOBILE_NAV = [
  { path: '/chat', label: 'Chat', Icon: IconMessage },
  { path: '/snaps', label: 'Snaps', Icon: IconSnap },
  { path: '/calls', label: 'Calls', Icon: IconPhone },
  { path: '/profile', label: 'Profile', Icon: IconUser },
];

export function Layout() {
  const { session, partner, isLoading, setSession, setProfile, setPartner, setLoading } = useAuthStore();
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const callMinimized = useCallStore((s) => s.callMinimized);
  const activeCall = useCallStore((s) => s.activeCall);
  const composing = useChatStore((s) => s.composing);

  useMessageNotifications();

  useEffect(() => {
    restoreSession().then(async (s) => {
      if (!s) { setLoading(false); return; }
      setSession(s);
      const profile = await loadProfile(s.user.uid).catch(() => ({
        uid: s.user.uid,
        email: s.user.email,
        displayName: s.user.displayName,
        isOnline: true,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      }));
      const partnerP = await fetchPartner(s.user.uid).catch(() => null);
      setProfile(profile);
      setPartner(partnerP);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!session?.user.uid || !isSupabaseMode()) return;
    return trackOnline(session.user.uid);
  }, [session?.user.uid]);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <img src="/logo.png" alt="" width={64} height={64} className="logo-round" />
        <p>Loading 1216…</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  const dur = relationshipDuration(APP_CONFIG.relationshipStart);
  const isChatOrSnaps = location.pathname === '/chat' || location.pathname === '/snaps';
  const withCallBar = Boolean(callMinimized && activeCall);
  const chatComposing = location.pathname === '/chat' && composing;

  return (
    <CallProvider>
      <div className={`app-shell ${withCallBar ? 'app-with-call-bar' : ''} ${chatComposing ? 'chat-composing-shell' : ''}`} data-theme={theme}>
        <aside className={`sidebar glass-panel ${isChatOrSnaps ? 'hidden-desktop-on-chat' : ''}`}>
          <header className="sidebar-header">
            <img src="/logo.png" alt="1216" className="sidebar-logo" />
            <div>
              <h1>1216</h1>
              <p className="status-badge">{isSupabaseMode() ? 'Live' : isDemoMode() ? 'Demo' : 'Local'}</p>
            </div>
          </header>

          <div className="relationship-pill glass">
            <span className="relationship-since">Together since Aug 17, 2022</span>
            <span>{dur.years}y · {dur.months}m · {dur.days}d</span>
          </div>

          <nav className="sidebar-nav">
            {NAV.map(({ path, label, Icon }) => (
              <button
                key={path}
                type="button"
                className={`nav-item ${location.pathname === path ? 'active' : ''}`}
                onClick={() => navigate(path)}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>

          <button type="button" className="conversation-card glass" onClick={() => navigate('/chat')}>
            <img src="/logo.png" alt="" className="avatar" />
            <div className="conv-info">
              <strong>{partner?.displayName ?? 'Partner'}</strong>
              <span className={partner?.isOnline ? 'online' : ''}>
                {partner?.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </button>
        </aside>

        <main className={`main-panel ${isChatOrSnaps ? 'main-full-mobile' : ''}`}>
          <Outlet />
        </main>

        <nav className={`mobile-tab-bar glass ${chatComposing ? 'mobile-tab-hidden' : ''}`}>
          {MOBILE_NAV.map(({ path, label, Icon }) => (
            <button
              key={path}
              type="button"
              className={`mobile-tab ${location.pathname === path ? 'active' : ''}`}
              onClick={() => navigate(path)}
              aria-label={label}
            >
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </CallProvider>
  );
}
