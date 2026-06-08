const router = require('express').Router();
const { query } = require('../db');
const { auth } = require('../middleware/auth');
const { nextId } = require('../utils/ids');

const toJson = (r) => ({
  id: r.id, ticketId: r.ticket_id, type: r.type, title: r.title,
  description: r.description, category: r.category,
  priority: r.priority, status: r.status,
  customerId: r.customer_id, customerName: r.customer_name,
  contact: r.contact, city: r.city,
  assetId: r.asset_id, assetRegNo: r.asset_reg_no,
  assignedTo: r.assigned_to,
  followupDate: r.followup_date, dueDate: r.due_date,
  incidentDate: r.incident_date, severity: r.severity,
  notes: r.notes, resolvedAt: r.resolved_at,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

// GET /api/v1/tickets
router.get('/', auth, async (req, res) => {
  const { type, status, priority, search, customerId, assignedTo } = req.query;
  let sql = 'SELECT * FROM tickets WHERE 1=1';
  const params = []; let p = 1;
  if (customerId) { sql += ` AND customer_id = $${p}`; params.push(customerId); p++; }
  if (type)       { sql += ` AND type = $${p}`; params.push(type); p++; }
  if (status)     { sql += ` AND status = $${p}`; params.push(status); p++; }
  if (priority)   { sql += ` AND priority = $${p}`; params.push(priority); p++; }
  if (assignedTo) { sql += ` AND assigned_to ILIKE $${p}`; params.push(`%${assignedTo}%`); p++; }
  if (search) {
    sql += ` AND (title ILIKE $${p} OR customer_name ILIKE $${p} OR ticket_id ILIKE $${p} OR asset_reg_no ILIKE $${p})`;
    params.push(`%${search}%`); p++;
  }
  sql += ' ORDER BY created_at DESC LIMIT 1000';
  const { rows } = await query(sql, params);
  res.json({ data: rows.map(toJson), total: rows.length });
});

// GET /api/v1/tickets/:id
router.get('/:id', auth, async (req, res) => {
  const { rows } = await query('SELECT * FROM tickets WHERE ticket_id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Ticket not found' });
  res.json(toJson(rows[0]));
});

// POST /api/v1/tickets
router.post('/', auth, async (req, res) => {
  const d = req.body;
  if (!d.customerId) return res.status(400).json({ message: 'customerId required' });
  if (!d.title)      return res.status(400).json({ message: 'title required' });

  // Enforce: tickets are Query or Complaint only
  const type = d.type === 'Lead' ? 'Query' : (d.type || 'Query');

  const ticketId = await nextId('seq_ticket', 'TKT');

  await query(`
    INSERT INTO tickets (ticket_id,type,title,description,category,priority,status,
      customer_id,customer_name,contact,city,asset_id,asset_reg_no,assigned_to,
      followup_date,due_date,incident_date,severity,notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
  `, [ticketId, type, d.title, d.description||null, d.category||null,
      d.priority||'Medium', d.status||'Open',
      d.customerId, d.customerName||null, d.contact||null, d.city||null,
      d.assetId||null, d.assetRegNo||null, d.assignedTo||null,
      d.followupDate||null, d.dueDate||null, d.incidentDate||null,
      d.severity||null, d.notes||null]);

  const { rows } = await query('SELECT * FROM tickets WHERE ticket_id = $1', [ticketId]);
  res.status(201).json(toJson(rows[0]));
});

// PATCH /api/v1/tickets/:id
router.patch('/:id', auth, async (req, res) => {
  const d = req.body; const id = req.params.id;
  const fields = {
    type: d.type === 'Lead' ? 'Query' : d.type,
    title: d.title, description: d.description, category: d.category,
    priority: d.priority, status: d.status,
    assigned_to: d.assignedTo,
    followup_date: d.followupDate||null, due_date: d.dueDate||null,
    severity: d.severity, asset_reg_no: d.assetRegNo,
    notes: d.notes,
    resolved_at: d.status === 'Resolved' ? new Date().toISOString() : undefined,
  };
  const sets = []; const vals = []; let p = 2;
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) { sets.push(`${col} = $${p++}`); vals.push(val === '' ? null : val); }
  }
  if (!sets.length) return res.json({ message: 'Nothing to update' });
  const { rows } = await query(
    `UPDATE tickets SET ${sets.join(',')} WHERE ticket_id = $1 RETURNING *`,
    [id, ...vals]
  );
  if (!rows.length) return res.status(404).json({ message: 'Ticket not found' });
  res.json(toJson(rows[0]));
});

module.exports = router;
