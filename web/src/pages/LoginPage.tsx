import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoMark } from '@/components/LogoMark';
import { login } from '@/services/api';
import { isSupabaseMode, supabaseConfigHint } from '@/lib/supabase';
import { isDemoMode } from '@/config/app.config';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
      navigate('/chat');
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const configMissing = !isSupabaseMode() && !isDemoMode();

  return (
    <div className="login-page">
      <div className="login-card">
        <LogoMark size={100} showLabel />
        <p className="login-tagline">Your private space, just for two</p>

        {configMissing && (
          <div className="login-error">
            <p><strong>Backend not connected</strong></p>
            <p style={{ fontSize: 13, marginTop: 8 }}>
              Add in Vercel → Settings → Environment Variables, then <strong>Redeploy</strong>:
            </p>
            <code style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
              VITE_SUPABASE_URL<br />
              VITE_SUPABASE_ANON_KEY
            </code>
            {supabaseConfigHint() && (
              <p style={{ fontSize: 12, marginTop: 8, opacity: 0.9 }}>
                Missing in this build: {supabaseConfigHint()!.join(', ')}
              </p>
            )}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && (
            <div className="login-error">
              <p>{error}</p>
            </div>
          )}

          <button className="btn-primary" type="submit" disabled={loading || !email.trim() || !password}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {isSupabaseMode() && (
          <p className="login-hint">Sign in with your Supabase account</p>
        )}
      </div>
    </div>
  );
}
