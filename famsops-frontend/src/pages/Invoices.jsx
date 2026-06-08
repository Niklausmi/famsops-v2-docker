import { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Search, Send } from 'lucide-react';
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

const STATUS_STYLE = {
  Draft:     {bg:'rgba(90,96,112,.15)',  color:'var(--muted)'},
  Sent:      {bg:'rgba(56,217,245,.1)',  color:'var(--accent)'},
  Paid:      {bg:'rgba(61,255,160,.1)',  color:'var(--success)'},
  Partial:   {bg:'rgba(123,111,255,.1)',color:'var(--accent2)'},
  Overdue:   {bg:'rgba(255,95,109,.1)',  color:'var(--danger)'},
  Cancelled: {bg:'rgba(90,96,112,.15)',  color:'var(--muted)'},
  Void:      {bg:'rgba(90,96,112,.15)',  color:'var(--muted)'},
};

const BLANK = {
  type:'one_time', issueDate:new Date().toISOString().split('T')[0], dueDate:'',
  discountPct:0, taxPct:0, currency:'PKR', notes:'', items:[],
};
const BLANK_ITEM = { description:'', qty:1, unit:'unit', unitPrice:0 };

export default function Invoices() {
  const canCreate = usePermission('invoices','create');
  const canSend   = usePermission('invoices','send');
  const canVoid   = usePermission('invoices','void');

  const [invoices,setInvoices] = useState([]);
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

  const load = async () => {
    setLoading(true);
    try { const {data} = await api.invoices.list(); setInvoices(data.data||data||[]); }
    catch { setInvoices([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let r = invoices;
    if (search)     r = r.filter(i=>[i.invoiceId,i.customerName].some(v=>(v||'').toLowerCase().includes(search.toLowerCase())));
    if (statFilter) r = r.filter(i=>i.status===statFilter);
    return r;
  }, [invoices, search, statFilter]);

  const stats = useMemo(() => ({
    total:   invoices.length,
    unpaid:  invoices.filter(i=>!['Paid','Void','Cancelled'].includes(i.status)).length,
    overdue: invoices.filter(i=>i.status==='Overdue'||(!['Paid','Void','Cancelled'].includes(i.status)&&i.dueDate&&new Date(i.dueDate)<new Date())).length,
    collected: invoices.reduce((s,i)=>s+Number(i.paidAmount||0),0),
    outstanding: invoices.reduce((s,i)=>s+Number(i.balanceDue||0),0),
  }), [invoices]);

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const addItem    = () => setForm(f=>({...f,items:[...f.items,{...BLANK_ITEM}]}));
  const removeItem = i => setForm(f=>({...f,items:f.items.filter((_,idx)=>idx!==i)}));
  const setItem    = (i,k,v) => setForm(f=>{const items=[...f.items];items[i]={...items[i],[k]:v};return{...f,items};});
  const lineTotal  = it => Number(it.qty||1)*Number(it.unitPrice||0);
  const subtotal   = form.items.reduce((s,it)=>s+lineTotal(it),0);
  const total      = subtotal*(1-Number(form.discountPct||0)/100)*(1+Number(form.taxPct||0)/100);

  const save = async () => {
    if (!customer?.customerId) { setCustErr('Select a customer'); return; }
    setSaving(true); setFormErr('');
    try {
      await api.invoices.create({...form, customerId:customer.customerId, customerName:customer.customerName, contact:customer.contact});
      setShowNew(false); load();
    } catch(e) { setFormErr(e.response?.data?.message||'Save failed'); }
    finally { setSaving(false); }
  };

  const doSend = async id => { try { await api.invoices.send(id); load(); setSelected(null); } catch(e) { alert(e.response?.data?.message||'Failed'); } };
  const doVoid = async id => { if (!confirm('Void this invoice?')) return; try { await api.invoices.void(id); load(); setSelected(null); } catch(e) { alert(e.response?.data?.message||'Failed'); } };

  const StatusPill = ({s}) => { const st=STATUS_STYLE[s]||STATUS_STYLE.Draft; return <span style={{padding:'3px 9px',borderRadius:5,fontSize:10,fontWeight:600,background:st.bg,color:st.color}}>{s}</span>; };

  const columns = [
    {key:'issueDate',    label:'Date',     render:v=><span style={{color:'var(--muted)',fontSize:11}}>{formatDate(v)}</span>},
    {key:'invoiceId',    label:'Invoice',  render:v=><span style={{fontFamily:'monospace',fontSize:10,color:'var(--accent2)'}}>{v}</span>},
    {key:'customerName', label:'Customer', render:v=><strong style={{fontSize:12}}>{v||'—'}</strong>},
    {key:'type',         label:'Type',     render:v=><span style={{fontSize:10,color:'var(--muted)',textTransform:'capitalize'}}>{(v||'').replace('_',' ')}</span>},
    {key:'total',        label:'Total',    render:v=><span style={{fontFamily:'Syne',fontWeight:700,fontSize:12}}>PKR {Number(v||0).toLocaleString()}</span>},
    {key:'paidAmount',   label:'Paid',     render:v=><span style={{fontSize:11,color:'var(--success)'}}>PKR {Number(v||0).toLocaleString()}</span>},
    {key:'balanceDue',   label:'Balance',  render:v=><span style={{fontSize:11,color:Number(v)>0?'var(--danger)':'var(--muted)',fontWeight:Number(v)>0?600:400}}>{Number(v||0)>0?`PKR ${Number(v).toLocaleString()}`:'—'}</span>},
    {key:'dueDate',      label:'Due',      render:v=><span style={{fontSize:11,color:v&&new Date(v)<new Date()?'var(--danger)':'var(--muted)'}}>{formatDate(v)}</span>},
    {key:'status',       label:'Status',   render:v=><StatusPill s={v}/>},
    {key:'invoiceId',    label:'',         sortable:false, render:(_,row)=>(
      <div style={{display:'flex',gap:5}}>
        {canSend && row.status==='Draft' && <button className="btn btn-primary btn-sm" onClick={e=>{e.stopPropagation();doSend(row.invoiceId);}}><Send size={10}/> Send</button>}
        {canVoid && !['Paid','Void','Cancelled'].includes(row.status) && <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={e=>{e.stopPropagation();doVoid(row.invoiceId);}}>Void</button>}
        <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();setSelected(row);}}>View</button>
      </div>
    )},
  ];

  return (
    <>
      <Topbar title="Invoices" subtitle="Auto-generated from subscriptions · manual creation available"
        actions={canCreate && <button className="btn btn-solid btn-sm" onClick={()=>{setForm({...BLANK,items:[{...BLANK_ITEM}]});setCustomer(null);setCustErr('');setFormErr('');setShowNew(true);}}><Plus size={13}/> New Invoice</button>}/>
      <PageContent>

        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:22}}>
          <StatTile label="Total"       value={stats.total}   color="t-cyan"/>
          <StatTile label="Unpaid"      value={stats.unpaid}  color="t-warn"/>
          <StatTile label="Overdue"     value={stats.overdue} color="t-pink"/>
          <StatTile label="Collected"   value={`PKR ${Math.round(stats.collected/1000)}K`}    color="t-green"/>
          <StatTile label="Outstanding" value={`PKR ${Math.round(stats.outstanding/1000)}K`}  color="t-purple"/>
        </div>

        <div className="card">
          <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:200,position:'relative'}}>
              <Search size={13} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
              <input className="field-input" style={{paddingLeft:34}} placeholder="Customer, INV ID…"
                value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <select className="field-input" style={{width:140,appearance:'none',cursor:'pointer'}} value={statFilter} onChange={e=>setStatFilter(e.target.value)}>
              <option value="">All Status</option>
              {['Draft','Sent','Paid','Partial','Overdue','Void'].map(s=><option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12}/></button>
          </div>
          <DataTable columns={columns} data={filtered} loading={loading} onRowClick={setSelected} emptyMessage="No invoices yet"/>
        </div>
      </PageContent>

      {/* Detail Drawer */}
      <Drawer open={!!selected} onClose={()=>setSelected(null)}
        title={selected?.invoiceId||'—'} subtitle={`${selected?.customerName}`}
        actions={<>
          {canSend && selected?.status==='Draft' && <button className="btn btn-primary btn-sm" onClick={()=>{doSend(selected.invoiceId);}}><Send size={12}/> Send</button>}
          {canVoid && !['Paid','Void','Cancelled'].includes(selected?.status) && <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={()=>doVoid(selected.invoiceId)}>Void</button>}
        </>}>
        {selected&&(<>
          <DrawerSection title="Invoice Details"/>
          <InfoGrid>
            <InfoItem label="Status"      value={selected.status}/>
            <InfoItem label="Type"        value={(selected.type||'').replace('_',' ')}/>
            <InfoItem label="Issue Date"  value={formatDate(selected.issueDate)}/>
            <InfoItem label="Due Date"    value={formatDate(selected.dueDate)}/>
            <InfoItem label="Total"       value={`PKR ${Number(selected.total||0).toLocaleString()}`}/>
            <InfoItem label="Paid"        value={`PKR ${Number(selected.paidAmount||0).toLocaleString()}`}/>
            <InfoItem label="Balance"     value={`PKR ${Number(selected.balanceDue||0).toLocaleString()}`}/>
            <InfoItem label="Subscription" value={selected.subscriptionId||'—'}/>
          </InfoGrid>
          {(selected.items||[]).length>0&&(<>
            <DrawerSection title="Line Items"/>
            {(selected.items||[]).map((it,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'var(--surface2)',borderRadius:8,marginBottom:6}}>
                <div>
                  <div style={{fontSize:12,color:'var(--text)',fontWeight:500}}>{it.description}</div>
                  <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{it.qty} {it.unit} × PKR {Number(it.unit_price||it.unitPrice||0).toLocaleString()}</div>
                </div>
                <span style={{fontFamily:'Syne',fontWeight:700,fontSize:13}}>PKR {Number(it.total||0).toLocaleString()}</span>
              </div>
            ))}
          </>)}
        </>)}
      </Drawer>

      {/* New Invoice Modal */}
      <Modal open={showNew} onClose={()=>setShowNew(false)} title="New Invoice" size="lg">
        <Field label="Customer *">
          <CustomerSearch value={customer} onChange={c=>{setCustomer(c);setCustErr('');}} onClear={()=>setCustomer(null)} error={custErr}/>
        </Field>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 14px'}}>
          <Field label="Type"><Select value={form.type} onChange={set('type')}>{['one_time','recurring','renewal'].map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}</Select></Field>
          <Field label="Issue Date"><Input type="date" value={form.issueDate} onChange={set('issueDate')}/></Field>
          <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={set('dueDate')}/></Field>
        </div>

        {/* Items */}
        <div style={{fontSize:9,letterSpacing:2,textTransform:'uppercase',color:'var(--muted)',padding:'14px 0 8px',display:'flex',alignItems:'center',gap:10}}>
          Line Items <div style={{flex:1,height:1,background:'var(--border)'}}/>
          <button className="btn btn-ghost btn-sm" onClick={addItem}><Plus size={11}/> Add</button>
        </div>
        {form.items.map((it,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 80px 100px 36px',gap:8,marginBottom:8,alignItems:'end'}}>
            <Field label={i===0?'Description':undefined}><Input value={it.description} onChange={e=>setItem(i,'description',e.target.value)} placeholder="Service or item"/></Field>
            <Field label={i===0?'Qty':undefined}><Input type="number" min="1" value={it.qty} onChange={e=>setItem(i,'qty',e.target.value)}/></Field>
            <Field label={i===0?'Unit Price':undefined}><Input type="number" value={it.unitPrice} onChange={e=>setItem(i,'unitPrice',e.target.value)}/></Field>
            <div style={{paddingBottom:4}}><button onClick={()=>removeItem(i)} style={{background:'none',border:'none',color:'var(--danger)',cursor:'pointer',padding:4,borderRadius:4,fontSize:16}}>×</button></div>
          </div>
        ))}
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
          <div style={{width:240}}>
            {[{l:'Subtotal',v:`PKR ${subtotal.toLocaleString('en-PK',{maximumFractionDigits:0})}`},{l:'TOTAL',v:`PKR ${total.toLocaleString('en-PK',{maximumFractionDigits:0})}`,bold:true}].map(r=>(
              <div key={r.l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:11,color:'var(--muted)'}}>{r.l}</span>
                <span style={{fontSize:11,color:r.bold?'var(--success)':'var(--text)',fontWeight:r.bold?700:400}}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {formErr&&<div style={{padding:'10px 14px',background:'rgba(255,95,109,.08)',border:'1px solid rgba(255,95,109,.3)',borderRadius:8,color:'var(--danger)',fontSize:11,marginBottom:8}}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={()=>setShowNew(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={save}>{saving?'Saving…':'Create Invoice'}</button>
        </ModalButtons>
      </Modal>
    </>
  );
}
