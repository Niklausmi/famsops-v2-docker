import { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
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
import { formatDate, genId } from '../lib/utils';

// Tickets = Query | Complaint only. Leads live in Leads module.
const TICKET_TYPES   = ['Query','Complaint'];
const TICKET_STATUSES= ['Open','In Progress','Resolved','Closed'];

const PRIORITY_COLORS = {
  Low:      {bg:'rgba(56,217,245,.1)',  border:'rgba(56,217,245,.3)',  color:'var(--accent)'},
  Medium:   {bg:'rgba(255,179,71,.1)',  border:'rgba(255,179,71,.3)',  color:'var(--warn)'},
  High:     {bg:'rgba(255,95,109,.1)',  border:'rgba(255,95,109,.3)',  color:'var(--danger)'},
  Critical: {bg:'rgba(255,126,179,.1)', border:'rgba(255,126,179,.3)', color:'var(--accent3)'},
};

const QUERY_CATS    = ['Device Not Working','App / Platform Access','SIM / Network Issue','Location Inaccuracy','Alerts Not Received','Account / Billing','Installation Query','AMC / Renewal','Feature Request','General Enquiry','Other'];
const COMPLAINT_CATS= ['Device Malfunction','Wrong Installation','SIM Not Working','Data Loss / History Missing','Service Not Delivered','Billing Dispute','Staff Behaviour','Response Time','Device Physically Damaged','App Not Working','Other'];

const BLANK = {
  type:'Query', title:'', description:'', category:'',
  priority:'Medium', status:'Open',
  customerId:'', customerName:'', contact:'', city:'',
  assetId:'', assetRegNo:'', assignedTo:'',
  followupDate:'', dueDate:'', incidentDate:'', severity:'', notes:'',
};

export default function Tickets() {
  const [tickets,setTickets]       = useState([]);
  const [loading,setLoading]       = useState(false);
  const [search,setSearch]         = useState('');
  const [typeFilter,setTypeFilter] = useState('');
  const [statFilter,setStatFilter] = useState('');
  const [prioFilter,setPrioFilter] = useState('');
  const [selected,setSelected]     = useState(null);
  const [showEdit,setShowEdit]     = useState(false);
  const [form,setForm]             = useState(BLANK);
  const [customer,setCustomer]     = useState(null);  // selected customer object
  const [custErr,setCustErr]       = useState('');
  const [saving,setSaving]         = useState(false);
  const [formErr,setFormErr]       = useState('');
  const [searchParams] = useSearchParams();

  const load = async () => {
    setLoading(true);
    try { const {data} = await api.tickets.list(); setTickets(data.data||data||[]); }
    catch { setTickets([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    if (searchParams.get('new')==='1') openNew(searchParams.get('type')||'Query');
  }, []);

  const filtered = useMemo(() => {
    let r = tickets;
    if (search)     r = r.filter(t=>[t.title,t.customerName,t.ticketId,t.assignedTo,t.assetRegNo].some(v=>(v||'').toLowerCase().includes(search.toLowerCase())));
    if (typeFilter) r = r.filter(t=>t.type===typeFilter);
    if (statFilter) r = r.filter(t=>t.status===statFilter);
    if (prioFilter) r = r.filter(t=>t.priority===prioFilter);
    return r;
  }, [tickets, search, typeFilter, statFilter, prioFilter]);

  const counts = useMemo(() => ({
    total:     tickets.length,
    query:     tickets.filter(t=>t.type==='Query').length,
    complaint: tickets.filter(t=>t.type==='Complaint').length,
    open:      tickets.filter(t=>t.status==='Open').length,
    overdue:   tickets.filter(t=>t.followupDate && new Date(t.followupDate) < new Date() && !['Resolved','Closed'].includes(t.status)).length,
  }), [tickets]);

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const openNew = (type='Query') => {
    setForm({...BLANK, type});
    setCustomer(null); setCustErr(''); setFormErr('');
    setShowEdit(true);
  };

  const openEdit = (t) => {
    setForm({...BLANK,...t});
    setCustomer(t.customerId ? {customerId:t.customerId,customerName:t.customerName,contact:t.contact,city:t.city} : null);
    setCustErr(''); setFormErr('');
    setSelected(null);
    setShowEdit(true);
  };

  const onSelectCustomer = (c) => {
    setCustomer(c);
    setForm(f=>({...f, customerId:c.customerId, customerName:c.customerName, contact:c.contact, city:c.city||''}));
    setCustErr('');
  };

  const save = async () => {
    if (!customer?.customerId) { setCustErr('Please select a customer'); return; }
    if (!form.title)           { setFormErr('Title / subject is required'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload = {...form, customerId: customer.customerId, customerName: customer.customerName, contact: customer.contact, city: customer.city||''};
      if (form.ticketId) await api.tickets.update(form.ticketId, payload);
      else               await api.tickets.create(payload);
      setShowEdit(false); load();
    } catch(e) { setFormErr(e.response?.data?.message||'Save failed'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (t, status) => {
    try { await api.tickets.update(t.ticketId, {status}); load(); setSelected(null); }
    catch(e) { alert('Update failed: ' + e.message); }
  };

  const typeColor = {Query:'var(--accent2)', Complaint:'var(--danger)'};

  const columns = [
    {key:'createdAt',    label:'Date',     render:v=><span style={{color:'var(--muted)',fontSize:11}}>{formatDate(v)}</span>},
    {key:'ticketId',     label:'ID',       render:v=><span style={{fontFamily:'monospace',fontSize:10,color:'var(--muted)'}}>{v}</span>, sortable:false},
    {key:'type',         label:'Type',     render:v=><span style={{fontSize:10,fontWeight:600,color:typeColor[v]||'var(--text)',textTransform:'uppercase',letterSpacing:.8}}>{v}</span>},
    {key:'customerName', label:'Customer', render:v=><strong style={{fontSize:12}}>{v||'—'}</strong>},
    {key:'title',        label:'Subject',  render:v=><span style={{fontSize:11}}>{v}</span>},
    {key:'assetRegNo',   label:'Asset',    render:v=><span style={{fontSize:11,color:'var(--accent)',fontFamily:'monospace'}}>{v||'—'}</span>},
    {key:'priority',     label:'Priority', render:v=>{const p=PRIORITY_COLORS[v]||{};return <span style={{padding:'3px 8px',borderRadius:5,fontSize:10,background:p.bg,color:p.color,border:`1px solid ${p.border}`}}>{v}</span>;}},
    {key:'status',       label:'Status',   render:v=><Badge variant={v?.toLowerCase()}>{v}</Badge>},
    {key:'followupDate', label:'Follow-up',render:v=><span style={{fontSize:11,color:v&&new Date(v)<new Date()?'var(--danger)':'var(--muted)'}}>{formatDate(v)}</span>},
    {key:'assignedTo',   label:'Assigned', render:v=><span style={{fontSize:11,color:'var(--muted)'}}>{v||'—'}</span>},
    {key:'ticketId',     label:'',         sortable:false, render:(_,row)=>(
      <div style={{display:'flex',gap:5}}>
        <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();openEdit(row);}}>Edit</button>
        <button className="btn btn-primary btn-sm" onClick={e=>{e.stopPropagation();setSelected(row);}}>View</button>
      </div>
    )},
  ];

  return (
    <>
      <Topbar
        title="Tickets"
        subtitle="Queries & Complaints — for Sales Leads use the Leads module"
        actions={
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost btn-sm" style={{color:'var(--accent2)',borderColor:'rgba(123,111,255,.3)'}} onClick={()=>openNew('Query')}>💬 Query</button>
            <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)',borderColor:'rgba(255,95,109,.3)'}}   onClick={()=>openNew('Complaint')}>⚠ Complaint</button>
          </div>
        }
      />
      <PageContent>

        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:22}}>
          <StatTile label="Total"       value={counts.total}     color="t-cyan"/>
          <StatTile label="Queries"     value={counts.query}     color="t-purple"/>
          <StatTile label="Complaints"  value={counts.complaint} color="t-pink"/>
          <StatTile label="Open"        value={counts.open}      color="t-warn"/>
          <StatTile label="Overdue"     value={counts.overdue}   color="t-danger"/>
        </div>

        <div className="card">
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16,alignItems:'center'}}>
            <div style={{flex:1,minWidth:200,position:'relative'}}>
              <Search size={13} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
              <input className="field-input" style={{paddingLeft:34}} placeholder="Customer, title, ticket ID, asset reg…"
                value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            {[
              {val:typeFilter, set:setTypeFilter, opts:[['','All Types'],['Query','Query'],['Complaint','Complaint']], w:130},
              {val:statFilter, set:setStatFilter, opts:[['','All Status'],...TICKET_STATUSES.map(s=>[s,s])], w:130},
              {val:prioFilter, set:setPrioFilter, opts:[['','All Priority'],['Low','Low'],['Medium','Medium'],['High','High'],['Critical','Critical']], w:130},
            ].map((f,i)=>(
              <select key={i} className="field-input" style={{width:f.w,appearance:'none',cursor:'pointer'}}
                value={f.val} onChange={e=>f.set(e.target.value)}>
                {f.opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12}/></button>
          </div>
          <DataTable columns={columns} data={filtered} loading={loading} onRowClick={setSelected} emptyMessage="No tickets found"/>
        </div>

      </PageContent>

      {/* Detail Drawer */}
      <Drawer
        open={!!selected} onClose={()=>setSelected(null)}
        title={selected?.title||'—'}
        subtitle={`${selected?.type} · ${selected?.ticketId}`}
        actions={<>
          <button className="btn btn-primary btn-sm" onClick={()=>openEdit(selected)}>✏ Edit</button>
          {selected?.status==='Open'&&<button className="btn btn-ghost btn-sm" style={{color:'var(--warn)'}} onClick={()=>updateStatus(selected,'In Progress')}>→ In Progress</button>}
          {selected?.status!=='Resolved'&&<button className="btn btn-ghost btn-sm" style={{color:'var(--success)'}} onClick={()=>updateStatus(selected,'Resolved')}>✓ Resolve</button>}
          <button className="btn btn-ghost btn-sm" onClick={()=>updateStatus(selected,'Closed')}>Close</button>
        </>}
      >
        {selected&&(
          <>
            <DrawerSection title="Ticket Details"/>
            <InfoGrid>
              <InfoItem label="Ticket ID"   value={selected.ticketId}/>
              <InfoItem label="Type"        value={selected.type}/>
              <InfoItem label="Priority"    value={selected.priority}/>
              <InfoItem label="Status"      value={selected.status}/>
              <InfoItem label="Customer"    value={selected.customerName}/>
              <InfoItem label="Contact"     value={selected.contact}/>
              <InfoItem label="Asset / Reg" value={selected.assetRegNo||selected.assetId||'—'}/>
              <InfoItem label="Assigned To" value={selected.assignedTo}/>
              <InfoItem label="Created"     value={formatDate(selected.createdAt)}/>
              <InfoItem label="Follow-up"   value={formatDate(selected.followupDate)}/>
              <InfoItem label="Due Date"    value={formatDate(selected.dueDate)}/>
            </InfoGrid>
            {selected.description&&(
              <><DrawerSection title="Description"/>
              <p style={{fontSize:12,color:'var(--text)',lineHeight:1.7,background:'var(--surface2)',borderRadius:8,padding:'12px 14px'}}>{selected.description}</p></>
            )}
            {selected.type==='Complaint'&&selected.severity&&(
              <><DrawerSection title="Severity"/>
              <p style={{fontSize:12,color:'var(--danger)',padding:'8px 12px',background:'rgba(255,95,109,.08)',borderRadius:8}}>{selected.severity}</p></>
            )}
            {selected.notes&&(
              <><DrawerSection title="Internal Notes"/>
              <p style={{fontSize:12,color:'var(--muted)',lineHeight:1.7,background:'var(--surface2)',borderRadius:8,padding:'12px 14px'}}>{selected.notes}</p></>
            )}
          </>
        )}
      </Drawer>

      {/* Add / Edit Modal */}
      <Modal open={showEdit} onClose={()=>setShowEdit(false)} title={form.ticketId?'Edit Ticket':`New ${form.type}`} size="lg">
        {/* Type selector — new only */}
        {!form.ticketId&&(
          <div style={{display:'flex',gap:8,marginBottom:18}}>
            {TICKET_TYPES.map(t=>(
              <button key={t} className="btn btn-ghost" style={{flex:1,justifyContent:'center',
                borderColor:form.type===t?typeColor[t]:undefined,
                color:form.type===t?typeColor[t]:undefined,
                background:form.type===t?`${typeColor[t]}11`:undefined}}
                onClick={()=>setForm(f=>({...f,type:t}))}>
                {t}
              </button>
            ))}
          </div>
        )}

        <Field label="Customer *">
          <CustomerSearch value={customer} onChange={onSelectCustomer} onClear={()=>{setCustomer(null);setForm(f=>({...f,customerId:'',customerName:'',contact:'',city:''}));}} error={custErr}/>
        </Field>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 18px'}}>
          <Field label="Title / Subject *" style={{gridColumn:'span 2'}}>
            <Input placeholder="Brief description of issue" value={form.title} onChange={set('title')}/>
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={set('category')}>
              <option value="">Select…</option>
              {(form.type==='Complaint'?COMPLAINT_CATS:QUERY_CATS).map(o=><option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={set('priority')}>
              {['Low','Medium','High','Critical'].map(p=><option key={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {TICKET_STATUSES.map(s=><option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Assigned To"><Input placeholder="Team member / dept" value={form.assignedTo} onChange={set('assignedTo')}/></Field>
          <Field label="Asset Reg No."><Input placeholder="ABC-000 — which vehicle?" value={form.assetRegNo||''} onChange={set('assetRegNo')}/></Field>
          <Field label="Follow-up Date"><Input type="date" value={form.followupDate} onChange={set('followupDate')}/></Field>
          <Field label="Due / Resolution Date"><Input type="date" value={form.dueDate} onChange={set('dueDate')}/></Field>
          {form.type==='Complaint'&&(
            <Field label="Severity" style={{gridColumn:'span 2'}}>
              <Select value={form.severity} onChange={set('severity')}>
                <option value="">Select…</option>
                {['Minor — Inconvenience only','Moderate — Affects daily usage','Major — Service completely down','Critical — Financial or data loss'].map(o=><option key={o}>{o}</option>)}
              </Select>
            </Field>
          )}
        </div>

        <Field label="Description"><Textarea placeholder="Full details…" value={form.description} onChange={set('description')}/></Field>
        <Field label="Internal Notes"><Textarea placeholder="Internal notes only" value={form.notes} onChange={set('notes')} style={{minHeight:60}}/></Field>

        {formErr&&<div style={{padding:'10px 14px',background:'rgba(255,95,109,.08)',border:'1px solid rgba(255,95,109,.3)',borderRadius:8,color:'var(--danger)',fontSize:11,marginBottom:8}}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={()=>setShowEdit(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={save}>{saving?'Saving…':(form.ticketId?'Save Changes':`Submit ${form.type}`)}</button>
        </ModalButtons>
      </Modal>
    </>
  );
}
