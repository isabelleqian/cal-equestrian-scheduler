import { useEffect, useMemo, useState } from 'react';
import Grid from '../../components/Grid';
import { getCoach, getRoster, type RosterEntry } from '../../lib/api';
import { allLessonTimes, coachFreeFor, memberFreeFor } from '../../lib/pairing';
import { DAY_NAMES, TOTAL_CELLS, lessonTimeLabel } from '../../lib/time';

type Filter = 'all' | 'drivers' | 'riders';

export default function Heatmap() {
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [coach, setCoach] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getRoster(), getCoach()])
      .then(([r, c]) => {
        setRoster(r);
        setCoach(new Set(c.slots));
      })
      .catch((e) => setError(e.message));
  }, []);

  const people = useMemo(
    () => (roster ?? []).filter((r) => (filter === 'all' ? true : filter === 'drivers' ? r.is_driver : !r.is_driver)),
    [roster, filter],
  );
  const counts = useMemo(() => {
    const c = new Array(TOTAL_CELLS).fill(0);
    people.forEach((p) => p.slots.forEach((s) => c[s]++));
    return c;
  }, [people]);
  const namesBySlot = useMemo(() => {
    const m = new Map<number, string[]>();
    people.forEach((p) => p.slots.forEach((s) => m.set(s, [...(m.get(s) ?? []), p.name])));
    return m;
  }, [people]);

  const starts = useMemo(() => {
    if (!roster) return [];
    const sets = roster.map((r) => ({ r, s: new Set(r.slots) }));
    return allLessonTimes()
      .filter((t) => coachFreeFor(coach, t.day, t.start))
      .map((t) => {
        const free = sets.filter(({ s }) => memberFreeFor(s, t.day, t.start)).map(({ r }) => r);
        return { ...t, drivers: free.filter((r) => r.is_driver), riders: free.filter((r) => !r.is_driver) };
      });
  }, [roster, coach]);

  if (error) return <div className="notice err">{error}</div>;
  if (!roster) return <p>Loading...</p>;

  return (
    <>
      <div className="toolbar">
        <span>Show:</span>
        {(['all', 'drivers', 'riders'] as Filter[]).map((f) => (
          <button key={f} className={`btn ${filter === f ? 'primary' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Everyone' : f === 'drivers' ? 'Drivers' : 'Non-drivers'}
          </button>
        ))}
        <span className="muted small">
          Numbers show how many people are free in each half hour. Gold outline marks coach hours. Hover for names.
        </span>
      </div>
      <Grid
        counts={counts}
        maxCount={Math.max(1, people.length)}
        outline={coach}
        titleFor={(k) => (namesBySlot.get(k) ?? []).join(', ') || 'Nobody'}
      />
      <div className="card">
        <h2>Possible lesson times</h2>
        <p className="muted">
          Lesson hours inside coach hours, with the people who are free for the whole 3-hour window (travel, lesson,
          travel).
        </p>
        {starts.length === 0 ? (
          <p>No coach hours yet. Add them on the Coach hours tab.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Day</th>
                <th>Lesson</th>
                <th>Drivers free</th>
                <th>Non-drivers free</th>
              </tr>
            </thead>
            <tbody>
              {starts.map((t) => (
                <tr key={`${t.day}-${t.start}`} className={t.drivers.length && t.riders.length ? '' : 'dim'}>
                  <td>{DAY_NAMES[t.day]}</td>
                  <td>{lessonTimeLabel(t.start)}</td>
                  <td title={t.drivers.map((r) => r.name).join(', ')}>{t.drivers.length}</td>
                  <td title={t.riders.map((r) => r.name).join(', ')}>{t.riders.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
