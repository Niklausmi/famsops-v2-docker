const router = require('express').Router();
const { query } = require('../db');
const { auth } = require('../middleware/auth');
const { nextId } = require('../utils/ids');

const toJson = (r) => ({
  id: r.id, leadId: r.lead_id, status: r.status, title: r.title,
  description: r.description, customerId: r.customer_id,
  customerName: r.customer_name, contact: r.contact, city: r.city,
  company: r.company, package: r.package, vehicles: r.vehicles,
  budget: r.budget, timeline: r.timeline,
  preferredPayment: r.preferred_payment, source: r.source,
  salesperson: r.salesperson, followupDate: r.followup_date,
  priority: r.priority, amount: r.amount, closedDate: r.closed_date,
  notes: r.notes,
  convertedJobId: r.converted_job_id, convertedAt: r.converted_at,
  sourceTicketId: r.source_ticket_id,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

// GET /api/v1/leads
router.get('/', auth, async (req, res) => {
  const { status, search, salesperson, customerId } = req.query;
  let sql = 'SELECT * FROM leads WHERE 1=1';
  const params = []; let p = 1;
  if (customerId)  { sql += ` AND customer_id = $${p}`; params.push(customerId); p++; }
  if (status)      { sql += ` AND status = $${p}`; params.push(status); p++; }
  if (salesperson) { sql += ` AND salesperson ILIKE $${p}`; params.push(`%${salesperson}%`); p++; }
  if (search) {
    sql += ` AND (title ILIKE $${p} OR customer_name ILIKE $${p} OR salesperson ILIKE $${p} OR lead_id ILIKE $${p})`;
    params.push(`%${search}%`); p++;
  }
  sql += ' ORDER BY created_at DESC LIMIT 1000';
  const { rows } = await query(sql, params);
  res.json({ data: rows.map(toJson), total: rows.length });
});

// GET /api/v1/leads/:id
router.get('/:id', auth, async (req, res) => {
  const { rows } = await query('SELECT * FROM leads WHERE lead_id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Lead not found' });
  res.json(toJson(rows[0]));
});

// POST /api/v1/leads
router.post('/', auth, async (req, res) => {
  const d = req.body;
  if (!d.customerId) return res.status(400).json({ message: 'customerId required' });
  if (!d.title)      return res.status(400).json({ message: 'title required' });

  const leadId = await nextId('seq_lead', 'LEAD');

  await query(`
    INSERT INTO leads (lead_id,status,title,description,
      customer_id,customer_name,contact,city,company,
      package,vehicles,budget,timeline,preferred_payment,
      source,salesperson,followup_date,priority,amount,notes,source_ticket_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
  `, [leadId, d.status||'New Lead', d.title, d.description||null,
      d.customerId, d.customerName||null, d.contact||null, d.city||null,
      d.company||null, d.package||null, d.vehicles||null, d.budget||null,
      d.timeline||null, d.preferredPayment||null, d.source||null,
      d.salesperson||null, d.followupDate||null, d.priority||'Medium',
      d.amount||null, d.notes||null, d.sourceTicketId||null]);

  const { rows } = await query('SELECT * FROM leads WHERE lead_id = $1', [leadId]);
  res.status(201).json(toJson(rows[0]));
});

// PATCH /api/v1/leads/:id
router.patch('/:id', auth, async (req, res) => {
  const d = req.body; const id = req.params.id;
  const fields = {
    status: d.status, title: d.title, description: d.description,
    package: d.package, vehicles: d.vehicles, budget: d.budget,
    timeline: d.timeline, preferred_payment: d.preferredPayment,
    source: d.source, salesperson: d.salesperson,
    followup_date: d.followupDate||null, priority: d.priority,
    amount: d.amount, notes: d.notes,
    closed_date: (d.status === 'Won' || d.status === 'Lost')
      ? new Date().toISOString().split('T')[0] : undefined,
  };
  const sets = []; const vals = []; let p = 2;
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) { sets.push(`${col} = $${p++}`); vals.push(val === '' ? null : val); }
  }
  if (!sets.length) return res.json({ message: 'Nothing to update' });
  const { rows } = await query(
    `UPDATE leads SET ${sets.join(',')} WHERE lead_id = $1 RETURNING *`,
    [id, ...vals]
  );
  if (!rows.length) return res.status(404).json({ message: 'Lead not found' });
  res.json(toJson(rows[0]));
});

module.exports = router;
