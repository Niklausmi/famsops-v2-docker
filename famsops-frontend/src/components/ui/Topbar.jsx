import { useEffect, useState } from 'react';
import { useAppStore } from '../../store';

export function Topbar({ title, subtitle, actions }) {
  const [time, setTime] = useState('');
  const { navCollapsed } = useAppStore();

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="crm-topbar"
      style={{ marginLeft: navCollapsed ? 58 : 220, transition: 'margin-left 0.25s' }}
    >
      <div>
        <div style={{
          fontFamily: 'var(--display)', fontSize: 16,
          fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text)',
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.8px', marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {actions}
        <div style={{
          fontSize: 11, color: 'var(--muted)',
          letterSpacing: '0.5px', fontVariantNumeric: 'tabular-nums',
        }}>
          {time}
        </div>
      </div>
    </div>
  );
}
