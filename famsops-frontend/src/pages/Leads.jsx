import { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Search, Target } from 'lucide-react';
import { Topbar } from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { Drawer, DrawerSection, InfoGrid, InfoItem } from '../components/ui/Drawer';
import { Modal, ModalButtons } from '../components/ui/Modal';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { CustomerSearch } from '../components/ui/CustomerSearch';
import { api } from '../api/client';
import { formatDate, genId, CITIES, PACKAGES } from '../lib/utils';

const STATUSES = ['New Lead','Contacted','Interested','Negotiation','Won','Lost'];
const SOURCES  = ['Referral','Walk-in','WhatsApp','Social Media','Cold Call','Website','Exhibition / Event','Existing Client','Other'];

const STATUS_COLORS = {
  'New Lead':    { bg: 'rgba(56,217,245,0.1)',  color: 'var(--accent)' },
  'Contacted':   { bg: 'rgba(123,111,255,0.1)', color: 'var(--accent2)' },
  'Interested':  { bg: 'rgba(255,179,71,0.1)',  color: 'var(--warn)' },
  'Negotiation': { bg: 'rgba(255,126,179,0.1)', color: 'var(--accent3)' },
  'Won':         { bg: 'rgba(61,255,160,0.1)',  color: 'var(--success)' },
  'Lost':        { bg: 'rgba(90,96,112,0.15)',  color: 'var(--muted)' },
};

const BLANK = {
  leadId: '', status: 'New Lead', title: '', description: '',
  customerId: '', customerName: '', contact: '', city: '', company: '',
  package: '', vehicles: '', budget: '', timeline: '',
  preferredPayment: '', source: '', salesperson: '',
  followupDate: '', priority: 'Medium', notes: '',
  amount: '', closedDate: '',
  // New vehicle details
  plateNumber: '', vehicleMake: '', vehicleModel: '', vehicleColor: '', chassisNo: '',
  images: [],
};

export default function Leads() {
  const [leads, setLeads]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [statFilter, setStatFilter] = useState('');
  const [selected, setSelected]     = useState(null);
  const [showEdit, setShowEdit]     = useState(false);
  const [form, setForm]             = useState(BLANK);
  const [saving, setSaving]         = useState(false);
  const [formErr, setFormErr]       = useState('');
  const [customer, setCustomer]     = useState(null);
  const [custErr, setCustErr]       = useState('');
  const [view, setView]             = useState('table'); // table | kanban

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.leads.list(); setLeads(data.data || data || []); }
    catch { setLeads([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let r = leads;
    if (search)     r = r.filter(l => [l.title, l.customerName, l.leadId, l.salesperson, l.company].some(v => (v||'').toLowerCase().includes(search.toLowerCase())));
    if (statFilter) r = r.filter(l => l.status === statFilter);
    return r;
  }, [leads, search, statFilter]);

  const counts = useMemo(() => {
    const c = {};
    STATUSES.forEach(s => c[s] = leads.filter(l => l.status === s).length);
    return c;
  }, [leads]);

  const onSelectCustomer = (c) => {
    setCustomer(c);
    setForm(f => ({ ...f, customerId: c.customerId, customerName: c.customerName, contact: c.contact, city: c.city||'', company: c.company||'' }));
    setCustErr('');
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const openNew  = () => { setForm(BLANK); setCustomer(null); setCustErr(''); setFormErr(''); setShowEdit(true); };
  const openEdit = (l) => { setForm({ ...BLANK, ...l }); setCustomer(l.customerId ? {customerId:l.customerId,customerName:l.customerName,contact:l.contact,city:l.city} : null); setCustErr(''); setFormErr(''); setSelected(null); setShowEdit(true); };

  const save = async () => {
    if (!customer?.customerId) { setCustErr('Please select a customer'); return; }
    if (!form.title)      { setFormErr('Lead title is required'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload = { ...form, leadId: form.leadId || genId('LEAD') };
      if (form.leadId) await api.leads.update(form.leadId, payload);
      else             await api.leads.create(payload);
      setShowEdit(false); load();
    } catch(e) { setFormErr(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (l, status) => {
    try { await api.leads.update(l.leadId, { status }); load(); setSelected(s => s ? { ...s, status } : null); }
    catch(e) { alert('Update failed'); }
  };

  const columns = [
    { key: 'createdAt',    label: 'Date',       render: v => <span style={{ color: 'var(--muted)', fontSize: 11 }}>{formatDate(v)}</span> },
    { key: 'leadId',       label: 'ID',         render: v => <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{v}</span>, sortable: false },
    { key: 'customerName', label: 'Customer',   render: v => <strong style={{ fontSize: 12 }}>{v || '—'}</strong> },
    { key: 'title',        label: 'Title',      render: v => <span style={{ fontSize: 11 }}>{v}</span> },
    { key: 'package',      label: 'Package',    render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v || '—'}</span> },
    { key: 'salesperson',  label: 'Sales Rep',  render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v || '—'}</span> },
    { key: 'followupDate', label: 'Follow-up',  render: v => <span style={{ fontSize: 11, color: v && new Date(v) < new Date() ? 'var(--danger)' : 'var(--muted)' }}>{formatDate(v)}</span> },
    { key: 'status',       label: 'Status',     render: v => {
      const s = STATUS_COLORS[v] || {};
      return <span style={{ padding: '3px 9px', borderRadius: 5, fontSize: 10, background: s.bg, color: s.color, fontWeight: 500 }}>{v}</span>;
    }},
    { key: 'leadId',       label: 'Actions',    sortable: false, render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); openEdit(row); }}>Edit</button>
        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setSelected(row); }}>View</button>
      </div>
    )},
  ];

  /* Kanban column */
  const KanbanCol = ({ status }) => {
    const items = filtered.filter(l => l.status === status);
    const sc = STATUS_COLORS[status] || {};
    return (
      <div style={{ flex: '0 0 220px', minWidth: 220 }}>
        <div style={{ padding: '8px 12px', marginBottom: 10, borderRadius: 8, background: sc.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: sc.color }}>{status}</span>
          <span style={{ fontSize: 11, color: sc.color, fontFamily: 'var(--display)', fontWeight: 700 }}>{items.length}</span>
        </div>
        {items.map(l => (
          <div key={l.leadId}
            onClick={() => setSelected(l)}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>{l.customerName}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>{l.title}</div>
            {l.salesperson && <div style={{ fontSize: 10, color: 'var(--accent2)' }}>👤 {l.salesperson}</div>}
            {l.followupDate && <div style={{ fontSize: 10, color: new Date(l.followupDate) < new Date() ? 'var(--danger)' : 'var(--muted)', marginTop: 4 }}>📅 {formatDate(l.followupDate)}</div>}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Topbar
        title="Sales Leads"
        subtitle="Lead pipeline management"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setView(v => v === 'table' ? 'kanban' : 'table')}>
              {view === 'table' ? '⬛ Kanban' : '≡ Table'}
            </button>
            <button className="btn btn-solid btn-sm" onClick={openNew}><Plus size={13} /> New Lead</button>
          </div>
        }
      />
      <PageContent>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 22 }}>
          {STATUSES.map(s => {
            const c = STATUS_COLORS[s];
            return <div key={s} className="stat-tile" style={{ borderTop: `2px solid ${c.color}`, padding: '12px 14px' }}>
              <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{s}</div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 24, fontWeight: 800, color: c.color }}>{counts[s] || 0}</div>
            </div>;
          })}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input className="field-input" style={{ paddingLeft: 34 }} placeholder="Customer, title, sales rep…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="field-input" style={{ width: 150, appearance: 'none', cursor: 'pointer' }} value={statFilter} onChange={e => setStatFilter(e.target.value)}>
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12} /></button>
        </div>

        {view === 'table' ? (
          <div className="card">
            <DataTable columns={columns} data={filtered} loading={loading} onRowClick={setSelected} emptyMessage="No leads found" />
          </div>
        ) : (
          <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
            <div style={{ display: 'flex', gap: 14, minWidth: 'max-content' }}>
              {STATUSES.map(s => <KanbanCol key={s} status={s} />)}
            </div>
          </div>
        )}

      </PageContent>

      {/* Detail Drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || '—'}
        subtitle={`${selected?.customerName} · ${selected?.leadId}`}
        actions={
          <>
            <button className="btn btn-primary btn-sm" onClick={() => openEdit(selected)}>✏ Edit</button>
            {STATUSES.filter(s => s !== selected?.status).map(s => (
              <button key={s} className="btn btn-ghost btn-sm" style={{ color: STATUS_COLORS[s]?.color }}
                onClick={() => updateStatus(selected, s)}>→ {s}</button>
            )).slice(0, 2)}
          </>
        }
      >
        {selected && (
          <>
            <DrawerSection title="Lead Details" />
            <InfoGrid>
              <InfoItem label="Lead ID"    value={selected.leadId} />
              <InfoItem label="Status"     value={selected.status} />
              <InfoItem label="Priority"   value={selected.priority} />
              <InfoItem label="Sales Rep"  value={selected.salesperson} />
              <InfoItem label="Source"     value={selected.source} />
              <InfoItem label="Follow-up"  value={formatDate(selected.followupDate)} />
            </InfoGrid>
            <DrawerSection title="Opportunity" />
            <InfoGrid>
              <InfoItem label="Package"   value={selected.package} />
              <InfoItem label="Vehicles"  value={selected.vehicles} />
              <InfoItem label="Budget"    value={selected.budget} />
              <InfoItem label="Timeline"  value={selected.timeline} />
              <InfoItem label="Payment"   value={selected.preferredPayment} />
              <InfoItem label="Amount"    value={selected.amount ? `PKR ${Number(selected.amount).toLocaleString()}` : '—'} />
            </InfoGrid>

            {(selected.plateNumber || selected.vehicleMake || selected.vehicleModel || selected.vehicleColor || selected.chassisNo) && (
              <>
                <DrawerSection title="Vehicle Details" />
                <InfoGrid>
                  {selected.plateNumber && <InfoItem label="Plate No." value={selected.plateNumber} />}
                  {selected.vehicleMake && <InfoItem label="Make" value={selected.vehicleMake} />}
                  {selected.vehicleModel && <InfoItem label="Model" value={selected.vehicleModel} />}
                  {selected.vehicleColor && <InfoItem label="Color" value={selected.vehicleColor} />}
                  {selected.chassisNo && <InfoItem label="Chassis No." value={selected.chassisNo} />}
                </InfoGrid>
              </>
            )}

            {selected.images && selected.images.length > 0 && (
              <>
                <DrawerSection title="Attachments" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selected.images.map((img, idx) => (
                    <a key={idx} href={img} target="_blank" rel="noreferrer" style={{ width: 100, height: 70, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </a>
                  ))}
                </div>
              </>
            )}
            {selected.description && (
              <>
                <DrawerSection title="Description" />
                <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px' }}>{selected.description}</p>
              </>
            )}
            {selected.notes && (
              <>
                <DrawerSection title="Internal Notes" />
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px' }}>{selected.notes}</p>
              </>
            )}
          </>
        )}
      </Drawer>

      {/* Add / Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={form.leadId ? 'Edit Lead' : 'New Sales Lead'} size="lg">
        <Field label="Customer *">
          <CustomerSearch value={customer} onChange={onSelectCustomer} onClear={()=>{setCustomer(null);setForm(f=>({...f,customerId:'',customerName:'',contact:'',city:''}));}} error={custErr}/>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
          <Field label="Title *" style={{ gridColumn: 'span 2' }}>
            <Input placeholder="e.g. Fleet tracking for 10 vehicles — DHA Lahore" value={form.title} onChange={set('title')} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>{STATUSES.map(s => <option key={s}>{s}</option>)}</Select>
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={set('priority')}>{['Low','Medium','High','Critical'].map(p => <option key={p}>{p}</option>)}</Select>
          </Field>
          <Field label="Package">
            <Select value={form.package} onChange={set('package')}><option value="">Select…</option>{PACKAGES.map(p => <option key={p}>{p}</option>)}</Select>
          </Field>
          <Field label="No. of Vehicles"><Input type="number" min="1" value={form.vehicles} onChange={set('vehicles')} /></Field>
          <Field label="Budget Range">
            <Select value={form.budget} onChange={set('budget')}><option value="">Select…</option>{['Under PKR 10,000','PKR 10,000 – 25,000','PKR 25,000 – 50,000','PKR 50,000 – 100,000','PKR 100,000+','To be discussed'].map(o=><option key={o}>{o}</option>)}</Select>
          </Field>
          <Field label="Timeline">
            <Select value={form.timeline} onChange={set('timeline')}><option value="">Select…</option>{['Immediately','Within 1 week','Within 1 month','1–3 months','3+ months','Just exploring'].map(o=><option key={o}>{o}</option>)}</Select>
          </Field>
          <Field label="Lead Source">
            <Select value={form.source} onChange={set('source')}><option value="">Select…</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</Select>
          </Field>
          <Field label="Sales Person"><Input value={form.salesperson} onChange={set('salesperson')} /></Field>
          <Field label="Follow-up Date"><Input type="date" value={form.followupDate} onChange={set('followupDate')} /></Field>
          <Field label="Est. Amount (PKR)"><Input type="number" value={form.amount} onChange={set('amount')} /></Field>
        </div>

        {/* Vehicle Details Section */}
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', padding: '14px 0 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
          Vehicle Information <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0 12px' }}>
          <Field label="Plate Number"><Input placeholder="ABC-123" value={form.plateNumber} onChange={set('plateNumber')} /></Field>
          <Field label="Make"><Input placeholder="Toyota, Honda..." value={form.vehicleMake} onChange={set('vehicleMake')} /></Field>
          <Field label="Model"><Input placeholder="Corolla, Civic..." value={form.vehicleModel} onChange={set('vehicleModel')} /></Field>
          <Field label="Color"><Input placeholder="White, Black..." value={form.vehicleColor} onChange={set('vehicleColor')} /></Field>
          <Field label="Chassis Number"><Input placeholder="VIN / Chassis" value={form.chassisNo} onChange={set('chassisNo')} /></Field>
        </div>

        <Field label="Attach Images">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
            {form.images.map((img, idx) => (
              <div key={idx} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button 
                  onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))}
                  style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ×
                </button>
              </div>
            ))}
            <label style={{ width: 80, height: 80, borderRadius: 8, border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
              <Plus size={16} style={{ color: 'var(--muted)' }} />
              <span style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>Upload</span>
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={async (e) => {
                  const files = Array.from(e.target.files);
                  const base64s = await Promise.all(files.map(file => new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(file);
                  })));
                  setForm(f => ({ ...f, images: [...f.images, ...base64s] }));
                }}
              />
            </label>
          </div>
        </Field>

        <Field label="Description">
          <Textarea placeholder="What the customer is looking for…" value={form.description} onChange={set('description')} />
        </Field>
        <Field label="Internal Notes">
          <Textarea placeholder="Internal notes only" value={form.notes} onChange={set('notes')} style={{ minHeight: 60 }} />
        </Field>

        {formErr && <div style={{ padding: '10px 14px', background: 'rgba(255,95,109,0.08)', border: '1px solid rgba(255,95,109,0.3)', borderRadius: 8, color: 'var(--danger)', fontSize: 11, marginBottom: 8 }}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={save}>{saving ? 'Saving…' : (form.leadId ? 'Save Changes' : 'Create Lead')}</button>
        </ModalButtons>
      </Modal>
    </>
  );
}
