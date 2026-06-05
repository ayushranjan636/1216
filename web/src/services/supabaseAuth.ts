import { getSupabase } from '@/lib/supabase';
import { toProfile } from '@/lib/mappers';
import type { AuthSession, UserProfile } from '@/types';

export async function supabaseLogin(email: string, password: string): Promise<AuthSession> {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message);
  if (!data.session || !data.user) throw new Error('Login failed');

  const profile = await fetchMyProfile(data.user.id);
  return {
    token: data.session.access_token,
    user: {
      uid: data.user.id,
      username: profile.displayName,
      displayName: profile.displayName,
      email: data.user.email ?? email,
    },
    expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 3600000,
  };
}

export async function supabaseRestoreSession(): Promise<AuthSession | null> {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return null;

  const profile = await fetchMyProfile(session.user.id).catch(() => null);
  return {
    token: session.access_token,
    user: {
      uid: session.user.id,
      username: profile?.displayName ?? session.user.email?.split('@')[0] ?? 'User',
      displayName: profile?.displayName ?? 'User',
      email: session.user.email ?? '',
    },
    expiresAt: session.expires_at ? session.expires_at * 1000 : Date.now() + 3600000,
  };
}

export async function supabaseLogout() {
  await getSupabase().auth.signOut();
}

export async function fetchMyProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) throw new Error('Profile not found');
  return toProfile(data, true);
}

export async function fetchPartnerProfile(userId: string): Promise<UserProfile> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .neq('id', userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error('Partner not found');

  const presence = sb.channel('online-users');
  let isOnline = false;
  await new Promise<void>((resolve) => {
    presence.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const state = presence.presenceState<{ user_id: string }>();
        isOnline = Object.values(state).flat().some((p) => p.user_id === data.id);
        await sb.removeChannel(presence);
        resolve();
      }
    });
    setTimeout(resolve, 800);
  });

  return toProfile(data, isOnline);
}

export function trackOnline(userId: string) {
  const sb = getSupabase();
  const channel = sb.channel('online-users', { config: { presence: { key: userId } } });
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ user_id: userId, online_at: new Date().toISOString() });
    }
  });
  return () => { sb.removeChannel(channel); };
}

export async function fetchStats(_userId: string) {
  const sb = getSupabase();
  const [msgs, calls, mems] = await Promise.all([
    sb.from('messages').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    sb.from('calls').select('id', { count: 'exact', head: true }),
    sb.from('memories').select('id', { count: 'exact', head: true }),
  ]);
  return {
    totalMessages: msgs.count ?? 0,
    totalCalls: calls.count ?? 0,
    totalMemories: mems.count ?? 0,
  };
}
