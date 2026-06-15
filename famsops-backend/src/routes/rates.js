const router  = require('express').Router();
const { query } = require('../db');
const { auth, can } = require('../middleware/auth');
const billingSvc = require('../services/billingService');

// ════════════════════════════════════════════════════════════
//  STANDARD RATES  (price list — admin / management)
// ════════════════════════════════════════════════════════════

// GET /api/v1/rates
router.get('/rates', auth, can('payments', 'read'), async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM standard_rates ORDER BY rate_type ASC'
  );
  res.json({ data: rows, total: rows.length });
});

// PATCH /api/v1/rates/:rateType  — update a standard rate amount
router.patch('/rates/:rateType', auth, can('payments', 'update'), async (req, res) => {
  const { amount, label, description, isActive } = req.body;
  const { rows } = await query(`
    UPDATE standard_rates SET
      amount      = COALESCE($2, amount),
      label       = COALESCE($3, label),
      description = COALESCE($4, description),
      is_active   = COALESCE($5, is_active)
    WHERE rate_type = $1
    RETURNING *
  `, [req.params.rateType,
      amount      != null ? amount      : null,
      label       || null,
      description || null,
      isActive    != null ? isActive    : null]);

  if (!rows.length)
    return res.status(404).json({ message: 'Rate type not found' });
  res.json(rows[0]);
});

// ════════════════════════════════════════════════════════════
//  TOC BILLING RULES
// ════════════════════════════════════════════════════════════

// GET /api/v1/rates/toc-rules
router.get('/rates/toc-rules', auth, can('payments', 'read'), async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM toc_billing_rules ORDER BY toc ASC'
  );
  res.json({ data: rows, total: rows.length });
});

// PATCH /api/v1/rates/toc-rules/:toc  — update a TOC rule
router.patch('/rates/toc-rules/:toc', auth, can('payments', 'update'), async (req, res) => {
  const { chargeTypes, subscriptionAction, invoiceType, paymentDueDays, isActive, notes } = req.body;
  const { rows } = await query(`
    UPDATE toc_billing_rules SET
      charge_types         = COALESCE($2, charge_types),
      subscription_action  = COALESCE($3, subscription_action),
      invoice_type         = COALESCE($4, invoice_type),
      payment_due_days     = COALESCE($5, payment_due_days),
      is_active            = COALESCE($6, is_active),
      notes                = COALESCE($7, notes)
    WHERE toc = $1
    RETURNING *
  `, [decodeURIComponent(req.params.toc),
      chargeTypes        ? JSON.stringify(chargeTypes) : null,
      subscriptionAction || null,
      invoiceType        || null,
      paymentDueDays     != null ? paymentDueDays : null,
      isActive           != null ? isActive       : null,
      notes              || null]);

  if (!rows.length)
    return res.status(404).json({ message: 'TOC rule not found' });
  res.json(rows[0]);
});

// ════════════════════════════════════════════════════════════
//  CUSTOMER PRICING OVERRIDES
// ════════════════════════════════════════════════════════════

// GET /api/v1/rates/customer/:customerId
// Returns all standard rates with this customer's overrides highlighted
router.get('/rates/customer/:customerId', auth, can('payments', 'read'), async (req, res) => {
  const rates = await billingSvc.getRatesWithOverrides(req.params.customerId);
  res.json({ data: rates, total: rates.length });
});

// PUT /api/v1/rates/customer/:customerId/:rateType
// Upsert a customer override
router.put('/rates/customer/:customerId/:rateType', auth, can('payments', 'update'), async (req, res) => {
  const { amount, notes } = req.body;
  if (amount == null)
    return res.status(400).json({ message: 'amount required' });

  const { rows } = await query(`
    INSERT INTO pricing_overrides (customer_id, item_type, custom_rate, notes)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (customer_id, item_type) DO UPDATE SET
      custom_rate = EXCLUDED.custom_rate,
      notes       = EXCLUDED.notes,
      updated_at  = NOW()
    RETURNING *
  `, [req.params.customerId, req.params.rateType, amount, notes || null]);

  res.json(rows[0]);
});

// DELETE /api/v1/rates/customer/:customerId/:rateType
// Remove a customer override (revert to standard rate)
router.delete('/rates/customer/:customerId/:rateType', auth, can('payments', 'update'), async (req, res) => {
  await query(
    'DELETE FROM pricing_overrides WHERE customer_id=$1 AND item_type=$2',
    [req.params.customerId, req.params.rateType]
  );
  res.json({ message: 'Override removed — standard rate applies' });
});

// ════════════════════════════════════════════════════════════
//  BILLING PREVIEW & MANUAL TRIGGER
// ════════════════════════════════════════════════════════════

// GET /api/v1/billing/preview?toc=New+Installation&customerId=CUST-000001&registrationNo=ABC-123
// Returns exactly what will be billed when this job completes
// GET or POST — GET for simple preview, POST when job overrides are present
router.get('/billing/preview', auth, can('invoices', 'read'), async (req, res) => {
  const { toc, customerId, registrationNo } = req.query;
  if (!toc) return res.status(400).json({ message: 'toc required' });
  const preview = await billingSvc.previewBilling(toc, customerId, registrationNo, null);
  res.json(preview);
});

// POST /api/v1/billing/preview — includes priceOverrides in body
router.post('/billing/preview', auth, can('invoices', 'read'), async (req, res) => {
  const { toc, customerId, registrationNo, priceOverrides } = req.body;
  if (!toc) return res.status(400).json({ message: 'toc required' });
  const preview = await billingSvc.previewBilling(
    toc, customerId, registrationNo, priceOverrides || null
  );
  res.json(preview);
});

// POST /api/v1/billing/trigger/:invoiceNumber
// Manually run auto-billing for a completed job (fallback if DB trigger missed)
router.post('/billing/trigger/:invoiceNumber', auth, can('invoices', 'create'), async (req, res) => {
  const result = await billingSvc.triggerBilling(req.params.invoiceNumber, req.user.userId);
  res.json(result);
});

// GET /api/v1/billing/history/:customerId
// Full billing history for a customer — invoices + subscriptions linked
router.get('/billing/history/:customerId', auth, can('invoices', 'read'), async (req, res) => {
  const id = req.params.customerId;
  const [invRows, subRows, payRows] = await Promise.all([
    query(`
      SELECT i.*, COALESCE(json_agg(ii ORDER BY ii.sort_order)
        FILTER (WHERE ii.id IS NOT NULL),'[]') AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON ii.invoice_id = i.invoice_id
      WHERE i.customer_id = $1
      GROUP BY i.id
      ORDER BY i.issue_date DESC
    `, [id]),
    query(
      'SELECT * FROM subscriptions WHERE customer_id=$1 ORDER BY created_at DESC',
      [id]
    ),
    query(
      'SELECT * FROM payments WHERE customer_id=$1 ORDER BY payment_date DESC',
      [id]
    ),
  ]);

  const totalBilled    = invRows.rows.reduce((s, i) => s + Number(i.total     || 0), 0);
  const totalCollected = payRows.rows.reduce((s, p) => s + Number(p.paid_amount || 0), 0);
  const outstanding    = invRows.rows.reduce((s, i) => s + Number(i.balance_due || 0), 0);

  res.json({
    invoices:      invRows.rows,
    subscriptions: subRows.rows,
    payments:      payRows.rows,
    summary: {
      totalBilled,
      totalCollected,
      outstanding,
      activeSubscriptions: subRows.rows.filter(s => s.status === 'Active').length,
      monthlyRecurring:    subRows.rows
        .filter(s => s.status === 'Active')
        .reduce((s, sub) => s + Number(sub.monthly_amount || 0), 0),
    },
  });
});

module.exports = router;
