import { createClient, SupabaseClient } from '@supabase/supabase-js';

function readEnv() {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
  const anonKey = (
    import.meta.env.VITE_SUPABASE_ANON_KEY
    ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    ?? ''
  ).trim();
  return { url, anonKey };
}

const env = readEnv();

export const isSupabaseMode = () => Boolean(env.url && env.anonKey);

/** True when build ran without Supabase env (helps debug Vercel config). */
export const supabaseConfigHint = () => {
  if (isSupabaseMode()) return null;
  const missing: string[] = [];
  if (!env.url) missing.push('VITE_SUPABASE_URL');
  if (!env.anonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  return missing;
};

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseMode()) {
    const missing = supabaseConfigHint()?.join(', ') ?? 'Supabase env';
    throw new Error(
      `${missing} not set in this build. Add them in Vercel → Settings → Environment Variables → Redeploy.`,
    );
  }
  if (!client) {
    client = createClient(env.url, env.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
