import { useState, useEffect } from 'react';
import { Receipt, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { formatDate } from '../../lib/utils';

const SUB_ACTION_STYLE = {
  create:   { color: 'var(--success)',  icon: '🆕', label: 'New subscription will be created' },
  continue: { color: 'var(--muted)',    icon: '▶',  label: 'Existing subscription continues' },
  cancel:   { color: 'var(--danger)',   icon: '⛔',  label: 'Subscription will be cancelled' },
  renew:    { color: 'var(--accent2)',  icon: '🔁',  label: 'Subscription will be renewed +1 year' },
  transfer: { color: 'var(--warn)',     icon: '↔',   label: 'Subscription will be transferred' },
  none:     { color: 'var(--muted)',    icon: '—',   label: 'No subscription change' },
};

/**
 * BillingPreview
 * Shows what invoice + subscription will be auto-generated when a job completes.
 *
 * Props:
 *   toc            string  — e.g. 'New Installation'
 *   customerId     string
 *   registrationNo string
 *   onClose        fn
 */
export function BillingPreview({ toc, customerId, registrationNo, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!toc) return;
    setLoading(true);
    setError('');
    api.billing.preview({ toc, customerId, registrationNo })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Could not load billing preview'))
      .finally(() => setLoading(false));
  }, [toc, customerId, registrationNo]);

  if (!toc) return null;

  const subStyle = data?.rule?.subscriptionAction
    ? (SUB_ACTION_STYLE[data.rule.subscriptionAction] || SUB_ACTION_STYLE.none)
    : SUB_ACTION_STYLE.none;

  return (
    <div style={{
      background:   'var(--surface)',
      border:       '1px solid var(--border-hi)',
      borderRadius: 12,
      overflow:     'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding:        '12px 16px',
        background:     'var(--surface2)',
        borderBottom:   '1px solid var(--border)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Receipt size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', letterSpacing: .5, textTransform: 'uppercase' }}>
            Auto-Billing Preview
          </span>
          <span style={{
            fontSize: 9, padding: '2px 7px', borderRadius: 4,
            background: 'rgba(56,217,245,.1)', color: 'var(--accent)',
            letterSpacing: 1, textTransform: 'uppercase',
          }}>
            {toc}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => { setLoading(true); api.billing.preview({toc,customerId,registrationNo}).then(r=>setData(r.data)).catch(e=>setError(e.message)).finally(()=>setLoading(false)); }}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={12} />
          </button>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
          )}
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>

        {loading && (
          <div style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'center', padding: '12px 0' }}>
            Calculating charges…
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}>
            <AlertCircle size={12} /> {error}
          </div>
        )}

        {!loading && data && !data.supported && (
          <div style={{ color: 'var(--muted)', fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}>
            <AlertCircle size={12} /> No billing rule configured for "{toc}". Invoice will not be auto-generated.
          </div>
        )}

        {!loading && data?.supported && (
          <>
            {/* Line items */}
            <div style={{ marginBottom: 12 }}>
              {data.items.map((it, i) => (
                <div key={i} style={{
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                  padding:        '7px 0',
                  borderBottom:   '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text)' }}>
                      {it.description}
                      {it.isCustomRate && (
                        <span style={{
                          fontSize: 9, marginLeft: 6, padding: '1px 5px',
                          borderRadius: 3, background: 'rgba(255,179,71,.15)',
                          color: 'var(--warn)', letterSpacing: .5,
                        }}>
                          CUSTOM RATE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                      {it.qty} {it.unit}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'Syne', fontWeight: 700, fontSize: 12,
                    color: it.unitPrice === 0 ? 'var(--warn)' : 'var(--text)',
                  }}>
                    {it.unitPrice === 0
                      ? 'To be set'
                      : `PKR ${it.unitPrice.toLocaleString('en-PK')}`}
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              padding:        '8px 10px',
              background:     'var(--surface2)',
              borderRadius:   8,
              marginBottom:   10,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>Invoice Total</span>
              <span style={{
                fontFamily: 'Syne', fontWeight: 800, fontSize: 14,
                color: data.total === 0 ? 'var(--warn)' : 'var(--success)',
              }}>
                PKR {data.total.toLocaleString('en-PK')}
              </span>
            </div>

            {/* Due date */}
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10 }}>
              Invoice due: <strong style={{ color: 'var(--text)' }}>{formatDate(data.paymentDueDate)}</strong>
              &nbsp;·&nbsp; Status will be: <strong style={{ color: 'var(--accent)' }}>Draft</strong> (accounts team reviews before sending)
            </div>

            {/* Subscription action */}
            {data.subscriptionPreview && (
              <div style={{
                display:      'flex',
                alignItems:   'center',
                gap:          8,
                padding:      '8px 10px',
                background:   `${subStyle.color}11`,
                border:       `1px solid ${subStyle.color}33`,
                borderRadius: 8,
                fontSize:     11,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{subStyle.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: subStyle.color, fontWeight: 600 }}>{subStyle.label}</div>
                  {data.subscriptionPreview.monthlyRate != null && (
                    <div style={{ color: 'var(--muted)', marginTop: 2 }}>
                      PKR {data.subscriptionPreview.monthlyRate.toLocaleString('en-PK')}/vehicle/month
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Zero-rate warning */}
            {data.items.some(it => it.unitPrice === 0) && (
              <div style={{
                marginTop:    10, padding: '8px 10px',
                background:   'rgba(255,179,71,.08)',
                border:       '1px solid rgba(255,179,71,.25)',
                borderRadius: 8, fontSize: 10, color: 'var(--warn)',
                display: 'flex', gap: 6, alignItems: 'flex-start',
              }}>
                <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
                Some rates are PKR 0 — update standard rates or set a customer override to generate correct invoice amounts.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
