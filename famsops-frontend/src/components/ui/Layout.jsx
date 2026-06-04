import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '../../store';
import { Sidebar } from '../Sidebar';

export function Layout() {
  const { user, navCollapsed, initTheme } = useAppStore();

  useEffect(() => { initTheme(); }, []);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          marginLeft: navCollapsed ? 58 : 220,
          transition: 'margin-left 0.25s',
          position: 'relative',
          zIndex: 1,
        }}
      >
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
