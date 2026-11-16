import type { Group, Unplaced } from '../lib/pairing';
import { DAY_NAMES, lessonTimeLabel, travelWindowLabel } from '../lib/time';

interface Props {
  groups: Group[];
  unplaced: Unplaced[];
  names: Record<string, string>;
}

export default function GroupsView({ groups, unplaced, names }: Props) {
  const n = (id: string) => names[id] ?? 'Unknown (removed)';
  const sorted = [...groups].sort((a, b) => a.day - b.day || a.start - b.start);
  return (
    <>
      <table className="data">
        <thead>
          <tr>
            <th>#</th>
            <th>Day</th>
            <th>Lesson</th>
            <th>Travel window</th>
            <th>Driver</th>
            <th>Riders</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((g, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{DAY_NAMES[g.day]}</td>
              <td>{lessonTimeLabel(g.start)}</td>
              <td className="small muted">{travelWindowLabel(g.start)}</td>
              <td>
                <span className="tag driver">{n(g.driverId)}</span>
              </td>
              <td>
                {g.memberIds.map((id) => (
                  <span key={id} className="tag">
                    {n(id)}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {unplaced.length > 0 && (
        <details className="unplaced" open={unplaced.length <= 8}>
          <summary>Not placed ({unplaced.length})</summary>
          <ul>
            {unplaced.map((u) => (
              <li key={u.id}>
                <b>{n(u.id)}</b>: {u.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
