import { useEffect, useState } from 'react';
import GroupsView from '../../components/GroupsView';
import GroupEditor from '../../components/GroupEditor';
import {
  deletePairing,
  getCoach,
  getRoster,
  listPairings,
  rosterToMembers,
  savePairing,
  selectPairing,
  toSavedData,
  type RosterEntry,
  type SavedPairing,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { downloadText, pairingCsv } from '../../lib/csv';
import { summarize, type Group } from '../../lib/pairing';

export default function Saved() {
  const { session } = useAuth();
  const [list, setList] = useState<SavedPairing[] | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [coach, setCoach] = useState<number[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = () =>
    Promise.all([listPairings(), getRoster(), getCoach()])
      .then(([l, r, c]) => {
        setList(l);
        setRoster(r);
        setCoach(c.slots);
        setOpen((o) => o ?? l.find((p) => p.is_selected)?.id ?? null);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  if (error) return <div className="notice err">{error}</div>;
  if (!list) return <p>Loading...</p>;
  if (list.length === 0) return <p>No saved results yet. Generate options on the Pairings tab and save one.</p>;

  const members = rosterToMembers(roster);

  const saveEdit = async (groups: Group[], label: string, select: boolean) => {
    const s = summarize(groups, members, coach);
    await savePairing(label, toSavedData({ groups, ...s }, roster), session?.user.email ?? '', select);
    setEditing(null);
    setOpen(null);
    await load();
  };

  return (
    <>
      {list.map((p) => {
        const names = { ...p.data.names, ...Object.fromEntries(roster.map((r) => [r.id, r.name])) };
        const emails = { ...p.data.emails, ...Object.fromEntries(roster.map((r) => [r.id, r.email])) };
        return (
          <div key={p.id} className={`card ${p.is_selected ? 'chosen' : ''}`}>
            <div className="group-head">
              <div>
                <h2>
                  {p.label || `Result ${p.id}`} {p.is_selected && <span className="pill gold">Chosen</span>}
                </h2>
                <div className="small muted">
                  {p.data.placedCount} placed in {p.data.lessonCount} lessons. Saved {new Date(p.created_at).toLocaleString()}
                  {p.created_by ? ` by ${p.created_by}` : ''}
                </div>
              </div>
              <div className="actions">
                <button className="btn tiny" onClick={() => setOpen(open === p.id ? null : p.id)}>
                  {open === p.id ? 'Hide' : 'View'}
                </button>
                {!p.is_selected && (
                  <button className="btn tiny" onClick={() => selectPairing(p.id).then(load)}>
                    Mark as chosen
                  </button>
                )}
                <button
                  className="btn tiny"
                  onClick={() => {
                    setOpen(p.id);
                    setEditing(p.id);
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn tiny"
                  onClick={() =>
                    downloadText(
                      `${(p.label || 'pairing').replace(/[^a-z0-9]+/gi, '-')}.csv`,
                      pairingCsv(p.data.groups, p.data.unplaced, names, emails),
                    )
                  }
                >
                  CSV
                </button>
                <button
                  className="btn tiny danger"
                  onClick={() => confirm('Delete this saved result?') && deletePairing(p.id).then(load)}
                >
                  Delete
                </button>
              </div>
            </div>
            {open === p.id && editing !== p.id && (
              <GroupsView groups={p.data.groups} unplaced={p.data.unplaced} names={names} />
            )}
            {editing === p.id && (
              <GroupEditor
                initial={p.data.groups}
                members={members}
                coachSlots={coach}
                defaultLabel={`${p.label || 'Result'} (edited)`}
                onSave={saveEdit}
                onCancel={() => setEditing(null)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
