import { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Search, FileText, Send, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import { usePermission, usePermissions } from '../hooks/usePermission';
import { formatDate } from '../lib/utils';

const STATUS_STYLE = {
  Draft:    { bg: 'rgba(90,96,112,.15)',   color: 'var(--muted)' },
  Sent:     { bg: 'rgba(56,217,245,.1)',   color: 'var(--accent)' },
  Approved: { bg: 'rgba(61,255,160,.1)',   color: 'var(--success)' },
  Rejected: { bg: 'rgba(255,95,109,.1)',   color: 'var(--danger)' },
  Expired:  { bg: 'rgba(255,179,71,.1)',   color: 'var(--warn)' },
  Invoiced: { bg: 'rgba(123,111,255,.1)',  color: 'var(--accent2)' },
};

const ITEM_TYPES = ['hardware','installation','subscription','amc','sim','other'];
const BLANK_ITEM = { itemType:'hardware', description:'', qty:1, unit:'unit', unitPrice:0, discountPct:0, isRecurring:false, billingCycle:'' };
const BLANK_Q = { title:'', description:'', validUntil:'', discountPct:0, taxPct:0, currency:'PKR', paymentTerms:'', notes:'', terms:'', items:[] };

export default function Quotations() {
  const navigate = useNavigate();
  const canCreate  = usePermission('quotations','create');
  const canUpdate  = usePermission('quotations','update');
  const canSend    = usePermission('quotations','send');
  const canApprove = usePermission('quotations','approve');

  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [statFilter, setStatFilter] = useState('');
  const [selected, setSelected]     = useState(null);
  const [showEdit, setShowEdit]     = useState(false);
  const [form, setForm]             = useState(BLANK_Q);
  const [customer, setCustomer]     = useState(null);
  const [custErr, setCustErr]       = useState('');
  const [saving, setSaving]         = useState(false);
  const [formErr, setFormErr]       = useState('');
  const [approveModal, setApproveModal] = useState(null);
  const [rejectModal, setRejectModal]   = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveForm, setApproveForm]   = useState({ vehicleCount:1, scheduledDate:'' });

  const load = async () => {
    setLoading(true);
    try { const {data} = await api.quotations.list(); setQuotations(data.data||data||[]); }
    catch { setQuotations([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let r = quotations;
    if (search)     r = r.filter(q => [q.quotationId,q.customerName,q.title].some(v=>(v||'').toLowerCase().includes(search.toLowerCase())));
    if (statFilter) r = r.filter(q => q.status === statFilter);
    return r;
  }, [quotations, search, statFilter]);

  const counts = useMemo(() => ({
    total:    quotations.length,
    draft:    quotations.filter(q=>q.status==='Draft').length,
    sent:     quotations.filter(q=>q.status==='Sent').length,
    approved: quotations.filter(q=>q.status==='Approved').length,
    value:    quotations.filter(q=>q.status!=='Rejected'&&q.status!=='Expired').reduce((s,q)=>s+Number(q.total||0),0),
  }), [quotations]);

  // ── Item helpers ──────────────────────────────────────────
  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, {...BLANK_ITEM}] }));
  const removeItem = i  => setForm(f => ({ ...f, items: f.items.filter((_,idx)=>idx!==i) }));
  const setItem    = (i,k,v) => setForm(f => {
    const items = [...f.items];
    items[i] = { ...items[i], [k]:v };
    return { ...f, items };
  });

  const lineTotal = it => Number(it.qty||1) * Number(it.unitPrice||0) * (1 - Number(it.discountPct||0)/100);
  const subtotal  = form.items.reduce((s,it) => s + lineTotal(it), 0);
  const discAmt   = subtotal * Number(form.discountPct||0)/100;
  const taxAmt    = (subtotal - discAmt) * Number(form.taxPct||0)/100;
  const total     = subtotal - discAmt + taxAmt;

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}));

  const openNew = () => {
    setForm({...BLANK_Q, items:[{...BLANK_ITEM}]});
    setCustomer(null); setCustErr(''); setFormErr(''); setShowEdit(true);
  };
  const openEdit = q => {
    setForm({...BLANK_Q, ...q, items: q.items||[{...BLANK_ITEM}]});
    setCustomer(q.customerId ? {customerId:q.customerId,customerName:q.customerName,contact:q.contact,city:q.city} : null);
    setCustErr(''); setFormErr(''); setSelected(null); setShowEdit(true);
  };

  const save = async () => {
    if (!customer?.customerId) { setCustErr('Select a customer'); return; }
    if (!form.title)           { setFormErr('Title is required'); return; }
    if (!form.items?.length)   { setFormErr('Add at least one line item'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload = { ...form, customerId:customer.customerId, customerName:customer.customerName, contact:customer.contact, city:customer.city||'' };
      if (form.quotationId) await api.quotations.update(form.quotationId, payload);
      else                  await api.quotations.create(payload);
      setShowEdit(false); load();
    } catch(e) { setFormErr(e.response?.data?.message||'Save failed'); }
    finally { setSaving(false); }
  };

  const doSend = async q => {
    try { await api.quotations.send(q.quotationId); load(); setSelected(null); }
    catch(e) { alert(e.response?.data?.message||'Failed'); }
  };

  const doApprove = async () => {
    try {
      const {data} = await api.quotations.approve(approveModal.quotationId, approveForm);
      setApproveModal(null);
      load();
      alert(`Approved! Work Order ${data.workOrderId} created automatically.`);
    } catch(e) { alert(e.response?.data?.message||'Approval failed'); }
  };

  const doReject = async () => {
    try { await api.quotations.reject(rejectModal.quotationId, {reason:rejectReason}); setRejectModal(null); setRejectReason(''); load(); }
    catch(e) { alert(e.response?.data?.message||'Failed'); }
  };

  const StatusPill = ({s}) => {
    const st = STATUS_STYLE[s] || STATUS_STYLE.Draft;
    return <span style={{padding:'3px 9px',borderRadius:5,fontSize:10,fontWeight:600,background:st.bg,color:st.color}}>{s}</span>;
  };

  const columns = [
    {key:'createdAt',    label:'Date',     render:v=><span style={{color:'var(--muted)',fontSize:11}}>{formatDate(v)}</span>},
    {key:'quotationId',  label:'ID',       render:v=><span style={{fontFamily:'monospace',fontSize:10,color:'var(--accent2)'}}>{v}</span>},
    {key:'customerName', label:'Customer', render:v=><strong style={{fontSize:12}}>{v||'—'}</strong>},
    {key:'title',        label:'Title',    render:v=><span style={{fontSize:11,color:'var(--text)'}}>{v}</span>},
    {key:'total',        label:'Total',    render:v=><span style={{fontFamily:'Syne',fontWeight:700,fontSize:12}}>PKR {Number(v||0).toLocaleString()}</span>},
    {key:'validUntil',   label:'Valid Until', render:v=><span style={{fontSize:11,color:v&&new Date(v)<new Date()?'var(--danger)':'var(--muted)'}}>{formatDate(v)}</span>},
    {key:'status',       label:'Status',   render:v=><StatusPill s={v}/>},
    {key:'quotationId',  label:'',         sortable:false, render:(_,row)=>(
      <div style={{display:'flex',gap:5}}>
        {canUpdate && row.status==='Draft' && <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();openEdit(row);}}>Edit</button>}
        {canSend   && row.status==='Draft' && <button className="btn btn-primary btn-sm" onClick={e=>{e.stopPropagation();doSend(row);}}><Send size={10}/> Send</button>}
        {canApprove && row.status==='Sent' && (
          <>
            <button className="btn btn-ghost btn-sm" style={{color:'var(--success)',borderColor:'rgba(61,255,160,.3)'}} onClick={e=>{e.stopPropagation();setApproveModal(row);setApproveForm({vehicleCount:1,scheduledDate:''});}}>✓ Approve</button>
            <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={e=>{e.stopPropagation();setRejectModal(row);}}>✗ Reject</button>
          </>
        )}
        <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();setSelected(row);}}>View</button>
      </div>
    )},
  ];

  return (
    <>
      <Topbar title="Quotations" subtitle="Lead → Quotation → Approve → Work Order"
        actions={canCreate && <button className="btn btn-solid btn-sm" onClick={openNew}><Plus size={13}/> New Quotation</button>}/>
      <PageContent>

        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:22}}>
          <StatTile label="Total"    value={counts.total}    color="t-cyan"/>
          <StatTile label="Draft"    value={counts.draft}    color="t-purple"/>
          <StatTile label="Sent"     value={counts.sent}     color="t-warn"/>
          <StatTile label="Approved" value={counts.approved} color="t-green"/>
          <StatTile label="Pipeline Value" value={`PKR ${Math.round(counts.value/1000)}K`} color="t-pink"/>
        </div>

        <div className="card">
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16,alignItems:'center'}}>
            <div style={{flex:1,minWidth:200,position:'relative'}}>
              <Search size={13} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
              <input className="field-input" style={{paddingLeft:34}} placeholder="Customer, QT ID, title…"
                value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <select className="field-input" style={{width:140,appearance:'none',cursor:'pointer'}} value={statFilter} onChange={e=>setStatFilter(e.target.value)}>
              <option value="">All Status</option>
              {['Draft','Sent','Approved','Rejected','Expired','Invoiced'].map(s=><option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12}/></button>
          </div>
          <DataTable columns={columns} data={filtered} loading={loading} onRowClick={setSelected} emptyMessage="No quotations yet"/>
        </div>
      </PageContent>

      {/* Detail Drawer */}
      <Drawer open={!!selected} onClose={()=>setSelected(null)}
        title={selected?.quotationId||'—'} subtitle={`${selected?.customerName} · ${selected?.title}`}
        actions={<>
          {canUpdate && selected?.status==='Draft' && <button className="btn btn-primary btn-sm" onClick={()=>openEdit(selected)}>✏ Edit</button>}
          {canSend   && selected?.status==='Draft' && <button className="btn btn-ghost btn-sm" style={{color:'var(--accent)'}} onClick={()=>{doSend(selected);setSelected(null);}}><Send size={12}/> Send</button>}
          {canApprove && selected?.status==='Sent' && <button className="btn btn-ghost btn-sm" style={{color:'var(--success)'}} onClick={()=>{setApproveModal(selected);setSelected(null);}}>✓ Approve</button>}
        </>}>
        {selected&&(<>
          <DrawerSection title="Overview"/>
          <InfoGrid>
            <InfoItem label="Status"      value={selected.status}/>
            <InfoItem label="Valid Until" value={formatDate(selected.validUntil)}/>
            <InfoItem label="Currency"    value={selected.currency}/>
            <InfoItem label="Payment Terms" value={selected.paymentTerms}/>
          </InfoGrid>
          {/* Line items */}
          <DrawerSection title={`Line Items (${selected.items?.length||0})`}/>
          {(selected.items||[]).map((it,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:'var(--surface2)',borderRadius:8,marginBottom:6}}>
              <div>
                <div style={{fontSize:12,color:'var(--text)',fontWeight:500}}>{it.description}</div>
                <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>
                  {it.qty} {it.unit} × PKR {Number(it.unit_price||it.unitPrice||0).toLocaleString()}
                  {Number(it.discount_pct||it.discountPct||0)>0&&<span style={{color:'var(--success)',marginLeft:6}}> -{it.discount_pct||it.discountPct}%</span>}
                  {it.is_recurring&&<span style={{color:'var(--accent2)',marginLeft:6}}>🔁 {it.billing_cycle||it.billingCycle}</span>}
                </div>
              </div>
              <div style={{fontFamily:'Syne',fontWeight:700,color:'var(--text)',fontSize:13}}>
                PKR {Number(it.total||0).toLocaleString()}
              </div>
            </div>
          ))}
          {/* Totals */}
          <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px',marginTop:8}}>
            {[
              {l:'Subtotal',v:`PKR ${Number(selected.subtotal||0).toLocaleString()}`},
              selected.discountPct && {l:`Discount (${selected.discountPct}%)`,v:`-PKR ${Math.round(Number(selected.subtotal||0)*Number(selected.discountPct)/100).toLocaleString()}`},
              selected.taxPct && {l:`Tax (${selected.taxPct}%)`,v:`PKR ${Math.round((Number(selected.subtotal||0)*(1-Number(selected.discountPct||0)/100))*Number(selected.taxPct)/100).toLocaleString()}`},
              {l:'TOTAL',v:`PKR ${Number(selected.total||0).toLocaleString()}`,bold:true},
            ].filter(Boolean).map(row=>(
              <div key={row.l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:11,color:'var(--muted)',fontWeight:row.bold?700:400}}>{row.l}</span>
                <span style={{fontSize:11,color:row.bold?'var(--success)':'var(--text)',fontWeight:row.bold?700:400}}>{row.v}</span>
              </div>
            ))}
          </div>
          {selected.notes&&(<><DrawerSection title="Notes"/><p style={{fontSize:12,color:'var(--muted)',background:'var(--surface2)',borderRadius:8,padding:'12px 14px'}}>{selected.notes}</p></>)}
        </>)}
      </Drawer>

      {/* Create / Edit Modal */}
      <Modal open={showEdit} onClose={()=>setShowEdit(false)} title={form.quotationId?'Edit Quotation':'New Quotation'} size="xl">
        <Field label="Customer *">
          <CustomerSearch value={customer} onChange={c=>{setCustomer(c);setForm(f=>({...f,customerId:c.customerId,customerName:c.customerName,contact:c.contact,city:c.city||''}));setCustErr('');}}
            onClear={()=>{setCustomer(null);setForm(f=>({...f,customerId:'',customerName:''}));}} error={custErr}/>
        </Field>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 14px'}}>
          <Field label="Title *" style={{gridColumn:'span 2'}}><Input value={form.title} onChange={set('title')}/></Field>
          <Field label="Valid Until"><Input type="date" value={form.validUntil} onChange={set('validUntil')}/></Field>
        </div>
        <Field label="Description"><Textarea value={form.description} onChange={set('description')} style={{minHeight:50}}/></Field>

        {/* Line items */}
        <div style={{fontSize:9,letterSpacing:2,textTransform:'uppercase',color:'var(--muted)',padding:'14px 0 8px',display:'flex',alignItems:'center',gap:10}}>
          Line Items <div style={{flex:1,height:1,background:'var(--border)'}}/>
          <button className="btn btn-ghost btn-sm" onClick={addItem}><Plus size={11}/> Add Item</button>
        </div>

        <div style={{background:'var(--surface2)',borderRadius:10,overflow:'hidden',border:'1px solid var(--border)',marginBottom:12}}>
          {form.items.map((it,i)=>(
            <div key={i} style={{padding:'12px 14px',borderBottom:'1px solid var(--border)',display:'grid',gridTemplateColumns:'2fr 1fr 1fr 80px 80px 50px 32px',gap:8,alignItems:'end'}}>
              <Field label={i===0?'Description':undefined}>
                <Input value={it.description} onChange={e=>setItem(i,'description',e.target.value)} placeholder="e.g. GT06 Tracker Unit"/>
              </Field>
              <Field label={i===0?'Type':undefined}>
                <Select value={it.itemType} onChange={e=>setItem(i,'itemType',e.target.value)}>
                  {ITEM_TYPES.map(t=><option key={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label={i===0?'Unit':undefined}>
                <Select value={it.unit} onChange={e=>setItem(i,'unit',e.target.value)}>
                  {['unit','vehicle','month','year'].map(u=><option key={u}>{u}</option>)}
                </Select>
              </Field>
              <Field label={i===0?'Qty':undefined}>
                <Input type="number" min="1" value={it.qty} onChange={e=>setItem(i,'qty',e.target.value)}/>
              </Field>
              <Field label={i===0?'Unit Price':undefined}>
                <Input type="number" min="0" value={it.unitPrice} onChange={e=>setItem(i,'unitPrice',e.target.value)}/>
              </Field>
              <Field label={i===0?'Disc%':undefined}>
                <Input type="number" min="0" max="100" value={it.discountPct} onChange={e=>setItem(i,'discountPct',e.target.value)}/>
              </Field>
              <div style={{display:'flex',alignItems:'flex-end',paddingBottom:4}}>
                <button onClick={()=>removeItem(i)} style={{background:'none',border:'none',color:'var(--danger)',cursor:'pointer',padding:4,borderRadius:4}}><Trash2 size={13}/></button>
              </div>
              {/* Line total */}
              <div style={{gridColumn:'1/-1',display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:2}}>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:10,color:'var(--muted)',cursor:'pointer'}}>
                  <input type="checkbox" checked={it.isRecurring||false} onChange={e=>setItem(i,'isRecurring',e.target.checked)}/>
                  Recurring
                  {it.isRecurring && (
                    <select className="field-input" style={{width:100,padding:'3px 8px',fontSize:10}} value={it.billingCycle||''} onChange={e=>setItem(i,'billingCycle',e.target.value)}>
                      <option value="">Cycle</option>
                      {['monthly','quarterly','annual'].map(c=><option key={c}>{c}</option>)}
                    </select>
                  )}
                </label>
                <span style={{fontSize:12,fontWeight:700,color:'var(--text)'}}>
                  PKR {lineTotal(it).toLocaleString('en-PK',{minimumFractionDigits:0,maximumFractionDigits:0})}
                </span>
              </div>
            </div>
          ))}
          {!form.items.length && (
            <div style={{padding:'20px',textAlign:'center',color:'var(--muted)',fontSize:11}}>No items — click "+ Add Item"</div>
          )}
        </div>

        {/* Totals summary */}
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
          <div style={{width:280}}>
            {[
              {l:'Subtotal',v:`PKR ${subtotal.toLocaleString('en-PK',{maximumFractionDigits:0})}`},
              ...(discAmt>0?[{l:`Discount`,v:`-PKR ${discAmt.toLocaleString('en-PK',{maximumFractionDigits:0})}`}]:[]),
              ...(taxAmt>0?[{l:`Tax`,v:`PKR ${taxAmt.toLocaleString('en-PK',{maximumFractionDigits:0})}`}]:[]),
              {l:'TOTAL',v:`PKR ${total.toLocaleString('en-PK',{maximumFractionDigits:0})}`,bold:true},
            ].map(r=>(
              <div key={r.l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:11,color:'var(--muted)'}}>{r.l}</span>
                <span style={{fontSize:11,color:r.bold?'var(--success)':'var(--text)',fontWeight:r.bold?700:400}}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 14px'}}>
          <Field label="Discount %"><Input type="number" min="0" max="100" value={form.discountPct} onChange={set('discountPct')}/></Field>
          <Field label="Tax %"><Input type="number" min="0" value={form.taxPct} onChange={set('taxPct')}/></Field>
          <Field label="Payment Terms"><Input placeholder="30 days net" value={form.paymentTerms} onChange={set('paymentTerms')}/></Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={set('notes')} style={{minHeight:50}}/></Field>

        {formErr&&<div style={{padding:'10px 14px',background:'rgba(255,95,109,.08)',border:'1px solid rgba(255,95,109,.3)',borderRadius:8,color:'var(--danger)',fontSize:11,marginBottom:8}}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={()=>setShowEdit(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={save}>{saving?'Saving…':(form.quotationId?'Save Changes':'Create Quotation')}</button>
        </ModalButtons>
      </Modal>

      {/* Approve Modal */}
      <Modal open={!!approveModal} onClose={()=>setApproveModal(null)} title={`Approve — ${approveModal?.quotationId}`} size="sm">
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:16,lineHeight:1.6}}>
          Approving will create a <strong style={{color:'var(--accent)'}}>Work Order</strong> automatically and reserve inventory for {approveModal?.customerName}.
        </p>
        <Field label="Number of Vehicles"><Input type="number" min="1" value={approveForm.vehicleCount} onChange={e=>setApproveForm(f=>({...f,vehicleCount:e.target.value}))}/></Field>
        <Field label="Scheduled Date"><Input type="date" value={approveForm.scheduledDate} onChange={e=>setApproveForm(f=>({...f,scheduledDate:e.target.value}))}/></Field>
        <ModalButtons>
          <button className="btn btn-ghost" onClick={()=>setApproveModal(null)}>Cancel</button>
          <button className="btn btn-solid" style={{background:'linear-gradient(135deg,#22c97a,#3dffa0)',color:'#0a0c0f'}} onClick={doApprove}>✓ Approve & Create Work Order</button>
        </ModalButtons>
      </Modal>

      {/* Reject Modal */}
      <Modal open={!!rejectModal} onClose={()=>setRejectModal(null)} title="Reject Quotation" size="sm">
        <Field label="Reason for rejection">
          <Textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Price too high, changed requirements…" style={{minHeight:80}}/>
        </Field>
        <ModalButtons>
          <button className="btn btn-ghost" onClick={()=>setRejectModal(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={doReject}>✗ Reject</button>
        </ModalButtons>
      </Modal>
    </>
  );
}
