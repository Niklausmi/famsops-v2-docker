import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '../../api/client';

/**
 * CustomerSearch — reusable autocomplete customer picker.
 *
 * Props:
 *   value       {object|null}  — currently selected customer { customerId, customerName, ... }
 *   onChange    {fn}           — called with the full customer object when selected
 *   onClear     {fn}           — called when X is clicked
 *   placeholder {string}
 *   error       {string}
 *   disabled    {bool}
 */
export function CustomerSearch({ value, onChange, onClear, placeholder = 'Search customer name, contact, RAC…', error, disabled }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const wrapRef               = useRef(null);
  const debounceRef           = useRef(null);

  // When a value is already selected, show it in the box
  useEffect(() => {
    if (value?.customerName) setQuery(value.customerName);
    else setQuery('');
  }, [value?.customerId]);

  // Click-outside to close
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = (q) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.customers.list({ search: q, limit: 10 });
        setResults(data.data || data || []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 280);
  };

  const select = (c) => {
    setQuery(c.customerName);
    setResults([]);
    setOpen(false);
    onChange?.(c);
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    onClear?.();
  };

  const isSelected = !!value?.customerId;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{
          position: 'absolute', left: 12, top: '50%',
          transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none',
        }} />
        <input
          className="field-input"
          style={{
            paddingLeft: 34, paddingRight: isSelected ? 34 : 12,
            borderColor: error ? 'rgba(255,95,109,0.5)'
              : isSelected ? 'rgba(61,255,160,0.3)'
              : undefined,
            background: isSelected ? 'rgba(61,255,160,0.04)' : undefined,
          }}
          placeholder={placeholder}
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => query && results.length && setOpen(true)}
          disabled={disabled}
          autoComplete="off"
        />
        {isSelected && (
          <button
            type="button"
            onClick={clear}
            style={{
              position: 'absolute', right: 10, top: '50%',
              transform: 'translateY(-50%)', background: 'none',
              border: 'none', color: 'var(--muted)', cursor: 'pointer',
              padding: 2, display: 'flex', alignItems: 'center',
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Selected customer pill */}
      {isSelected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginTop: 8, padding: '8px 12px',
          background: 'rgba(61,255,160,0.06)',
          border: '1px solid rgba(61,255,160,0.2)',
          borderRadius: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            background: 'linear-gradient(135deg,var(--accent2),var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Syne', fontSize: 10, fontWeight: 800, color: '#0a0c0f',
          }}>
            {(value.customerName||'?').slice(0,2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value.customerName}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
              {[value.contact, value.city, value.rac].filter(Boolean).join(' · ')}
            </div>
          </div>
          <span style={{ fontSize: 9, color: 'var(--success)', letterSpacing: 1, textTransform: 'uppercase' }}>Selected</span>
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border-hi)',
          borderRadius: 12, maxHeight: 280, overflowY: 'auto',
          zIndex: 300, boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
        }}>
          {loading ? (
            <div style={{ padding: '14px 16px', fontSize: 11, color: 'var(--muted)' }}>Searching…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 11, color: 'var(--muted)' }}>No customers found</div>
          ) : results.map(c => (
            <div
              key={c.customerId}
              onClick={() => select(c)}
              style={{
                padding: '11px 16px', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                transition: 'background 0.1s',
                display: 'flex', alignItems: 'center', gap: 10,
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(56,217,245,0.05)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                background: 'linear-gradient(135deg,var(--accent2),var(--accent))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Syne', fontSize: 10, fontWeight: 800, color: '#0a0c0f',
              }}>
                {(c.customerName||'?').slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.customerName}
                  {c.company && <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>{c.company}</span>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                  {[c.contact, c.city, c.rac && `RAC: ${c.rac}`].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace', flexShrink: 0 }}>{c.customerId}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 5 }}>⚠ {error}</div>
      )}
    </div>
  );
}
