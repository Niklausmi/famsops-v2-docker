import { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Search, FileText, Loader } from 'lucide-react';
import { Topbar } from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { Modal, ModalButtons } from '../components/ui/Modal';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { CustomerSearch } from '../components/ui/CustomerSearch';
import { api } from '../api/client';
import { formatDate, genId } from '../lib/utils';

const PAY_METHODS  = ['Cash','Bank Transfer','Cheque','Online / Mobile','Credit / Installment'];
const PAY_STATUSES = ['Pending','Received','Partial','Overdue','Refunded'];
const PAY_TYPES    = ['Installation Fee','AMC Renewal','Replacement','Repair','SIM Recharge','Advance','Other'];

const TOC_TO_TYPE = {
  'New Installation': 'Installation Fee',
  'Replacement':      'Replacement',
  'Reinstallation':   'Installation Fee',
  'Removal':          'Other',
  'Vehicle Transfer': 'Other',
  'Ownership Transfer':'Other',
  'Inspection':       'Other',
  'AMC Visit':        'AMC Renewal',
};

const STATUS_COLORS = {
  Received: 'badge-active',
  Pending:  'badge-warn',
  Partial:  'badge-purple',
  Overdue:  'badge-hot',
  Refunded: 'badge-closed',
};

const BLANK = {
  paymentId: '', type: 'Installation Fee', method: 'Cash', status: 'Pending',
  amount: '', paidAmount: '', balanceDue: '',
  customerId: '', customerName: '', contact: '', invoiceRef: '',
  paymentDate: new Date().toISOString().split('T')[0], dueDate: '',
  chequeNo: '', bankName: '', transactionRef: '',
  notes: '',
};

export default function Payments() {
  const [payments, setPayments]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [statFilter, setStatFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showEdit, setShowEdit]     = useState(false);
  const [form, setForm]             = useState(BLANK);
  const [saving, setSaving]         = useState(false);
  const [formErr, setFormErr]       = useState('');
  const [customer, setCustomer]     = useState(null);
  const [custErr, setCustErr]       = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [allCustomers, setAllCustomers] = useState([]);
  const [custResults, setCustResults] = useState([]);

  // Invoice lookup state
  const [invLookup, setInvLookup]   = useState('');
  const [invLoading, setInvLoading] = useState(false);
  const [invMsg, setInvMsg]         = useState('');
  const [invMsgOk, setInvMsgOk]     = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.payments.list(); setPayments(data.data || data || []); }
    catch { setPayments([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    api.customers.list().then(r => setAllCustomers(r.data.data || r.data || [])).catch(() => {});
  }, []);

  const searchCust = (q) => {
    setCustSearch(q);
    if (!q.trim()) { setCustResults([]); return; }
    const results = allCustomers.filter(c =>
      [c.customerName, c.contact, c.city, c.rac].some(v =>
        (v || '').toLowerCase().includes(q.toLowerCase())
      )
    );
    setCustResults(results.slice(0, 10));
  };

  const selectCust = (c) => {
    onSelectCustomer(c);
    setCustSearch('');
    setCustResults([]);
  };

  // ── Auto-fill from invoice ──────────────────────────────────
  const lookupInvoice = async () => {
    const ref = invLookup.trim();
    if (!ref) return;
    setInvLoading(true); setInvMsg(''); setInvMsgOk(false);
    try {
      const { data: inv } = await api.invoices.get(ref);
      if (!inv || !inv.invoiceId) { setInvMsg('Invoice not found'); return; }

      // Determine payment type from invoice type / work order toc
      let payType = 'Installation Fee';
      if (inv.type === 'recurring') payType = 'AMC Renewal';
      else if (inv.type === 'renewal') payType = 'AMC Renewal';

      // Try to get toc from the linked job order
      if (inv.workOrderId) {
        try {
          const { data: jo } = await api.jobOrders.get(inv.workOrderId);
          if (jo?.toc) payType = TOC_TO_TYPE[jo.toc] || payType;
        } catch {}
      }

      // Balance due = total - already paid
      const balanceDue = Number(inv.total || 0) - Number(inv.paidAmount || 0);
      const isPaid     = inv.status === 'Paid';

      // Pre-fill customer
      if (inv.customerId) {
        const match = allCustomers.find(c => c.customerId === inv.customerId);
        if (match) onSelectCustomer(match);
        else {
          setCustomer({ customerId: inv.customerId, customerName: inv.customerName, contact: inv.contact });
          setForm(f => ({ ...f, customerId: inv.customerId, customerName: inv.customerName, contact: inv.contact || '' }));
        }
      }

      setForm(f => ({
        ...f,
        invoiceRef:  inv.invoiceId,
        amount:      balanceDue > 0 ? String(balanceDue) : String(inv.total || ''),
        dueDate:     inv.dueDate ? inv.dueDate.split('T')[0] : f.dueDate,
        type:        payType,
        status:      isPaid ? 'Received' : balanceDue <= 0 ? 'Received' : 'Pending',
        notes:       f.notes || `Payment for ${inv.invoiceId}${inv.workOrderId ? ' / ' + inv.workOrderId : ''}`,
      }));

      setInvMsgOk(true);
      setInvMsg(isPaid
        ? `⚠ Invoice already marked as Paid (PKR ${Number(inv.total||0).toLocaleString()})`
        : `✓ Loaded — Balance due: PKR ${balanceDue.toLocaleString()}`);
      setCustErr('');
    } catch(e) {
      setInvMsg(e.response?.status === 404 ? 'Invoice not found' : 'Failed to load invoice');
      setInvMsgOk(false);
    } finally { setInvLoading(false); }
  };

  const filtered = useMemo(() => {
    let r = payments;
    if (search)     r = r.filter(p => [p.customerName, p.paymentId, p.invoiceRef, p.transactionRef].some(v => (v||'').toLowerCase().includes(search.toLowerCase())));
    if (statFilter) r = r.filter(p => p.status === statFilter);
    if (typeFilter) r = r.filter(p => p.type === typeFilter);
    return r;
  }, [payments, search, statFilter, typeFilter]);

  const totals = useMemo(() => ({
    received: payments.filter(p => p.status === 'Received').reduce((s, p) => s + Number(p.amount || 0), 0),
    pending:  payments.filter(p => p.status === 'Pending').reduce((s, p) => s + Number(p.amount || 0), 0),
    overdue:  payments.filter(p => p.status === 'Overdue').reduce((s, p) => s + Number(p.balanceDue || 0), 0),
    count:    payments.length,
  }), [payments]);

  const onSelectCustomer = (c) => {
    setCustomer(c);
    setForm(f => ({ ...f, customerId: c.customerId, customerName: c.customerName, contact: c.contact, city: c.city||'', rac: c.rac||'', company: c.company||'' }));
    setCustErr('');
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const openNew  = () => {
    setForm({ ...BLANK, paymentDate: new Date().toISOString().split('T')[0] });
    setCustomer(null); setCustErr(''); setCustSearch(''); setCustResults([]);
    setFormErr(''); setInvLookup(''); setInvMsg(''); setInvMsgOk(false);
    setShowEdit(true);
  };
  const openEdit = (p) => {
    setForm({ ...BLANK, ...p }); setCustSearch(p.customerName || '');
    setCustResults([]); setFormErr('');
    setInvLookup(p.invoiceRef || ''); setInvMsg(''); setInvMsgOk(false);
    setShowEdit(true);
  };

  const save = async () => {
    if (!customer?.customerId && !form.customerId) { setCustErr('Please select a customer'); return; }
    if (!form.amount)     { setFormErr('Amount is required'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload = {
        ...form,
        paymentId: form.paymentId || genId('PAY'),
        balanceDue: Number(form.amount || 0) - Number(form.paidAmount || 0),
      };
      if (form.paymentId) await api.payments.update(form.paymentId, payload);
      else                await api.payments.create(payload);
      setShowEdit(false); load();
    } catch(e) { setFormErr(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'paymentDate',  label: 'Date',     render: v => <span style={{ color: 'var(--muted)', fontSize: 11 }}>{formatDate(v)}</span> },
    { key: 'paymentId',    label: 'ID',        render: v => <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>{v}</span>, sortable: false },
    { key: 'customerName', label: 'Customer',  render: v => <strong style={{ fontSize: 12 }}>{v || '—'}</strong> },
    { key: 'type',         label: 'Type',      render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v}</span> },
    { key: 'invoiceRef',   label: 'Invoice',   render: v => <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent2)' }}>{v || '—'}</span> },
    { key: 'amount',       label: 'Amount',    render: v => <span style={{ fontFamily: 'var(--display)', fontSize: 13, fontWeight: 700 }}>PKR {Number(v||0).toLocaleString()}</span> },
    { key: 'paidAmount',   label: 'Paid',      render: v => <span style={{ color: v ? 'var(--success)' : 'var(--muted)', fontSize: 12 }}>{v ? `PKR ${Number(v).toLocaleString()}` : '—'}</span> },
    { key: 'balanceDue',   label: 'Balance',   render: v => <span style={{ color: Number(v) > 0 ? 'var(--danger)' : 'var(--muted)', fontSize: 12, fontWeight: Number(v)>0?600:400 }}>{Number(v||0) > 0 ? `PKR ${Number(v).toLocaleString()}` : '—'}</span> },
    { key: 'method',       label: 'Method',    render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v || '—'}</span> },
    { key: 'status',       label: 'Status',    render: v => <span className={`badge ${STATUS_COLORS[v] || 'badge-closed'}`}>{v}</span> },
    { key: 'paymentId',    label: 'Actions',   sortable: false, render: (_, row) => (
      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); openEdit(row); }}>Edit</button>
    )},
  ];

  const fmt = (n) => `PKR ${Math.round(n).toLocaleString()}`;

  return (
    <>
      <Topbar
        title="Payments"
        subtitle="Invoice tracking & receivables"
        actions={<button className="btn btn-solid btn-sm" onClick={openNew}><Plus size={13} /> Record Payment</button>}
      />
      <PageContent>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
          <StatTile label="Total Received" value={fmt(totals.received)} color="t-green"  />
          <StatTile label="Pending"        value={fmt(totals.pending)}  color="t-warn"   />
          <StatTile label="Overdue"        value={fmt(totals.overdue)}  color="t-pink"   />
          <StatTile label="Total Records"  value={totals.count}         color="t-cyan"   />
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input className="field-input" style={{ paddingLeft: 34 }} placeholder="Customer, payment ID, invoice, transaction ref…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="field-input" style={{ width: 140, appearance: 'none', cursor: 'pointer' }} value={statFilter} onChange={e => setStatFilter(e.target.value)}>
              <option value="">All Status</option>
              {PAY_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="field-input" style={{ width: 180, appearance: 'none', cursor: 'pointer' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {PAY_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12} /></button>
          </div>
          <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No payments recorded" />
        </div>

      </PageContent>

      {/* Add / Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={form.paymentId ? 'Edit Payment' : 'Record Payment'} size="lg">

        {/* ── Invoice auto-fill banner ───────────────────────── */}
        <div style={{ background: 'rgba(56,217,245,0.04)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={11} /> Auto-fill from Invoice
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="field-input"
              style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12 }}
              placeholder="e.g. INV-000001"
              value={invLookup}
              onChange={e => { setInvLookup(e.target.value); setInvMsg(''); }}
              onKeyDown={e => e.key === 'Enter' && lookupInvoice()}
            />
            <button
              className="btn btn-ghost btn-sm"
              style={{ whiteSpace: 'nowrap', minWidth: 80 }}
              onClick={lookupInvoice}
              disabled={invLoading || !invLookup.trim()}
            >
              {invLoading ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Load Invoice'}
            </button>
          </div>
          {invMsg && (
            <div style={{ marginTop: 6, fontSize: 11, color: invMsgOk ? 'var(--success)' : 'var(--danger)' }}>
              {invMsg}
            </div>
          )}
        </div>

        {/* ── Customer ──────────────────────────────────────── */}
        <Field label="Customer *">
          {customer?.customerId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(56,217,245,0.06)', border: '1px solid var(--border-hi)', borderRadius: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{customer.customerName}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{customer.contact}</div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => { setCustomer(null); setForm(f => ({ ...f, customerId: '', customerName: '', contact: '' })); setCustSearch(''); }}>Change</button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <Input placeholder="Search customer…" value={custSearch} onChange={e => searchCust(e.target.value)} />
              {custResults.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border-hi)', borderRadius: 10, maxHeight: 200, overflowY: 'auto', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  {custResults.map(c => (
                    <div key={c.customerId} onClick={() => selectCust(c)}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(56,217,245,0.06)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{c.customerName}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{c.contact}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {custErr && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{custErr}</div>}
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
          <Field label="Payment Type">
            <Select value={form.type} onChange={set('type')}>{PAY_TYPES.map(t => <option key={t}>{t}</option>)}</Select>
          </Field>
          <Field label="Payment Method">
            <Select value={form.method} onChange={set('method')}>{PAY_METHODS.map(m => <option key={m}>{m}</option>)}</Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>{PAY_STATUSES.map(s => <option key={s}>{s}</option>)}</Select>
          </Field>
          <Field label="Invoice / Job Ref">
            <Input placeholder="INV-XXXXXXXX" value={form.invoiceRef} onChange={set('invoiceRef')} />
          </Field>
          <Field label="Total Amount (PKR) *"><Input type="number" value={form.amount} onChange={set('amount')} /></Field>
          <Field label="Amount Paid (PKR)"><Input type="number" value={form.paidAmount} onChange={set('paidAmount')} /></Field>
          <Field label="Payment Date"><Input type="date" value={form.paymentDate} onChange={set('paymentDate')} /></Field>
          <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={set('dueDate')} /></Field>
          {form.method === 'Cheque' && (
            <>
              <Field label="Cheque No."><Input value={form.chequeNo} onChange={set('chequeNo')} /></Field>
              <Field label="Bank Name"><Input value={form.bankName} onChange={set('bankName')} /></Field>
            </>
          )}
          {(form.method === 'Bank Transfer' || form.method === 'Online / Mobile') && (
            <Field label="Transaction Ref"><Input value={form.transactionRef} onChange={set('transactionRef')} /></Field>
          )}
        </div>

        <Field label="Notes"><Textarea value={form.notes} onChange={set('notes')} style={{ minHeight: 60 }} /></Field>

        {formErr && <div style={{ padding: '10px 14px', background: 'rgba(255,95,109,0.08)', border: '1px solid rgba(255,95,109,0.3)', borderRadius: 8, color: 'var(--danger)', fontSize: 11, marginBottom: 8 }}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={save}>{saving ? 'Saving…' : (form.paymentId ? 'Save Changes' : 'Record Payment')}</button>
        </ModalButtons>
      </Modal>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
