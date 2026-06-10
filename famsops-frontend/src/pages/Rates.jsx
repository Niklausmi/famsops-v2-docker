import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Save, Plus, Trash2, Search } from 'lucide-react';
import { Topbar }     from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { StatTile }   from '../components/ui/StatTile';
import { Modal, ModalButtons } from '../components/ui/Modal';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { CustomerSearch } from '../components/ui/CustomerSearch';
import { api } from '../api/client';
import { usePermission } from '../hooks/usePermission';

const TOC_LIST = [
  'New Installation','Replacement','Reinstallation',
  'Removal','Vehicle Transfer','Ownership Transfer','Inspection',
];

const SUB_ACTIONS = ['create','continue','cancel','transfer','renew','none'];

const ACTION_STYLE = {
  create:   { color:'var(--success)',  bg:'rgba(61,255,160,.1)',  label:'Create subscription' },
  continue: { color:'var(--muted)',    bg:'rgba(90,96,112,.12)', label:'Subscription continues' },
  cancel:   { color:'var(--danger)',   bg:'rgba(255,95,109,.1)',  label:'Cancel subscription' },
  renew:    { color:'var(--accent2)',  bg:'rgba(123,111,255,.1)', label:'Renew +1 year' },
  transfer: { color:'var(--warn)',     bg:'rgba(255,179,71,.1)',  label:'Transfer subscription' },
  none:     { color:'var(--muted)',    bg:'rgba(90,96,112,.08)', label:'No change' },
};

export default function Rates() {
  const canRead   = usePermission('payments','read');
  const canUpdate = usePermission('payments','update');

  const [tab, setTab]           = useState('rates');       // 'rates' | 'toc' | 'overrides'
  const [rates, setRates]       = useState([]);
  const [tocRules, setTocRules] = useState([]);
  const [loading, setLoading]   = useState(false);

  // Rates editing
  const [editingRate, setEditingRate]   = useState(null);   // rateType string
  const [rateValues, setRateValues]     = useState({});     // { rateType: { amount, label } }
  const [saving, setSaving]             = useState({});

  // TOC rules editing
  const [editingToc, setEditingToc]     = useState(null);
  const [tocForm, setTocForm]           = useState({});

  // Customer overrides
  const [overrideCustomer, setOverrideCustomer] = useState(null);
  const [customerRates, setCustomerRates]       = useState([]);
  const [overrideModal, setOverrideModal]       = useState(null); // rate object
  const [overrideAmount, setOverrideAmount]     = useState('');
  const [overrideNotes, setOverrideNotes]       = useState('');
  const [overrideLoading, setOverrideLoading]   = useState(false);

  const loadRates = async () => {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([api.rates.list(), api.rates.tocRules()]);
      setRates(r.data.data || r.data || []);
      setTocRules(t.data.data || t.data || []);
    } catch { setRates([]); setTocRules([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadRates(); }, []);

  const loadCustomerRates = async (custId) => {
    setOverrideLoading(true);
    try { const r = await api.rates.customerRates(custId); setCustomerRates(r.data.data || r.data || []); }
    catch { setCustomerRates([]); }
    finally { setOverrideLoading(false); }
  };

  const saveRate = async (rateType) => {
    const vals = rateValues[rateType];
    if (!vals) return;
    setSaving(s => ({...s, [rateType]: true}));
    try {
      await api.rates.update(rateType, { amount: Number(vals.amount), label: vals.label });
      setEditingRate(null);
      loadRates();
    } catch(e) { alert(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(s => ({...s, [rateType]: false})); }
  };

  const saveTocRule = async () => {
    try {
      await api.rates.updateTocRule(editingToc, {
        chargeTypes:        tocForm.chargeTypes,
        subscriptionAction: tocForm.subscription_action,
        paymentDueDays:     Number(tocForm.payment_due_days),
        notes:              tocForm.notes,
      });
      setEditingToc(null);
      loadRates();
    } catch(e) { alert(e.response?.data?.message || 'Save failed'); }
  };

  const saveOverride = async () => {
    if (!overrideCustomer || !overrideModal) return;
    try {
      await api.rates.setOverride(overrideCustomer.customerId, overrideModal.rate_type, {
        amount: Number(overrideAmount),
        notes:  overrideNotes,
      });
      setOverrideModal(null);
      loadCustomerRates(overrideCustomer.customerId);
    } catch(e) { alert(e.response?.data?.message || 'Save failed'); }
  };

  const removeOverride = async (rateType) => {
    if (!overrideCustomer) return;
    if (!confirm(`Remove custom rate for "${rateType}"? Standard rate will apply.`)) return;
    try {
      await api.rates.removeOverride(overrideCustomer.customerId, rateType);
      loadCustomerRates(overrideCustomer.customerId);
    } catch(e) { alert(e.response?.data?.message || 'Failed'); }
  };

  const totalRevenue = useMemo(() =>
    rates.reduce((s, r) => s + Number(r.amount || 0), 0)
  , [rates]);

  const Section = ({title}) => (
    <div style={{fontSize:9,letterSpacing:2,textTransform:'uppercase',color:'var(--muted)',padding:'18px 0 8px',display:'flex',alignItems:'center',gap:10,marginTop:4}}>
      {title}<div style={{flex:1,height:1,background:'var(--border)'}}/>
    </div>
  );

  return (
    <>
      <Topbar title="Rate Management" subtitle="Standard rates · TOC billing rules · Customer overrides"/>
      <PageContent>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:22}}>
          <StatTile label="Rate Types"        value={rates.length}                                    color="t-cyan"/>
          <StatTile label="TOC Rules"         value={tocRules.length}                                 color="t-purple"/>
          <StatTile label="Install + Hardware" value={`PKR ${(Number(rates.find(r=>r.rate_type==='installation_fee')?.amount||0)+Number(rates.find(r=>r.rate_type==='hardware_unit')?.amount||0)+Number(rates.find(r=>r.rate_type==='sim_card')?.amount||0)).toLocaleString('en-PK')}`} color="t-green"/>
          <StatTile label="Monthly SaaS"      value={`PKR ${Number(rates.find(r=>r.rate_type==='monthly_saas')?.amount||0).toLocaleString('en-PK')}`} sub="per vehicle/mo" color="t-warn"/>
        </div>

        {/* Tab bar */}
        <div style={{display:'flex',gap:6,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:5,marginBottom:20,maxWidth:520}}>
          {[
            {id:'rates',    label:'📋 Standard Rates'},
            {id:'toc',      label:'🔧 TOC Rules'},
            {id:'overrides',label:'👤 Customer Overrides'},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:1, padding:'9px 14px', border:'none', borderRadius:8, cursor:'pointer',
              background: tab===t.id ? 'rgba(56,217,245,.1)' : 'transparent',
              color: tab===t.id ? 'var(--accent)' : 'var(--muted)',
              fontFamily:'DM Mono', fontSize:11, letterSpacing:1, textTransform:'uppercase',
              transition:'all .2s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── TAB: STANDARD RATES ─────────────────────────── */}
        {tab === 'rates' && (
          <div className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:12,color:'var(--muted)'}}>These are your published prices. Customer overrides sit on top.</div>
              <button className="btn btn-ghost btn-sm" onClick={loadRates}><RefreshCw size={12}/></button>
            </div>

            {loading ? (
              <div style={{color:'var(--muted)',fontSize:12,padding:'20px 0'}}>Loading…</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rate Type</th>
                      <th>Label</th>
                      <th>Amount (PKR)</th>
                      <th>Unit</th>
                      <th>Description</th>
                      {canUpdate && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map(r => (
                      <tr key={r.rate_type}>
                        <td><span style={{fontFamily:'monospace',fontSize:10,color:'var(--accent2)'}}>{r.rate_type}</span></td>
                        <td>
                          {editingRate === r.rate_type ? (
                            <input className="field-input" style={{fontSize:11,padding:'5px 8px'}}
                              value={rateValues[r.rate_type]?.label ?? r.label}
                              onChange={e => setRateValues(v=>({...v,[r.rate_type]:{...v[r.rate_type],label:e.target.value}}))}/>
                          ) : (
                            <span style={{fontSize:12,color:'var(--text)',fontWeight:500}}>{r.label}</span>
                          )}
                        </td>
                        <td>
                          {editingRate === r.rate_type ? (
                            <input className="field-input" type="number" min="0" style={{fontSize:12,padding:'5px 8px',width:100,fontFamily:'Syne',fontWeight:700}}
                              value={rateValues[r.rate_type]?.amount ?? r.amount}
                              onChange={e => setRateValues(v=>({...v,[r.rate_type]:{...v[r.rate_type],amount:e.target.value}}))}/>
                          ) : (
                            <span style={{fontFamily:'Syne',fontWeight:700,fontSize:13,color:'var(--success)'}}>
                              PKR {Number(r.amount).toLocaleString('en-PK')}
                            </span>
                          )}
                        </td>
                        <td><span style={{fontSize:10,color:'var(--muted)'}}>{r.unit}</span></td>
                        <td><span style={{fontSize:10,color:'var(--muted)'}}>{r.description}</span></td>
                        {canUpdate && (
                          <td>
                            {editingRate === r.rate_type ? (
                              <div style={{display:'flex',gap:5}}>
                                <button className="btn btn-ghost btn-sm" style={{color:'var(--success)'}}
                                  disabled={saving[r.rate_type]}
                                  onClick={()=>saveRate(r.rate_type)}>
                                  {saving[r.rate_type]?'…':<Save size={11}/>}
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={()=>setEditingRate(null)}>×</button>
                              </div>
                            ) : (
                              <button className="btn btn-ghost btn-sm" onClick={()=>{
                                setEditingRate(r.rate_type);
                                setRateValues(v=>({...v,[r.rate_type]:{amount:r.amount,label:r.label}}));
                              }}>Edit</button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: TOC RULES ──────────────────────────────── */}
        {tab === 'toc' && (
          <div className="card">
            <div style={{fontSize:12,color:'var(--muted)',marginBottom:16}}>
              Defines what charges fire and what happens to subscriptions when each job type completes.
            </div>
            {loading ? (
              <div style={{color:'var(--muted)',fontSize:12}}>Loading…</div>
            ) : (
              <div style={{display:'grid',gap:12}}>
                {tocRules.map(rule => {
                  const as = ACTION_STYLE[rule.subscription_action] || ACTION_STYLE.none;
                  const isEditing = editingToc === rule.toc;
                  return (
                    <div key={rule.toc} style={{
                      background:'var(--surface2)',border:'1px solid var(--border)',
                      borderRadius:12,padding:'16px 18px',
                    }}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                        <div>
                          <div style={{fontFamily:'Syne',fontSize:14,fontWeight:700,color:'var(--text)'}}>{rule.toc}</div>
                          {rule.notes && <div style={{fontSize:10,color:'var(--muted)',marginTop:3}}>{rule.notes}</div>}
                        </div>
                        {canUpdate && !isEditing && (
                          <button className="btn btn-ghost btn-sm" onClick={()=>{
                            setEditingToc(rule.toc);
                            setTocForm({...rule, chargeTypes: rule.charge_types || []});
                          }}>Edit</button>
                        )}
                      </div>

                      {isEditing ? (
                        <div>
                          <div style={{fontSize:10,color:'var(--muted)',marginBottom:8}}>Charge types (rate_type keys, comma separated):</div>
                          <input className="field-input" style={{marginBottom:10,fontSize:11}}
                            value={(tocForm.chargeTypes||[]).join(',')}
                            onChange={e=>setTocForm(f=>({...f,chargeTypes:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}))}
                            placeholder="installation_fee,hardware_unit,sim_card"/>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 12px'}}>
                            <Field label="Subscription Action">
                              <Select value={tocForm.subscription_action||'none'} onChange={e=>setTocForm(f=>({...f,subscription_action:e.target.value}))}>
                                {SUB_ACTIONS.map(a=><option key={a}>{a}</option>)}
                              </Select>
                            </Field>
                            <Field label="Payment Due (days)">
                              <Input type="number" min="0" value={tocForm.payment_due_days||7} onChange={e=>setTocForm(f=>({...f,payment_due_days:e.target.value}))}/>
                            </Field>
                            <Field label="Notes">
                              <Input value={tocForm.notes||''} onChange={e=>setTocForm(f=>({...f,notes:e.target.value}))}/>
                            </Field>
                          </div>
                          <div style={{display:'flex',gap:8,marginTop:10}}>
                            <button className="btn btn-solid btn-sm" onClick={saveTocRule}>Save Rule</button>
                            <button className="btn btn-ghost btn-sm" onClick={()=>setEditingToc(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                          {/* Charge pills */}
                          {(rule.charge_types||[]).map(ct=>(
                            <span key={ct} style={{fontSize:10,padding:'3px 9px',borderRadius:5,background:'rgba(56,217,245,.1)',color:'var(--accent)',border:'1px solid rgba(56,217,245,.2)'}}>
                              {ct}
                            </span>
                          ))}
                          <span style={{color:'var(--muted)',fontSize:12}}>→</span>
                          {/* Subscription action badge */}
                          <span style={{fontSize:10,padding:'3px 9px',borderRadius:5,background:as.bg,color:as.color,fontWeight:600}}>
                            {as.label}
                          </span>
                          <span style={{fontSize:10,color:'var(--muted)',marginLeft:'auto'}}>
                            Due in {rule.payment_due_days} days
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: CUSTOMER OVERRIDES ─────────────────────── */}
        {tab === 'overrides' && (
          <div className="card">
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>
                Set custom rates for specific customers. Overrides standard rates for invoicing and billing preview.
              </div>
              <Field label="Select Customer">
                <CustomerSearch
                  value={overrideCustomer}
                  onChange={c => { setOverrideCustomer(c); loadCustomerRates(c.customerId); }}
                  onClear={() => { setOverrideCustomer(null); setCustomerRates([]); }}
                  placeholder="Search customer to view/set custom rates…"
                />
              </Field>
            </div>

            {overrideCustomer && (
              <>
                {overrideLoading ? (
                  <div style={{color:'var(--muted)',fontSize:12}}>Loading rates…</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Rate Type</th>
                          <th>Standard Rate</th>
                          <th>Custom Rate</th>
                          <th>Effective Rate</th>
                          <th>Notes</th>
                          {canUpdate && <th>Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {customerRates.map(r=>(
                          <tr key={r.rateType}>
                            <td>
                              <div style={{fontSize:11,fontWeight:600,color:'var(--text)'}}>{r.label}</div>
                              <div style={{fontSize:9,color:'var(--muted)',fontFamily:'monospace',marginTop:1}}>{r.rateType}</div>
                            </td>
                            <td><span style={{fontSize:11,color:'var(--muted)'}}>PKR {Number(r.standardRate).toLocaleString('en-PK')}</span></td>
                            <td>
                              {r.override ? (
                                <span style={{fontSize:11,fontWeight:600,color:'var(--warn)'}}>
                                  PKR {Number(r.override.rate).toLocaleString('en-PK')}
                                </span>
                              ) : (
                                <span style={{fontSize:10,color:'var(--muted2)'}}>—</span>
                              )}
                            </td>
                            <td>
                              <span style={{fontFamily:'Syne',fontWeight:700,fontSize:12,color:r.override?'var(--warn)':'var(--success)'}}>
                                PKR {Number(r.effectiveRate).toLocaleString('en-PK')}
                              </span>
                              {r.override && (
                                <span style={{fontSize:9,marginLeft:5,color:'var(--warn)',letterSpacing:.5}}>CUSTOM</span>
                              )}
                            </td>
                            <td><span style={{fontSize:10,color:'var(--muted)'}}>{r.override?.notes||'—'}</span></td>
                            {canUpdate && (
                              <td>
                                <div style={{display:'flex',gap:5}}>
                                  <button className="btn btn-ghost btn-sm" onClick={()=>{
                                    setOverrideModal(r);
                                    setOverrideAmount(r.override ? r.override.rate : r.standardRate);
                                    setOverrideNotes(r.override?.notes || '');
                                  }}>
                                    {r.override ? 'Edit' : 'Set'}
                                  </button>
                                  {r.override && (
                                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}}
                                      onClick={()=>removeOverride(r.rateType)}>
                                      <Trash2 size={11}/>
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {!overrideCustomer && (
              <div className="empty-state">
                <div className="ei">👤</div>
                <p>Select a customer above to view and set custom rates</p>
              </div>
            )}
          </div>
        )}

      </PageContent>

      {/* Set Override Modal */}
      <Modal open={!!overrideModal} onClose={()=>setOverrideModal(null)}
        title={`Custom Rate — ${overrideModal?.label}`} size="sm">
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:16,lineHeight:1.6}}>
          Customer: <strong>{overrideCustomer?.customerName}</strong><br/>
          Standard rate: <strong>PKR {Number(overrideModal?.standardRate||0).toLocaleString('en-PK')}</strong>
        </p>
        <Field label="Custom Rate (PKR) *">
          <Input type="number" min="0" value={overrideAmount}
            onChange={e=>setOverrideAmount(e.target.value)}
            style={{fontFamily:'Syne',fontWeight:700,fontSize:14}}/>
        </Field>
        <Field label="Notes">
          <Input value={overrideNotes} onChange={e=>setOverrideNotes(e.target.value)}
            placeholder="Reason for custom rate…"/>
        </Field>
        <ModalButtons>
          <button className="btn btn-ghost" onClick={()=>setOverrideModal(null)}>Cancel</button>
          <button className="btn btn-solid" onClick={saveOverride}>Save Custom Rate</button>
        </ModalButtons>
      </Modal>
    </>
  );
}
