import { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { Topbar } from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { Drawer, DrawerSection, InfoGrid, InfoItem } from '../components/ui/Drawer';
import { Modal, ModalButtons } from '../components/ui/Modal';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { api } from '../api/client';
import { formatDate, genId, CITIES, PACKAGES } from '../lib/utils';

const JO_TYPES = ['New Installation','Replacement','Removal','Repair / Service','Relocation','SIM Swap','AMC Visit'];
const JO_STATUSES = ['Scheduled','In Progress','Completed','Cancelled','On Hold'];

const BLANK = {
  invoiceNumber: '', toc: 'New Installation', date: new Date().toISOString().split('T')[0],
  customerId: '', customerName: '', contact: '', city: '', rac: '', company: '',
  registrationNo: '', vehicleMake: '', vehicleModel: '', vehicleColor: '', vehicleYear: '',
  trackerIMEI: '', simNumber: '', installerName: '', installCity: '', package: '',
  amcDuration: '', amcExpiry: '', status: 'Scheduled',
  amount: '', paymentStatus: '', paymentMethod: '',
  notes: '', followupDate: '',
};

export default function JobOrders() {
  const [jobs, setJobs]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [tocFilter, setTocFilter]   = useState('');
  const [statFilter, setStatFilter] = useState('');
  const [selected, setSelected]     = useState(null);
  const [showEdit, setShowEdit]     = useState(false);
  const [form, setForm]             = useState(BLANK);
  const [saving, setSaving]         = useState(false);
  const [formErr, setFormErr]       = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.jobOrders.list(); setJobs(data.data || data || []); }
    catch { setJobs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    api.customers.list().then(r => setAllCustomers(r.data.data || r.data || [])).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let r = jobs;
    if (search)     r = r.filter(j => [j.customerName, j.invoiceNumber, j.registrationNo, j.trackerIMEI, j.installerName].some(v => (v||'').toLowerCase().includes(search.toLowerCase())));
    if (tocFilter)  r = r.filter(j => j.toc === tocFilter);
    if (statFilter) r = r.filter(j => j.status === statFilter);
    return r;
  }, [jobs, search, tocFilter, statFilter]);

  const counts = useMemo(() => ({
    total:     jobs.length,
    scheduled: jobs.filter(j => j.status === 'Scheduled').length,
    completed: jobs.filter(j => j.status === 'Completed').length,
    today:     jobs.filter(j => j.date === new Date().toISOString().split('T')[0]).length,
  }), [jobs]);

  const searchCust = (q) => {
    setCustSearch(q);
    if (!q) { setCustResults([]); return; }
    setCustResults(allCustomers.filter(c => [c.customerName, c.contact, c.company, c.rac].some(v => (v||'').toLowerCase().includes(q.toLowerCase()))).slice(0, 8));
  };

  const selectCust = (c) => {
    setForm(f => ({ ...f, customerId: c.customerId, customerName: c.customerName, contact: c.contact, city: c.city||'', rac: c.rac||'', company: c.company||'' }));
    setCustSearch(c.customerName); setCustResults([]);
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const openNew = () => { setForm({ ...BLANK, date: new Date().toISOString().split('T')[0] }); setCustSearch(''); setFormErr(''); setShowEdit(true); };
  const openEdit = (j) => { setForm({ ...BLANK, ...j }); setCustSearch(j.customerName || ''); setFormErr(''); setSelected(null); setShowEdit(true); };

  const save = async () => {
    if (!form.customerId)    { setFormErr('Please select a customer'); return; }
    if (!form.registrationNo){ setFormErr('Registration number is required'); return; }
    if (!form.installerName) { setFormErr('Installer name is required'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload = { ...form, invoiceNumber: form.invoiceNumber || genId('INV') };
      if (form.invoiceNumber) await api.jobOrders.update(form.invoiceNumber, payload);
      else                    await api.jobOrders.create(payload);
      setShowEdit(false); load();
    } catch(e) { setFormErr(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const statusColor = { Scheduled: 'var(--accent)', 'In Progress': 'var(--warn)', Completed: 'var(--success)', Cancelled: 'var(--muted)', 'On Hold': 'var(--accent3)' };
  const tocColor    = { 'New Installation': 'var(--accent)', Replacement: 'var(--warn)', Removal: 'var(--danger)' };

  const columns = [
    { key: 'date',          label: 'Date',     render: v => <span style={{ color: 'var(--muted)', fontSize: 11 }}>{formatDate(v)}</span> },
    { key: 'invoiceNumber', label: 'Invoice',  render: v => <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent2)' }}>{v}</span> },
    { key: 'toc',           label: 'Type',     render: v => <span style={{ fontSize: 10, fontWeight: 600, color: tocColor[v] || 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{v}</span> },
    { key: 'customerName',  label: 'Customer', render: v => <strong style={{ fontSize: 12 }}>{v || '—'}</strong> },
    { key: 'registrationNo',label: 'Reg No.',  render: v => <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{v || '—'}</span> },
    { key: 'installerName', label: 'Installer',render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v || '—'}</span> },
    { key: 'status',        label: 'Status',   render: v => <Badge variant={v?.toLowerCase().replace(/ /g,'-')}>{v}</Badge> },
    { key: 'invoiceNumber', label: 'Actions',  sortable: false, render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); openEdit(row); }}>Edit</button>
        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setSelected(row); }}>View</button>
      </div>
    )},
  ];

  return (
    <>
      <Topbar
        title="Job Orders"
        subtitle="Installation · Replacement · Service"
        actions={<button className="btn btn-solid btn-sm" onClick={openNew}><Plus size={13} /> New Job Order</button>}
      />
      <PageContent>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
          <StatTile label="Total"     value={counts.total}     color="t-cyan"   />
          <StatTile label="Scheduled" value={counts.scheduled} color="t-purple" />
          <StatTile label="Completed" value={counts.completed} color="t-green"  />
          <StatTile label="Today"     value={counts.today}     color="t-warn"   />
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input className="field-input" style={{ paddingLeft: 34 }} placeholder="Customer, invoice, reg no., IMEI, installer…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="field-input" style={{ width: 180, appearance: 'none', cursor: 'pointer' }} value={tocFilter} onChange={e => setTocFilter(e.target.value)}>
              <option value="">All Types</option>
              {JO_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <select className="field-input" style={{ width: 140, appearance: 'none', cursor: 'pointer' }} value={statFilter} onChange={e => setStatFilter(e.target.value)}>
              <option value="">All Status</option>
              {JO_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12} /></button>
          </div>
          <DataTable columns={columns} data={filtered} loading={loading} onRowClick={setSelected} emptyMessage="No job orders found" />
        </div>

      </PageContent>

      {/* Detail Drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.invoiceNumber || '—'}
        subtitle={`${selected?.toc} · ${selected?.customerName}`}
        actions={<button className="btn btn-primary btn-sm" onClick={() => openEdit(selected)}>✏ Edit</button>}
      >
        {selected && (
          <>
            <DrawerSection title="Job Details" />
            <InfoGrid>
              <InfoItem label="Invoice No."  value={selected.invoiceNumber} />
              <InfoItem label="Date"         value={formatDate(selected.date)} />
              <InfoItem label="Type"         value={selected.toc} />
              <InfoItem label="Status"       value={selected.status} />
              <InfoItem label="Package"      value={selected.package} />
              <InfoItem label="Installer"    value={selected.installerName} />
              <InfoItem label="City"         value={selected.installCity} />
              <InfoItem label="AMC Expiry"   value={formatDate(selected.amcExpiry)} />
            </InfoGrid>
            <DrawerSection title="Customer" />
            <InfoGrid>
              <InfoItem label="Customer"  value={selected.customerName} />
              <InfoItem label="Contact"   value={selected.contact} />
              <InfoItem label="RAC"       value={selected.rac} />
              <InfoItem label="Company"   value={selected.company} />
            </InfoGrid>
            <DrawerSection title="Vehicle & Devices" />
            <InfoGrid>
              <InfoItem label="Registration" value={selected.registrationNo} />
              <InfoItem label="Vehicle"      value={[selected.vehicleMake, selected.vehicleModel, selected.vehicleColor].filter(Boolean).join(' ')} />
              <InfoItem label="Tracker IMEI" value={selected.trackerIMEI} />
              <InfoItem label="SIM Number"   value={selected.simNumber} />
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
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={form.invoiceNumber ? 'Edit Job Order' : 'New Job Order'} size="xl">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
          <Field label="Invoice Number"><Input placeholder="Auto-generated if blank" value={form.invoiceNumber} onChange={set('invoiceNumber')} /></Field>
          <Field label="Date *"><Input type="date" value={form.date} onChange={set('date')} /></Field>
          <Field label="Job Type *">
            <Select value={form.toc} onChange={set('toc')}>
              {JO_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {JO_STATUSES.map(s => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>

        {/* Customer */}
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          Customer <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <Field label="Search Customer *">
          <div style={{ position: 'relative' }}>
            <Input placeholder="Type name, contact, RAC…" value={custSearch} onChange={e => searchCust(e.target.value)} />
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

        {/* Vehicle */}
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          Vehicle <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 14px' }}>
          <Field label="Registration No. *"><Input placeholder="ABC-000" value={form.registrationNo} onChange={set('registrationNo')} /></Field>
          <Field label="Make"><Input placeholder="Toyota" value={form.vehicleMake} onChange={set('vehicleMake')} /></Field>
          <Field label="Model"><Input placeholder="Corolla" value={form.vehicleModel} onChange={set('vehicleModel')} /></Field>
          <Field label="Color"><Input value={form.vehicleColor} onChange={set('vehicleColor')} /></Field>
          <Field label="Year"><Input type="number" min="1990" max="2099" value={form.vehicleYear} onChange={set('vehicleYear')} /></Field>
        </div>

        {/* Devices */}
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          Devices <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
          <Field label="Tracker IMEI"><Input placeholder="15-digit IMEI" value={form.trackerIMEI} onChange={set('trackerIMEI')} /></Field>
          <Field label="SIM Number"><Input value={form.simNumber} onChange={set('simNumber')} /></Field>
        </div>

        {/* Installation */}
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          Installation <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 14px' }}>
          <Field label="Installer Name *"><Input value={form.installerName} onChange={set('installerName')} /></Field>
          <Field label="Install City">
            <Select value={form.installCity} onChange={set('installCity')}>
              <option value="">Select…</option>
              {CITIES.map(c => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Package">
            <Select value={form.package} onChange={set('package')}>
              <option value="">Select…</option>
              {PACKAGES.map(p => <option key={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="AMC Duration"><Input placeholder="1 Year" value={form.amcDuration} onChange={set('amcDuration')} /></Field>
          <Field label="AMC Expiry"><Input type="date" value={form.amcExpiry} onChange={set('amcExpiry')} /></Field>
          <Field label="Amount (PKR)"><Input type="number" value={form.amount} onChange={set('amount')} /></Field>
        </div>

        <Field label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} style={{ minHeight: 60 }} />
        </Field>

        {formErr && <div style={{ padding: '10px 14px', background: 'rgba(255,95,109,0.08)', border: '1px solid rgba(255,95,109,0.3)', borderRadius: 8, color: 'var(--danger)', fontSize: 11, marginBottom: 8 }}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={save}>{saving ? 'Saving…' : (form.invoiceNumber ? 'Save Changes' : 'Create Job Order')}</button>
        </ModalButtons>
      </Modal>
    </>
  );
}
