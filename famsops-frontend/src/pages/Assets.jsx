import { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { Topbar } from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { Drawer, DrawerSection, InfoGrid, InfoItem } from '../components/ui/Drawer';
import { Modal, ModalButtons } from '../components/ui/Modal';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { CustomerSearch } from '../components/ui/CustomerSearch';
import { api } from '../api/client';
import { formatDate, genId, CITIES } from '../lib/utils';

const BLANK = {
  assetId: '', registrationNo: '', make: '', model: '', color: '', year: '',
  engineNo: '', chassisNo: '', status: 'Active',
  customerId: '', customerName: '', contact: '', city: '',
  trackerIMEI: '', simNumber: '',
  installerName: '', installDate: '', package: '',
  amcDuration: '', amcExpiry: '', installCity: '', notes: '',
};

export default function Assets() {
  const [assets, setAssets]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [statFilter, setStatFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [selected, setSelected]     = useState(null);
  const [showEdit, setShowEdit]     = useState(false);
  const [form, setForm]             = useState(BLANK);
  const [saving, setSaving]         = useState(false);
  const [formErr, setFormErr]       = useState('');
  const [customer, setCustomer]     = useState(null);
  const [custErr, setCustErr]       = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [allCustomers, setAllCustomers] = useState([]);
  const [custResults, setCustResults] = useState([]);

  const [page, setPage] = useState(1);
  const PP = 24;

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.assets.list(); setAssets(data.data || data || []); }
    catch { setAssets([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    api.customers.list().then(r => setAllCustomers(r.data.data || r.data || [])).catch(() => {});
  }, []);

  const searchCust = (q) => {
    setCustSearch(q);
    if (!q.trim()) { setCustResults([]); return; }
    const results = allCustomers.filter(c =>
      [c.customerName, c.contact, c.city, c.rac].some(v =>
        (v || '').toLowerCase().includes(q.toLowerCase())
      )
    );
    setCustResults(results.slice(0, 10));
  };

  const selectCust = (c) => {
    onSelectCustomer(c);
    setCustSearch('');
    setCustResults([]);
  };

  const filtered = useMemo(() => {
    let r = assets;
    if (search)     r = r.filter(a => [a.registrationNo, a.customerName, a.trackerIMEI, a.simNumber, a.make, a.model, a.city].some(v => (v||'').toLowerCase().includes(search.toLowerCase())));
    if (statFilter) r = r.filter(a => a.status === statFilter);
    if (cityFilter) r = r.filter(a => a.installCity === cityFilter || a.city === cityFilter);
    return r;
  }, [assets, search, statFilter, cityFilter]);

  const counts = useMemo(() => ({
    total:    assets.length,
    active:   assets.filter(a => a.status === 'Active').length,
    expiring: assets.filter(a => {
      if (!a.amcExpiry) return false;
      const d = new Date(a.amcExpiry) - Date.now();
      return d > 0 && d < 30 * 24 * 60 * 60 * 1000;
    }).length,
    expired:  assets.filter(a => a.amcExpiry && new Date(a.amcExpiry) < new Date()).length,
  }), [assets]);

  const pages = Math.max(1, Math.ceil(filtered.length / PP));
  const slice = filtered.slice((page-1)*PP, page*PP);

  const onSelectCustomer = (c) => {
    setCustomer(c);
    setForm(f => ({ ...f, customerId: c.customerId, customerName: c.customerName, contact: c.contact, city: c.city||'', rac: c.rac||'', company: c.company||'' }));
    setCustErr('');
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const openNew  = () => { setForm(BLANK); setCustomer(null); setCustErr(''); setCustSearch(''); setCustResults([]); setFormErr(''); setShowEdit(true); };
  const openEdit = (a) => { setForm({ ...BLANK, ...a }); setCustSearch(a.customerName || ''); setCustResults([]); setFormErr(''); setSelected(null); setShowEdit(true); };

  const save = async () => {
    if (!form.customerId)    { setFormErr('Please select a customer'); return; }
    if (!form.registrationNo){ setFormErr('Registration number is required'); return; }
    if (!form.make)          { setFormErr('Vehicle make is required'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload = { ...form, assetId: form.assetId || genId('AST') };
      if (form.assetId) await api.assets.update(form.assetId, payload);
      else              await api.assets.create(payload);
      setShowEdit(false); load();
    } catch(e) { setFormErr(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const amcClass = (a) => {
    if (!a.amcExpiry) return '';
    const d = new Date(a.amcExpiry) - Date.now();
    if (d < 0)                    return 'expired';
    if (d < 30 * 24 * 60 * 60 * 1000) return 'expiring';
    return 'active';
  };

  const amcColors = { active: 'var(--success)', expiring: 'var(--warn)', expired: 'var(--danger)', '': 'var(--muted)' };

  return (
    <>
      <Topbar
        title="Assets"
        subtitle="Vehicle registry — trackers, SIMs & AMC"
        actions={<button className="btn btn-solid btn-sm" onClick={openNew}><Plus size={13} /> Add Asset</button>}
      />
      <PageContent>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
          <StatTile label="Total Assets"  value={counts.total}    color="t-cyan"   />
          <StatTile label="Active"        value={counts.active}   color="t-green"  />
          <StatTile label="AMC Expiring"  value={counts.expiring} color="t-warn"   />
          <StatTile label="AMC Expired"   value={counts.expired}  color="t-pink"   />
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input className="field-input" style={{ paddingLeft: 34 }} placeholder="Reg no., customer, IMEI, SIM, make…"
                value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select className="field-input" style={{ width: 130, appearance: 'none', cursor: 'pointer' }} value={statFilter} onChange={e => setStatFilter(e.target.value)}>
              <option value="">All Status</option>
              {['Active','Inactive','Transferred'].map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="field-input" style={{ width: 130, appearance: 'none', cursor: 'pointer' }} value={cityFilter} onChange={e => setCityFilter(e.target.value)}>
              <option value="">All Cities</option>
              {[...new Set(assets.map(a => a.installCity || a.city).filter(Boolean))].sort().map(c => <option key={c}>{c}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12} /></button>
          </div>

          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>{filtered.length} assets · {pages} page{pages !== 1 ? 's' : ''}</div>

          {/* Cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))', gap: 14 }}>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <div key={i} style={{ background: 'var(--surface2)', borderRadius: 12, height: 130, opacity: 0.5 }} />)
            ) : slice.length === 0 ? (
              <div style={{ gridColumn: '1/-1' }} className="empty-state"><div className="ei">🚗</div><p>No assets found</p></div>
            ) : (
              slice.map(a => {
                const amc = amcClass(a);
                return (
                  <div key={a.assetId}
                    onClick={() => setSelected(a)}
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 0, cursor: 'pointer', transition: 'all 0.18s', overflow: 'hidden' }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(56,217,245,0.3)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
                  >
                    <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg,rgba(56,217,245,0.15),rgba(123,111,255,0.15))', border: '1px solid rgba(56,217,245,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🚗</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 800, color: 'var(--accent)', letterSpacing: 0.5 }}>{a.registrationNo}</div>
                        <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 2 }}>{[a.make, a.model, a.color].filter(Boolean).join(' ')}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{a.customerName}</div>
                      </div>
                      <Badge variant={a.status?.toLowerCase()}>{a.status}</Badge>
                    </div>
                    <div style={{ padding: '10px 16px', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                        {a.trackerIMEI ? `📡 ${a.trackerIMEI.slice(-6)}…` : '📡 —'} &nbsp; {a.simNumber ? `💳 ${a.simNumber.slice(-4)}…` : '💳 —'}
                      </div>
                      {a.amcExpiry && (
                        <div style={{ fontSize: 10, color: amcColors[amc] }}>
                          AMC {formatDate(a.amcExpiry)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

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

      {/* Detail Drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.registrationNo || '—'}
        subtitle={[selected?.make, selected?.model, selected?.color].filter(Boolean).join(' ')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => openEdit(selected)}>✏ Edit</button>}
      >
        {selected && (
          <>
            <DrawerSection title="Vehicle Details" />
            <InfoGrid>
              <InfoItem label="Asset ID"       value={selected.assetId} />
              <InfoItem label="Status"         value={selected.status} />
              <InfoItem label="Engine No."     value={selected.engineNo} />
              <InfoItem label="Chassis No."    value={selected.chassisNo} />
              <InfoItem label="Year"           value={selected.year} />
              <InfoItem label="Color"          value={selected.color} />
            </InfoGrid>
            <DrawerSection title="Customer" />
            <InfoGrid>
              <InfoItem label="Name"    value={selected.customerName} />
              <InfoItem label="Contact" value={selected.contact} />
              <InfoItem label="City"    value={selected.city} />
            </InfoGrid>
            <DrawerSection title="Devices" />
            <InfoGrid>
              <InfoItem label="Tracker IMEI" value={selected.trackerIMEI} />
              <InfoItem label="SIM Number"   value={selected.simNumber} />
            </InfoGrid>
            <DrawerSection title="Installation & AMC" />
            <InfoGrid>
              <InfoItem label="Installer"    value={selected.installerName} />
              <InfoItem label="Install Date" value={formatDate(selected.installDate)} />
              <InfoItem label="Package"      value={selected.package} />
              <InfoItem label="AMC Duration" value={selected.amcDuration} />
              <InfoItem label="AMC Expiry"   value={formatDate(selected.amcExpiry)} />
              <InfoItem label="Install City" value={selected.installCity} />
            </InfoGrid>
            {selected.notes && (
              <>
                <DrawerSection title="Notes" />
                <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px' }}>{selected.notes}</p>
              </>
            )}
          </>
        )}
      </Drawer>

      {/* Add / Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={form.assetId ? 'Edit Asset' : 'Add New Asset'} size="xl">
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', padding: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          Vehicle Details <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 14px' }}>
          <Field label="Registration No. *"><Input placeholder="ABC-000" value={form.registrationNo} onChange={set('registrationNo')} /></Field>
          <Field label="Make *"><Input placeholder="Toyota" value={form.make} onChange={set('make')} /></Field>
          <Field label="Model *"><Input placeholder="Corolla" value={form.model} onChange={set('model')} /></Field>
          <Field label="Color"><Input value={form.color} onChange={set('color')} /></Field>
          <Field label="Year"><Input type="number" value={form.year} onChange={set('year')} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {['Active','Inactive','Transferred'].map(s => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Engine No."><Input value={form.engineNo} onChange={set('engineNo')} /></Field>
          <Field label="Chassis No."><Input value={form.chassisNo} onChange={set('chassisNo')} /></Field>
        </div>

        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          Customer <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <Field label="Search Customer *">
          <div style={{ position: 'relative' }}>
            <Input placeholder="Type name, contact…" value={custSearch} onChange={e => searchCust(e.target.value)} />
            {custResults.length > 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border-hi)', borderRadius: 10, maxHeight: 200, overflowY: 'auto', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                {custResults.map(c => (
                  <div key={c.customerId} onClick={() => selectCust(c)}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(56,217,245,0.06)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{c.customerName}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{c.contact} · {c.city}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>

        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          Device & Installation <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
          <Field label="Tracker IMEI"><Input placeholder="15-digit IMEI" value={form.trackerIMEI} onChange={set('trackerIMEI')} /></Field>
          <Field label="SIM Number"><Input value={form.simNumber} onChange={set('simNumber')} /></Field>
          <Field label="Installer"><Input value={form.installerName} onChange={set('installerName')} /></Field>
          <Field label="Install Date"><Input type="date" value={form.installDate} onChange={set('installDate')} /></Field>
          <Field label="Package"><Select value={form.package} onChange={set('package')}><option value="">Select…</option>{['Basic Tracker','Standard','Premium','Fleet Bundle'].map(p=><option key={p}>{p}</option>)}</Select></Field>
          <Field label="Install City"><Select value={form.installCity} onChange={set('installCity')}><option value="">Select…</option>{CITIES.map(c=><option key={c}>{c}</option>)}</Select></Field>
          <Field label="AMC Duration"><Input placeholder="1 Year" value={form.amcDuration} onChange={set('amcDuration')} /></Field>
          <Field label="AMC Expiry"><Input type="date" value={form.amcExpiry} onChange={set('amcExpiry')} /></Field>
        </div>

        <Field label="Notes"><Textarea value={form.notes} onChange={set('notes')} style={{ minHeight: 60 }} /></Field>

        {formErr && <div style={{ padding: '10px 14px', background: 'rgba(255,95,109,0.08)', border: '1px solid rgba(255,95,109,0.3)', borderRadius: 8, color: 'var(--danger)', fontSize: 11, marginBottom: 8 }}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={save}>{saving ? 'Saving…' : (form.assetId ? 'Save Changes' : 'Add Asset')}</button>
        </ModalButtons>
      </Modal>
    </>
  );
}
