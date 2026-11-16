import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import Roster from './Roster';
import CoachHours from './CoachHours';
import Heatmap from './Heatmap';
import Pairings from './Pairings';
import Saved from './Saved';
import Reset from './Reset';

export default function AdminHome() {
  const { isAdmin } = useAuth();
  if (!isAdmin)
    return (
      <div className="page narrow">
        <div className="card">
          <h1>Admins only</h1>
          <p>Your email is not on the admin list. Ask a club officer to add it in Supabase.</p>
        </div>
      </div>
    );
  return (
    <div className="page">
      <nav className="tabs">
        <NavLink to="roster">Roster</NavLink>
        <NavLink to="coach">Coach hours</NavLink>
        <NavLink to="heatmap">Heatmap</NavLink>
        <NavLink to="pairings">Pairings</NavLink>
        <NavLink to="saved">Saved results</NavLink>
        <NavLink to="reset">New semester</NavLink>
      </nav>
      <Routes>
        <Route index element={<Navigate to="roster" replace />} />
        <Route path="roster" element={<Roster />} />
        <Route path="coach" element={<CoachHours />} />
        <Route path="heatmap" element={<Heatmap />} />
        <Route path="pairings" element={<Pairings />} />
        <Route path="saved" element={<Saved />} />
        <Route path="reset" element={<Reset />} />
      </Routes>
    </div>
  );
}
