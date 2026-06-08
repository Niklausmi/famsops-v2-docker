const router = require('express').Router();
const { query, getClient } = require('../db');
const { auth, can } = require('../middleware/auth');
const { nextId } = require('../utils/ids');

// ════════════════════════════════════════════════════════════
//  SUBSCRIPTIONS
// ════════════════════════════════════════════════════════════
const toSub = r => ({
  id: r.id, subscriptionId: r.subscription_id, status: r.status,
  customerId: r.customer_id, customerName: r.customer_name,
  assetId: r.asset_id, workOrderId: r.work_order_id, quotationId: r.quotation_id,
  planName: r.plan_name, billingCycle: r.billing_cycle,
  ratePerVehicle: r.rate_per_vehicle, vehicleCount: r.vehicle_count,
  monthlyAmount: r.monthly_amount,
  startDate: r.start_date, endDate: r.end_date,
  nextBillingDate: r.next_billing_date, lastBilledDate: r.last_billed_date,
  autoRenew: r.auto_renew, notes: r.notes, createdBy: r.created_by,
  cancelledAt: r.cancelled_at, cancelReason: r.cancel_reason,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

router.get('/subscriptions', auth, can('subscriptions', 'read'), async (req, res) => {
  const { status, customerId, search, expiringSoon } = req.query;
  let sql = 'SELECT * FROM subscriptions WHERE 1=1';
  const p = []; let i = 1;
  if (customerId)           { sql += ` AND customer_id = $${i++}`; p.push(customerId); }
  if (status)               { sql += ` AND status = $${i++}`; p.push(status); }
  if (expiringSoon === 'true') { sql += ` AND end_date IS NOT NULL AND end_date <= CURRENT_DATE + 30 AND status = 'Active'`; }
  if (search)               { sql += ` AND (customer_name ILIKE $${i} OR subscription_id ILIKE $${i} OR plan_name ILIKE $${i})`; p.push(`%${search}%`); i++; }
  sql += ' ORDER BY created_at DESC LIMIT 500';
  const { rows } = await query(sql, p);
  res.json({ data: rows.map(toSub), total: rows.length });
});

router.get('/subscriptions/:id', auth, can('subscriptions', 'read'), async (req, res) => {
  const { rows } = await query('SELECT * FROM subscriptions WHERE subscription_id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Subscription not found' });
  res.json(toSub(rows[0]));
});

router.post('/subscriptions', auth, can('subscriptions', 'create'), async (req, res) => {
  const d = req.body;
  if (!d.customerId)   return res.status(400).json({ message: 'customerId required' });
  if (!d.planName)     return res.status(400).json({ message: 'planName required' });
  if (!d.startDate)    return res.status(400).json({ message: 'startDate required' });
  if (!d.ratePerVehicle) return res.status(400).json({ message: 'ratePerVehicle required' });

  const subscriptionId = await nextId('seq_sub', 'SUB');

  // Calculate next billing date
  const start  = new Date(d.startDate);
  const cycle  = d.billingCycle || 'monthly';
  let nextBill = new Date(start);
  if (cycle === 'monthly')   nextBill.setMonth(nextBill.getMonth() + 1);
  else if (cycle === 'quarterly') nextBill.setMonth(nextBill.getMonth() + 3);
  else                       nextBill.setFullYear(nextBill.getFullYear() + 1);

  await query(
    `INSERT INTO subscriptions (subscription_id,status,customer_id,customer_name,asset_id,
       work_order_id,quotation_id,plan_name,billing_cycle,rate_per_vehicle,vehicle_count,
       start_date,end_date,next_billing_date,auto_renew,notes,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [subscriptionId, d.status||'Pending', d.customerId, d.customerName||null,
     d.assetId||null, d.workOrderId||null, d.quotationId||null,
     d.planName, cycle, d.ratePerVehicle, d.vehicleCount||1,
     d.startDate, d.endDate||null, nextBill.toISOString().split('T')[0],
     d.autoRenew !== false, d.notes||null, req.user.userId]
  );

  const { rows } = await query('SELECT * FROM subscriptions WHERE subscription_id = $1', [subscriptionId]);
  res.status(201).json(toSub(rows[0]));
});

router.patch('/subscriptions/:id', auth, can('subscriptions', 'update'), async (req, res) => {
  const d = req.body; const id = req.params.id;
  const { rows } = await query(
    `UPDATE subscriptions SET
       status          = COALESCE($2, status),
       plan_name       = COALESCE($3, plan_name),
       billing_cycle   = COALESCE($4, billing_cycle),
       rate_per_vehicle= COALESCE($5, rate_per_vehicle),
       vehicle_count   = COALESCE($6, vehicle_count),
       end_date        = COALESCE($7, end_date),
       next_billing_date=COALESCE($8, next_billing_date),
       auto_renew      = COALESCE($9, auto_renew),
       notes           = COALESCE($10, notes)
     WHERE subscription_id=$1 RETURNING *`,
    [id, d.status||null, d.planName||null, d.billingCycle||null,
     d.ratePerVehicle||null, d.vehicleCount||null, d.endDate||null,
     d.nextBillingDate||null, d.autoRenew!=null?d.autoRenew:null, d.notes||null]
  );
  if (!rows.length) return res.status(404).json({ message: 'Subscription not found' });
  res.json(toSub(rows[0]));
});

router.post('/subscriptions/:id/activate', auth, can('subscriptions', 'update'), async (req, res) => {
  const { rows } = await query(
    `UPDATE subscriptions SET status='Active' WHERE subscription_id=$1 RETURNING *`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Subscription not found' });
  // DB trigger auto_create_invoice fires here
  res.json({ subscription: toSub(rows[0]), message: 'Subscription activated. Invoice auto-generated.' });
});

router.post('/subscriptions/:id/cancel', auth, can('subscriptions', 'cancel'), async (req, res) => {
  const { rows } = await query(
    `UPDATE subscriptions SET status='Cancelled', cancelled_at=NOW(), cancel_reason=$2
     WHERE subscription_id=$1 RETURNING *`,
    [req.params.id, req.body.reason||null]
  );
  if (!rows.length) return res.status(404).json({ message: 'Subscription not found' });
  res.json(toSub(rows[0]));
});

// ════════════════════════════════════════════════════════════
//  INVOICES
// ════════════════════════════════════════════════════════════
const toInv = r => ({
  id: r.id, invoiceId: r.invoice_id, status: r.status, type: r.type,
  customerId: r.customer_id, customerName: r.customer_name, contact: r.contact,
  subscriptionId: r.subscription_id, workOrderId: r.work_order_id, quotationId: r.quotation_id,
  billingPeriodStart: r.billing_period_start, billingPeriodEnd: r.billing_period_end,
  issueDate: r.issue_date, dueDate: r.due_date,
  subtotal: r.subtotal, discountPct: r.discount_pct, taxPct: r.tax_pct,
  total: r.total, paidAmount: r.paid_amount, balanceDue: r.balance_due,
  currency: r.currency, notes: r.notes,
  sentAt: r.sent_at, paidAt: r.paid_at, createdBy: r.created_by,
  createdAt: r.created_at, updatedAt: r.updated_at,
  items: r.items || [],
});

router.get('/invoices', auth, can('invoices', 'read'), async (req, res) => {
  const { status, customerId, search, overdue, subscriptionId } = req.query;
  let sql = `SELECT i.*,
    COALESCE(json_agg(ii ORDER BY ii.sort_order) FILTER (WHERE ii.id IS NOT NULL), '[]') AS items
    FROM invoices i
    LEFT JOIN invoice_items ii ON ii.invoice_id = i.invoice_id
    WHERE 1=1`;
  const p = []; let idx = 1;
  if (customerId)    { sql += ` AND i.customer_id = $${idx++}`; p.push(customerId); }
  if (status)        { sql += ` AND i.status = $${idx++}`; p.push(status); }
  if (subscriptionId){ sql += ` AND i.subscription_id = $${idx++}`; p.push(subscriptionId); }
  if (overdue==='true'){ sql += ` AND i.due_date < CURRENT_DATE AND i.status NOT IN ('Paid','Void','Cancelled')`; }
  if (search)        { sql += ` AND (i.customer_name ILIKE $${idx} OR i.invoice_id ILIKE $${idx})`; p.push(`%${search}%`); idx++; }
  sql += ' GROUP BY i.id ORDER BY i.issue_date DESC LIMIT 500';
  const { rows } = await query(sql, p);
  res.json({ data: rows.map(toInv), total: rows.length });
});

router.get('/invoices/:id', auth, can('invoices', 'read'), async (req, res) => {
  const [inv, items] = await Promise.all([
    query('SELECT * FROM invoices WHERE invoice_id = $1', [req.params.id]),
    query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order', [req.params.id]),
  ]);
  if (!inv.rows.length) return res.status(404).json({ message: 'Invoice not found' });
  res.json({ ...toInv(inv.rows[0]), items: items.rows });
});

router.post('/invoices', auth, can('invoices', 'create'), async (req, res) => {
  const d = req.body;
  if (!d.customerId) return res.status(400).json({ message: 'customerId required' });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const invoiceId = 'INV-' + String(await nextId('seq_invoice','X')).replace('X-','').padStart(6,'0');
    const items = d.items || [];
    const subtotal = items.reduce((s,it) => s + Number(it.qty||1)*Number(it.unitPrice||0), 0);
    const discAmt  = subtotal * Number(d.discountPct||0)/100;
    const taxAmt   = (subtotal - discAmt) * Number(d.taxPct||0)/100;
    const total    = subtotal - discAmt + taxAmt;

    await client.query(
      `INSERT INTO invoices (invoice_id,status,type,customer_id,customer_name,contact,
         subscription_id,work_order_id,quotation_id,
         billing_period_start,billing_period_end,issue_date,due_date,
         subtotal,discount_pct,tax_pct,total,currency,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [invoiceId, d.status||'Draft', d.type||'one_time',
       d.customerId, d.customerName||null, d.contact||null,
       d.subscriptionId||null, d.workOrderId||null, d.quotationId||null,
       d.billingPeriodStart||null, d.billingPeriodEnd||null,
       d.issueDate||new Date().toISOString().split('T')[0], d.dueDate||null,
       subtotal, d.discountPct||0, d.taxPct||0, total, d.currency||'PKR',
       d.notes||null, req.user.userId]
    );

    for (let i=0; i<items.length; i++) {
      const it = items[i];
      await client.query(
        `INSERT INTO invoice_items (invoice_id,sort_order,description,qty,unit,unit_price)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [invoiceId, i, it.description, it.qty||1, it.unit||'unit', it.unitPrice||0]
      );
    }

    await client.query('COMMIT');
    const { rows } = await query('SELECT * FROM invoices WHERE invoice_id = $1', [invoiceId]);
    res.status(201).json(toInv(rows[0]));
  } catch(err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
});

router.patch('/invoices/:id', auth, can('invoices', 'update'), async (req, res) => {
  const d = req.body;
  const { rows } = await query(
    `UPDATE invoices SET status=COALESCE($2,status), due_date=COALESCE($3,due_date),
     notes=COALESCE($4,notes), discount_pct=COALESCE($5,discount_pct), tax_pct=COALESCE($6,tax_pct)
     WHERE invoice_id=$1 RETURNING *`,
    [req.params.id, d.status||null, d.dueDate||null, d.notes||null, d.discountPct||null, d.taxPct||null]
  );
  if (!rows.length) return res.status(404).json({ message: 'Invoice not found' });
  res.json(toInv(rows[0]));
});

router.post('/invoices/:id/send', auth, can('invoices', 'send'), async (req, res) => {
  const { rows } = await query(
    `UPDATE invoices SET status='Sent', sent_at=NOW() WHERE invoice_id=$1 AND status='Draft' RETURNING *`,
    [req.params.id]
  );
  if (!rows.length) return res.status(400).json({ message: 'Invoice not found or already sent' });
  res.json(toInv(rows[0]));
});

router.post('/invoices/:id/void', auth, can('invoices', 'void'), async (req, res) => {
  const { rows } = await query(
    `UPDATE invoices SET status='Void' WHERE invoice_id=$1 AND status NOT IN ('Paid') RETURNING *`,
    [req.params.id]
  );
  if (!rows.length) return res.status(400).json({ message: 'Cannot void a paid invoice' });
  res.json(toInv(rows[0]));
});

module.exports = router;
