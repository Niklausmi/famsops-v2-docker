const router = require('express').Router();
const { query, getClient } = require('../db');
const { auth, can } = require('../middleware/auth');
const { nextId } = require('../utils/ids');

const toJson = r => ({
  id: r.id, quotationId: r.quotation_id, status: r.status,
  customerId: r.customer_id, customerName: r.customer_name,
  contact: r.contact, city: r.city, leadId: r.lead_id,
  title: r.title, description: r.description, validUntil: r.valid_until,
  subtotal: r.subtotal, discountPct: r.discount_pct, taxPct: r.tax_pct,
  total: r.total, currency: r.currency, paymentTerms: r.payment_terms,
  notes: r.notes, terms: r.terms,
  sentAt: r.sent_at, approvedAt: r.approved_at, rejectedAt: r.rejected_at,
  rejectedReason: r.rejected_reason, createdBy: r.created_by, approvedBy: r.approved_by,
  createdAt: r.created_at, updatedAt: r.updated_at,
  items: r.items || [],
});

async function withItems(quotationId) {
  const [q, items] = await Promise.all([
    query('SELECT * FROM quotations WHERE quotation_id = $1', [quotationId]),
    query('SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY sort_order ASC', [quotationId]),
  ]);
  if (!q.rows.length) return null;
  return { ...toJson(q.rows[0]), items: items.rows };
}

// GET /api/v1/quotations
router.get('/', auth, can('quotations', 'read'), async (req, res) => {
  const { status, customerId, search } = req.query;
  let sql = `SELECT q.*,
    COALESCE(json_agg(qi ORDER BY qi.sort_order) FILTER (WHERE qi.id IS NOT NULL), '[]') AS items
    FROM quotations q
    LEFT JOIN quotation_items qi ON qi.quotation_id = q.quotation_id
    WHERE 1=1`;
  const p = []; let i = 1;
  if (customerId) { sql += ` AND q.customer_id = $${i++}`; p.push(customerId); }
  if (status)     { sql += ` AND q.status = $${i++}`; p.push(status); }
  if (search)     { sql += ` AND (q.customer_name ILIKE $${i} OR q.quotation_id ILIKE $${i} OR q.title ILIKE $${i})`; p.push(`%${search}%`); i++; }
  sql += ' GROUP BY q.id ORDER BY q.created_at DESC LIMIT 500';
  const { rows } = await query(sql, p);
  res.json({ data: rows.map(toJson), total: rows.length });
});

// GET /api/v1/quotations/:id
router.get('/:id', auth, can('quotations', 'read'), async (req, res) => {
  const q = await withItems(req.params.id);
  if (!q) return res.status(404).json({ message: 'Quotation not found' });
  res.json(q);
});

// POST /api/v1/quotations
router.post('/', auth, can('quotations', 'create'), async (req, res) => {
  const d = req.body;
  if (!d.customerId) return res.status(400).json({ message: 'customerId required' });
  if (!d.title)      return res.status(400).json({ message: 'title required' });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const quotationId = await nextId('seq_quotation', 'QT');

    // Calculate totals from items
    const items = d.items || [];
    const subtotal = items.reduce((s, it) =>
      s + (Number(it.qty||1) * Number(it.unitPrice||0) * (1 - Number(it.discountPct||0)/100)), 0);
    const discountAmt = subtotal * Number(d.discountPct||0) / 100;
    const taxAmt = (subtotal - discountAmt) * Number(d.taxPct||0) / 100;
    const total = subtotal - discountAmt + taxAmt;

    await client.query(
      `INSERT INTO quotations (quotation_id,status,customer_id,customer_name,contact,city,lead_id,
         title,description,valid_until,subtotal,discount_pct,tax_pct,total,currency,
         payment_terms,notes,terms,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [quotationId, d.status||'Draft', d.customerId, d.customerName||null, d.contact||null,
       d.city||null, d.leadId||null, d.title, d.description||null, d.validUntil||null,
       subtotal, d.discountPct||0, d.taxPct||0, total, d.currency||'PKR',
       d.paymentTerms||null, d.notes||null, d.terms||null, req.user.userId]
    );

    // Insert line items
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      await client.query(
        `INSERT INTO quotation_items (quotation_id,sort_order,item_type,description,qty,unit,unit_price,discount_pct,is_recurring,billing_cycle)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [quotationId, idx, it.itemType||'service', it.description, it.qty||1, it.unit||'unit',
         it.unitPrice||0, it.discountPct||0, it.isRecurring||false, it.billingCycle||null]
      );
    }

    await client.query('COMMIT');
    const result = await withItems(quotationId);
    res.status(201).json(result);
  } catch(err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
});

// PATCH /api/v1/quotations/:id
router.patch('/:id', auth, can('quotations', 'update'), async (req, res) => {
  const d = req.body; const id = req.params.id;
  const items = d.items;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Recalculate totals if items provided
    let subtotal = d.subtotal, total = d.total;
    if (items) {
      subtotal = items.reduce((s, it) =>
        s + (Number(it.qty||1) * Number(it.unitPrice||0) * (1 - Number(it.discountPct||0)/100)), 0);
      const discountAmt = subtotal * Number(d.discountPct||0) / 100;
      const taxAmt = (subtotal - discountAmt) * Number(d.taxPct||0) / 100;
      total = subtotal - discountAmt + taxAmt;
    }

    await client.query(
      `UPDATE quotations SET
         status=COALESCE($2,status), title=COALESCE($3,title),
         description=COALESCE($4,description), valid_until=COALESCE($5,valid_until),
         subtotal=COALESCE($6,subtotal), discount_pct=COALESCE($7,discount_pct),
         tax_pct=COALESCE($8,tax_pct), total=COALESCE($9,total),
         payment_terms=COALESCE($10,payment_terms), notes=COALESCE($11,notes),
         terms=COALESCE($12,terms)
       WHERE quotation_id=$1`,
      [id, d.status||null, d.title||null, d.description||null, d.validUntil||null,
       subtotal||null, d.discountPct||null, d.taxPct||null, total||null,
       d.paymentTerms||null, d.notes||null, d.terms||null]
    );

    if (items) {
      await client.query('DELETE FROM quotation_items WHERE quotation_id = $1', [id]);
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        await client.query(
          `INSERT INTO quotation_items (quotation_id,sort_order,item_type,description,qty,unit,unit_price,discount_pct,is_recurring,billing_cycle)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, idx, it.itemType||'service', it.description, it.qty||1, it.unit||'unit',
           it.unitPrice||0, it.discountPct||0, it.isRecurring||false, it.billingCycle||null]
        );
      }
    }

    await client.query('COMMIT');
    const result = await withItems(id);
    res.json(result);
  } catch(err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
});

// POST /api/v1/quotations/:id/send
router.post('/:id/send', auth, can('quotations', 'send'), async (req, res) => {
  const { rows } = await query(
    `UPDATE quotations SET status='Sent', sent_at=NOW()
     WHERE quotation_id=$1 AND status IN ('Draft','Sent') RETURNING *`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Quotation not found or already approved' });
  res.json(toJson(rows[0]));
});

// POST /api/v1/quotations/:id/approve — creates Work Order automatically
router.post('/:id/approve', auth, can('quotations', 'approve'), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: qr } = await client.query(
      `UPDATE quotations SET status='Approved', approved_at=NOW(), approved_by=$2
       WHERE quotation_id=$1 AND status IN ('Sent','Draft') RETURNING *`,
      [req.params.id, req.user.userId]
    );
    if (!qr.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Quotation not found or already processed' }); }
    const q = qr[0];

    // Auto-create Work Order
    const workOrderId = await nextId('seq_workorder', 'WO');
    const vehicleCount = req.body.vehicleCount || 1;
    await client.query(
      `INSERT INTO work_orders (work_order_id,status,customer_id,customer_name,quotation_id,lead_id,title,vehicle_count,scheduled_date,created_by)
       VALUES ($1,'Pending',$2,$3,$4,$5,$6,$7,$8,$9)`,
      [workOrderId, q.customer_id, q.customer_name, q.quotation_id, q.lead_id,
       `WO: ${q.title}`, vehicleCount, req.body.scheduledDate||null, req.user.userId]
    );

    await client.query('COMMIT');
    res.json({ quotation: toJson(qr[0]), workOrderId, message: `Quotation approved. Work Order ${workOrderId} created.` });
  } catch(err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
});

// POST /api/v1/quotations/:id/reject
router.post('/:id/reject', auth, can('quotations', 'approve'), async (req, res) => {
  const { rows } = await query(
    `UPDATE quotations SET status='Rejected', rejected_at=NOW(), rejected_reason=$2
     WHERE quotation_id=$1 RETURNING *`,
    [req.params.id, req.body.reason||null]
  );
  if (!rows.length) return res.status(404).json({ message: 'Quotation not found' });
  res.json(toJson(rows[0]));
});

module.exports = router;
