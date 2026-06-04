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
import { formatDate, genId, TICKET_TYPES, TICKET_STATUSES } from '../lib/utils';

const BLANK = {
  type: 'Lead', title: '', description: '', category: '',
  priority: 'Medium', status: 'Open',
  customerId: '', customerName: '', contact: '', city: '',
  assetId: '', assignedTo: '', followupDate: '', dueDate: '',
  incidentDate: '', severity: '', notes: '',
  leadSource: '', salesperson: '', vehicles: '', budget: '',
  timeline: '', preferredPayment: '', package: '',
};

const PRIORITY_COLORS = {
  Low:      { bg: 'rgba(56,217,245,0.1)',  border: 'rgba(56,217,245,0.3)',  color: 'var(--accent)' },
  Medium:   { bg: 'rgba(255,179,71,0.1)',  border: 'rgba(255,179,71,0.3)',  color: 'var(--warn)' },
  High:     { bg: 'rgba(255,95,109,0.1)',  border: 'rgba(255,95,109,0.3)',  color: 'var(--danger)' },
  Critical: { bg: 'rgba(255,126,179,0.1)', border: 'rgba(255,126,179,0.3)', color: 'var(--accent3)' },
};

export default function Tickets() {
  const [tickets, setTickets]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statFilter, setStatFilter] = useState('');
  const [prioFilter, setPrioFilter] = useState('');
  const [active, setActive]         = useState('list');   // list | lead | query | complaint
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
    try { const { data } = await api.tickets.list(); setTickets(data.data || data || []); }
    catch { setTickets([]); }
    finally { setLoading(false); }
  };

  const loadCustomers = async () => {
    try { const { data } = await api.customers.list(); setAllCustomers(data.data || data || []); }
    catch {}
  };

  useEffect(() => { load(); loadCustomers(); }, []);

  const filtered = useMemo(() => {
    let r = tickets;
    if (search)     r = r.filter(t => [t.title, t.customerName, t.ticketId, t.assignedTo].some(v => (v||'').toLowerCase().includes(search.toLowerCase())));
    if (typeFilter) r = r.filter(t => t.type === typeFilter);
    if (statFilter) r = r.filter(t => t.status === statFilter);
    if (prioFilter) r = r.filter(t => t.priority === prioFilter);
    return r;
  }, [tickets, search, typeFilter, statFilter, prioFilter]);

  const counts = useMemo(() => ({
    total:     tickets.length,
    lead:      tickets.filter(t => t.type === 'Lead').length,
    query:     tickets.filter(t => t.type === 'Query').length,
    complaint: tickets.filter(t => t.type === 'Complaint').length,
    open:      tickets.filter(t => t.status === 'Open').length,
  }), [tickets]);

  const searchCustomers = (q) => {
    setCustSearch(q);
    if (!q) { setCustResults([]); return; }
    setCustResults(allCustomers.filter(c =>
      [c.customerName, c.contact, c.company, c.rac, c.customerId].some(v => (v||'').toLowerCase().includes(q.toLowerCase()))
    ).slice(0, 8));
  };

  const selectCustomer = (c) => {
    setForm(f => ({ ...f, customerId: c.customerId, customerName: c.customerName, contact: c.contact, city: c.city || '' }));
    setCustSearch(c.customerName);
    setCustResults([]);
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const openNew = (type) => {
    setForm({ ...BLANK, type });
    setCustSearch(''); setCustResults([]);
    setFormErr('');
    setShowEdit(true);
  };

  const openEdit = (t) => {
    setForm({ ...BLANK, ...t });
    setCustSearch(t.customerName || '');
    setCustResults([]);
    setFormErr('');
    setSelected(null);
    setShowEdit(true);
  };

  const save = async () => {
    if (!form.customerId) { setFormErr('Please select a customer'); return; }
    if (!form.title)      { setFormErr('Title / subject is required'); return; }
    if (!form.type)       { setFormErr('Ticket type is required'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload = { ...form, ticketId: form.ticketId || genId('TKT') };
      if (form.ticketId) await api.tickets.update(form.ticketId, payload);
      else               await api.tickets.create(payload);
      setShowEdit(false); load();
    } catch(e) { setFormErr(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (t, status) => {
    try { await api.tickets.update(t.ticketId, { status }); load(); setSelected(null); }
    catch(e) { alert('Update failed: ' + e.message); }
  };

  const TABS = [
    { id: 'list',      label: '📋 All Tickets',    cnt: counts.total },
    { id: 'lead',      label: '🎯 New Lead',        cnt: null },
    { id: 'query',     label: '💬 New Query',       cnt: null },
    { id: 'complaint', label: '⚠ New Complaint',   cnt: null },
  ];

  const typeAccent = { Lead: 'var(--success)', Query: 'var(--accent2)', Complaint: 'var(--danger)' };

  const columns = [
    { key: 'createdAt',    label: 'Date',     render: v => <span style={{ color: 'var(--muted)', fontSize: 11 }}>{formatDate(v)}</span> },
    { key: 'ticketId',     label: 'ID',       render: v => <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>{v}</span>, sortable: false },
    { key: 'type',         label: 'Type',     render: v => <span style={{ fontSize: 10, fontWeight: 600, color: typeAccent[v] || 'var(--text)', textTransform: 'uppercase', letterSpacing: 1 }}>{v}</span> },
    { key: 'customerName', label: 'Customer', render: v => <strong style={{ fontSize: 12 }}>{v || '—'}</strong> },
    { key: 'title',        label: 'Subject',  render: v => <span style={{ fontSize: 11, color: 'var(--text)' }}>{v}</span> },
    { key: 'priority',     label: 'Priority', render: v => {
      const p = PRIORITY_COLORS[v] || {};
      return <span style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, background: p.bg, color: p.color, border: `1px solid ${p.border}` }}>{v}</span>;
    }},
    { key: 'status',       label: 'Status',   render: v => <Badge variant={v?.toLowerCase()}>{v}</Badge> },
    { key: 'assignedTo',   label: 'Assigned', render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v || '—'}</span> },
    { key: 'ticketId',     label: 'Actions',  sortable: false, render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); openEdit(row); }}>Edit</button>
        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setSelected(row); }}>View</button>
      </div>
    )},
  ];

  const CategoryOptions = ({ type }) => {
    const cats = {
      Lead:      ['Basic Tracker','Standard','Premium','Fleet Bundle','Enterprise / Custom'],
      Query:     ['Device Not Working','App / Platform Access','SIM / Network Issue','Location Inaccuracy','Alerts Not Received','Account / Billing','Installation Query','AMC / Renewal','Feature Request','General Enquiry','Other'],
      Complaint: ['Device Malfunction','Wrong Installation','SIM Not Working','Data Loss / History Missing','Service Not Delivered','Billing Dispute','Staff Behaviour','Response Time','Device Physically Damaged','App Not Working','Other'],
    };
    return (cats[type] || []).map(o => <option key={o}>{o}</option>);
  };

  return (
    <>
      <Topbar
        title="Tickets"
        subtitle="Sales Leads · Queries · Complaints"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => openNew('Lead')}   style={{ color: 'var(--success)', borderColor: 'rgba(61,255,160,0.3)' }}>🎯 Lead</button>
            <button className="btn btn-ghost btn-sm" onClick={() => openNew('Query')}  style={{ color: 'var(--accent2)', borderColor: 'rgba(123,111,255,0.3)' }}>💬 Query</button>
            <button className="btn btn-ghost btn-sm" onClick={() => openNew('Complaint')} style={{ color: 'var(--danger)', borderColor: 'rgba(255,95,109,0.3)' }}>⚠ Complaint</button>
          </div>
        }
      />
      <PageContent>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 22 }}>
          <StatTile label="Total"      value={counts.total}     color="t-cyan"   />
          <StatTile label="Leads"      value={counts.lead}      color="t-green"  />
          <StatTile label="Queries"    value={counts.query}     color="t-purple" />
          <StatTile label="Complaints" value={counts.complaint} color="t-pink"   />
          <StatTile label="Open"       value={counts.open}      color="t-warn"   />
        </div>

        <div className="card">
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input className="field-input" style={{ paddingLeft: 34 }} placeholder="Search customer, title, ID…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {[
              { val: typeFilter, set: setTypeFilter, opts: [['','All Types'],...TICKET_TYPES.map(t=>[t,t])], w: 130 },
              { val: statFilter, set: setStatFilter, opts: [['','All Status'],...TICKET_STATUSES.map(s=>[s,s])], w: 130 },
              { val: prioFilter, set: setPrioFilter, opts: [['','All Priority'],['Low','Low'],['Medium','Medium'],['High','High'],['Critical','Critical']], w: 130 },
            ].map((f, i) => (
              <select key={i} className="field-input" style={{ width: f.w, appearance: 'none', cursor: 'pointer' }}
                value={f.val} onChange={e => f.set(e.target.value)}>
                {f.opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12} /></button>
          </div>

          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>
            {filtered.length} ticket{filtered.length !== 1 ? 's' : ''} found
          </div>

          <DataTable columns={columns} data={filtered} loading={loading} onRowClick={setSelected} emptyMessage="No tickets found" />
        </div>

      </PageContent>

      {/* Detail Drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || '—'}
        subtitle={`${selected?.type} · ${selected?.ticketId}`}
        actions={
          <>
            <button className="btn btn-primary btn-sm" onClick={() => openEdit(selected)}>✏ Edit</button>
            {selected?.status !== 'Resolved' && (
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)', borderColor: 'rgba(61,255,160,0.3)' }}
                onClick={() => updateStatus(selected, 'Resolved')}>✓ Resolve</button>
            )}
            {selected?.status === 'Open' && (
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--warn)' }}
                onClick={() => updateStatus(selected, 'In Progress')}>→ In Progress</button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(selected, 'Closed')}>Close</button>
          </>
        }
      >
        {selected && (
          <>
            <DrawerSection title="Ticket Details" />
            <InfoGrid>
              <InfoItem label="Ticket ID"   value={selected.ticketId} />
              <InfoItem label="Type"        value={selected.type} />
              <InfoItem label="Priority"    value={selected.priority} />
              <InfoItem label="Status"      value={selected.status} />
              <InfoItem label="Customer"    value={selected.customerName} />
              <InfoItem label="Contact"     value={selected.contact} />
              <InfoItem label="Assigned To" value={selected.assignedTo} />
              <InfoItem label="Created"     value={formatDate(selected.createdAt)} />
              {selected.dueDate && <InfoItem label="Due Date" value={formatDate(selected.dueDate)} />}
              {selected.followupDate && <InfoItem label="Follow-up" value={formatDate(selected.followupDate)} />}
            </InfoGrid>

            {selected.description && (
              <>
                <DrawerSection title="Description" />
                <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px' }}>
                  {selected.description}
                </p>
              </>
            )}

            {selected.type === 'Lead' && (
              <>
                <DrawerSection title="Lead Details" />
                <InfoGrid>
                  <InfoItem label="Package"  value={selected.package} />
                  <InfoItem label="Vehicles" value={selected.vehicles} />
                  <InfoItem label="Budget"   value={selected.budget} />
                  <InfoItem label="Timeline" value={selected.timeline} />
                  <InfoItem label="Source"   value={selected.leadSource} />
                  <InfoItem label="Sales Rep" value={selected.salesperson} />
                </InfoGrid>
              </>
            )}

            {selected.notes && (
              <>
                <DrawerSection title="Internal Notes" />
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px' }}>
                  {selected.notes}
                </p>
              </>
            )}
          </>
        )}
      </Drawer>

      {/* Add / Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={form.ticketId ? 'Edit Ticket' : `New ${form.type}`} size="lg">
        {/* Type selector (new only) */}
        {!form.ticketId && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {TICKET_TYPES.map(t => (
              <button key={t}
                className="btn btn-ghost"
                style={{ flex: 1, justifyContent: 'center', borderColor: form.type === t ? typeAccent[t] : undefined, color: form.type === t ? typeAccent[t] : undefined, background: form.type === t ? `${typeAccent[t]}11` : undefined }}
                onClick={() => setForm(f => ({ ...f, type: t }))}>
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Customer search */}
        <Field label="Customer *">
          <div style={{ position: 'relative' }}>
            <Input placeholder="Search customer…" value={custSearch} onChange={e => searchCustomers(e.target.value)} />
            {custResults.length > 0 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                background: 'var(--surface)', border: '1px solid var(--border-hi)',
                borderRadius: 10, maxHeight: 220, overflowY: 'auto',
                zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}>
                {custResults.map(c => (
                  <div key={c.customerId} onClick={() => selectCustomer(c)}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(56,217,245,0.06)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{c.customerName}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{c.contact} · {c.city} {c.rac ? `· ${c.rac}` : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
          <Field label="Title / Subject *" style={{ gridColumn: 'span 2' }}>
            <Input placeholder="Brief description" value={form.title} onChange={set('title')} />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={set('category')}>
              <option value="">Select…</option>
              <CategoryOptions type={form.type} />
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={set('priority')}>
              {['Low','Medium','High','Critical'].map(p => <option key={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {TICKET_STATUSES.map(s => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Assigned To">
            <Input placeholder="Team member or dept" value={form.assignedTo} onChange={set('assignedTo')} />
          </Field>

          {form.type === 'Lead' && (
            <>
              <Field label="Package"><Select value={form.package} onChange={set('package')}><option value="">Select…</option>{['Basic Tracker','Standard','Premium','Fleet Bundle','Enterprise / Custom'].map(o=><option key={o}>{o}</option>)}</Select></Field>
              <Field label="No. of Vehicles"><Input type="number" min="1" value={form.vehicles} onChange={set('vehicles')} /></Field>
              <Field label="Lead Source"><Select value={form.leadSource} onChange={set('leadSource')}><option value="">Select…</option>{['Referral','Walk-in','WhatsApp','Social Media','Cold Call','Website','Existing Client','Other'].map(o=><option key={o}>{o}</option>)}</Select></Field>
              <Field label="Sales Person"><Input value={form.salesperson} onChange={set('salesperson')} /></Field>
              <Field label="Follow-up Date"><Input type="date" value={form.followupDate} onChange={set('followupDate')} /></Field>
            </>
          )}
          {(form.type === 'Query' || form.type === 'Complaint') && (
            <Field label="Due / Resolution Date"><Input type="date" value={form.dueDate} onChange={set('dueDate')} /></Field>
          )}
          {form.type === 'Complaint' && (
            <Field label="Severity">
              <Select value={form.severity} onChange={set('severity')}>
                <option value="">Select…</option>
                {['Minor — Inconvenience only','Moderate — Affects daily usage','Major — Service completely down','Critical — Financial or data loss'].map(o=><option key={o}>{o}</option>)}
              </Select>
            </Field>
          )}
        </div>

        <Field label="Description">
          <Textarea placeholder="Full details…" value={form.description} onChange={set('description')} />
        </Field>
        <Field label="Internal Notes">
          <Textarea placeholder="Internal notes only" value={form.notes} onChange={set('notes')} style={{ minHeight: 60 }} />
        </Field>

        {formErr && <div style={{ padding: '10px 14px', background: 'rgba(255,95,109,0.08)', border: '1px solid rgba(255,95,109,0.3)', borderRadius: 8, color: 'var(--danger)', fontSize: 11, marginBottom: 8 }}>⚠ {formErr}</div>}

        <ModalButtons>
          <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={save}>{saving ? 'Saving…' : (form.ticketId ? 'Save Changes' : `Submit ${form.type}`)}</button>
        </ModalButtons>
      </Modal>
    </>
  );
}
