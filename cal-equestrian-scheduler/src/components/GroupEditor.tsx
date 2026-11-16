import { useMemo, useState } from 'react';
import { memberFreeFor, summarize, validateGroups, type Group, type Member } from '../lib/pairing';
import { DAY_NAMES, FIRST_START, LAST_START, lessonTimeLabel } from '../lib/time';

interface Props {
  initial: Group[];
  members: Member[];
  coachSlots: number[];
  defaultLabel: string;
  onSave: (groups: Group[], label: string, select: boolean) => Promise<void>;
  onCancel: () => void;
}

export default function GroupEditor({ initial, members, coachSlots, defaultLabel, onSave, onCancel }: Props) {
  const [groups, setGroups] = useState<Group[]>(() => initial.map((g) => ({ ...g, memberIds: [...g.memberIds] })));
  const [label, setLabel] = useState(defaultLabel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const sets = useMemo(() => new Map(members.map((m) => [m.id, new Set(m.slots)])), [members]);
  const drivers = members.filter((m) => m.isDriver).sort((a, b) => a.name.localeCompare(b.name));
  const riders = members.filter((m) => !m.isDriver).sort((a, b) => a.name.localeCompare(b.name));
  const warnings = validateGroups(groups, members, coachSlots);
  const summary = summarize(groups, members, coachSlots);

  const groupOf = (id: string) => groups.findIndex((g) => g.driverId === id || g.memberIds.includes(id));
  const free = (id: string, g: Group) => memberFreeFor(sets.get(id) ?? new Set(), g.day, g.start);
  const name = (id: string) => byId.get(id)?.name ?? 'Unknown (removed)';

  const update = (i: number, patch: Partial<Group>) =>
    setGroups((gs) => gs.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  const addRider = (i: number, id: string) => {
    if (!id) return;
    setGroups((gs) =>
      gs.map((g, j) =>
        j === i
          ? { ...g, memberIds: [...g.memberIds.filter((x) => x !== id), id] }
          : { ...g, memberIds: g.memberIds.filter((x) => x !== id) },
      ),
    );
  };

  const optionLabel = (m: Member, g: Group, gi: number) => {
    const where = groupOf(m.id);
    const bits = [m.name];
    if (!free(m.id, g)) bits.push('(not free)');
    if (where >= 0 && where !== gi) bits.push(`(in group ${where + 1}, will move)`);
    return bits.join(' ');
  };

  const save = async (select: boolean) => {
    setBusy(true);
    setError('');
    try {
      await onSave(groups, label.trim() || defaultLabel, select);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="editor">
      <div className="toolbar">
        <b>
          {summary.placedCount} of {members.length} placed in {summary.lessonCount} lessons
        </b>
        <button
          className="btn"
          onClick={() => setGroups((gs) => [...gs, { day: 0, start: FIRST_START, driverId: '', memberIds: [] }])}
        >
          Add group
        </button>
      </div>
      {warnings.length > 0 ? (
        <div className="notice warn">
          <b>Constraint warnings</b>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          You can still save, but double check these.
        </div>
      ) : (
        <div className="notice ok">All rules are satisfied.</div>
      )}

      <div className="group-cards">
        {groups.map((g, i) => (
          <div className="card group-card" key={i}>
            <div className="group-head">
              <b>Group {i + 1}</b>
              <button className="btn tiny danger" onClick={() => setGroups((gs) => gs.filter((_, j) => j !== i))}>
                Delete
              </button>
            </div>
            <div className="row">
              <select value={g.day} onChange={(e) => update(i, { day: Number(e.target.value) })}>
                {DAY_NAMES.map((d, di) => (
                  <option key={d} value={di}>
                    {d}
                  </option>
                ))}
              </select>
              <select value={g.start} onChange={(e) => update(i, { start: Number(e.target.value) })}>
                {Array.from({ length: LAST_START - FIRST_START + 1 }, (_, k) => FIRST_START + k).map((s) => (
                  <option key={s} value={s}>
                    {lessonTimeLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <label className="small">
              Driver
              <select
                value={g.driverId}
                onChange={(e) => {
                  const id = e.target.value;
                  setGroups((gs) =>
                    gs.map((x, j) =>
                      j === i ? { ...x, driverId: id } : x.driverId === id ? { ...x, driverId: '' } : x,
                    ),
                  );
                }}
              >
                <option value="">Choose a driver</option>
                {drivers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {optionLabel(m, g, i)}
                  </option>
                ))}
              </select>
            </label>
            <div className="small">Riders</div>
            <ul className="riders">
              {g.memberIds.map((id) => (
                <li key={id} className={free(id, g) ? '' : 'bad'}>
                  {name(id)}
                  {!free(id, g) && <span className="small"> (not free)</span>}
                  <button
                    className="btn tiny"
                    onClick={() => update(i, { memberIds: g.memberIds.filter((x) => x !== id) })}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            {g.memberIds.length < 3 && (
              <select value="" onChange={(e) => addRider(i, e.target.value)}>
                <option value="">Add a rider...</option>
                {riders
                  .filter((m) => !g.memberIds.includes(m.id))
                  .sort((a, b) => Number(free(b.id, g)) - Number(free(a.id, g)) || Number(groupOf(a.id) >= 0) - Number(groupOf(b.id) >= 0))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {optionLabel(m, g, i)}
                    </option>
                  ))}
              </select>
            )}
          </div>
        ))}
      </div>

      {summary.unplaced.length > 0 && (
        <details className="unplaced">
          <summary>Not placed ({summary.unplaced.length})</summary>
          <ul>
            {summary.unplaced.map((u) => (
              <li key={u.id}>
                <b>{name(u.id)}</b>: {u.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="toolbar">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name for this result" />
        <button className="btn primary" disabled={busy} onClick={() => save(true)}>
          Save as chosen pairing
        </button>
        <button className="btn" disabled={busy} onClick={() => save(false)}>
          Save as draft
        </button>
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && <div className="notice err">{error}</div>}
    </div>
  );
}
