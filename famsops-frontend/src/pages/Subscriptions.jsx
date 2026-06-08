import { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Search, Layers, AlertTriangle } from 'lucide-react';
import { Topbar }     from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { StatTile }   from '../components/ui/StatTile';
import { Badge }      from '../components/ui/Badge';
import { DataTable }  from '../components/ui/DataTable';
import { Drawer, DrawerSection, InfoGrid, InfoItem } from '../components/ui/Drawer';
import { Modal, ModalButtons } from '../components/ui/Modal';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { CustomerSearch } from '../components/ui/CustomerSearch';
import { api }  from '../api/client';
import { usePermission } from '../hooks/usePermission';
import { formatDate } from '../lib/utils';

const PLANS   = ['Basic','Standard','Premium','Fleet Bundle','Enterprise'];
const CYCLES  = ['monthly','quarterly','annual'];
const STATUS_COLOR = {
  Active:    'var(--success)', Pending:  'var(--warn)',
  Suspended: 'var(--accent3)', Cancelled:'var(--muted)', Expired:'var(--danger)',
};

const BLANK = {
  planName:'Standard', billingCycle:'monthly', ratePerVehicle:'',
  vehicleCount:1, startDate:new Date().toISOString().split('T')[0],
  endDate:'', autoRenew:true, notes:'',
};

export default function Subscriptions() {
  const canCreate  = usePermission('subscriptions','create');
  const canUpdate  = usePermission('subscriptions','update');
  const canCancel  = usePermission('subscriptions','cancel');

  const [subs,setSubs]         = useState([]);
  const [loading,setLoading]   = useState(false);
  const [search,setSearch]     = useState('');
  const [statFilter,setStatFilter] = useState('');
  const [selected,setSelected] = useState(null);
  const [showNew,setShowNew]   = useState(false);
  const [form,setForm]         = useState(BLANK);
  const [customer,setCustomer] = useState(null);
  const [custErr,setCustErr]   = useState('');
  const [saving,setSaving]     = useState(false);
  const [formErr,setFormErr]   = useState('');
  const [cancelModal,setCancelModal] = useState(null);
  const [cancelReason,setCancelReason] = useState('');

  const load = async () => {
    setLoading(true);
    try { const {data} = await api.subscriptions.list(); setSubs(data.data||data||[]); }
    catch { setSubs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let r = subs;
    if (search)     r = r.filter(s=>[s.subscriptionId,s.customerName,s.planName].some(v=>(v||'').toLowerCase().includes(search.toLowerCase())));
    if (statFilter) r = r.filter(s=>s.status===statFilter);
    return r;
  }, [subs, search, statFilter]);

  const stats = useMemo(() => ({
    total:   subs.length,
    active:  subs.filter(s=>s.status==='Active').length,
    pending: subs.filter(s=>s.status==='Pending').length,
    expiring:subs.filter(s=>s.endDate && new Date(s.endDate)-Date.now()<30*86400000 && s.status==='Active').length,
    mrr:     subs.filter(s=>s.status==='Active').reduce((t,s)=>t+Number(s.monthlyAmount||0),0),
  }), [subs]);

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const save = async () => {
    if (!customer?.customerId) { setCustErr('Select a customer'); return; }
    if (!form.ratePerVehicle)  { setFormErr('Rate per vehicle required'); return; }
    setSaving(true); setFormErr('');
    try {
      await api.subscriptions.create({...form,
        customerId: customer.customerId, customerName: customer.customerName});
      setShowNew(false); load();
    } catch(e) { setFormErr(e.response?.data?.message||'Save failed'); }
    finally { setSaving(false); }
  };

  const activate = async id => {
    try { await api.subscriptions.activate(id); load(); setSelected(null); }
    catch(e) { alert(e.response?.data?.message||'Failed'); }
  };

  const doCancel = async () => {
    try { await api.subscriptions.cancel(cancelModal.subscriptionId,{reason:cancelReason}); setCancelModal(null); setCancelReason(''); load(); setSelected(null); }
    catch(e) { alert(e.response?.data?.message||'Failed'); }
  };

  const columns = [
    {key:'subscriptionId', label:'ID',       render:v=><span style={{fontFamily:'monospace',fontSize:10,color:'var(--accent2)'}}>{v}</span>},
    {key:'customerName',   label:'Customer', render:v=><strong style={{fontSize:12}}>{v||'—'}</strong>},
    {key:'planName',       label:'Plan',     render:v=><span style={{fontSize:11}}>{v}</span>},
    {key:'billingCycle',   label:'Cycle',    render:v=><span style={{fontSize:11,color:'var(--muted)',textTransform:'capitalize'}}>{v}</span>},
    {key:'vehicleCount',   label:'Vehicles', render:v=><span style={{fontFamily:'Syne',fontWeight:700,fontSize:13}}>{v}</span>},
    {key:'monthlyAmount',  label:'Monthly',  render:v=><span style={{fontFamily:'Syne',fontWeight:700,fontSize:12,color:'var(--success)'}}>PKR {Number(v||0).toLocaleString()}</span>},
    {key:'nextBillingDate',label:'Next Bill',render:v=><span style={{fontSize:11,color:v&&new Date(v)<new Date()?'var(--danger)':'var(--muted)'}}>{formatDate(v)}</span>},
    {key:'endDate',        label:'Expires',  render:v=>{
      if (!v) return <span style={{color:'var(--muted)',fontSize:11}}>—</span>;
      const soon = new Date(v)-Date.now()<30*86400000;
      return <span style={{fontSize:11,color:soon?'var(--warn)':'var(--muted)',display:'flex',alignItems:'center',gap:4}}>
        {soon&&<AlertTriangle size={10}/>}{formatDate(v)}
      </span>;
    }},
    {key:'status',         label:'Status',   render:v=><span style={{fontSize:10,fontWeight:700,color:STATUS_COLOR[v]||'var(--muted)',textTransform:'uppercase',letterSpacing:.8}}>{v}</span>},
    {key:'subscriptionId', label:'',         sortable:false, render:(_,row)=>(
      <div style={{display:'flex',gap:5}}>
        {canUpdate && row.status==='Pending' && <button className="btn btn-ghost btn-sm" style={{color:'var(--success)',borderColor:'rgba(61,255,160,.3)'}} onClick={e=>{e.stopPropagation();activate(row.subscriptionId);}}>Activate</button>}
        {canCancel && ['Active','Pending'].includes(row.status) && <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={e=>{e.stopPropagation();setCancelModal(row);}}>Cancel</button>}
        <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();setSelected(row);}}>View</button>
      </div>
    )},
  ];

  return (
    <>
      <Topbar title="Subscriptions" subtitle="Recurring billing — Monthly Recurring Revenue"
        actions={canCreate && <button className="btn btn-solid btn-sm" onClick={()=>{setForm(BLANK);setCustomer(null);setCustErr('');setFormErr('');setShowNew(true);}}><Plus size={13}/> New Subscription</button>}/>
      <PageContent>

        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:22}}>
          <StatTile label="Total"    value={stats.total}   color="t-cyan"/>
          <StatTile label="Active"   value={stats.active}  color="t-green"/>
          <StatTile label="Pending"  value={stats.pending} color="t-warn"/>
          <StatTile label="Expiring" value={stats.expiring} sub="within 30 days" color="t-pink"/>
          <StatTile label="MRR"      value={`PKR ${Math.round(stats.mrr/1000)}K`} color="t-purple"/>
        </div>

        <div className="card">
          <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:200,position:'relative'}}>
              <Search size={13} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
              <input className="field-input" style={{paddingLeft:34}} placeholder="Customer, SUB ID, plan…"
                value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <select className="field-input" style={{width:140,appearance:'none',cursor:'pointer'}} value={statFilter} onChange={e=>setStatFilter(e.target.value)}>
              <option value="">All Status</option>
              {['Active','Pending','Suspended','Cancelled','Expired'].map(s=><option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12}/></button>
          </div>
          <DataTable columns={columns} data={filtered} loading={loading} onRowClick={setSelected} emptyMessage="No subscriptions yet"/>
        </div>
      </PageContent>

      {/* Detail Drawer */}
      <Drawer open={!!selected} onClose={()=>setSelected(null)}
        title={selected?.subscriptionId||'—'} subtitle={`${selected?.customerName} · ${selected?.planName}`}
        actions={<>
          {canUpdate && selected?.status==='Pending' && <button className="btn btn-ghost btn-sm" style={{color:'var(--success)'}} onClick={()=>activate(selected.subscriptionId)}>Activate</button>}
          {canCancel && ['Active','Pending'].includes(selected?.status) && <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={()=>setCancelModal(selected)}>Cancel</button>}
        </>}>
        {selected&&(<>
          <DrawerSection title="Plan Details"/>
          <InfoGrid>
            <InfoItem label="Plan"         value={selected.planName}/>
            <InfoItem label="Status"       value={selected.status}/>
            <InfoItem label="Billing"      value={selected.billingCycle}/>
            <InfoItem label="Vehicles"     value={selected.vehicleCount}/>
            <InfoItem label="Rate/Vehicle" value={`PKR ${Number(selected.ratePerVehicle||0).toLocaleString()}`}/>
            <InfoItem label="Monthly Amt"  value={`PKR ${Number(selected.monthlyAmount||0).toLocaleString()}`}/>
            <InfoItem label="Start Date"   value={formatDate(selected.startDate)}/>
            <InfoItem label="End Date"     value={selected.endDate?formatDate(selected.endDate):'Ongoing'}/>
            <InfoItem label="Next Billing" value={formatDate(selected.nextBillingDate)}/>
            <InfoItem label="Auto Renew"   value={selected.autoRenew?'Yes':'No'}/>
          </InfoGrid>
          {selected.notes&&(<><DrawerSection title="Notes"/><p style={{fontSize:12,color:'var(--muted)',background:'var(--surface2)',borderRadius:8,padding:'12px 14px'}}>{selected.notes}</p></>)}
        </>)}
      </Drawer>

      {/* New Subscription Modal */}
      <Modal open={showNew} onClose={()=>setShowNew(false)} title="New Subscription" size="md">
        <Field label="Customer *">
          <CustomerSearch value={customer} onChange={c=>{setCustomer(c);setCustErr('');}}
            onClear={()=>setCustomer(null)} error={custErr}/>
        </Field>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 18px'}}>
          <Field label="Plan *">
            <Select value={form.planName} onChange={set('planName')}>{PLANS.map(p=><option key={p}>{p}</option>)}</Select>
          </Field>
          <Field label="Billing Cycle *">
            <Select value={form.billingCycle} onChange={set('billingCycle')}>{CYCLES.map(c=><option key={c}>{c}</option>)}</Select>
          </Field>
          <Field label="Rate per Vehicle (PKR) *"><Input type="number" min="0" value={form.ratePerVehicle} onChange={set('ratePerVehicle')}/></Field>
          <Field label="Number of Vehicles"><Input type="number" min="1" value={form.vehicleCount} onChange={set('vehicleCount')}/></Field>
          <Field label="Start Date *"><Input type="date" value={form.startDate} onChange={set('startDate')}/></Field>
          <Field label="End Date (blank = ongoing)"><Input type="date" value={form.endDate} onChange={set('endDate')}/></Field>
        </div>
        {/* Preview */}
        {form.ratePerVehicle && (
          <div style={{padding:'12px 14px',background:'rgba(61,255,160,.06)',border:'1px solid rgba(61,255,160,.2)',borderRadius:8,marginBottom:12,fontSize:11,color:'var(--success)'}}>
            💰 Monthly amount: <strong>PKR {(Number(form.ratePerVehicle||0)*Number(form.vehicleCount||1)).toLocaleString()}</strong>
            {form.billingCycle==='annual' && <span style={{color:'var(--muted)',marginLeft:8}}>· Annual: PKR {(Number(form.ratePerVehicle||0)*Number(form.vehicleCount||1)*12).toLocaleString()}</span>}
          </div>
        )}
        <Field label="Notes"><Textarea value={form.notes} onChange={set('notes')} style={{minHeight:50}}/></Field>
        {formErr&&<div style={{padding:'10px 14px',background:'rgba(255,95,109,.08)',border:'1px solid rgba(255,95,109,.3)',borderRadius:8,color:'var(--danger)',fontSize:11,marginBottom:8}}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={()=>setShowNew(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={save}>{saving?'Saving…':'Create Subscription'}</button>
        </ModalButtons>
      </Modal>

      {/* Cancel Modal */}
      <Modal open={!!cancelModal} onClose={()=>setCancelModal(null)} title="Cancel Subscription" size="sm">
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:14}}>Cancel subscription for <strong>{cancelModal?.customerName}</strong>? This will stop billing.</p>
        <Field label="Reason"><Textarea value={cancelReason} onChange={e=>setCancelReason(e.target.value)} style={{minHeight:70}}/></Field>
        <ModalButtons>
          <button className="btn btn-ghost" onClick={()=>setCancelModal(null)}>Keep Active</button>
          <button className="btn btn-danger" onClick={doCancel}>Cancel Subscription</button>
        </ModalButtons>
      </Modal>
    </>
  );
}
