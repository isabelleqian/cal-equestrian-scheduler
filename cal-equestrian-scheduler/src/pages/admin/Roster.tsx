import { useEffect, useState } from 'react';
import { adminDeleteProfile, adminUpdateProfile, getRoster, type RosterEntry } from '../../lib/api';

export default function Roster() {
  const [rows, setRows] = useState<RosterEntry[] | null>(null);
  const [error, setError] = useState('');

  const load = () => getRoster().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  if (error) return <div className="notice err">{error}</div>;
  if (!rows) return <p>Loading roster...</p>;

  const drivers = rows.filter((r) => r.is_driver);
  const riders = rows.filter((r) => !r.is_driver);
  const submitted = rows.filter((r) => r.slots.length > 0);

  const toggleDriver = async (r: RosterEntry) => {
    await adminUpdateProfile(r.id, { is_driver: !r.is_driver }).catch((e) => setError(e.message));
    void load();
  };
  const remove = async (r: RosterEntry) => {
    if (!confirm(`Remove ${r.name} and their availability? They can sign up again later.`)) return;
    await adminDeleteProfile(r.id).catch((e) => setError(e.message));
    void load();
  };

  const table = (title: string, list: RosterEntry[]) => (
    <div className="card">
      <h2>
        {title} <span className="muted">({list.length})</span>
      </h2>
      {list.length === 0 ? (
        <p className="muted">Nobody yet.</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Availability</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="small">{r.email}</td>
                <td>
                  {r.slots.length ? (
                    <span className="pill ok" title={r.availability_updated_at ?? ''}>
                      {(r.slots.length / 2).toFixed(1)} h, updated{' '}
                      {r.availability_updated_at ? new Date(r.availability_updated_at).toLocaleDateString() : ''}
                    </span>
                  ) : (
                    <span className="pill warn">Not submitted</span>
                  )}
                </td>
                <td className="actions">
                  <button className="btn tiny" onClick={() => toggleDriver(r)}>
                    Mark as {r.is_driver ? 'non-driver' : 'driver'}
                  </button>
                  <button className="btn tiny danger" onClick={() => remove(r)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <>
      <div className="stats">
        <div className="stat">
          <b>{rows.length}</b> members
        </div>
        <div className="stat">
          <b>{drivers.length}</b> drivers
        </div>
        <div className="stat">
          <b>{riders.length}</b> non-drivers
        </div>
        <div className="stat">
          <b>{submitted.length}</b> submitted
        </div>
      </div>
      {table('Drivers', drivers)}
      {table('Non-drivers', riders)}
    </>
  );
}
