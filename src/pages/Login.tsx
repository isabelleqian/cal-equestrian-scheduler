import { useState } from 'react';
import { googleEnabled, siteUrl, supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => new URL(window.location.href).searchParams.get('error_description') ?? '');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: siteUrl(), shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: siteUrl() } });
    if (error) setError(error.message);
  };

  return (
    <div className="page narrow">
      <div className="card">
        <h1>Sign in</h1>
        <p>Enter your email and we will send you a sign-in link. No password needed.</p>
        {sent ? (
          <div className="notice ok">
            Check <b>{email}</b> for a link. Open it <b>in this same browser</b> to finish signing in. It can take a
            minute to arrive; check spam too.
          </div>
        ) : (
          <form onSubmit={send} className="stack">
            <input
              type="email"
              required
              placeholder="you@berkeley.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <button className="btn primary" disabled={busy}>
              {busy ? 'Sending...' : 'Email me a sign-in link'}
            </button>
          </form>
        )}
        {googleEnabled && (
          <>
            <div className="divider">or</div>
            <button className="btn" onClick={google}>
              Sign in with Google
            </button>
          </>
        )}
        {error && <div className="notice err">{error}</div>}
      </div>
    </div>
  );
}
