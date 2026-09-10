import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import NotificationsBell from './NotificationsBell';

export default function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const navLinks = (
    <nav>
      {user?.role === 'admin' && (
        <>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/students">Students</NavLink>
          <NavLink to="/admissions">Admissions</NavLink>
          <NavLink to="/classes">Classes</NavLink>
          <NavLink to="/results">Results</NavLink>
          <NavLink to="/finance">Finance</NavLink>
          <NavLink to="/announcements">Announcements</NavLink>
          <NavLink to="/users">Users</NavLink>
        </>
      )}
      {user?.role === 'teacher' && (
        <>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/attendance">Attendance</NavLink>
          <NavLink to="/grades">Grades</NavLink>
        </>
      )}
      {user?.role === 'parent' && (
        <NavLink to="/" end>
          My Children
        </NavLink>
      )}
    </nav>
  );

  return (
    <div className="app-shell">
      {menuOpen && <div className="app-sidebar-backdrop" onClick={() => setMenuOpen(false)} />}

      <aside className={menuOpen ? 'app-sidebar app-sidebar-open' : 'app-sidebar'}>
        <span className="brand">SMIS</span>
        {navLinks}
        <div className="sidebar-user">
          <div>
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
          <button onClick={logout}>Log out</button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button className="mobile-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="mobile-brand">SMIS</span>
          <NotificationsBell />
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
