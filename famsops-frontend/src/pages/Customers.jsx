import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, RefreshCw, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Topbar } from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { Drawer, DrawerSection, InfoGrid, InfoItem } from '../components/ui/Drawer';
import { Modal, ModalButtons } from '../components/ui/Modal';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { api } from '../api/client';
import { formatDate, genId, CITIES } from '../lib/utils';

const BLANK = {
  customerId: '', customerName: '', contact: '', email: '',
  cnic: '', father: '', company: '', rac: '', designation: '',
  industry: '', customerType: 'individual', preferredPayment: '',
  city: '', area: '', address: '', notes: '',
};

export default function Customers() {
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [sortBy, setSortBy]         = useState('name');
  const [page, setPage]             = useState(1);
  const [hubData, setHubData]       = useState(null);
  const [hubLoading, setHubLoading] = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState(BLANK);
  const [saving, setSaving]         = useState(false);
  const [formErr, setFormErr]       = useState('');
  const navigate = useNavigate();
  const PP = 24;

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.customers.list(); setCustomers(data.data || data || []); }
    catch { setCustomers([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let r = customers;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(c => [c.customerName, c.contact, c.company, c.cnic, c.rac, c.customerId, c.email, c.city]
        .some(v => (v || '').toLowerCase().includes(q)));
    }
    if (cityFilter) r = r.filter(c => c.city === cityFilter);
    if (sortBy === 'name')   r = [...r].sort((a,b) => (a.customerName||'').localeCompare(b.customerName||''));
    if (sortBy === 'recent') r = [...r].sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));
    if (sortBy === 'jobs')   r = [...r].sort((a,b) => (b.totalJobs||0) - (a.totalJobs||0));
    return r;
  }, [customers, search, cityFilter, sortBy]);

  const pages = Math.max(1, Math.ceil(filtered.length / PP));
  const slice = filtered.slice((page-1)*PP, page*PP);

  const openHub = async (c) => {
    setHubLoading(true);
    setHubData({ customer: c, assets: [], tickets: [], jobs: [], leads: [] });
    try { const { data } = await api.customers.hub(c.customerId); setHubData(data); }
    catch { }
    finally { setHubLoading(false); }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.customerName) { setFormErr('Customer name is required'); return; }
    if (!form.contact)      { setFormErr('Contact number is required'); return; }
    if (!form.city)         { setFormErr('City is required'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload = { ...form, customerId: form.customerId || genId('CUST') };
      await api.customers.create(payload);
      setShowAdd(false); setForm(BLANK); load();
    } catch(e) { setFormErr(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const c = hubData?.customer;

  return (
    <>
      <Topbar
        title="Customers"
        subtitle="Start here — search or create a customer"
        actions={
          <button className="btn btn-solid btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={13} /> New Customer
          </button>
        }
      />
      <PageContent>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
          <StatTile label="Total Customers" value={customers.length} color="t-cyan" />
          <StatTile label="Total Assets"    value={customers.reduce((n,c) => n + (c.totalJobs||0), 0)} color="t-purple" />
          <StatTile label="Cities"          value={[...new Set(customers.map(c => c.city).filter(Boolean))].length} color="t-green" />
          <StatTile label="Showing"         value={filtered.length} sub="after filters" color="t-warn" />
        </div>

        {/* Search */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                className="field-input"
                style={{ paddingLeft: 34 }}
                placeholder="Search name, contact, company, CNIC, RAC, ID…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select className="field-input" style={{ width: 160, appearance: 'none', cursor: 'pointer' }}
              value={cityFilter} onChange={e => { setCityFilter(e.target.value); setPage(1); }}>
              <option value="">All Cities</option>
              {[...new Set(customers.map(c => c.city).filter(Boolean))].sort().map(city => (
                <option key={city}>{city}</option>
              ))}
            </select>
            <select className="field-input" style={{ width: 140, appearance: 'none', cursor: 'pointer' }}
              value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="name">Name A–Z</option>
              <option value="recent">Recently Added</option>
              <option value="jobs">Most Jobs</option>
            </select>
            <button className="btn btn-ghost btn-sm" onClick={load}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
            {filtered.length} customer{filtered.length !== 1 ? 's' : ''} found
          </div>

          {/* Cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ background: 'var(--surface2)', borderRadius: 12, height: 120, opacity: 0.5 }} />
              ))
            ) : slice.length === 0 ? (
              <div style={{ gridColumn: '1/-1' }} className="empty-state">
                <div className="ei">👥</div>
                <p>{search ? 'No customers match your search' : 'No customers yet'}</p>
              </div>
            ) : (
              slice.map(c => (
                <div
                  key={c.customerId}
                  onClick={() => openHub(c)}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: 18, cursor: 'pointer',
                    transition: 'all 0.18s', position: 'relative',
                  }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(56,217,245,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, color: 'var(--muted)', background: 'var(--surface2)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 4 }}>
                    {c.customerId}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--accent2), var(--accent))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--display)', fontSize: 14, fontWeight: 800, color: '#0a0c0f',
                    }}>
                      {(c.customerName || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 60 }}>
                      <div style={{ fontFamily: 'var(--display)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.customerName}</div>
                      {c.company && <div style={{ fontSize: 10, color: 'var(--accent2)', marginTop: 1 }}>{c.company}</div>}
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{c.contact} · {c.city}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    {[
                      { label: 'Jobs', val: c.totalJobs || 0 },
                      { label: 'City', val: c.city || '—' },
                      { label: 'Type', val: c.customerType || '—' },
                    ].map(m => (
                      <div key={m.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--display)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{m.val}</div>
                        <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 2 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{(page-1)*PP+1}–{Math.min(page*PP, filtered.length)} of {filtered.length}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={() => setPage(p=>p-1)}>‹ Prev</button>
                <button className="btn btn-ghost btn-sm" disabled={page===pages} onClick={() => setPage(p=>p+1)}>Next ›</button>
              </div>
            </div>
          )}
        </div>

      </PageContent>

      {/* Customer Hub Drawer */}
      <Drawer
        open={!!hubData}
        onClose={() => setHubData(null)}
        title={c?.customerName || '…'}
        subtitle={[c?.company, c?.rac].filter(Boolean).join(' · ')}
        actions={
          <>
            <button className="btn btn-primary btn-sm" onClick={() => { navigate(`/tickets?custId=${c?.customerId}`); setHubData(null); }}>
              + Ticket
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { navigate(`/job-orders?custId=${c?.customerId}`); setHubData(null); }}>
              + Job Order
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { navigate(`/assets?custId=${c?.customerId}`); setHubData(null); }}>
              + Asset
            </button>
          </>
        }
      >
        {hubLoading ? (
          <div style={{ color: 'var(--muted)', fontSize: 12, padding: '20px 0' }}>Loading hub data…</div>
        ) : c ? (
          <>
            <DrawerSection title="Contact Details" />
            <InfoGrid>
              <InfoItem label="Customer ID"  value={c.customerId} />
              <InfoItem label="Contact"      value={c.contact} />
              <InfoItem label="Email"        value={c.email} />
              <InfoItem label="CNIC"         value={c.cnic} />
              <InfoItem label="City"         value={`${c.city || '—'}${c.area ? `, ${c.area}` : ''}`} />
              <InfoItem label="Customer Type" value={c.customerType} />
              <InfoItem label="Preferred Payment" value={c.preferredPayment} />
              <InfoItem label="Member Since" value={formatDate(c.createdAt)} />
            </InfoGrid>

            {hubData.assets?.length > 0 && (
              <>
                <DrawerSection title={`Assets (${hubData.assets.length})`} />
                {hubData.assets.map(a => (
                  <div key={a.assetId} style={{
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '12px 14px', marginBottom: 8,
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 800, color: 'var(--accent)', minWidth: 80 }}>
                      {a.registrationNo}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--text)' }}>{[a.make, a.model, a.color].filter(Boolean).join(' ')}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{a.trackerIMEI || '—'} · {a.simNumber || '—'}</div>
                    </div>
                    <Badge variant={a.status?.toLowerCase()}>{a.status || 'Active'}</Badge>
                  </div>
                ))}
              </>
            )}

            {hubData.tickets?.length > 0 && (
              <>
                <DrawerSection title={`Recent Tickets (${hubData.tickets.length})`} />
                {hubData.tickets.slice(0, 5).map(t => (
                  <div key={t.ticketId} className="tl-item" style={{
                    borderLeftColor: t.type === 'Complaint' ? 'var(--danger)' : t.type === 'Lead' ? 'var(--success)' : 'var(--accent2)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: t.type === 'Complaint' ? 'var(--danger)' : t.type === 'Lead' ? 'var(--success)' : 'var(--accent2)' }}>{t.type}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{formatDate(t.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 3 }}>{t.title}</div>
                    <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2, fontFamily: 'var(--mono)' }}>{t.ticketId}</div>
                  </div>
                ))}
              </>
            )}
          </>
        ) : null}
      </Drawer>

      {/* Add Customer Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setForm(BLANK); setFormErr(''); }} title="New Customer" size="lg">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
          <Field label="Customer Name *" className="col-span-2" style={{ gridColumn: 'span 2' }}>
            <Input placeholder="Full legal name" value={form.customerName} onChange={set('customerName')} />
          </Field>
          <Field label="Contact Number *"><Input placeholder="+92 3XX XXXXXXX" value={form.contact} onChange={set('contact')} /></Field>
          <Field label="Email"><Input type="email" placeholder="email@example.com" value={form.email} onChange={set('email')} /></Field>
          <Field label="CNIC"><Input placeholder="XXXXX-XXXXXXX-X" value={form.cnic} onChange={set('cnic')} /></Field>
          <Field label="Father's Name"><Input value={form.father} onChange={set('father')} /></Field>
          <Field label="Company"><Input placeholder="Company name" value={form.company} onChange={set('company')} /></Field>
          <Field label="RAC / Group"><Input placeholder="Fleet group code" value={form.rac} onChange={set('rac')} /></Field>
          <Field label="City *">
            <Select value={form.city} onChange={set('city')}>
              <option value="">Select…</option>
              {CITIES.map(c => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Area"><Input placeholder="DHA, Gulberg…" value={form.area} onChange={set('area')} /></Field>
          <Field label="Customer Type">
            <Select value={form.customerType} onChange={set('customerType')}>
              <option value="individual">Individual</option>
              <option value="corporate">Corporate</option>
              <option value="fleet">Fleet Owner</option>
            </Select>
          </Field>
          <Field label="Preferred Payment">
            <Select value={form.preferredPayment} onChange={set('preferredPayment')}>
              <option value="">Select…</option>
              {['Cash','Bank Transfer','Cheque','Online / Mobile'].map(o => <option key={o}>{o}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <Textarea placeholder="Internal notes…" value={form.notes} onChange={set('notes')} style={{ minHeight: 60 }} />
        </Field>
        {formErr && (
          <div style={{ padding: '10px 14px', background: 'rgba(255,95,109,0.08)', border: '1px solid rgba(255,95,109,0.3)', borderRadius: 8, color: 'var(--danger)', fontSize: 11, marginBottom: 8 }}>
            ⚠ {formErr}
          </div>
        )}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={() => { setShowAdd(false); setForm(BLANK); }}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Customer'}</button>
        </ModalButtons>
      </Modal>
    </>
  );
}
