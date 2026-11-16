import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GroupsView from '../../components/GroupsView';
import GroupEditor from '../../components/GroupEditor';
import { getCoach, getRoster, rosterToMembers, savePairing, toSavedData, type RosterEntry } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { downloadText, pairingCsv } from '../../lib/csv';
import { generatePairings, summarize, type Group, type PairingOption } from '../../lib/pairing';

export default function Pairings() {
  const { session } = useAuth();
  const nav = useNavigate();
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [coach, setCoach] = useState<number[]>([]);
  const [options, setOptions] = useState<PairingOption[] | null>(null);
  const [picked, setPicked] = useState(0);
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getRoster(), getCoach()])
      .then(([r, c]) => {
        setRoster(r);
        setCoach(c.slots);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="notice err">{error}</div>;
  if (!roster) return <p>Loading...</p>;

  const members = rosterToMembers(roster);
  const names = Object.fromEntries(roster.map((r) => [r.id, r.name]));
  const emails = Object.fromEntries(roster.map((r) => [r.id, r.email]));

  const run = () => {
    setRunning(true);
    setEditing(false);
    // Let the spinner paint before the search starts.
    setTimeout(() => {
      const res = generatePairings(members, coach, { maxOptions: 5, timeLimitMs: 2500, seed: Date.now() % 100000 });
      setOptions(res);
      setPicked(0);
      setRunning(false);
    }, 30);
  };

  const opt = options?.[picked];

  const save = async (groups: Group[], label: string, select: boolean) => {
    const s = summarize(groups, members, coach);
    await savePairing(label, toSavedData({ groups, ...s }, roster), session?.user.email ?? '', select);
    nav('/admin/saved');
  };

  return (
    <>
      <div className="card tip">
        Generate builds several complete pairings and ranks them: most members placed first, then fewest lessons (fuller
        groups). Each group has exactly 1 driver and 1 to 3 non-drivers, everyone is free for the 3-hour window, the
        coach is free for the lesson hour, lessons never overlap, and nobody gets more than one lesson.
      </div>
      <div className="toolbar">
        <button className="btn primary" onClick={run} disabled={running}>
          {running ? 'Searching...' : options ? 'Generate again' : 'Generate pairing options'}
        </button>
        <span className="muted small">
          {members.length} members, {members.filter((m) => m.isDriver).length} drivers,{' '}
          {coach.length ? `${coach.length / 2} coach hours` : 'no coach hours set yet'}
        </span>
      </div>

      {options && (
        <>
          <div className="options">
            {options.map((o, i) => (
              <button
                key={i}
                className={`option ${i === picked ? 'active' : ''}`}
                onClick={() => {
                  setPicked(i);
                  setEditing(false);
                }}
              >
                <div className="opt-title">Option {o.rank}</div>
                <div>
                  <b>{o.placedCount}</b>/{o.totalMembers} placed
                </div>
                <div>{o.lessonCount} lessons</div>
                <div className="small muted">Score {o.score}</div>
              </button>
            ))}
          </div>
          {opt && !editing && (
            <div className="card">
              <div className="group-head">
                <h2>Option {opt.rank}</h2>
                <div className="actions">
                  <button className="btn primary" onClick={() => save(opt.groups, `Option ${opt.rank} (${new Date().toLocaleDateString()})`, true)}>
                    Choose and save
                  </button>
                  <button className="btn" onClick={() => setEditing(true)}>
                    Edit by hand
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      downloadText(`pairing-option-${opt.rank}.csv`, pairingCsv(opt.groups, opt.unplaced, names, emails))
                    }
                  >
                    Download CSV
                  </button>
                </div>
              </div>
              {opt.groups.length === 0 && (
                <p>No groups could be formed. Check that coach hours are set and members have submitted schedules.</p>
              )}
              <GroupsView groups={opt.groups} unplaced={opt.unplaced} names={names} />
            </div>
          )}
          {opt && editing && (
            <div className="card">
              <h2>Editing option {opt.rank}</h2>
              <GroupEditor
                initial={opt.groups}
                members={members}
                coachSlots={coach}
                defaultLabel={`Option ${opt.rank}, edited (${new Date().toLocaleDateString()})`}
                onSave={save}
                onCancel={() => setEditing(false)}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}
