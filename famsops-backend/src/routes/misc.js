const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { query } = require('../db');
const { auth, rbac } = require('../middleware/auth');

// ── INVENTORY — TRACKERS ──────────────────────────────────────
const toTracker = (r) => ({
  id: r.id, imei: r.imei, model: r.model, supplier: r.supplier,
  dateReceived: r.date_received, purchasePrice: r.purchase_price,
  status: r.status, assignedTo: r.assigned_to, installer: r.installer,
  city: r.city, notes: r.notes, createdAt: r.created_at,
});

router.get('/inventory/trackers', auth, async (req, res) => {
  const { status, search } = req.query;
  let sql = 'SELECT * FROM trackers WHERE 1=1';
  const params = []; let p = 1;
  if (status) { sql += ` AND status = $${p}`; params.push(status); p++; }
  if (search) { sql += ` AND (imei ILIKE $${p} OR model ILIKE $${p} OR supplier ILIKE $${p})`; params.push(`%${search}%`); p++; }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await query(sql, params);
  res.json({ data: rows.map(toTracker), total: rows.length });
});

router.post('/inventory/stock-in', auth, async (req, res) => {
  const d = req.body;
  if (d.type === 'trackers') {
    if (!d.imei) return res.status(400).json({ message: 'IMEI required' });
    await query(`
      INSERT INTO trackers (imei, model, supplier, date_received, purchase_price, status, notes)
      VALUES ($1,$2,$3,$4,$5,'Available',$6)
      ON CONFLICT (imei) DO NOTHING
    `, [d.imei, d.model||null, d.supplier||null, d.dateReceived||null, d.purchasePrice||null, d.notes||null]);
    res.status(201).json({ message: 'Tracker added' });
  } else {
    if (!d.simNumber) return res.status(400).json({ message: 'simNumber required' });
    await query(`
      INSERT INTO sims (sim_number, sim_provider, data_package, monthly_rate, expiry_date, status, notes)
      VALUES ($1,$2,$3,$4,$5,'Available',$6)
      ON CONFLICT (sim_number) DO NOTHING
    `, [d.simNumber, d.simProvider||null, d.dataPackage||null, d.monthlyRate||null, d.expiryDate||null, d.notes||null]);
    res.status(201).json({ message: 'SIM added' });
  }
});

router.patch('/inventory/trackers/:id', auth, async (req, res) => {
  const d = req.body;
  const { rows } = await query(`
    UPDATE trackers SET
      status      = COALESCE($2, status),
      assigned_to = COALESCE($3, assigned_to),
      installer   = COALESCE($4, installer),
      city        = COALESCE($5, city),
      notes       = COALESCE($6, notes)
    WHERE imei = $1 RETURNING *
  `, [req.params.id, d.status||null, d.assignedTo||null, d.installer||null, d.city||null, d.notes||null]);
  if (!rows.length) return res.status(404).json({ message: 'Tracker not found' });
  res.json(toTracker(rows[0]));
});

// ── INVENTORY — SIMS ──────────────────────────────────────────
const toSim = (r) => ({
  id: r.id, simNumber: r.sim_number, simProvider: r.sim_provider,
  dataPackage: r.data_package, monthlyRate: r.monthly_rate,
  expiryDate: r.expiry_date, status: r.status, assignedTo: r.assigned_to,
  notes: r.notes, createdAt: r.created_at,
});

router.get('/inventory/sims', auth, async (req, res) => {
  const { status, search } = req.query;
  let sql = 'SELECT * FROM sims WHERE 1=1';
  const params = []; let p = 1;
  if (status) { sql += ` AND status = $${p}`; params.push(status); p++; }
  if (search) { sql += ` AND (sim_number ILIKE $${p} OR sim_provider ILIKE $${p})`; params.push(`%${search}%`); p++; }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await query(sql, params);
  res.json({ data: rows.map(toSim), total: rows.length });
});

router.patch('/inventory/sims/:id', auth, async (req, res) => {
  const d = req.body;
  const { rows } = await query(`
    UPDATE sims SET
      status      = COALESCE($2, status),
      assigned_to = COALESCE($3, assigned_to),
      notes       = COALESCE($4, notes)
    WHERE sim_number = $1 RETURNING *
  `, [req.params.id, d.status||null, d.assignedTo||null, d.notes||null]);
  if (!rows.length) return res.status(404).json({ message: 'SIM not found' });
  res.json(toSim(rows[0]));
});

// ── PAYMENTS ─────────────────────────────────────────────────
const toPay = (r) => ({
  id: r.id, paymentId: r.payment_id, type: r.type, method: r.method,
  status: r.status, amount: r.amount, paidAmount: r.paid_amount,
  balanceDue: r.balance_due, customerId: r.customer_id,
  customerName: r.customer_name, contact: r.contact,
  invoiceRef: r.invoice_ref, paymentDate: r.payment_date,
  dueDate: r.due_date, chequeNo: r.cheque_no, bankName: r.bank_name,
  transactionRef: r.transaction_ref, notes: r.notes,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

router.get('/payments', auth, async (req, res) => {
  const { status, type, search } = req.query;
  let sql = 'SELECT * FROM payments WHERE 1=1';
  const params = []; let p = 1;
  if (status) { sql += ` AND status = $${p}`; params.push(status); p++; }
  if (type)   { sql += ` AND type = $${p}`; params.push(type); p++; }
  if (search) { sql += ` AND (customer_name ILIKE $${p} OR payment_id ILIKE $${p} OR invoice_ref ILIKE $${p} OR transaction_ref ILIKE $${p})`; params.push(`%${search}%`); p++; }
  sql += ' ORDER BY payment_date DESC, created_at DESC LIMIT 1000';
  const { rows } = await query(sql, params);
  res.json({ data: rows.map(toPay), total: rows.length });
});

router.post('/payments', auth, async (req, res) => {
  const d = req.body;
  if (!d.paymentId) return res.status(400).json({ message: 'paymentId required' });
  if (!d.amount)    return res.status(400).json({ message: 'amount required' });
  if (!d.customerId)return res.status(400).json({ message: 'customerId required' });

  await query(`
    INSERT INTO payments (payment_id,type,method,status,amount,paid_amount,
      customer_id,customer_name,contact,invoice_ref,payment_date,due_date,
      cheque_no,bank_name,transaction_ref,notes,created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
  `, [d.paymentId, d.type||'Installation Fee', d.method||'Cash', d.status||'Pending',
      d.amount, d.paidAmount||0, d.customerId, d.customerName||null, d.contact||null,
      d.invoiceRef||null, d.paymentDate||null, d.dueDate||null,
      d.chequeNo||null, d.bankName||null, d.transactionRef||null,
      d.notes||null, req.user.user_id]);

  const { rows } = await query('SELECT * FROM payments WHERE payment_id = $1', [d.paymentId]);
  res.status(201).json(toPay(rows[0]));
});

router.patch('/payments/:id', auth, async (req, res) => {
  const d = req.body; const id = req.params.id;
  const { rows } = await query(`
    UPDATE payments SET
      type            = COALESCE($2, type),
      method          = COALESCE($3, method),
      status          = COALESCE($4, status),
      amount          = COALESCE($5, amount),
      paid_amount     = COALESCE($6, paid_amount),
      payment_date    = COALESCE($7, payment_date),
      due_date        = COALESCE($8, due_date),
      cheque_no       = COALESCE($9, cheque_no),
      bank_name       = COALESCE($10, bank_name),
      transaction_ref = COALESCE($11, transaction_ref),
      notes           = COALESCE($12, notes)
    WHERE payment_id = $1 RETURNING *
  `, [id, d.type||null, d.method||null, d.status||null, d.amount||null,
      d.paidAmount||null, d.paymentDate||null, d.dueDate||null,
      d.chequeNo||null, d.bankName||null, d.transactionRef||null, d.notes||null]);
  if (!rows.length) return res.status(404).json({ message: 'Payment not found' });
  res.json(toPay(rows[0]));
});

// ── USERS ────────────────────────────────────────────────────
const toUser = (r) => ({
  id: r.id, userId: r.user_id, name: r.name, email: r.email,
  role: r.role, department: r.department, phone: r.phone,
  active: r.active, lastLogin: r.last_login,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

router.get('/users', auth, rbac('admin', 'management'), async (req, res) => {
  const { rows } = await query('SELECT * FROM users ORDER BY created_at DESC');
  res.json({ data: rows.map(toUser), total: rows.length });
});

router.post('/users', auth, rbac('admin'), async (req, res) => {
  const d = req.body;
  if (!d.name || !d.email || !d.userId) return res.status(400).json({ message: 'name, email, userId required' });
  if (!d.password) return res.status(400).json({ message: 'password required for new users' });

  const hash = await bcrypt.hash(d.password, 10);
  await query(`
    INSERT INTO users (user_id, name, email, password_hash, role, department, phone)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
  `, [d.userId, d.name, d.email.toLowerCase(), hash, d.role||'operations', d.department||null, d.phone||null]);

  const { rows } = await query('SELECT * FROM users WHERE user_id = $1', [d.userId]);
  res.status(201).json(toUser(rows[0]));
});

router.patch('/users/:id', auth, rbac('admin'), async (req, res) => {
  const d = req.body; const id = req.params.id;
  let passwordSet = '';
  const params = [id, d.name||null, d.role||null, d.department||null, d.phone||null];
  let p = 6;

  let sql = `UPDATE users SET
    name       = COALESCE($2, name),
    role       = COALESCE($3, role),
    department = COALESCE($4, department),
    phone      = COALESCE($5, phone)`;

  if (d.password) {
    const hash = await bcrypt.hash(d.password, 10);
    sql += `, password_hash = $${p}`;
    params.push(hash); p++;
  }
  sql += ` WHERE user_id = $1 RETURNING *`;

  const { rows } = await query(sql, params);
  if (!rows.length) return res.status(404).json({ message: 'User not found' });
  res.json(toUser(rows[0]));
});

router.patch('/users/:id/toggle', auth, rbac('admin'), async (req, res) => {
  const { rows } = await query(
    'UPDATE users SET active = NOT active WHERE user_id = $1 RETURNING *',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'User not found' });
  res.json(toUser(rows[0]));
});

// ── DASHBOARD ─────────────────────────────────────────────────
router.get('/dashboard', auth, async (req, res) => {
  const [
    leadsTotal, leadsByStatus,
    jobsTotal,  jobsRecent,
    trackers,   sims,
    ticketsOpen,
  ] = await Promise.all([
    query('SELECT COUNT(*) FROM leads'),
    query(`SELECT status, COUNT(*) as cnt FROM leads GROUP BY status`),
    query('SELECT COUNT(*) FROM job_orders'),
    query(`SELECT j.*, c.customer_name as customer
           FROM job_orders j
           LEFT JOIN customers c ON c.customer_id = j.customer_id
           ORDER BY j.date DESC LIMIT 5`),
    query(`SELECT
             COUNT(*) FILTER (WHERE status = 'Available') as available,
             COUNT(*) FILTER (WHERE status = 'Assigned')  as assigned,
             COUNT(*) as total
           FROM trackers`),
    query(`SELECT
             COUNT(*) FILTER (WHERE status = 'Available') as available,
             COUNT(*) FILTER (WHERE status = 'Installed') as assigned,
             COUNT(*) as total
           FROM sims`),
    query(`SELECT COUNT(*) FROM tickets WHERE status = 'Open'`),
  ]);

  const byStatus = {};
  for (const r of leadsByStatus.rows) byStatus[r.status] = Number(r.cnt);

  res.json({
    leads: {
      total:    Number(leadsTotal.rows[0].count),
      byStatus,
    },
    jobs: {
      total:  Number(jobsTotal.rows[0].count),
      recent: jobsRecent.rows.map(j => ({
        invoiceNumber: j.invoice_number,
        toc:           j.toc,
        vehicle:       [j.vehicle_make, j.vehicle_model].filter(Boolean).join(' '),
        date:          j.date,
        customer:      j.customer || j.customer_name,
      })),
    },
    trackers: {
      total:     Number(trackers.rows[0].total),
      available: Number(trackers.rows[0].available),
      assigned:  Number(trackers.rows[0].assigned),
    },
    sims: {
      total:     Number(sims.rows[0].total),
      available: Number(sims.rows[0].available),
      assigned:  Number(sims.rows[0].assigned),
    },
    tickets: { open: Number(ticketsOpen.rows[0].count) },
  });
});

module.exports = router;
