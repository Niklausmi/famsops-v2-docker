import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Target, ClipboardList, Package, CreditCard, Users, Ticket, Car, TrendingUp } from 'lucide-react';
import { Topbar } from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { api } from '../api/client';
import { useAppStore } from '../store';
import { formatDate, ROLE_PAGES } from '../lib/utils';

const LEAD_STATUSES = [
  { s: 'New Lead',     color: 'var(--accent)' },
  { s: 'Contacted',   color: 'var(--accent2)' },
  { s: 'Interested',  color: 'var(--warn)' },
  { s: 'Negotiation', color: 'var(--accent3)' },
  { s: 'Won',         color: 'var(--success)' },
  { s: 'Lost',        color: 'var(--muted)' },
];

const QUICK_ACTIONS = [
  { icon: Target,        label: 'New Lead',       sub: 'Forward to sales',    to: '/leads?new=1',      roles: ['admin','sales'] },
  { icon: ClipboardList, label: 'New Job Order',  sub: 'Start installation',  to: '/job-orders?new=1', roles: ['admin','operations'] },
  { icon: Package,       label: 'Stock In',       sub: 'Add to inventory',    to: '/inventory?new=1',  roles: ['admin','operations'] },
  { icon: Ticket,        label: 'New Ticket',     sub: 'Log query/complaint', to: '/tickets?new=1',    roles: ['admin','sales','operations'] },
  { icon: Users,         label: 'Customers',      sub: 'View customer DB',    to: '/customers',        roles: ['admin','sales','operations','management'] },
  { icon: Car,           label: 'Assets',         sub: 'Fleet registry',      to: '/assets',           roles: ['admin','sales','operations','management'] },
];

export default function Dashboard() {
  const { user } = useAppStore();
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const allowed = ROLE_PAGES[user?.role] || [];

  useEffect(() => {
    api.dashboard.stats()
      .then(r => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const date = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const actions = QUICK_ACTIONS.filter(a => a.roles.includes(user?.role));

  return (
    <>
      <Topbar
        title="Dashboard"
        subtitle={`Welcome back, ${user?.name || ''} · ${date}`}
      />
      <PageContent>

        {/* Stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          <StatTile label="Total Leads"        value={loading ? '…' : stats?.leads?.total}     sub="All time"  icon={<Target size={24} />}        color="t-cyan" />
          <StatTile label="Job Orders"         value={loading ? '…' : stats?.jobs?.total}      sub="All time"  icon={<ClipboardList size={24} />}  color="t-purple" />
          <StatTile label="Trackers Available" value={loading ? '…' : stats?.trackers?.available} sub="In stock" icon={<Package size={24} />}     color="t-green" />
          <StatTile label="SIMs Available"     value={loading ? '…' : stats?.sims?.available}  sub="Active"    icon={<CreditCard size={24} />}     color="t-warn" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Quick Actions */}
          <div className="card">
            <div className="section-head">
              <div className="section-icon si-cyan"><TrendingUp size={15} /></div>
              <div>
                <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700 }}>Quick Actions</h2>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Jump to key tasks</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {actions.slice(0, 6).map(a => (
                <Link
                  key={a.to}
                  to={a.to}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: 16,
                    textDecoration: 'none',
                    display: 'block',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <a.icon size={20} style={{ color: 'var(--accent)', marginBottom: 8 }} />
                  <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>{a.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{a.sub}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* Lead Funnel */}
          <div className="card">
            <div className="section-head">
              <div className="section-icon si-purple"><Target size={15} /></div>
              <div>
                <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700 }}>Lead Conversion Funnel</h2>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Status breakdown</p>
              </div>
            </div>
            {loading ? (
              <div style={{ color: 'var(--muted)', fontSize: 12, padding: '20px 0' }}>Loading…</div>
            ) : stats?.leads?.byStatus ? (
              LEAD_STATUSES.map(({ s, color }) => {
                const cnt = stats.leads.byStatus[s] || 0;
                const pct = stats.leads.total ? Math.round(cnt / stats.leads.total * 100) : 0;
                return (
                  <div key={s} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{s}</span>
                      <span style={{ fontSize: 11, color, fontWeight: 500 }}>{cnt}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state"><div className="ei">📊</div><p>No lead data</p></div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Recent Job Orders */}
          <div className="card">
            <div className="section-head">
              <div className="section-icon si-purple"><ClipboardList size={15} /></div>
              <div>
                <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700 }}>Recent Job Orders</h2>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Last 5 installations</p>
              </div>
            </div>
            {(stats?.jobs?.recent || []).map((j, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{j.customer || '—'}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{j.vehicle} · {j.invoiceNumber}</div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'right' }}>
                  <div style={{ color: 'var(--accent2)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{j.toc}</div>
                  {formatDate(j.date)}
                </div>
              </div>
            ))}
            {(!stats?.jobs?.recent?.length) && !loading && (
              <div className="empty-state"><div className="ei">📋</div><p>No recent job orders</p></div>
            )}
          </div>

          {/* Inventory Snapshot */}
          <div className="card">
            <div className="section-head">
              <div className="section-icon si-warn"><Package size={15} /></div>
              <div>
                <h2 style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700 }}>Inventory Snapshot</h2>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Current stock levels</p>
              </div>
            </div>
            {['trackers', 'sims'].map(k => {
              const d = stats?.[k];
              if (!d) return null;
              const pct = d.total ? Math.round(d.available / d.total * 100) : 0;
              const col = pct > 50 ? 'var(--success)' : pct > 20 ? 'var(--warn)' : 'var(--danger)';
              return (
                <div key={k} style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, textTransform: 'capitalize' }}>{k}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {d.available} available · {d.assigned} {k === 'sims' ? 'installed' : 'assigned'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 80, height: 5, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 14, fontFamily: 'var(--display)', fontWeight: 700, color: col, width: 30, textAlign: 'right' }}>
                      {d.available}
                    </span>
                  </div>
                </div>
              );
            })}
            {loading && <div style={{ color: 'var(--muted)', fontSize: 12, padding: '20px 0' }}>Loading…</div>}
          </div>
        </div>

      </PageContent>
    </>
  );
}
