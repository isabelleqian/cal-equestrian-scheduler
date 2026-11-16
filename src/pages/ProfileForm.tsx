import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { saveMyProfile } from '../lib/api';

export default function ProfileForm() {
  const { session, profile, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState(profile?.name ?? '');
  const [isDriver, setIsDriver] = useState<boolean | null>(profile ? profile.is_driver : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || isDriver === null) return;
    setBusy(true);
    setError('');
    try {
      await saveMyProfile({ id: session.user.id, email: session.user.email ?? '', name: name.trim(), is_driver: isDriver });
      await refreshProfile();
      nav('/');
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="page narrow">
      <div className="card">
        <h1>{profile ? 'Your profile' : 'Welcome to Cal Equestrian'}</h1>
        <p>{profile ? 'Update your details anytime.' : 'Tell us a little about you before you fill in your schedule.'}</p>
        <form onSubmit={save} className="stack">
          <label>
            Full name
            <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <fieldset className="choice">
            <legend>Can you drive to lessons this semester?</legend>
            <label className={isDriver === true ? 'picked' : ''}>
              <input type="radio" name="driver" checked={isDriver === true} onChange={() => setIsDriver(true)} />
              Yes, I am a <b>driver</b> (I can drive up to 3 teammates)
            </label>
            <label className={isDriver === false ? 'picked' : ''}>
              <input type="radio" name="driver" checked={isDriver === false} onChange={() => setIsDriver(false)} />
              No, I am a <b>non-driver</b> (I need a ride)
            </label>
          </fieldset>
          <button className="btn primary" disabled={busy || !name.trim() || isDriver === null}>
            {busy ? 'Saving...' : 'Save'}
          </button>
          {error && <div className="notice err">{error}</div>}
        </form>
      </div>
    </div>
  );
}
