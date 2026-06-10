import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '../../store';
import { Sidebar } from '../Sidebar';

export function Layout() {
  const { user, navCollapsed, initTheme, _hydrated } = useAppStore();

  useEffect(() => { initTheme(); }, []);

  // ── Wait for Zustand to rehydrate from localStorage ──────
  // Without this guard, the first render always sees user=null
  // (localStorage hasn't loaded yet) and redirects to /login,
  // creating the login → dashboard → login loop.
  if (!_hydrated) {
    return (
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        height:         '100vh',
        background:     'var(--bg)',
        color:          'var(--muted)',
        fontFamily:     'monospace',
        fontSize:       11,
        letterSpacing:  2,
        textTransform:  'uppercase',
      }}>
        Loading…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{
        flex:       1,
        marginLeft: navCollapsed ? 58 : 220,
        transition: 'margin-left 0.25s',
        position:   'relative',
        zIndex:     1,
      }}>
        <Outlet />
      </main>
    </div>
  );
}

export function PageContent({ children }) {
  return (
    <div style={{ padding: '28px 32px' }} className="animate-fade-up">
      {children}
    </div>
  );
}
