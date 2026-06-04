import { cn } from '../../lib/utils';

export function StatTile({ label, value, sub, icon, color = 't-cyan', className }) {
  return (
    <div className={cn('stat-tile', color, className)}>
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--display)', fontSize: 28, fontWeight: 800, lineHeight: 1, marginBottom: 4, color: 'var(--text)' }}>
        {value ?? '—'}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{sub}</div>}
      {icon && (
        <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 24, opacity: 0.12 }}>
          {icon}
        </div>
      )}
    </div>
  );
}
