import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Grid from '../components/Grid';
import { useAuth } from '../lib/auth';
import { getCoach, getMyAvailability, saveMyAvailability } from '../lib/api';

const sameSet = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every((x) => b.has(x));

export default function MyAvailability() {
  const { session, profile } = useAuth();
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState<Set<number>>(new Set());
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [coach, setCoach] = useState<Set<number>>(new Set());
  const [showCoach, setShowCoach] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const [row, c] = await Promise.all([getMyAvailability(session.user.id), getCoach()]);
        const s = new Set(row?.slots ?? []);
        setSaved(s);
        setDraft(new Set(s));
        setUpdatedAt(row?.updated_at ?? null);
        setCoach(new Set(c.slots));
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message });
      }
      setLoading(false);
    })();
  }, [session]);

  const dirty = useMemo(() => !sameSet(saved, draft), [saved, draft]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async () => {
    if (!session) return;
    setBusy(true);
    setMsg(null);
    try {
      const row = await saveMyAvailability(session.user.id, [...draft].sort((a, b) => a - b));
      setSaved(new Set(row.slots));
      setUpdatedAt(row.updated_at);
      setMsg({ ok: true, text: 'Saved. You can come back and change it anytime.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  };

  if (loading) return <div className="page">Loading your schedule...</div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My weekly availability</h1>
          <p className="muted">
            Hi {profile?.name}. You are listed as a <b>{profile?.is_driver ? 'driver' : 'non-driver'}</b> (
            <Link to="/profile">change</Link>).
          </p>
        </div>
        <div className="status">
          {dirty ? (
            <span className="pill warn">Unsaved changes</span>
          ) : updatedAt ? (
            <span className="pill ok">Saved {new Date(updatedAt).toLocaleString()}</span>
          ) : (
            <span className="pill">Not submitted yet</span>
          )}
        </div>
      </div>

      <div className="card tip">
        Click or drag to color every time you are free. A lesson is 1 hour, and you need to be free for 1 hour of travel
        before and after it, so a lesson needs a <b>3-hour free block</b>. Lessons run between 8:30 AM and 4:00 PM.
        Click a day name to fill or clear the whole day.
      </div>

      <div className="toolbar">
        <button className="btn primary" onClick={save} disabled={busy || !dirty}>
          {busy ? 'Saving...' : 'Save availability'}
        </button>
        <button className="btn" onClick={() => setDraft(new Set(saved))} disabled={!dirty}>
          Undo changes
        </button>
        <button className="btn" onClick={() => setDraft(new Set())} disabled={draft.size === 0}>
          Clear all
        </button>
        <label className="check">
          <input type="checkbox" checked={showCoach} onChange={(e) => setShowCoach(e.target.checked)} />
          Outline coach hours
        </label>
        <span className="muted small">{(draft.size / 2).toFixed(1)} hours selected</span>
      </div>
      {msg && <div className={`notice ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}

      <Grid selected={draft} onChange={setDraft} outline={showCoach ? coach : undefined} />
      <div className="legend">
        <span className="swatch on" /> Free
        {showCoach && (
          <>
            <span className="swatch outline" /> Coach available
          </>
        )}
      </div>
    </div>
  );
}
