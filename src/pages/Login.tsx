import { useState } from 'react';
import { siteUrl, supabase } from '../lib/supabase';

function getInitialAuthError(): string {
  try {
    const url = new URL(window.location.href);
    const searchDesc = url.searchParams.get('error_description') || url.searchParams.get('error');
    if (searchDesc) return searchDesc;
    if (url.hash && url.hash.includes('=')) {
      const hashParams = new URLSearchParams(url.hash.replace(/^#[^?]*\??/, ''));
      const hashDesc = hashParams.get('error_description') || hashParams.get('error');
      if (hashDesc) return hashDesc;
    }
  } catch {
    // ignore URL parsing errors
  }
  return '';
}

export default function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(getInitialAuthError);

  const google = async () => {
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: siteUrl() },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  };

  return (
    <div className="page narrow">
      <div className="card" style={{ textAlign: 'center' }}>
        <h1>Sign in</h1>
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          Sign in with your @berkeley.edu Google account to access your schedule.
        </p>
        <button
          className="btn primary"
          onClick={google}
          disabled={busy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: '1rem',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
            />
            <path
              fill="#FBBC05"
              d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.8s.7 5.1 1.9 7.5l3.7-2.9z"
            />
            <path
              fill="#34A853"
              d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.9C3.7 20.6 7.5 23.5 12 23.5z"
            />
          </svg>
          {busy ? 'Connecting to Google...' : 'Sign in with Google'}
        </button>
        {error && <div className="notice err" style={{ textAlign: 'left', marginTop: '1rem' }}>{error}</div>}
      </div>
    </div>
  );
}
