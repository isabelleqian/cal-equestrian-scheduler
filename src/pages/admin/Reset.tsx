import { useState } from 'react';
import { resetSemester } from '../../lib/api';

export default function Reset() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const go = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await resetSemester();
      setText('');
      setMsg({ ok: true, text: 'Done. Every grid is now empty and members can enter their new schedules.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  };

  return (
    <div className="card narrow-card">
      <h2>Start a new semester</h2>
      <p>This will:</p>
      <ul>
        <li>Clear every member's weekly availability.</li>
        <li>Clear the coach's hours.</li>
        <li>Unmark the chosen pairing (saved results stay for reference).</li>
      </ul>
      <p>
        Member accounts, names and driver status are kept. Members can update them on their profile page. Download a CSV
        of anything you want to keep first.
      </p>
      <p>
        Type <b>RESET</b> to confirm.
      </p>
      <div className="toolbar">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="RESET" />
        <button className="btn danger" disabled={text !== 'RESET' || busy} onClick={go}>
          {busy ? 'Resetting...' : 'Reset for new semester'}
        </button>
      </div>
      {msg && <div className={`notice ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
    </div>
  );
}
