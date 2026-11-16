import { useEffect, useState } from 'react';
import Grid from '../../components/Grid';
import { getCoach, saveCoach } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function CoachHours() {
  const { session } = useAuth();
  const [saved, setSaved] = useState<Set<number> | null>(null);
  const [draft, setDraft] = useState<Set<number>>(new Set());
  const [meta, setMeta] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const c = await getCoach();
    setSaved(new Set(c.slots));
    setDraft(new Set(c.slots));
    setMeta(c.updated_at ? `Last saved ${new Date(c.updated_at).toLocaleString()}${c.updated_by ? ` by ${c.updated_by}` : ''}` : '');
  };
  useEffect(() => {
    load().catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);

  if (!saved) return <p>Loading...</p>;
  const dirty = saved.size !== draft.size || [...draft].some((x) => !saved.has(x));

  const save = async () => {
    try {
      await saveCoach([...draft].sort((a, b) => a - b), session?.user.email ?? '');
      await load();
      setMsg({ ok: true, text: 'Coach hours saved.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <>
      <div className="card tip">
        Paint the times the coach can teach. The coach only needs to be free for the lesson hour itself (members handle
        the travel buffer). {meta && <span className="muted">{meta}.</span>}
      </div>
      <div className="toolbar">
        <button className="btn primary" disabled={!dirty} onClick={save}>
          Save coach hours
        </button>
        <button className="btn" disabled={!dirty} onClick={() => setDraft(new Set(saved))}>
          Undo changes
        </button>
        <button className="btn" onClick={() => setDraft(new Set())}>
          Clear all
        </button>
        {dirty && <span className="pill warn">Unsaved changes</span>}
      </div>
      {msg && <div className={`notice ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <Grid selected={draft} onChange={setDraft} />
    </>
  );
}
