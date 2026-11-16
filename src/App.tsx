import { HashRouter, Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { isConfigured } from './lib/supabase';
import { AuthProvider, useAuth } from './lib/auth';
import Setup from './pages/Setup';
import Login from './pages/Login';
import ProfileForm from './pages/ProfileForm';
import MyAvailability from './pages/MyAvailability';
import AdminHome from './pages/admin/AdminHome';

function Header() {
  const { session, isAdmin, signOut, profile } = useAuth();
  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <span className="logo">C</span>
        <span>
          Cal Equestrian <span className="brand-sub">Lesson Scheduler</span>
        </span>
      </Link>
      {session && (
        <nav className="topnav">
          {profile && <NavLink to="/" end>My schedule</NavLink>}
          {profile && <NavLink to="/profile">Profile</NavLink>}
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
          <button className="btn tiny ghost" onClick={signOut}>
            Sign out
          </button>
        </nav>
      )}
    </header>
  );
}

function Shell() {
  const { loading, session, profile } = useAuth();
  if (loading) return <div className="page">Loading...</div>;
  if (!session) return <Login />;
  if (!profile) return <ProfileForm />;
  return (
    <Routes>
      <Route path="/" element={<MyAvailability />} />
      <Route path="/profile" element={<ProfileForm />} />
      <Route path="/admin/*" element={<AdminHome />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  if (!isConfigured) return <Setup />;
  return (
    <AuthProvider>
      <HashRouter>
        <Header />
        <main>
          <Shell />
        </main>
        <footer className="footer">Cal Equestrian Team, UC Berkeley</footer>
      </HashRouter>
    </AuthProvider>
  );
}
