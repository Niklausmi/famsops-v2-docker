import { X } from 'lucide-react';

export function Drawer({ open, onClose, title, subtitle, actions, children, width = 680 }) {
  if (!open) return null;
  return (
    <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="drawer" style={{ maxWidth: width }}>
        {/* Header */}
        <div style={{
          padding: '22px 26px 16px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0,
          background: 'var(--surface)', zIndex: 10,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>
                {title}
              </div>
              {subtitle && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{subtitle}</div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none',
                color: 'var(--muted)', fontSize: 20,
                cursor: 'pointer', padding: '4px 8px',
                borderRadius: 6, transition: 'color 0.15s',
                flexShrink: 0, marginLeft: 14,
                display: 'flex', alignItems: 'center',
              }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--muted)'}
            >
              <X size={18} />
            </button>
          </div>
          {actions && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {actions}
            </div>
          )}
        </div>
        {/* Body */}
        <div style={{ padding: '22px 26px', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function DrawerSection({ title }) {
  return (
    <div style={{
      fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
      color: 'var(--muted)', margin: '18px 0 10px',
      paddingBottom: 6, borderBottom: '1px solid var(--border)',
    }}>
      {title}
    </div>
  );
}

export function InfoGrid({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {children}
    </div>
  );
}

export function InfoItem({ label, value }) {
  return (
    <div style={{
      background: 'var(--surface2)',
      borderRadius: 8, padding: '9px 12px',
    }}>
      <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text)', wordBreak: 'break-word' }}>
        {value || '—'}
      </div>
    </div>
  );
}
