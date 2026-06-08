import { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { Topbar } from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { Drawer, DrawerSection, InfoGrid, InfoItem } from '../components/ui/Drawer';
import { Modal, ModalButtons } from '../components/ui/Modal';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { api } from '../api/client';
import { formatDate } from '../lib/utils';

const BLANK = { name:'', phone:'', city:'', fuelAllowance:0, notes:'' };

const TOC_COLOR = {
  'New Installation':'var(--accent)',
  'Replacement':'var(--warn)',
  'Removal':'var(--danger)',
  'AMC Visit':'var(--accent2)',
  'Repair / Service':'var(--accent3)',
};

export default function Technicians() {
  const [techs,setTechs]       = useState([]);
  const [loading,setLoading]   = useState(false);
  const [search,setSearch]     = useState('');
  const [selected,setSelected] = useState(null);
  const [detail,setDetail]     = useState(null);
  const [detailLoading,setDetailLoading] = useState(false);
  const [showEdit,setShowEdit] = useState(false);
  const [form,setForm]         = useState(BLANK);
  const [saving,setSaving]     = useState(false);
  const [formErr,setFormErr]   = useState('');

  const load = async () => {
    setLoading(true);
    try { const {data} = await api.technicians.list(); setTechs(data.data||data||[]); }
    catch { setTechs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return techs;
    const q = search.toLowerCase();
    return techs.filter(t => [t.name,t.phone,t.city,t.techId].some(v=>(v||'').toLowerCase().includes(q)));
  }, [techs, search]);

  const totals = useMemo(() => ({
    total:     techs.length,
    active:    techs.filter(t=>t.active!==false).length,
    thisMonth: techs.reduce((s,t)=>s+Number(t.thisMonthJobs||0),0),
    allJobs:   techs.reduce((s,t)=>s+Number(t.completedJobs||0),0),
  }), [techs]);

  const openDetail = async (t) => {
    setSelected(t);
    setDetailLoading(true);
    try { const {data} = await api.technicians.get(t.techId); setDetail(data); }
    catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

  const openNew  = () => { setForm(BLANK); setFormErr(''); setShowEdit(true); };
  const openEdit = (t) => { setForm({...BLANK,...t}); setFormErr(''); setSelected(null); setDetail(null); setShowEdit(true); };

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}));

  const save = async () => {
    if (!form.name) { setFormErr('Name is required'); return; }
    setSaving(true); setFormErr('');
    try {
      if (form.techId) await api.technicians.update(form.techId, form);
      else             await api.technicians.create(form);
      setShowEdit(false); load();
    } catch(e) { setFormErr(e.response?.data?.message||'Save failed'); }
    finally { setSaving(false); }
  };

  const toggle = async (t) => {
    try { await api.technicians.update(t.techId, { active: !t.active }); load(); }
    catch(e) { alert('Failed: ' + e.message); }
  };

  // Incentive calculator — PKR 200 per job this month as baseline
  const calcIncentive = (t) => {
    const base   = Number(t.fuelAllowance||0);
    const bonus  = Number(t.thisMonthJobs||0) * 200;
    return base + bonus;
  };

  return (
    <>
      <Topbar
        title="Technicians"
        subtitle="Installer tracking — jobs, cities & fuel incentives"
        actions={<button className="btn btn-solid btn-sm" onClick={openNew}><Plus size={13}/> Add Technician</button>}
      />
      <PageContent>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:22}}>
          <StatTile label="Total"          value={totals.total}     color="t-cyan"/>
          <StatTile label="Active"         value={totals.active}    color="t-green"/>
          <StatTile label="This Month"     value={totals.thisMonth} sub="jobs completed" color="t-purple"/>
          <StatTile label="All Completed"  value={totals.allJobs}   sub="all time" color="t-warn"/>
        </div>

        {/* Technician cards */}
        <div className="card">
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16,alignItems:'center'}}>
            <div style={{flex:1,minWidth:200,position:'relative'}}>
              <Search size={13} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
              <input className="field-input" style={{paddingLeft:34}} placeholder="Name, phone, city…"
                value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12}/></button>
          </div>

          {loading ? (
            <div style={{color:'var(--muted)',fontSize:12,padding:'20px 0'}}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><div className="ei">🔧</div><p>No technicians found</p></div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
              {filtered.map(t => {
                const incentive = calcIncentive(t);
                return (
                  <div key={t.techId}
                    onClick={() => openDetail(t)}
                    style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',cursor:'pointer',transition:'all .18s'}}
                    onMouseOver={e=>{e.currentTarget.style.borderColor='rgba(56,217,245,.35)';e.currentTarget.style.transform='translateY(-1px)';}}
                    onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none';}}>
                    {/* Top accent bar */}
                    <div style={{height:3,background:t.active!==false?'linear-gradient(90deg,var(--accent2),var(--accent))':'var(--surface3)'}}/>
                    <div style={{padding:'16px 18px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
                        <div style={{width:42,height:42,borderRadius:10,flexShrink:0,background:'linear-gradient(135deg,var(--accent2),var(--accent))',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Syne',fontSize:15,fontWeight:800,color:'#0a0c0f'}}>
                          {(t.name||'?').slice(0,2).toUpperCase()}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:'Syne',fontSize:14,fontWeight:700,color:'var(--text)'}}>{t.name}</div>
                          <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{t.phone||'—'} · {t.city||'—'}</div>
                        </div>
                        <Badge variant={t.active!==false?'active':'inactive'}>{t.active!==false?'Active':'Inactive'}</Badge>
                      </div>

                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                        {[
                          {l:'This Month',v:t.thisMonthJobs||0,c:'var(--accent)'},
                          {l:'Completed',v:t.completedJobs||0,c:'var(--accent2)'},
                          {l:'Incentive',v:`PKR ${incentive.toLocaleString()}`,c:'var(--success)'},
                        ].map(m=>(
                          <div key={m.l} style={{background:'var(--surface2)',borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                            <div style={{fontFamily:'Syne',fontSize:m.l==='Incentive'?11:16,fontWeight:700,color:m.c}}>{m.v}</div>
                            <div style={{fontSize:9,letterSpacing:1,textTransform:'uppercase',color:'var(--muted)',marginTop:3}}>{m.l}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginTop:12,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                        <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();openEdit(t);}}>Edit</button>
                        <button className="btn btn-ghost btn-sm"
                          style={{color:t.active!==false?'var(--danger)':'var(--success)'}}
                          onClick={e=>{e.stopPropagation();toggle(t);}}>
                          {t.active!==false?'Disable':'Enable'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </PageContent>

      {/* Detail Drawer */}
      <Drawer
        open={!!selected}
        onClose={()=>{setSelected(null);setDetail(null);}}
        title={selected?.name||'—'}
        subtitle={`${selected?.techId} · ${selected?.city||'—'}`}
        actions={<button className="btn btn-primary btn-sm" onClick={()=>openEdit(selected)}>✏ Edit</button>}
      >
        {detailLoading ? (
          <div style={{color:'var(--muted)',fontSize:12,padding:'20px 0'}}>Loading…</div>
        ) : detail && (
          <>
            {/* Monthly stats bars */}
            {detail.monthlyStats?.length > 0 && (
              <>
                <DrawerSection title="Monthly Performance (last 6 months)"/>
                {detail.monthlyStats.map(m => {
                  const pct = m.total > 0 ? Math.round(Number(m.completed)/Number(m.total)*100) : 0;
                  return (
                    <div key={m.month} style={{marginBottom:10}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                        <span style={{fontSize:11,color:'var(--muted)'}}>{m.month}</span>
                        <span style={{fontSize:11,color:'var(--accent)',fontWeight:600}}>{m.completed} / {m.total} jobs</span>
                      </div>
                      <div style={{height:5,background:'var(--surface2)',borderRadius:3,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,background:'var(--accent)',borderRadius:3}}/>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            <DrawerSection title="Incentive Breakdown (this month)"/>
            <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px'}}>
              {[
                {l:'Base Fuel Allowance', v:`PKR ${Number(selected?.fuelAllowance||0).toLocaleString()}`},
                {l:'Job Bonus (PKR 200 × ' + (selected?.thisMonthJobs||0) + ')', v:`PKR ${(Number(selected?.thisMonthJobs||0)*200).toLocaleString()}`},
                {l:'Total Incentive', v:`PKR ${calcIncentive(selected||{}).toLocaleString()}`, bold:true},
              ].map(m=>(
                <div key={m.l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:11,color:'var(--muted)'}}>{m.l}</span>
                  <span style={{fontSize:11,color:m.bold?'var(--success)':'var(--text)',fontWeight:m.bold?700:400}}>{m.v}</span>
                </div>
              ))}
            </div>

            {/* Recent jobs */}
            {detail.jobs?.length > 0 && (
              <>
                <DrawerSection title={`Job History (${detail.jobs.length})`}/>
                {detail.jobs.slice(0,10).map(j=>(
                  <div key={j.invoice_number} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--border)'}}>
                    <div>
                      <div style={{fontSize:12,color:'var(--text)',fontWeight:500}}>{j.registration_no||j.customer_name||'—'}</div>
                      <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>
                        <span style={{color:TOC_COLOR[j.toc]||'var(--muted)'}}>{j.toc}</span>
                        {' · '}{j.install_city||j.customer_name||'—'}
                        {' · '}{formatDate(j.date)}
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <Badge variant={j.status?.toLowerCase().replace(/ /g,'-')}>{j.status}</Badge>
                      {j.amount&&<div style={{fontSize:10,color:'var(--muted)',marginTop:3}}>PKR {Number(j.amount).toLocaleString()}</div>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </Drawer>

      {/* Add / Edit Modal */}
      <Modal open={showEdit} onClose={()=>setShowEdit(false)} title={form.techId?'Edit Technician':'Add Technician'} size="sm">
        <Field label="Full Name *"><Input placeholder="Muhammad Zahid" value={form.name} onChange={set('name')}/></Field>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 18px'}}>
          <Field label="Phone"><Input placeholder="+92 3XX XXXXXXX" value={form.phone||''} onChange={set('phone')}/></Field>
          <Field label="City">
            <Select value={form.city||''} onChange={set('city')}>
              <option value="">Select…</option>
              {['Karachi','Lahore','Islamabad','Rawalpindi','Faisalabad','Multan','Peshawar','Other'].map(c=><option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Base Fuel Allowance (PKR/mo)">
            <Input type="number" min="0" value={form.fuelAllowance||0} onChange={set('fuelAllowance')}/>
          </Field>
          {form.techId && (
            <Field label="Status">
              <Select value={form.active===false?'false':'true'} onChange={e=>setForm(f=>({...f,active:e.target.value==='true'}))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </Field>
          )}
        </div>
        <Field label="Notes"><Textarea value={form.notes||''} onChange={set('notes')} style={{minHeight:60}}/></Field>
        {formErr&&<div style={{padding:'10px 14px',background:'rgba(255,95,109,.08)',border:'1px solid rgba(255,95,109,.3)',borderRadius:8,color:'var(--danger)',fontSize:11,marginBottom:8}}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={()=>setShowEdit(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={save}>{saving?'Saving…':(form.techId?'Save Changes':'Add Technician')}</button>
        </ModalButtons>
      </Modal>
    </>
  );
}
