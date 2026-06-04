import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export function DataTable({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data',
  loading = false,
  pageSize = 25,
}) {
  const [page, setPage]         = useState(1);
  const [sortKey, setSortKey]   = useState(null);
  const [sortDir, setSortDir]   = useState('asc');

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = String(a[sortKey] || '').toLowerCase();
        const bv = String(b[sortKey] || '').toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      })
    : data;

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const slice      = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  return (
    <div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                  style={{ cursor: col.sortable !== false ? 'pointer' : 'default', userSelect: 'none' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === 'asc'
                        ? <ChevronUp size={10} style={{ color: 'var(--accent)' }} />
                        : <ChevronDown size={10} style={{ color: 'var(--accent)' }} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</td></tr>
            ) : slice.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>{emptyMessage}</td></tr>
            ) : (
              slice.map((row, i) => (
                <tr
                  key={row.id || i}
                  onClick={() => onRowClick?.(row)}
                  style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map(col => (
                    <td key={col.key} style={col.style}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 14, flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div style={{ display: 'flex', gap: 5 }}>
            <button className="btn btn-ghost btn-sm" disabled={safePage === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const n = safePage <= 4 ? i + 1 : safePage + i - 3;
              if (n < 1 || n > totalPages) return null;
              return (
                <button
                  key={n}
                  className={cn('btn btn-ghost btn-sm', safePage === n && 'btn-primary')}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              );
            })}
            <button className="btn btn-ghost btn-sm" disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
