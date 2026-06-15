import { useState, useEffect, useRef } from 'react';
import { Receipt, RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { api } from '../../api/client';
import { formatDate } from '../../lib/utils';

const SUB_STYLE = {
  create:   { color:'var(--success)', icon:'🆕', label:'New subscription will be created' },
  continue: { color:'var(--muted)',   icon:'▶',  label:'Existing subscription continues' },
  cancel:   { color:'var(--danger)',  icon:'⛔',  label:'Subscription will be cancelled' },
  renew:    { color:'var(--accent2)', icon:'🔁',  label:'Subscription extended +1 year' },
  transfer: { color:'var(--warn)',    icon:'↔',   label:'Subscription will be transferred' },
  none:     { color:'var(--muted)',   icon:'—',   label:'No subscription change' },
};

/**
 * BillingPreview
 * Shows auto-billing breakdown before job completion.
 * Updates live as priceOverrides changes.
 *
 * Props:
 *   toc             string
 *   customerId      string
 *   registrationNo  string
 *   priceOverrides  object  { rate_type: amount }
 *   leadAmount      number  — agreed amount from lead
 */
export function BillingPreview({ toc, customerId, registrationNo, priceOverrides, leadAmount }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const debounceRef           = useRef(null);

  // Debounce fetches so live typing doesn't hammer the API
  useEffect(() => {
    if (!toc) { setData(null); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError('');

      const hasOverrides = priceOverrides &&
        Object.values(priceOverrides).some(v => v != null && v !== '');
      const cleanOverrides = hasOverrides
        ? Object.fromEntries(
            Object.entries(priceOverrides)
              .filter(([, v]) => v != null && v !== '')
              .map(([k, v]) => [k, Number(v)])
          )
        : null;

      api.billing.preview(
        { toc, customerId, registrationNo },
        cleanOverrides
      )
        .then(r => setData(r.data))
        .catch(e => setError(e.response?.data?.message || 'Could not load preview'))
        .finally(() => setLoading(false));
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [toc, customerId, registrationNo, JSON.stringify(priceOverrides)]);

  if (!toc) return null;

  const subStyle = data?.rule?.subscriptionAction
    ? (SUB_STYLE[data.rule.subscriptionAction] || SUB_STYLE.none)
    : SUB_STYLE.none;

  const hasAnyOverride = data?.items?.some(i => i.isJobOverride || i.isCustomerOverride);
  const hasZeroRate    = data?.items?.some(i => i.unitPrice === 0);

  // Lead amount reconciliation
  const leadDiff = leadAmount && data?.total
    ? Number(leadAmount) - data.total
    : null;

  return (
    <div style={{
      background:   'var(--surface)',
      border:       '1px solid var(--border-hi)',
      borderRadius: 12,
      overflow:     'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding:        '10px 16px',
        background:     'var(--surface2)',
        borderBottom:   '1px solid var(--border)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Receipt size={13} style={{ color:'var(--accent)' }} />
          <span style={{ fontSize:10, fontWeight:700, color:'var(--text)', letterSpacing:1.5, textTransform:'uppercase' }}>
            Auto-Billing Preview
          </span>
          {toc && (
            <span style={{
              fontSize:9, padding:'2px 7px', borderRadius:4,
              background:'rgba(56,217,245,.1)', color:'var(--accent)',
              letterSpacing:.8, textTransform:'uppercase',
            }}>
              {toc}
            </span>
          )}
          {hasAnyOverride && (
            <span style={{
              fontSize:9, padding:'2px 7px', borderRadius:4,
              background:'rgba(255,179,71,.15)', color:'var(--warn)',
              letterSpacing:.8,
            }}>
              CUSTOM RATES
            </span>
          )}
        </div>
        {loading && (
          <RefreshCw size={12} style={{ color:'var(--muted)', animation:'spin 1s linear infinite' }} />
        )}
      </div>

      <div style={{ padding:'12px 16px' }}>

        {error && (
          <div style={{ color:'var(--danger)', fontSize:11, display:'flex', gap:6, alignItems:'center' }}>
            <AlertCircle size={12}/> {error}
          </div>
        )}

        {!loading && !error && data && !data.supported && (
          <div style={{ color:'var(--muted)', fontSize:11, display:'flex', gap:6, alignItems:'center' }}>
            <Info size={12}/> No billing rule configured for "{toc}" — invoice will not auto-generate.
          </div>
        )}

        {!error && data?.supported && (
          <>
            {/* Line items table */}
            <div style={{ marginBottom:10 }}>
              {/* Header row */}
              <div style={{
                display:'grid', gridTemplateColumns:'1fr 80px 90px',
                padding:'4px 0', borderBottom:'1px solid var(--border)',
                marginBottom:4,
              }}>
                {['Charge','Qty','Amount'].map(h => (
                  <div key={h} style={{ fontSize:9, letterSpacing:1.5, textTransform:'uppercase', color:'var(--muted)', textAlign: h==='Amount'?'right':'left' }}>{h}</div>
                ))}
              </div>

              {data.items.map((it, i) => (
                <div key={i} style={{
                  display:'grid', gridTemplateColumns:'1fr 80px 90px',
                  padding:'6px 0',
                  borderBottom:'1px solid var(--border)',
                  opacity: loading ? .5 : 1,
                }}>
                  <div>
                    <div style={{ fontSize:11, color:'var(--text)', display:'flex', alignItems:'center', gap:5 }}>
                      {it.description.replace(` — ${registrationNo}`,'')}
                      {it.isJobOverride && (
                        <span style={{ fontSize:8, padding:'1px 5px', borderRadius:3, background:'rgba(255,179,71,.2)', color:'var(--warn)', fontWeight:700, letterSpacing:.5 }}>
                          JOB
                        </span>
                      )}
                      {it.isCustomerOverride && (
                        <span style={{ fontSize:8, padding:'1px 5px', borderRadius:3, background:'rgba(123,111,255,.2)', color:'var(--accent2)', fontWeight:700, letterSpacing:.5 }}>
                          CUST
                        </span>
                      )}
                    </div>
                    {it.isJobOverride && it.standardRate !== it.unitPrice && (
                      <div style={{ fontSize:9, color:'var(--muted)', marginTop:1 }}>
                        Standard: PKR {Number(it.standardRate).toLocaleString('en-PK')}
                        <span style={{ color:'var(--warn)', marginLeft:4 }}>
                          → PKR {Number(it.unitPrice).toLocaleString('en-PK')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>1 {it.unit}</div>
                  <div style={{
                    textAlign:  'right',
                    fontFamily: 'Syne',
                    fontWeight: 700,
                    fontSize:   12,
                    color: it.unitPrice === 0
                      ? 'var(--danger)'
                      : it.isJobOverride ? 'var(--warn)' : 'var(--text)',
                  }}>
                    {it.unitPrice === 0
                      ? 'PKR 0 ⚠'
                      : `PKR ${Number(it.unitPrice).toLocaleString('en-PK')}`}
                  </div>
                </div>
              ))}
            </div>

            {/* Total row */}
            <div style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              padding:        '8px 10px',
              background:     'var(--surface2)',
              borderRadius:   8,
              marginBottom:   8,
            }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text)' }}>Invoice Total</span>
              <span style={{
                fontFamily:'Syne', fontWeight:800, fontSize:15,
                color: data.total === 0 ? 'var(--danger)' : 'var(--success)',
              }}>
                PKR {data.total.toLocaleString('en-PK')}
              </span>
            </div>

            {/* Lead amount reconciliation */}
            {leadAmount && Number(leadAmount) > 0 && (
              <div style={{
                padding:'7px 10px', borderRadius:8, marginBottom:8,
                background: leadDiff === 0
                  ? 'rgba(61,255,160,.07)'
                  : 'rgba(255,179,71,.07)',
                border: `1px solid ${leadDiff === 0 ? 'rgba(61,255,160,.2)' : 'rgba(255,179,71,.2)'}`,
                display:'flex', justifyContent:'space-between', alignItems:'center',
              }}>
                <div style={{ fontSize:10, color:'var(--muted)' }}>
                  Agreed amount from lead
                  <strong style={{ color:'var(--text)', marginLeft:5 }}>
                    PKR {Number(leadAmount).toLocaleString('en-PK')}
                  </strong>
                </div>
                {leadDiff === 0 ? (
                  <span style={{ fontSize:10, color:'var(--success)', display:'flex', alignItems:'center', gap:4 }}>
                    <CheckCircle size={11}/> Matches
                  </span>
                ) : (
                  <span style={{ fontSize:10, color:'var(--warn)' }}>
                    {leadDiff > 0 ? '+' : ''}PKR {Number(leadDiff).toLocaleString('en-PK')} vs lead
                  </span>
                )}
              </div>
            )}

            {/* Due date */}
            <div style={{ fontSize:10, color:'var(--muted)', marginBottom:8 }}>
              Due: <strong style={{ color:'var(--text)' }}>{formatDate(data.paymentDueDate)}</strong>
              &nbsp;·&nbsp; Invoice created as <strong style={{ color:'var(--accent)' }}>Draft</strong> — accounts reviews before sending
            </div>

            {/* Subscription action */}
            {data.subscriptionPreview && (
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'7px 10px',
                background:`${subStyle.color}11`,
                border:`1px solid ${subStyle.color}33`,
                borderRadius:8, fontSize:11, marginBottom:8,
              }}>
                <span style={{ fontSize:13, flexShrink:0 }}>{subStyle.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ color:subStyle.color, fontWeight:600 }}>{subStyle.label}</div>
                  {data.subscriptionPreview.monthlyRate != null && (
                    <div style={{ color:'var(--muted)', marginTop:1, fontSize:10 }}>
                      PKR {data.subscriptionPreview.monthlyRate.toLocaleString('en-PK')}/vehicle/month
                      {data.subscriptionPreview.monthlyRate === 0 && (
                        <span style={{ color:'var(--warn)', marginLeft:5 }}>— set monthly_saas rate</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Warnings */}
            {hasZeroRate && (
              <div style={{
                padding:'7px 10px', background:'rgba(255,179,71,.07)',
                border:'1px solid rgba(255,179,71,.25)', borderRadius:8,
                fontSize:10, color:'var(--warn)',
                display:'flex', gap:6, alignItems:'flex-start',
              }}>
                <AlertCircle size={11} style={{ flexShrink:0, marginTop:1 }}/>
                Some rates are PKR 0. Set standard rates or enter manual amounts above.
              </div>
            )}
          </>
        )}

        {loading && !data && (
          <div style={{ color:'var(--muted)', fontSize:11, padding:'8px 0' }}>
            Calculating charges…
          </div>
        )}
      </div>
    </div>
  );
}
