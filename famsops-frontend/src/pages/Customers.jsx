import { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Search, ArrowRight, AlertTriangle, Ticket, ClipboardList, Target, CreditCard } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Topbar } from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { Drawer, DrawerSection, InfoGrid, InfoItem } from '../components/ui/Drawer';
import { Modal, ModalButtons } from '../components/ui/Modal';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { api } from '../api/client';
import { formatDate, CITIES } from '../lib/utils';

const BLANK = {
  customerName:'',contact:'',email:'',cnic:'',father:'',company:'',rac:'',
  designation:'',industry:'',customerType:'individual',preferredPayment:'',
  city:'',area:'',address:'',notes:'',
};

export default function Customers() {
  const [customers,setCustomers] = useState([]);
  const [loading,setLoading]     = useState(false);
  const [search,setSearch]       = useState('');
  const [cityFilter,setCityFilter]= useState('');
  const [sortBy,setSortBy]       = useState('name');
  const [page,setPage]           = useState(1);
  const [hubData,setHubData]     = useState(null);
  const [hubLoading,setHubLoading]= useState(false);
  const [showAdd,setShowAdd]     = useState(false);
  const [form,setForm]           = useState(BLANK);
  const [saving,setSaving]       = useState(false);
  const [formErr,setFormErr]     = useState('');
  const [converting,setConverting]= useState(false);
  const [renewModal,setRenewModal]= useState(null);
  const [renewForm,setRenewForm] = useState({});
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const PP = 24;

  const load = async () => {
    setLoading(true);
    try { const {data} = await api.customers.list(); setCustomers(data.data||data||[]); }
    catch { setCustomers([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    // Auto-open Add if ?new=1
    if (searchParams.get('new') === '1') setShowAdd(true);
  }, []);

  const filtered = useMemo(() => {
    let r = customers;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(c => [c.customerName,c.contact,c.company,c.cnic,c.rac,c.customerId,c.email,c.city]
        .some(v => (v||'').toLowerCase().includes(q)));
    }
    if (cityFilter) r = r.filter(c => c.city === cityFilter);
    if (sortBy==='name')   r=[...r].sort((a,b)=>(a.customerName||'').localeCompare(b.customerName||''));
    if (sortBy==='recent') r=[...r].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
    if (sortBy==='jobs')   r=[...r].sort((a,b)=>(b.totalJobs||0)-(a.totalJobs||0));
    return r;
  }, [customers, search, cityFilter, sortBy]);

  const pages = Math.max(1, Math.ceil(filtered.length / PP));
  const slice = filtered.slice((page-1)*PP, page*PP);

  const openHub = async (c) => {
    setHubLoading(true);
    setHubData({ customer: c, assets:[], tickets:[], jobs:[], leads:[], payments:[], summary:{} });
    try { const {data} = await api.customers.hub(c.customerId); setHubData(data); }
    catch {}
    finally { setHubLoading(false); }
  };

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}));
  const setR = k => e => setRenewForm(f => ({...f, [k]: e.target.value}));

  const save = async () => {
    if (!form.customerName) { setFormErr('Customer name is required'); return; }
    if (!form.contact)      { setFormErr('Contact number is required'); return; }
    if (!form.city)         { setFormErr('City is required'); return; }
    setSaving(true); setFormErr('');
    try {
      await api.customers.create(form);
      setShowAdd(false); setForm(BLANK); load();
    } catch(e) { setFormErr(e.response?.data?.message||'Save failed'); }
    finally { setSaving(false); }
  };

  const convertLead = async (leadId) => {
    setConverting(true);
    try {
      const {data} = await api.jobOrders.convertLead(leadId);
      setHubData(null);
      navigate(`/job-orders?highlight=${data.invoiceNumber}`);
    } catch(e) { alert(e.response?.data?.message||'Conversion failed'); }
    finally { setConverting(false); }
  };

  const submitRenewal = async () => {
    if (!renewForm.newAmcExpiry) { alert('New AMC expiry date is required'); return; }
    setSaving(true);
    try {
      await api.assets.renewAmc(renewModal.assetId, renewForm);
      setRenewModal(null); setRenewForm({});
      // Refresh hub
      if (hubData?.customer) { const {data} = await api.customers.hub(hubData.customer.customerId); setHubData(data); }
    } catch(e) { alert(e.response?.data?.message||'Renewal failed'); }
    finally { setSaving(false); }
  };

  const c   = hubData?.customer;
  const sum = hubData?.summary || {};

  // AMC status helper
  const amcStatus = (expiry) => {
    if (!expiry) return null;
    const d = new Date(expiry) - Date.now();
    if (d < 0) return 'expired';
    if (d < 30*86400000) return 'expiring';
    return 'active';
  };
  const amcCol = { active:'var(--success)', expiring:'var(--warn)', expired:'var(--danger)' };

  return (
    <>
      <Topbar
        title="Customers"
        subtitle="Entry point — create a customer first, everything flows from here"
        actions={
          <button className="btn btn-solid btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={13}/> New Customer
          </button>
        }
      />
      <PageContent>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:22}}>
          <StatTile label="Total Customers" value={customers.length}                                           color="t-cyan"/>
          <StatTile label="Cities"          value={[...new Set(customers.map(c=>c.city).filter(Boolean))].length} color="t-green"/>
          <StatTile label="Fleet Owners"    value={customers.filter(c=>c.customerType==='fleet').length}       color="t-purple"/>
          <StatTile label="Showing"         value={filtered.length} sub="after filters"                        color="t-warn"/>
        </div>

        {/* Search bar */}
        <div className="card" style={{marginBottom:20}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginBottom:14}}>
            <div style={{flex:1,minWidth:200,position:'relative'}}>
              <Search size={13} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
              <input className="field-input" style={{paddingLeft:34}} placeholder="Name, contact, CNIC, RAC, company, ID…"
                value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
            </div>
            <select className="field-input" style={{width:160,appearance:'none',cursor:'pointer'}}
              value={cityFilter} onChange={e=>{setCityFilter(e.target.value);setPage(1);}}>
              <option value="">All Cities</option>
              {[...new Set(customers.map(c=>c.city).filter(Boolean))].sort().map(c=><option key={c}>{c}</option>)}
            </select>
            <select className="field-input" style={{width:140,appearance:'none',cursor:'pointer'}}
              value={sortBy} onChange={e=>setSortBy(e.target.value)}>
              <option value="name">Name A–Z</option>
              <option value="recent">Recently Added</option>
              <option value="jobs">Most Jobs</option>
            </select>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12}/> Refresh</button>
          </div>

          <div style={{fontSize:11,color:'var(--muted)',marginBottom:14}}>
            {filtered.length} customer{filtered.length!==1?'s':''} · click any card to open the Customer Hub
          </div>

          {/* Cards grid */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
            {loading
              ? Array.from({length:6}).map((_,i)=><div key={i} style={{background:'var(--surface2)',borderRadius:12,height:120,opacity:.5}}/>)
              : slice.length===0
              ? <div style={{gridColumn:'1/-1'}} className="empty-state"><div className="ei">👥</div><p>{search?'No match':'No customers yet — add your first customer above'}</p></div>
              : slice.map(c=>(
                <div key={c.customerId} onClick={()=>openHub(c)}
                  style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:0,cursor:'pointer',transition:'all .18s',overflow:'hidden'}}
                  onMouseOver={e=>{e.currentTarget.style.borderColor='rgba(56,217,245,.35)';e.currentTarget.style.transform='translateY(-1px)';}}
                  onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none';}}>
                  <div style={{padding:'14px 16px 10px',display:'flex',gap:12,alignItems:'flex-start'}}>
                    <div style={{width:40,height:40,borderRadius:10,flexShrink:0,background:'linear-gradient(135deg,var(--accent2),var(--accent))',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Syne',fontSize:14,fontWeight:800,color:'#0a0c0f'}}>
                      {(c.customerName||'?').slice(0,2).toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0,paddingRight:48}}>
                      <div style={{fontFamily:'Syne',fontSize:13,fontWeight:700,color:'var(--text)'}}>{c.customerName}</div>
                      {c.company&&<div style={{fontSize:10,color:'var(--accent2)',marginTop:1}}>{c.company}</div>}
                      <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{c.contact} · {c.city}</div>
                    </div>
                    <div style={{position:'absolute',top:12,right:12,fontSize:9,color:'var(--muted)',background:'var(--surface2)',border:'1px solid var(--border)',padding:'2px 7px',borderRadius:4}}>
                      {c.customerId}
                    </div>
                  </div>
                  <div style={{padding:'8px 16px 12px',background:'var(--surface2)',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                    {[{l:'Jobs',v:c.totalJobs||0},{l:'City',v:c.city||'—'},{l:'Type',v:c.customerType||'—'}].map(m=>(
                      <div key={m.l} style={{textAlign:'center'}}>
                        <div style={{fontFamily:'Syne',fontSize:15,fontWeight:700,color:'var(--text)'}}>{m.v}</div>
                        <div style={{fontSize:9,letterSpacing:1,textTransform:'uppercase',color:'var(--muted)',marginTop:2}}>{m.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            }
          </div>

          {pages>1&&(
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:16,flexWrap:'wrap',gap:8}}>
              <span style={{fontSize:11,color:'var(--muted)'}}>{(page-1)*PP+1}–{Math.min(page*PP,filtered.length)} of {filtered.length}</span>
              <div style={{display:'flex',gap:6}}>
                <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹ Prev</button>
                <button className="btn btn-ghost btn-sm" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>Next ›</button>
              </div>
            </div>
          )}
        </div>

      </PageContent>

      {/* ── Customer Hub Drawer ─────────────────────────────── */}
      <Drawer
        open={!!hubData} onClose={()=>setHubData(null)}
        title={c?.customerName||'…'}
        subtitle={[c?.company, c?.rac].filter(Boolean).join(' · ')}
        actions={<>
          <button className="btn btn-solid btn-sm" onClick={()=>{navigate(`/tickets?custId=${c?.customerId}&new=1`);setHubData(null);}}>
            <Ticket size={12}/> New Ticket
          </button>
          <button className="btn btn-primary btn-sm" onClick={()=>{navigate(`/job-orders?custId=${c?.customerId}&new=1`);setHubData(null);}}>
            <ClipboardList size={12}/> New Job Order
          </button>
          <button className="btn btn-ghost btn-sm" onClick={()=>{navigate(`/leads?custId=${c?.customerId}&new=1`);setHubData(null);}}>
            <Target size={12}/> New Lead
          </button>
        </>}
      >
        {hubLoading
          ? <div style={{color:'var(--muted)',fontSize:12,padding:'20px 0'}}>Loading hub…</div>
          : c && (
          <>
            {/* Summary KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:18}}>
              {[
                {l:'Completed Jobs',v:sum.totalJobs||0,c:'var(--accent)'},
                {l:'Active Assets', v:sum.totalAssets||0,c:'var(--accent2)'},
                {l:'Open Tickets',  v:sum.openTickets||0,c:sum.openTickets?'var(--warn)':'var(--success)'},
                {l:'Active Leads',  v:sum.activeLeads||0,c:'var(--accent3)'},
                {l:'Total Paid',    v:`PKR ${(sum.totalPaid||0).toLocaleString()}`,c:'var(--success)'},
                {l:'Outstanding',   v:`PKR ${(sum.totalOutstanding||0).toLocaleString()}`,c:sum.totalOutstanding?'var(--danger)':'var(--muted)'},
              ].map(m=>(
                <div key={m.l} style={{background:'var(--surface2)',borderRadius:8,padding:'10px 12px'}}>
                  <div style={{fontSize:9,letterSpacing:1.5,textTransform:'uppercase',color:'var(--muted)',marginBottom:4}}>{m.l}</div>
                  <div style={{fontFamily:'Syne',fontSize:16,fontWeight:800,color:m.c}}>{m.v}</div>
                </div>
              ))}
            </div>

            <DrawerSection title="Contact Details"/>
            <InfoGrid>
              <InfoItem label="Customer ID"  value={c.customerId}/>
              <InfoItem label="Contact"      value={c.contact}/>
              <InfoItem label="Email"        value={c.email}/>
              <InfoItem label="CNIC"         value={c.cnic}/>
              <InfoItem label="City / Area"  value={[c.city,c.area].filter(Boolean).join(', ')}/>
              <InfoItem label="Type"         value={c.customerType}/>
              <InfoItem label="RAC"          value={c.rac}/>
              <InfoItem label="Payment Pref" value={c.preferredPayment}/>
            </InfoGrid>

            {/* Assets with AMC status + Renew button */}
            {hubData.assets?.length>0&&(
              <>
                <DrawerSection title={`Assets (${hubData.assets.length})`}/>
                {hubData.assets.map(a=>{
                  const amc = amcStatus(a.amcExpiry);
                  return (
                    <div key={a.assetId} style={{background:'var(--surface2)',border:`1px solid ${amc?amcCol[amc]+'33':'var(--border)'}`,borderRadius:10,padding:'12px 14px',marginBottom:8}}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                        <div style={{flex:1}}>
                          <div style={{fontFamily:'Syne',fontSize:14,fontWeight:800,color:'var(--accent)'}}>{a.registrationNo}</div>
                          <div style={{fontSize:11,color:'var(--text)',marginTop:2}}>{[a.make,a.model,a.color].filter(Boolean).join(' ')}</div>
                          <div style={{fontSize:10,color:'var(--muted)',marginTop:3}}>
                            📡 {a.trackerIMEI||'—'} {a.trackerModel&&`(${a.trackerModel})`}
                            &nbsp;·&nbsp; 💳 {a.simNumber||'—'}
                          </div>
                        </div>
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <Badge variant={a.status?.toLowerCase()}>{a.status}</Badge>
                          {a.amcExpiry&&(
                            <div style={{fontSize:10,color:amcCol[amc]||'var(--muted)',marginTop:5}}>
                              {amc==='expired'?'⚠ Expired':'AMC'} {formatDate(a.amcExpiry)}
                            </div>
                          )}
                          {(amc==='expired'||amc==='expiring')&&(
                            <button className="btn btn-ghost btn-sm" style={{marginTop:6,color:'var(--warn)',borderColor:'rgba(255,179,71,.3)',fontSize:9}}
                              onClick={()=>{setRenewModal(a);setRenewForm({amcDuration:'1 Year'});}}>
                              Renew AMC
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Recent Jobs */}
            {hubData.jobs?.length>0&&(
              <>
                <DrawerSection title={`Job Orders (${hubData.jobs.length})`}/>
                {hubData.jobs.slice(0,5).map(j=>(
                  <div key={j.invoiceNumber} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--border)'}}>
                    <div>
                      <div style={{fontSize:12,color:'var(--text)',fontWeight:500}}>{j.registrationNo||j.vehicle||'—'}</div>
                      <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{j.toc} · {j.technicianName||'—'} · {formatDate(j.date)}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <Badge variant={j.status?.toLowerCase().replace(/ /g,'-')}>{j.status}</Badge>
                      {j.amount&&<div style={{fontSize:10,color:'var(--muted)',marginTop:3}}>PKR {Number(j.amount).toLocaleString()}</div>}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Leads with Convert to JO button */}
            {hubData.leads?.length>0&&(
              <>
                <DrawerSection title={`Sales Leads (${hubData.leads.length})`}/>
                {hubData.leads.map(l=>(
                  <div key={l.leadId} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--border)'}}>
                    <div>
                      <div style={{fontSize:12,color:'var(--text)',fontWeight:500}}>{l.title}</div>
                      <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>
                        {l.salesperson||'—'} · Follow-up: {formatDate(l.followupDate)}
                        {l.convertedJobId&&<span style={{color:'var(--success)',marginLeft:8}}>✓ {l.convertedJobId}</span>}
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                      <Badge variant={l.status?.toLowerCase().replace(/ /g,'-')}>{l.status}</Badge>
                      {l.status==='Won'&&!l.convertedJobId&&(
                        <button className="btn btn-solid btn-sm" style={{fontSize:9}} disabled={converting}
                          onClick={()=>convertLead(l.leadId)}>
                          <ArrowRight size={10}/> Convert
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Recent Tickets */}
            {hubData.tickets?.length>0&&(
              <>
                <DrawerSection title={`Tickets (${hubData.tickets.length})`}/>
                {hubData.tickets.slice(0,5).map(t=>(
                  <div key={t.ticketId} className="tl-item" style={{borderLeftColor:t.type==='Complaint'?'var(--danger)':'var(--accent2)'}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:1,color:t.type==='Complaint'?'var(--danger)':'var(--accent2)'}}>{t.type}</span>
                      <span style={{fontSize:10,color:'var(--muted)'}}>{formatDate(t.createdAt)}</span>
                    </div>
                    <div style={{fontSize:11,color:'var(--text)',marginTop:3}}>{t.title}</div>
                    <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
                      <span style={{fontSize:9,color:'var(--muted)',fontFamily:'monospace'}}>{t.ticketId}</span>
                      <Badge variant={t.status?.toLowerCase()}>{t.status}</Badge>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Payments */}
            {hubData.payments?.length>0&&(
              <>
                <DrawerSection title="Recent Payments"/>
                {hubData.payments.map(p=>(
                  <div key={p.paymentId} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                    <div>
                      <div style={{fontSize:11,color:'var(--text)'}}>{p.type} · {formatDate(p.paymentDate)}</div>
                      <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>
                        Paid: PKR {Number(p.paidAmount||0).toLocaleString()}
                        {Number(p.balanceDue)>0&&<span style={{color:'var(--danger)',marginLeft:8}}>Balance: PKR {Number(p.balanceDue).toLocaleString()}</span>}
                      </div>
                    </div>
                    <Badge variant={p.status?.toLowerCase()}>{p.status}</Badge>
                  </div>
                ))}
              </>
            )}

            {/* No data placeholder */}
            {!hubData.assets?.length&&!hubData.jobs?.length&&!hubData.leads?.length&&(
              <div className="empty-state" style={{marginTop:16}}>
                <div className="ei">🚀</div>
                <p style={{color:'var(--muted)',fontSize:12}}>New customer — add a lead or job order to get started</p>
                <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:12}}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>{navigate(`/leads?custId=${c.customerId}&new=1`);setHubData(null);}}>New Lead</button>
                  <button className="btn btn-primary btn-sm" onClick={()=>{navigate(`/job-orders?custId=${c.customerId}&new=1`);setHubData(null);}}>New Job Order</button>
                </div>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* ── Add Customer Modal ──────────────────────────────── */}
      <Modal open={showAdd} onClose={()=>{setShowAdd(false);setForm(BLANK);setFormErr('');}} title="New Customer" size="lg">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 18px'}}>
          <Field label="Customer Name *"><Input placeholder="Full legal name" value={form.customerName} onChange={set('customerName')}/></Field>
          <Field label="Contact Number *"><Input placeholder="+92 3XX XXXXXXX" value={form.contact} onChange={set('contact')}/></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={set('email')}/></Field>
          <Field label="CNIC"><Input placeholder="XXXXX-XXXXXXX-X" value={form.cnic} onChange={set('cnic')}/></Field>
          <Field label="Company"><Input value={form.company} onChange={set('company')}/></Field>
          <Field label="RAC / Group"><Input placeholder="Fleet group code" value={form.rac} onChange={set('rac')}/></Field>
          <Field label="City *">
            <Select value={form.city} onChange={set('city')}><option value="">Select…</option>{CITIES.map(c=><option key={c}>{c}</option>)}</Select>
          </Field>
          <Field label="Area"><Input placeholder="DHA, Gulberg…" value={form.area} onChange={set('area')}/></Field>
          <Field label="Customer Type">
            <Select value={form.customerType} onChange={set('customerType')}>
              <option value="individual">Individual</option><option value="corporate">Corporate</option><option value="fleet">Fleet Owner</option>
            </Select>
          </Field>
          <Field label="Preferred Payment">
            <Select value={form.preferredPayment} onChange={set('preferredPayment')}>
              <option value="">Select…</option>{['Cash','Bank Transfer','Cheque','Online / Mobile'].map(o=><option key={o}>{o}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Notes"><Textarea placeholder="Internal notes…" value={form.notes} onChange={set('notes')} style={{minHeight:60}}/></Field>
        {formErr&&<div style={{padding:'10px 14px',background:'rgba(255,95,109,.08)',border:'1px solid rgba(255,95,109,.3)',borderRadius:8,color:'var(--danger)',fontSize:11,marginBottom:8}}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={()=>{setShowAdd(false);setForm(BLANK);}}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={save}>{saving?'Saving…':'Save Customer'}</button>
        </ModalButtons>
      </Modal>

      {/* ── AMC Renewal Modal ───────────────────────────────── */}
      <Modal open={!!renewModal} onClose={()=>setRenewModal(null)} title={`Renew AMC — ${renewModal?.registrationNo}`} size="sm">
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:16,lineHeight:1.6}}>
          Current expiry: <strong style={{color:'var(--danger)'}}>{formatDate(renewModal?.amcExpiry)}</strong>
          {renewModal?.package&&<> · Package: {renewModal.package}</>}
        </p>
        <Field label="New AMC Expiry *"><Input type="date" value={renewForm.newAmcExpiry||''} onChange={setR('newAmcExpiry')}/></Field>
        <Field label="AMC Duration"><Input placeholder="1 Year" value={renewForm.amcDuration||''} onChange={setR('amcDuration')}/></Field>
        <Field label="Renewal Amount (PKR)"><Input type="number" value={renewForm.amount||''} onChange={setR('amount')}/></Field>
        <ModalButtons>
          <button className="btn btn-ghost" onClick={()=>setRenewModal(null)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={submitRenewal}>{saving?'Saving…':'Create Renewal Job Order'}</button>
        </ModalButtons>
      </Modal>
    </>
  );
}
