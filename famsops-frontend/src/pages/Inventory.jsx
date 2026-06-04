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
import { formatDate, genId } from '../lib/utils';

const TRACKER_STATUSES = ['Available','Assigned','Faulty','Removed'];
const SIM_STATUSES     = ['Available','Installed','Lost','Disabled'];

export default function Inventory() {
  const [tab, setTab]               = useState('trackers');
  const [trackers, setTrackers]     = useState([]);
  const [sims, setSims]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [statFilter, setStatFilter] = useState('');
  const [selected, setSelected]     = useState(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [form, setForm]             = useState({});
  const [saving, setSaving]         = useState(false);
  const [formErr, setFormErr]       = useState('');

  const isTrackers = tab === 'trackers';

  const load = async () => {
    setLoading(true);
    try {
      const [tr, si] = await Promise.all([api.inventory.trackers(), api.inventory.sims()]);
      setTrackers(tr.data.data || tr.data || []);
      setSims(si.data.data || si.data || []);
    } catch { setTrackers([]); setSims([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const data = isTrackers ? trackers : sims;

  const filtered = useMemo(() => {
    let r = data;
    if (search)     r = r.filter(i => [i.imei, i.model, i.supplier, i.simNumber, i.simProvider, i.assignedTo].some(v => (v||'').toLowerCase().includes(search.toLowerCase())));
    if (statFilter) r = r.filter(i => i.status === statFilter);
    return r;
  }, [data, search, statFilter]);

  const counts = useMemo(() => {
    const total     = data.length;
    const available = data.filter(d => d.status === 'Available').length;
    const assigned  = data.filter(d => d.status === 'Assigned' || d.status === 'Installed').length;
    const problem   = data.filter(d => d.status === 'Faulty' || d.status === 'Lost' || d.status === 'Disabled').length;
    return { total, available, assigned, problem };
  }, [data]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const openStockIn = () => {
    setForm({ status: 'Available', qty: 1, dateReceived: new Date().toISOString().split('T')[0] });
    setFormErr('');
    setShowAdd(true);
  };

  const openEditItem = (item) => {
    setForm({ ...item });
    setFormErr('');
    setSelected(null);
    setShowEdit(true);
  };

  const saveStockIn = async () => {
    if (isTrackers && !form.imei)     { setFormErr('IMEI is required'); return; }
    if (!isTrackers && !form.simNumber) { setFormErr('SIM number is required'); return; }
    setSaving(true); setFormErr('');
    try {
      await api.inventory.stockIn({ ...form, type: tab });
      setShowAdd(false); load();
    } catch(e) { setFormErr(e.response?.data?.message || 'Failed to add stock'); }
    finally { setSaving(false); }
  };

  const saveEdit = async () => {
    setSaving(true); setFormErr('');
    try {
      if (isTrackers) await api.inventory.updateTracker(form.id || form.imei, form);
      else            await api.inventory.updateSim(form.id || form.simNumber, form);
      setShowEdit(false); load();
    } catch(e) { setFormErr(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const statuses = isTrackers ? TRACKER_STATUSES : SIM_STATUSES;

  const trackerCols = [
    { key: 'imei',       label: 'IMEI / Serial', render: v => <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)' }}>{v}</span> },
    { key: 'model',      label: 'Model',   render: v => <span style={{ fontSize: 11 }}>{v || '—'}</span> },
    { key: 'supplier',   label: 'Supplier',render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v || '—'}</span> },
    { key: 'dateReceived', label: 'Received', render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(v)}</span> },
    { key: 'purchasePrice', label: 'Price', render: v => <span style={{ fontSize: 11 }}>{v ? `PKR ${Number(v).toLocaleString()}` : '—'}</span> },
    { key: 'status',     label: 'Status',  render: v => <Badge variant={v?.toLowerCase()}>{v}</Badge> },
    { key: 'assignedTo', label: 'Assigned To', render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v || '—'}</span> },
    { key: 'city',       label: 'City',    render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v || '—'}</span> },
    { key: 'id',         label: 'Actions', sortable: false, render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); openEditItem(row); }}>Edit</button>
        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setSelected(row); }}>View</button>
      </div>
    )},
  ];

  const simCols = [
    { key: 'simNumber',   label: 'SIM Number', render: v => <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent2)' }}>{v}</span> },
    { key: 'simProvider', label: 'Provider',  render: v => <span style={{ fontSize: 11 }}>{v || '—'}</span> },
    { key: 'dataPackage', label: 'Package',   render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v || '—'}</span> },
    { key: 'monthlyRate', label: 'Rate/Mo',   render: v => <span style={{ fontSize: 11 }}>{v ? `PKR ${Number(v).toLocaleString()}` : '—'}</span> },
    { key: 'expiryDate',  label: 'Expiry',    render: v => <span style={{ fontSize: 11, color: v && new Date(v) < new Date() ? 'var(--danger)' : 'var(--muted)' }}>{formatDate(v)}</span> },
    { key: 'status',      label: 'Status',    render: v => <Badge variant={v?.toLowerCase()}>{v}</Badge> },
    { key: 'assignedTo',  label: 'Assigned',  render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v || '—'}</span> },
    { key: 'id',          label: 'Actions',   sortable: false, render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); openEditItem(row); }}>Edit</button>
        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setSelected(row); }}>View</button>
      </div>
    )},
  ];

  return (
    <>
      <Topbar
        title="Inventory"
        subtitle="SIMs & Trackers — stock, assignment & linking"
        actions={<button className="btn btn-solid btn-sm" onClick={openStockIn}><Plus size={13} /> Stock In</button>}
      />
      <PageContent>

        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 5, marginBottom: 22, maxWidth: 420 }}>
          {[
            { id: 'trackers', label: '📡 Trackers', cnt: trackers.length },
            { id: 'sims',     label: '💳 SIMs',     cnt: sims.length },
          ].map(t => (
            <button key={t.id}
              onClick={() => { setTab(t.id); setSearch(''); setStatFilter(''); }}
              style={{
                flex: 1, padding: '10px 16px', border: 'none', borderRadius: 8,
                background: tab === t.id ? (t.id === 'trackers' ? 'rgba(56,217,245,0.1)' : 'rgba(123,111,255,0.1)') : 'transparent',
                color: tab === t.id ? (t.id === 'trackers' ? 'var(--accent)' : 'var(--accent2)') : 'var(--muted)',
                borderColor: tab === t.id ? (t.id === 'trackers' ? 'rgba(56,217,245,0.2)' : 'rgba(123,111,255,0.2)') : 'transparent',
                fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: 1,
                textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {t.label}
              <span style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700 }}>{t.cnt}</span>
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
          <StatTile label="Total"         value={counts.total}     color="t-cyan"   />
          <StatTile label="Available"     value={counts.available} color="t-green"  />
          <StatTile label="Assigned / Installed" value={counts.assigned} color="t-purple" />
          <StatTile label="Faulty / Lost" value={counts.problem}   color="t-warn"   />
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input className="field-input" style={{ paddingLeft: 34 }}
                placeholder={isTrackers ? 'Search IMEI, model, supplier…' : 'Search SIM, provider…'}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="field-input" style={{ width: 140, appearance: 'none', cursor: 'pointer' }} value={statFilter} onChange={e => setStatFilter(e.target.value)}>
              <option value="">All Status</option>
              {statuses.map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12} /></button>
          </div>
          <DataTable columns={isTrackers ? trackerCols : simCols} data={filtered} loading={loading} onRowClick={setSelected} emptyMessage={`No ${tab} found`} />
        </div>

      </PageContent>

      {/* Detail Drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.imei || selected?.simNumber || '—'}
        subtitle={isTrackers ? selected?.model : selected?.simProvider}
        actions={<button className="btn btn-primary btn-sm" onClick={() => openEditItem(selected)}>✏ Edit</button>}
      >
        {selected && (
          <>
            <DrawerSection title={isTrackers ? 'Tracker Details' : 'SIM Details'} />
            <InfoGrid>
              {isTrackers ? (
                <>
                  <InfoItem label="IMEI"          value={selected.imei} />
                  <InfoItem label="Model"          value={selected.model} />
                  <InfoItem label="Supplier"       value={selected.supplier} />
                  <InfoItem label="Date Received"  value={formatDate(selected.dateReceived)} />
                  <InfoItem label="Purchase Price" value={selected.purchasePrice ? `PKR ${Number(selected.purchasePrice).toLocaleString()}` : '—'} />
                  <InfoItem label="Status"         value={selected.status} />
                  <InfoItem label="Assigned To"    value={selected.assignedTo} />
                  <InfoItem label="Installer"      value={selected.installer} />
                  <InfoItem label="City"           value={selected.city} />
                </>
              ) : (
                <>
                  <InfoItem label="SIM Number"   value={selected.simNumber} />
                  <InfoItem label="Provider"     value={selected.simProvider} />
                  <InfoItem label="Data Package" value={selected.dataPackage} />
                  <InfoItem label="Monthly Rate" value={selected.monthlyRate ? `PKR ${Number(selected.monthlyRate).toLocaleString()}` : '—'} />
                  <InfoItem label="Expiry"       value={formatDate(selected.expiryDate)} />
                  <InfoItem label="Status"       value={selected.status} />
                  <InfoItem label="Assigned To"  value={selected.assignedTo} />
                </>
              )}
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

      {/* Stock In Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`Stock In — ${isTrackers ? 'Tracker' : 'SIM'}`} size="md">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
          {isTrackers ? (
            <>
              <Field label="IMEI / Serial *"><Input placeholder="15-digit IMEI" value={form.imei||''} onChange={set('imei')} /></Field>
              <Field label="Model / Module"><Input placeholder="GT06N, FM3001…" value={form.model||''} onChange={set('model')} /></Field>
              <Field label="Supplier"><Input value={form.supplier||''} onChange={set('supplier')} /></Field>
              <Field label="Date Received"><Input type="date" value={form.dateReceived||''} onChange={set('dateReceived')} /></Field>
              <Field label="Quantity"><Input type="number" min="1" value={form.qty||1} onChange={set('qty')} /></Field>
              <Field label="Purchase Price (PKR)"><Input type="number" value={form.purchasePrice||''} onChange={set('purchasePrice')} /></Field>
            </>
          ) : (
            <>
              <Field label="SIM Number *"><Input placeholder="SIM number" value={form.simNumber||''} onChange={set('simNumber')} /></Field>
              <Field label="Provider"><Select value={form.simProvider||''} onChange={set('simProvider')}><option value="">Select…</option>{['Jazz','Zong','Telenor','Ufone','SCO'].map(p=><option key={p}>{p}</option>)}</Select></Field>
              <Field label="Data Package"><Input value={form.dataPackage||''} onChange={set('dataPackage')} /></Field>
              <Field label="Monthly Rate (PKR)"><Input type="number" value={form.monthlyRate||''} onChange={set('monthlyRate')} /></Field>
              <Field label="Expiry Date"><Input type="date" value={form.expiryDate||''} onChange={set('expiryDate')} /></Field>
              <Field label="Quantity"><Input type="number" min="1" value={form.qty||1} onChange={set('qty')} /></Field>
            </>
          )}
        </div>
        <Field label="Notes"><Textarea value={form.notes||''} onChange={set('notes')} style={{ minHeight: 60 }} /></Field>
        {formErr && <div style={{ padding: '10px 14px', background: 'rgba(255,95,109,0.08)', border: '1px solid rgba(255,95,109,0.3)', borderRadius: 8, color: 'var(--danger)', fontSize: 11, marginBottom: 8 }}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={saveStockIn}>{saving ? 'Adding…' : '+ Add to Stock'}</button>
        </ModalButtons>
      </Modal>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={`Edit ${isTrackers ? 'Tracker' : 'SIM'}`} size="md">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
          <Field label="Status">
            <Select value={form.status||''} onChange={set('status')}>
              {statuses.map(s => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Assigned To"><Input value={form.assignedTo||''} onChange={set('assignedTo')} /></Field>
          {isTrackers && (
            <>
              <Field label="Installer"><Input value={form.installer||''} onChange={set('installer')} /></Field>
              <Field label="City"><Input value={form.city||''} onChange={set('city')} /></Field>
            </>
          )}
        </div>
        <Field label="Notes"><Textarea value={form.notes||''} onChange={set('notes')} style={{ minHeight: 60 }} /></Field>
        {formErr && <div style={{ padding: '10px 14px', background: 'rgba(255,95,109,0.08)', border: '1px solid rgba(255,95,109,0.3)', borderRadius: 8, color: 'var(--danger)', fontSize: 11, marginBottom: 8 }}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </ModalButtons>
      </Modal>
    </>
  );
}
