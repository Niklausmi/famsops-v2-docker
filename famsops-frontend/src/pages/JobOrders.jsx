import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, RefreshCw, Search, ChevronDown, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Topbar }    from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { StatTile }  from '../components/ui/StatTile';
import { Badge }     from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { Drawer, DrawerSection, InfoGrid, InfoItem } from '../components/ui/Drawer';
import { Modal, ModalButtons } from '../components/ui/Modal';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { CustomerSearch } from '../components/ui/CustomerSearch';
import { api } from '../api/client';
import { formatDate, CITIES, PACKAGES } from '../lib/utils';

const JO_TYPES    = ['New Installation','Replacement','Removal','Repair / Service','Relocation','SIM Swap','AMC Visit'];
const JO_STATUSES = ['Scheduled','In Progress','Completed','Cancelled','On Hold'];

const BLANK = {
  invoiceNumber:'', toc:'New Installation', date:new Date().toISOString().split('T')[0],
  customerId:'', customerName:'', contact:'', city:'', rac:'', company:'',
  registrationNo:'', vehicleMake:'', vehicleModel:'', vehicleColor:'', vehicleYear:'',
  trackerIMEI:'', simNumber:'', technicianId:'', installerName:'', installCity:'', package:'',
  amcDuration:'', amcExpiry:'', status:'Scheduled',
  amount:'', paymentStatus:'', paymentMethod:'', notes:'', followupDate:'',
};

const STATUS_DOT_COLOR = {
  Available:'var(--success)', Assigned:'var(--warn)', Installed:'var(--warn)',
  Faulty:'var(--danger)',     Disabled:'var(--danger)', Removed:'var(--muted)',
};

/* ─────────────────────────────────────────────────────
   DeviceSearch — searchable inventory picker for
   Tracker IMEI or SIM Number
   Props:
     type     'tracker' | 'sim'
     items    array from inventory API
     value    selected IMEI / SIM string
     onChange fn(string)
     onClear  fn()
     disabled bool
───────────────────────────────────────────────────── */
function DeviceSearch({ type, items=[], value, onChange, onClear, disabled }) {
  const [q, setQ]       = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef         = useRef(null);
  const inputRef        = useRef(null);
  const isTracker       = type === 'tracker';

  const selected = items.find(i => (isTracker ? i.imei : i.simNumber) === value) || null;

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = useMemo(() => {
    if (!q) return items;
    const lq = q.toLowerCase();
    return items.filter(i => isTracker
      ? (i.imei||'').includes(lq) || (i.model||'').toLowerCase().includes(lq) || (i.supplier||'').toLowerCase().includes(lq)
      : (i.simNumber||'').includes(lq) || (i.simProvider||'').toLowerCase().includes(lq) || (i.dataPackage||'').toLowerCase().includes(lq)
    );
  }, [items, q, isTracker]);

  const pick = item => { onChange(isTracker ? item.imei : item.simNumber); setQ(''); setOpen(false); };
  const clear = e  => { e.stopPropagation(); setQ(''); setOpen(false); onClear?.(); };

  const available = items.filter(i => i.status === 'Available').length;

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>

      {/* ── Trigger ── */}
      <div
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          display:'flex', alignItems:'center', gap:8,
          background:'var(--surface2)',
          border:`1px solid ${open ? 'rgba(56,217,245,.45)' : value ? 'rgba(61,255,160,.35)' : 'var(--border)'}`,
          borderRadius:8, padding:'9px 12px', cursor: disabled ? 'not-allowed' : 'pointer',
          transition:'all .18s', minHeight:38,
          boxShadow: open ? '0 0 0 3px rgba(56,217,245,.07)' : 'none',
        }}
      >
        {value ? (
          <>
            <span style={{fontFamily:'monospace',fontSize:12,color:'var(--text)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {value}
            </span>
            {selected && (
              <span style={{fontSize:10,color:'var(--muted)',flexShrink:0}}>
                {isTracker ? selected.model : selected.simProvider}
              </span>
            )}
            <button onClick={clear} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',padding:2,display:'flex',alignItems:'center',flexShrink:0}}>
              <X size={12}/>
            </button>
          </>
        ) : (
          <>
            <span style={{fontSize:11,color:'var(--muted)',flex:1}}>
              {disabled ? 'Loading inventory…' : `Select from inventory (${available} available)`}
            </span>
            <ChevronDown size={13} style={{color:'var(--muted)',flexShrink:0,transition:'transform .2s',transform:open?'rotate(180deg)':'none'}}/>
          </>
        )}
      </div>

      {/* ── Selected pill ── */}
      {value && selected && (
        <div style={{
          marginTop:6, padding:'8px 12px',
          background: selected.status==='Available' ? 'rgba(61,255,160,.06)' : 'rgba(255,179,71,.06)',
          border:`1px solid ${selected.status==='Available' ? 'rgba(61,255,160,.2)' : 'rgba(255,179,71,.2)'}`,
          borderRadius:7, display:'flex', gap:10, alignItems:'center',
        }}>
          {selected.status==='Available'
            ? <CheckCircle size={12} style={{color:'var(--success)',flexShrink:0}}/>
            : <AlertCircle size={12} style={{color:'var(--warn)',flexShrink:0}}/>}
          <div style={{flex:1,minWidth:0,fontSize:10,color:'var(--muted)'}}>
            {isTracker
              ? <><strong style={{color:'var(--text)'}}>{selected.model||'—'}</strong> · {selected.supplier||'—'}{selected.purchasePrice?` · PKR ${Number(selected.purchasePrice).toLocaleString()}`:''}</>
              : <><strong style={{color:'var(--text)'}}>{selected.simProvider||'—'}</strong> · {selected.dataPackage||'—'}{selected.monthlyRate?` · PKR ${Number(selected.monthlyRate).toLocaleString()}/mo`:''}{selected.expiryDate?` · Exp: ${formatDate(selected.expiryDate)}`:''}</>
            }
          </div>
          <span style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:STATUS_DOT_COLOR[selected.status]||'var(--muted)',flexShrink:0}}>
            {selected.status}
          </span>
        </div>
      )}

      {/* ── Warning if not Available ── */}
      {value && selected && selected.status !== 'Available' && (
        <div style={{marginTop:4,fontSize:10,color:'var(--warn)',display:'flex',alignItems:'center',gap:5}}>
          <AlertCircle size={10}/> This device is currently <strong>{selected.status}</strong> — saving will override its status
        </div>
      )}

      {/* ── Dropdown ── */}
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
          background:'var(--surface)', border:'1px solid var(--border-hi)',
          borderRadius:12, zIndex:400,
          boxShadow:'0 16px 48px rgba(0,0,0,.65)',
          overflow:'hidden',
        }}>
          {/* Search header */}
          <div style={{padding:'10px 12px',borderBottom:'1px solid var(--border)',position:'sticky',top:0,background:'var(--surface)'}}>
            <div style={{position:'relative'}}>
              <Search size={12} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
              <input
                ref={inputRef}
                className="field-input"
                style={{paddingLeft:28,fontSize:11}}
                placeholder={isTracker ? 'Search IMEI, model, supplier…' : 'Search SIM number, provider, package…'}
                value={q}
                onChange={e => setQ(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
              <span style={{fontSize:10,color:'var(--muted)'}}>{filtered.length} result{filtered.length!==1?'s':''}</span>
              <span style={{fontSize:10,color:'var(--success)'}}>{available} available</span>
            </div>
          </div>

          {/* List */}
          <div style={{maxHeight:290,overflowY:'auto'}}>
            {filtered.length === 0 ? (
              <div style={{padding:'18px',fontSize:11,color:'var(--muted)',textAlign:'center'}}>
                No {isTracker?'trackers':'SIMs'} match "{q}"
              </div>
            ) : filtered.map(item => {
              const key  = isTracker ? item.imei : item.simNumber;
              const isSel = key === value;
              const dot  = STATUS_DOT_COLOR[item.status] || 'var(--muted)';
              return (
                <div
                  key={key}
                  onClick={() => pick(item)}
                  style={{
                    padding:'11px 14px', cursor:'pointer',
                    borderBottom:'1px solid var(--border)',
                    background: isSel ? 'rgba(56,217,245,.07)' : 'transparent',
                    transition:'background .1s',
                    display:'flex', alignItems:'center', gap:12,
                  }}
                  onMouseOver={e=>{if(!isSel) e.currentTarget.style.background='rgba(255,255,255,.025)';}}
                  onMouseOut={e=>{if(!isSel) e.currentTarget.style.background='transparent';}}
                >
                  {/* Status dot */}
                  <div style={{width:8,height:8,borderRadius:'50%',background:dot,flexShrink:0,boxShadow:`0 0 6px ${dot}`}}/>

                  <div style={{flex:1,minWidth:0}}>
                    {/* Primary — IMEI / SIM */}
                    <div style={{fontFamily:'monospace',fontSize:12,color:isSel?'var(--accent)':'var(--text)',fontWeight:600}}>
                      {key}
                    </div>
                    {/* Detail line */}
                    <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>
                      {isTracker
                        ? [item.model, item.supplier, item.purchasePrice && `PKR ${Number(item.purchasePrice).toLocaleString()}`].filter(Boolean).join(' · ')
                        : [item.simProvider, item.dataPackage, item.monthlyRate && `PKR ${Number(item.monthlyRate).toLocaleString()}/mo`, item.expiryDate && `Exp: ${formatDate(item.expiryDate)}`].filter(Boolean).join(' · ')
                      }
                    </div>
                  </div>

                  {/* Status label */}
                  <span style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:dot,flexShrink:0}}>
                    {item.status}
                  </span>

                  {isSel && <CheckCircle size={13} style={{color:'var(--accent)',flexShrink:0}}/>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Main page component
───────────────────────────────────────────────────── */
export default function JobOrders() {
  const [jobs,setJobs]           = useState([]);
  const [loading,setLoading]     = useState(false);
  const [search,setSearch]       = useState('');
  const [tocFilter,setTocFilter] = useState('');
  const [statFilter,setStatFilter]= useState('');
  const [selected,setSelected]   = useState(null);
  const [showEdit,setShowEdit]   = useState(false);
  const [form,setForm]           = useState(BLANK);
  const [saving,setSaving]       = useState(false);
  const [formErr,setFormErr]     = useState('');

  const [customer,setCustomer]   = useState(null);
  const [custErr,setCustErr]     = useState('');

  const [trackers,setTrackers]   = useState([]);
  const [sims,setSims]           = useState([]);
  const [invLoading,setInvLoading]= useState(false);

  const [technicians,setTechs]   = useState([]);

  const [searchParams] = useSearchParams();

  const load = async () => {
    setLoading(true);
    try { const {data} = await api.jobOrders.list(); setJobs(data.data||data||[]); }
    catch { setJobs([]); }
    finally { setLoading(false); }
  };

  const loadInventory = async () => {
    setInvLoading(true);
    try {
      const [tr,si] = await Promise.all([
        api.inventory.trackers({limit:500}),
        api.inventory.sims({limit:500}),
      ]);
      setTrackers(tr.data.data||tr.data||[]);
      setSims(si.data.data||si.data||[]);
    } catch { setTrackers([]); setSims([]); }
    finally { setInvLoading(false); }
  };

  useEffect(() => {
    load();
    api.technicians.list().then(r=>setTechs(r.data.data||r.data||[])).catch(()=>{});
    if (searchParams.get('new')==='1') openNew();
  }, []);

  const filtered = useMemo(() => {
    let r = jobs;
    if (search)     r=r.filter(j=>[j.customerName,j.invoiceNumber,j.registrationNo,j.trackerIMEI,j.simNumber,j.installerName].some(v=>(v||'').toLowerCase().includes(search.toLowerCase())));
    if (tocFilter)  r=r.filter(j=>j.toc===tocFilter);
    if (statFilter) r=r.filter(j=>j.status===statFilter);
    return r;
  }, [jobs, search, tocFilter, statFilter]);

  const counts = useMemo(() => ({
    total:     jobs.length,
    scheduled: jobs.filter(j=>j.status==='Scheduled').length,
    completed: jobs.filter(j=>j.status==='Completed').length,
    today:     jobs.filter(j=>j.date===new Date().toISOString().split('T')[0]).length,
  }), [jobs]);

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const openNew = () => {
    setForm({...BLANK, date:new Date().toISOString().split('T')[0]});
    setCustomer(null); setCustErr(''); setFormErr('');
    setShowEdit(true);
    loadInventory();
  };

  const openEdit = j => {
    setForm({...BLANK,...j});
    setCustomer(j.customerId ? {customerId:j.customerId,customerName:j.customerName,contact:j.contact,city:j.city} : null);
    setCustErr(''); setFormErr('');
    setSelected(null);
    setShowEdit(true);
    loadInventory();
  };

  const onSelectCustomer = c => {
    setCustomer(c);
    setForm(f=>({...f,customerId:c.customerId,customerName:c.customerName,contact:c.contact,city:c.city||'',rac:c.rac||'',company:c.company||''}));
    setCustErr('');
  };

  const save = async () => {
    if (!customer?.customerId)   { setCustErr('Please select a customer'); return; }
    if (!form.registrationNo)    { setFormErr('Registration number is required'); return; }
    if (!form.installerName && !form.technicianId) { setFormErr('Select a technician or enter installer name'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload = {...form, customerId:customer.customerId, customerName:customer.customerName, contact:customer.contact, city:customer.city||''};
      if (form.invoiceNumber) await api.jobOrders.update(form.invoiceNumber, payload);
      else                    await api.jobOrders.create(payload);
      setShowEdit(false); load();
    } catch(e) { setFormErr(e.response?.data?.message||'Save failed'); }
    finally { setSaving(false); }
  };

  const tocColor = {'New Installation':'var(--accent)',Replacement:'var(--warn)',Removal:'var(--danger)','AMC Visit':'var(--accent2)'};
  const availTrackers = trackers.filter(t=>t.status==='Available').length;
  const availSims     = sims.filter(s=>s.status==='Available').length;

  const Div = ({title}) => (
    <div style={{fontSize:9,letterSpacing:2,textTransform:'uppercase',color:'var(--muted)',padding:'14px 0 8px',display:'flex',alignItems:'center',gap:10}}>
      {title}<div style={{flex:1,height:1,background:'var(--border)'}}/>
    </div>
  );

  const columns = [
    {key:'date',          label:'Date',    render:v=><span style={{color:'var(--muted)',fontSize:11}}>{formatDate(v)}</span>},
    {key:'invoiceNumber', label:'Invoice', render:v=><span style={{fontFamily:'monospace',fontSize:10,color:'var(--accent2)'}}>{v}</span>},
    {key:'toc',           label:'Type',    render:v=><span style={{fontSize:10,fontWeight:600,color:tocColor[v]||'var(--muted)',textTransform:'uppercase',letterSpacing:.8}}>{v}</span>},
    {key:'customerName',  label:'Customer',render:v=><strong style={{fontSize:12}}>{v||'—'}</strong>},
    {key:'registrationNo',label:'Reg No.', render:v=><span style={{fontFamily:'monospace',color:'var(--accent)'}}>{v||'—'}</span>},
    {key:'trackerIMEI',   label:'IMEI',    render:v=><span style={{fontFamily:'monospace',fontSize:10,color:'var(--muted)'}}>{v||'—'}</span>},
    {key:'simNumber',     label:'SIM',     render:v=><span style={{fontFamily:'monospace',fontSize:10,color:'var(--muted)'}}>{v||'—'}</span>},
    {key:'installerName', label:'Installer',render:v=><span style={{fontSize:11,color:'var(--muted)'}}>{v||'—'}</span>},
    {key:'status',        label:'Status',  render:v=><Badge variant={v?.toLowerCase().replace(/ /g,'-')}>{v}</Badge>},
    {key:'invoiceNumber', label:'',        sortable:false, render:(_,row)=>(
      <div style={{display:'flex',gap:5}}>
        <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();openEdit(row);}}>Edit</button>
        <button className="btn btn-primary btn-sm" onClick={e=>{e.stopPropagation();setSelected(row);}}>View</button>
      </div>
    )},
  ];

  return (
    <>
      <Topbar title="Job Orders" subtitle="Installation · Replacement · Service"
        actions={<button className="btn btn-solid btn-sm" onClick={openNew}><Plus size={13}/> New Job Order</button>}/>
      <PageContent>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:22}}>
          <StatTile label="Total"     value={counts.total}     color="t-cyan"/>
          <StatTile label="Scheduled" value={counts.scheduled} color="t-purple"/>
          <StatTile label="Completed" value={counts.completed} color="t-green"/>
          <StatTile label="Today"     value={counts.today}     color="t-warn"/>
        </div>
        <div className="card">
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16,alignItems:'center'}}>
            <div style={{flex:1,minWidth:200,position:'relative'}}>
              <Search size={13} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
              <input className="field-input" style={{paddingLeft:34}} placeholder="Customer, invoice, reg no., IMEI, SIM, installer…"
                value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <select className="field-input" style={{width:180,appearance:'none',cursor:'pointer'}} value={tocFilter} onChange={e=>setTocFilter(e.target.value)}>
              <option value="">All Types</option>{JO_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
            <select className="field-input" style={{width:140,appearance:'none',cursor:'pointer'}} value={statFilter} onChange={e=>setStatFilter(e.target.value)}>
              <option value="">All Status</option>{JO_STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12}/></button>
          </div>
          <DataTable columns={columns} data={filtered} loading={loading} onRowClick={setSelected} emptyMessage="No job orders found"/>
        </div>
      </PageContent>

      {/* Detail Drawer */}
      <Drawer open={!!selected} onClose={()=>setSelected(null)}
        title={selected?.invoiceNumber||'—'} subtitle={`${selected?.toc} · ${selected?.customerName}`}
        actions={<button className="btn btn-primary btn-sm" onClick={()=>openEdit(selected)}>✏ Edit</button>}>
        {selected&&(<>
          <DrawerSection title="Job Details"/>
          <InfoGrid>
            <InfoItem label="Invoice No."  value={selected.invoiceNumber}/>
            <InfoItem label="Date"         value={formatDate(selected.date)}/>
            <InfoItem label="Type"         value={selected.toc}/>
            <InfoItem label="Status"       value={selected.status}/>
            <InfoItem label="Package"      value={selected.package}/>
            <InfoItem label="Installer"    value={selected.technicianName||selected.installerName}/>
            <InfoItem label="Install City" value={selected.installCity}/>
            <InfoItem label="AMC Expiry"   value={formatDate(selected.amcExpiry)}/>
            <InfoItem label="Amount"       value={selected.amount?`PKR ${Number(selected.amount).toLocaleString()}`:'—'}/>
            <InfoItem label="Payment"      value={[selected.paymentStatus,selected.paymentMethod].filter(Boolean).join(' · ')}/>
          </InfoGrid>
          <DrawerSection title="Customer"/>
          <InfoGrid>
            <InfoItem label="Name"    value={selected.customerName}/>
            <InfoItem label="Contact" value={selected.contact}/>
            <InfoItem label="RAC"     value={selected.rac}/>
            <InfoItem label="Company" value={selected.company}/>
          </InfoGrid>
          <DrawerSection title="Vehicle"/>
          <InfoGrid>
            <InfoItem label="Registration" value={selected.registrationNo}/>
            <InfoItem label="Vehicle"      value={[selected.vehicleMake,selected.vehicleModel,selected.vehicleColor].filter(Boolean).join(' ')}/>
            <InfoItem label="Year"         value={selected.vehicleYear}/>
          </InfoGrid>
          <DrawerSection title="Devices"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:6}}>
            {[
              {l:'Tracker IMEI', v:selected.trackerIMEI, c:'var(--accent)'},
              {l:'SIM Number',   v:selected.simNumber,   c:'var(--accent2)'},
            ].map(d=>(
              <div key={d.l} style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px'}}>
                <div style={{fontSize:9,letterSpacing:1.5,textTransform:'uppercase',color:'var(--muted)',marginBottom:5}}>{d.l}</div>
                <div style={{fontFamily:'monospace',fontSize:12,color:d.v?d.c:'var(--muted)',fontWeight:600}}>{d.v||'Not assigned'}</div>
              </div>
            ))}
          </div>
          {selected.notes&&(<><DrawerSection title="Notes"/>
            <p style={{fontSize:12,color:'var(--text)',lineHeight:1.7,background:'var(--surface2)',borderRadius:8,padding:'12px 14px'}}>{selected.notes}</p></>)}
        </>)}
      </Drawer>

      {/* Add / Edit Modal */}
      <Modal open={showEdit} onClose={()=>setShowEdit(false)} title={form.invoiceNumber?'Edit Job Order':'New Job Order'} size="xl">

        {/* Header row */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'0 12px'}}>
          <Field label="Invoice No."><Input placeholder="Auto-generated" value={form.invoiceNumber} onChange={set('invoiceNumber')}/></Field>
          <Field label="Date *"><Input type="date" value={form.date} onChange={set('date')}/></Field>
          <Field label="Job Type *">
            <Select value={form.toc} onChange={set('toc')}>{JO_TYPES.map(t=><option key={t}>{t}</option>)}</Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>{JO_STATUSES.map(s=><option key={s}>{s}</option>)}</Select>
          </Field>
        </div>

        {/* Customer */}
        <Div title="Customer"/>
        <Field label="Search Customer *">
          <CustomerSearch value={customer} onChange={onSelectCustomer}
            onClear={()=>{setCustomer(null);setForm(f=>({...f,customerId:'',customerName:'',contact:'',city:'',rac:'',company:''}));}}
            error={custErr}/>
        </Field>

        {/* Vehicle */}
        <Div title="Vehicle"/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'0 10px'}}>
          <Field label="Reg No. *"><Input placeholder="ABC-000" value={form.registrationNo} onChange={set('registrationNo')}/></Field>
          <Field label="Make"><Input placeholder="Toyota" value={form.vehicleMake} onChange={set('vehicleMake')}/></Field>
          <Field label="Model"><Input placeholder="Corolla" value={form.vehicleModel} onChange={set('vehicleModel')}/></Field>
          <Field label="Color"><Input value={form.vehicleColor} onChange={set('vehicleColor')}/></Field>
          <Field label="Year"><Input type="number" min="1990" max="2099" value={form.vehicleYear} onChange={set('vehicleYear')}/></Field>
        </div>

        {/* Devices — inventory dropdowns */}
        <Div title={
          invLoading
            ? 'Devices — loading inventory…'
            : `Devices — ${availTrackers} tracker${availTrackers!==1?'s':''} available · ${availSims} SIM${availSims!==1?'s':''} available`
        }/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 18px'}}>
          <Field label="Tracker IMEI">
            <DeviceSearch type="tracker" items={trackers} value={form.trackerIMEI}
              onChange={v=>setForm(f=>({...f,trackerIMEI:v}))}
              onClear={()=>setForm(f=>({...f,trackerIMEI:''}))}
              disabled={invLoading}/>
          </Field>
          <Field label="SIM Number">
            <DeviceSearch type="sim" items={sims} value={form.simNumber}
              onChange={v=>setForm(f=>({...f,simNumber:v}))}
              onClear={()=>setForm(f=>({...f,simNumber:''}))}
              disabled={invLoading}/>
          </Field>
        </div>

        {/* Installation */}
        <Div title="Installation"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 12px'}}>
          <Field label="Technician">
            <Select value={form.technicianId||''} onChange={e=>{
              const t=technicians.find(x=>x.techId===e.target.value);
              setForm(f=>({...f,technicianId:e.target.value,installerName:t?.name||f.installerName}));
            }}>
              <option value="">Select technician…</option>
              {technicians.filter(t=>t.active!==false).map(t=>(
                <option key={t.techId} value={t.techId}>{t.name} — {t.city||'—'}</option>
              ))}
            </Select>
          </Field>
          <Field label="Installer Name"><Input placeholder="Manual override" value={form.installerName} onChange={set('installerName')}/></Field>
          <Field label="Install City">
            <Select value={form.installCity} onChange={set('installCity')}>
              <option value="">Select…</option>{CITIES.map(c=><option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Package">
            <Select value={form.package} onChange={set('package')}>
              <option value="">Select…</option>{PACKAGES.map(p=><option key={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="AMC Duration"><Input placeholder="1 Year" value={form.amcDuration} onChange={set('amcDuration')}/></Field>
          <Field label="AMC Expiry"><Input type="date" value={form.amcExpiry} onChange={set('amcExpiry')}/></Field>
        </div>

        {/* Payment */}
        <Div title="Payment"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 12px'}}>
          <Field label="Amount (PKR)"><Input type="number" value={form.amount} onChange={set('amount')}/></Field>
          <Field label="Payment Status">
            <Select value={form.paymentStatus||''} onChange={set('paymentStatus')}>
              <option value="">Select…</option>
              {['Pending','Received','Partial','Overdue'].map(s=><option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Payment Method">
            <Select value={form.paymentMethod||''} onChange={set('paymentMethod')}>
              <option value="">Select…</option>
              {['Cash','Bank Transfer','Cheque','Online / Mobile'].map(m=><option key={m}>{m}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Notes"><Textarea value={form.notes} onChange={set('notes')} style={{minHeight:60}}/></Field>

        {formErr&&<div style={{padding:'10px 14px',background:'rgba(255,95,109,.08)',border:'1px solid rgba(255,95,109,.3)',borderRadius:8,color:'var(--danger)',fontSize:11,marginBottom:8}}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={()=>setShowEdit(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving||invLoading} onClick={save}>
            {saving?'Saving…':(form.invoiceNumber?'Save Changes':'Create Job Order')}
          </button>
        </ModalButtons>
      </Modal>
    </>
  );
}
