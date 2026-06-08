const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const { query }  = require('../db');
const { auth, can } = require('../middleware/auth');
const { nextId }    = require('../utils/ids');

// ════════════════════════════════════════════════════════════
//  INVENTORY — TRACKERS
// ════════════════════════════════════════════════════════════
const toTracker = r => ({
  id: r.id, imei: r.imei, model: r.model, supplier: r.supplier,
  dateReceived: r.date_received, purchasePrice: r.purchase_price,
  status: r.status, assignedTo: r.assigned_to, installer: r.installer,
  city: r.city, notes: r.notes, createdAt: r.created_at,
});

router.get('/inventory/trackers', auth, can('inventory','read'), async (req, res) => {
  const { status, search, limit = 500 } = req.query;
  let sql = 'SELECT * FROM trackers WHERE 1=1';
  const p = []; let i = 1;
  if (status) { sql += ` AND status = $${i++}`; p.push(status); }
  if (search) { sql += ` AND (imei ILIKE $${i} OR model ILIKE $${i} OR supplier ILIKE $${i})`; p.push(`%${search}%`); i++; }
  sql += ` ORDER BY created_at DESC LIMIT $${i}`; p.push(Number(limit));
  const { rows } = await query(sql, p);
  res.json({ data: rows.map(toTracker), total: rows.length });
});

router.post('/inventory/stock-in', auth, can('inventory','create'), async (req, res) => {
  const d = req.body;
  if (d.type === 'trackers') {
    if (!d.imei) return res.status(400).json({ message: 'IMEI required' });
    await query(
      `INSERT INTO trackers (imei,model,supplier,date_received,purchase_price,status,notes)
       VALUES ($1,$2,$3,$4,$5,'Available',$6) ON CONFLICT (imei) DO NOTHING`,
      [d.imei, d.model||null, d.supplier||null, d.dateReceived||null, d.purchasePrice||null, d.notes||null]
    );
  } else {
    if (!d.simNumber) return res.status(400).json({ message: 'simNumber required' });
    await query(
      `INSERT INTO sims (sim_number,sim_provider,data_package,monthly_rate,expiry_date,status,notes)
       VALUES ($1,$2,$3,$4,$5,'Available',$6) ON CONFLICT (sim_number) DO NOTHING`,
      [d.simNumber, d.simProvider||null, d.dataPackage||null, d.monthlyRate||null, d.expiryDate||null, d.notes||null]
    );
  }
  res.status(201).json({ message: 'Stock added' });
});

router.patch('/inventory/trackers/:id', auth, can('inventory','update'), async (req, res) => {
  const d = req.body;
  const { rows } = await query(
    `UPDATE trackers SET status=COALESCE($2,status), assigned_to=COALESCE($3,assigned_to),
     installer=COALESCE($4,installer), city=COALESCE($5,city), notes=COALESCE($6,notes)
     WHERE imei=$1 RETURNING *`,
    [req.params.id, d.status||null, d.assignedTo||null, d.installer||null, d.city||null, d.notes||null]
  );
  if (!rows.length) return res.status(404).json({ message: 'Tracker not found' });
  res.json(toTracker(rows[0]));
});

// ════════════════════════════════════════════════════════════
//  INVENTORY — SIMS
// ════════════════════════════════════════════════════════════
const toSim = r => ({
  id: r.id, simNumber: r.sim_number, simProvider: r.sim_provider,
  dataPackage: r.data_package, monthlyRate: r.monthly_rate,
  expiryDate: r.expiry_date, status: r.status, assignedTo: r.assigned_to,
  notes: r.notes, createdAt: r.created_at,
});

router.get('/inventory/sims', auth, can('inventory','read'), async (req, res) => {
  const { status, search, limit = 500 } = req.query;
  let sql = 'SELECT * FROM sims WHERE 1=1';
  const p = []; let i = 1;
  if (status) { sql += ` AND status = $${i++}`; p.push(status); }
  if (search) { sql += ` AND (sim_number ILIKE $${i} OR sim_provider ILIKE $${i})`; p.push(`%${search}%`); i++; }
  sql += ` ORDER BY created_at DESC LIMIT $${i}`; p.push(Number(limit));
  const { rows } = await query(sql, p);
  res.json({ data: rows.map(toSim), total: rows.length });
});

router.patch('/inventory/sims/:id', auth, can('inventory','update'), async (req, res) => {
  const d = req.body;
  const { rows } = await query(
    `UPDATE sims SET status=COALESCE($2,status), assigned_to=COALESCE($3,assigned_to),
     notes=COALESCE($4,notes) WHERE sim_number=$1 RETURNING *`,
    [req.params.id, d.status||null, d.assignedTo||null, d.notes||null]
  );
  if (!rows.length) return res.status(404).json({ message: 'SIM not found' });
  res.json(toSim(rows[0]));
});

// ════════════════════════════════════════════════════════════
//  PAYMENTS
// ════════════════════════════════════════════════════════════
const toPay = r => ({
  id: r.id, paymentId: r.payment_id, type: r.type, method: r.method,
  status: r.status, amount: r.amount, paidAmount: r.paid_amount,
  balanceDue: r.balance_due, customerId: r.customer_id,
  customerName: r.customer_name, contact: r.contact,
  invoiceRef: r.invoice_ref, invoiceId: r.invoice_id,
  subscriptionId: r.subscription_id,
  paymentDate: r.payment_date, dueDate: r.due_date,
  chequeNo: r.cheque_no, bankName: r.bank_name,
  transactionRef: r.transaction_ref, notes: r.notes,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

router.get('/payments', auth, can('payments','read'), async (req, res) => {
  const { status, type, search, invoiceId } = req.query;
  let sql = 'SELECT * FROM payments WHERE 1=1';
  const p = []; let i = 1;
  if (status)    { sql += ` AND status = $${i++}`; p.push(status); }
  if (type)      { sql += ` AND type = $${i++}`; p.push(type); }
  if (invoiceId) { sql += ` AND invoice_id = $${i++}`; p.push(invoiceId); }
  if (search)    { sql += ` AND (customer_name ILIKE $${i} OR payment_id ILIKE $${i} OR invoice_ref ILIKE $${i} OR transaction_ref ILIKE $${i})`; p.push(`%${search}%`); i++; }
  sql += ' ORDER BY payment_date DESC, created_at DESC LIMIT 1000';
  const { rows } = await query(sql, p);
  res.json({ data: rows.map(toPay), total: rows.length });
});

router.post('/payments', auth, can('payments','create'), async (req, res) => {
  const d = req.body;
  if (!d.amount)    return res.status(400).json({ message: 'amount required' });
  if (!d.customerId)return res.status(400).json({ message: 'customerId required' });
  const paymentId = await nextId('seq_payment', 'PAY');
  await query(
    `INSERT INTO payments (payment_id,type,method,status,amount,paid_amount,
       customer_id,customer_name,contact,invoice_ref,invoice_id,subscription_id,
       payment_date,due_date,cheque_no,bank_name,transaction_ref,notes,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    [paymentId, d.type||'Installation Fee', d.method||'Cash', d.status||'Pending',
     d.amount, d.paidAmount||0, d.customerId, d.customerName||null, d.contact||null,
     d.invoiceRef||null, d.invoiceId||null, d.subscriptionId||null,
     d.paymentDate||null, d.dueDate||null, d.chequeNo||null, d.bankName||null,
     d.transactionRef||null, d.notes||null, req.user.userId]
  );
  // Update invoice paid_amount if linked
  if (d.invoiceId && d.paidAmount) {
    await query(
      `UPDATE invoices SET paid_amount = paid_amount + $2,
       status = CASE WHEN paid_amount + $2 >= total THEN 'Paid' ELSE 'Partial' END,
       paid_at = CASE WHEN paid_amount + $2 >= total THEN NOW() ELSE paid_at END
       WHERE invoice_id = $1`,
      [d.invoiceId, d.paidAmount]
    );
  }
  const { rows } = await query('SELECT * FROM payments WHERE payment_id = $1', [paymentId]);
  res.status(201).json(toPay(rows[0]));
});

router.patch('/payments/:id', auth, can('payments','update'), async (req, res) => {
  const d = req.body; const id = req.params.id;
  const { rows } = await query(
    `UPDATE payments SET type=COALESCE($2,type), method=COALESCE($3,method),
     status=COALESCE($4,status), amount=COALESCE($5,amount),
     paid_amount=COALESCE($6,paid_amount), payment_date=COALESCE($7,payment_date),
     due_date=COALESCE($8,due_date), cheque_no=COALESCE($9,cheque_no),
     bank_name=COALESCE($10,bank_name), transaction_ref=COALESCE($11,transaction_ref),
     notes=COALESCE($12,notes)
     WHERE payment_id=$1 RETURNING *`,
    [id, d.type||null, d.method||null, d.status||null, d.amount||null,
     d.paidAmount||null, d.paymentDate||null, d.dueDate||null,
     d.chequeNo||null, d.bankName||null, d.transactionRef||null, d.notes||null]
  );
  if (!rows.length) return res.status(404).json({ message: 'Payment not found' });
  res.json(toPay(rows[0]));
});

// ════════════════════════════════════════════════════════════
//  USERS
// ════════════════════════════════════════════════════════════
const toUser = r => ({
  id: r.id, userId: r.user_id, name: r.name, email: r.email,
  role: r.role, roleId: r.role_id, roleLabel: r.role_label, roleColor: r.role_color,
  department: r.department, phone: r.phone, active: r.active,
  lastLogin: r.last_login, technicianId: r.technician_id,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

router.get('/users', auth, can('users','read'), async (req, res) => {
  const { rows } = await query(
    `SELECT u.*, r.name AS role_label, r.color AS role_color
     FROM users u LEFT JOIN roles r ON r.id = u.role_id
     ORDER BY u.created_at DESC`
  );
  res.json({ data: rows.map(toUser), total: rows.length });
});

router.post('/users', auth, can('users','create'), async (req, res) => {
  const d = req.body;
  if (!d.name || !d.email) return res.status(400).json({ message: 'name and email required' });
  if (!d.password)         return res.status(400).json({ message: 'password required' });
  const hash = await bcrypt.hash(d.password, 10);
  const userId = await nextId('seq_customer', 'USR');  // reuse seq
  // Resolve role_id from role name
  const { rows: rr } = await query('SELECT id FROM roles WHERE name = $1', [d.role||'operations']);
  const roleId = rr[0]?.id || null;
  await query(
    `INSERT INTO users (user_id,name,email,password_hash,role,role_id,department,phone)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [d.userId||userId, d.name, d.email.toLowerCase(), hash, d.role||'operations', roleId, d.department||null, d.phone||null]
  );
  const { rows } = await query(
    `SELECT u.*, r.name AS role_label, r.color AS role_color
     FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.email = $1`,
    [d.email.toLowerCase()]
  );
  res.status(201).json(toUser(rows[0]));
});

router.patch('/users/:id', auth, can('users','update'), async (req, res) => {
  const d = req.body; const id = req.params.id;
  let roleId = undefined;
  if (d.role) {
    const { rows: rr } = await query('SELECT id FROM roles WHERE name = $1', [d.role]);
    roleId = rr[0]?.id || null;
  }
  let sql = `UPDATE users SET
    name       = COALESCE($2, name),
    role       = COALESCE($3, role),
    role_id    = COALESCE($4, role_id),
    department = COALESCE($5, department),
    phone      = COALESCE($6, phone)`;
  const params = [id, d.name||null, d.role||null, roleId||null, d.department||null, d.phone||null];
  if (d.password) {
    const hash = await bcrypt.hash(d.password, 10);
    sql += `, password_hash = $${params.length + 1}`;
    params.push(hash);
  }
  sql += ' WHERE user_id = $1 RETURNING *';
  const { rows } = await query(sql, params);
  if (!rows.length) return res.status(404).json({ message: 'User not found' });
  const { rows: full } = await query(
    `SELECT u.*, r.name AS role_label, r.color AS role_color
     FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.user_id = $1`, [id]
  );
  res.json(toUser(full[0]));
});

router.patch('/users/:id/toggle', auth, can('users','toggle'), async (req, res) => {
  const { rows } = await query(
    'UPDATE users SET active = NOT active WHERE user_id = $1 RETURNING *', [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'User not found' });
  res.json(toUser(rows[0]));
});

// ════════════════════════════════════════════════════════════
//  CONTACTS
// ════════════════════════════════════════════════════════════
router.get('/contacts', auth, can('contacts','read'), async (req, res) => {
  const { customerId } = req.query;
  if (!customerId) return res.status(400).json({ message: 'customerId required' });
  const { rows } = await query(
    'SELECT * FROM contacts WHERE customer_id = $1 ORDER BY is_primary DESC, created_at ASC',
    [customerId]
  );
  res.json({ data: rows, total: rows.length });
});

router.post('/contacts', auth, can('contacts','create'), async (req, res) => {
  const d = req.body;
  if (!d.customerId) return res.status(400).json({ message: 'customerId required' });
  if (!d.name)       return res.status(400).json({ message: 'name required' });
  const contactId = await nextId('seq_contact', 'CON');
  await query(
    `INSERT INTO contacts (contact_id,customer_id,name,phone,email,role,cnic,is_primary,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [contactId, d.customerId, d.name, d.phone||null, d.email||null, d.role||null, d.cnic||null, d.isPrimary||false, d.notes||null]
  );
  const { rows } = await query('SELECT * FROM contacts WHERE contact_id = $1', [contactId]);
  res.status(201).json(rows[0]);
});

router.patch('/contacts/:id', auth, can('contacts','update'), async (req, res) => {
  const d = req.body;
  const { rows } = await query(
    `UPDATE contacts SET name=COALESCE($2,name), phone=COALESCE($3,phone),
     email=COALESCE($4,email), role=COALESCE($5,role), is_primary=COALESCE($6,is_primary),
     notes=COALESCE($7,notes) WHERE contact_id=$1 RETURNING *`,
    [req.params.id, d.name||null, d.phone||null, d.email||null, d.role||null, d.isPrimary!=null?d.isPrimary:null, d.notes||null]
  );
  if (!rows.length) return res.status(404).json({ message: 'Contact not found' });
  res.json(rows[0]);
});

// ════════════════════════════════════════════════════════════
//  DRIVERS
// ════════════════════════════════════════════════════════════
const toDriver = r => ({
  id: r.id, driverId: r.driver_id, customerId: r.customer_id, assetId: r.asset_id,
  name: r.name, phone: r.phone, cnic: r.cnic, licenseNo: r.license_no,
  licenseExpiry: r.license_expiry, status: r.status, notes: r.notes,
  createdAt: r.created_at,
});

router.get('/drivers', auth, can('drivers','read'), async (req, res) => {
  const { customerId, assetId } = req.query;
  let sql = 'SELECT * FROM drivers WHERE 1=1';
  const p = []; let i = 1;
  if (customerId) { sql += ` AND customer_id = $${i++}`; p.push(customerId); }
  if (assetId)    { sql += ` AND asset_id = $${i++}`; p.push(assetId); }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await query(sql, p);
  res.json({ data: rows.map(toDriver), total: rows.length });
});

router.post('/drivers', auth, can('drivers','create'), async (req, res) => {
  const d = req.body;
  if (!d.name)       return res.status(400).json({ message: 'name required' });
  if (!d.customerId) return res.status(400).json({ message: 'customerId required' });
  const driverId = await nextId('seq_driver', 'DRV');
  await query(
    `INSERT INTO drivers (driver_id,customer_id,asset_id,name,phone,cnic,license_no,license_expiry,status,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [driverId, d.customerId, d.assetId||null, d.name, d.phone||null, d.cnic||null, d.licenseNo||null, d.licenseExpiry||null, d.status||'Active', d.notes||null]
  );
  const { rows } = await query('SELECT * FROM drivers WHERE driver_id = $1', [driverId]);
  res.status(201).json(toDriver(rows[0]));
});

router.patch('/drivers/:id', auth, can('drivers','update'), async (req, res) => {
  const d = req.body;
  const { rows } = await query(
    `UPDATE drivers SET name=COALESCE($2,name), phone=COALESCE($3,phone),
     cnic=COALESCE($4,cnic), license_no=COALESCE($5,license_no),
     license_expiry=COALESCE($6,license_expiry), status=COALESCE($7,status),
     asset_id=COALESCE($8,asset_id), notes=COALESCE($9,notes)
     WHERE driver_id=$1 RETURNING *`,
    [req.params.id, d.name||null, d.phone||null, d.cnic||null, d.licenseNo||null,
     d.licenseExpiry||null, d.status||null, d.assetId||null, d.notes||null]
  );
  if (!rows.length) return res.status(404).json({ message: 'Driver not found' });
  res.json(toDriver(rows[0]));
});

// ════════════════════════════════════════════════════════════
//  TICKET COMMENTS
// ════════════════════════════════════════════════════════════
router.get('/tickets/:id/comments', auth, can('tickets','read'), async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at ASC',
    [req.params.id]
  );
  res.json({ data: rows, total: rows.length });
});

router.post('/tickets/:id/comments', auth, can('tickets','update'), async (req, res) => {
  const { body, isInternal } = req.body;
  if (!body) return res.status(400).json({ message: 'body required' });
  const { rows } = await query(
    `INSERT INTO ticket_comments (ticket_id,user_id,user_name,user_role,body,is_internal)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.params.id, req.user.userId, req.user.name, req.user.role, body, isInternal||false]
  );
  res.status(201).json(rows[0]);
});

// ════════════════════════════════════════════════════════════
//  TASKS
// ════════════════════════════════════════════════════════════
const toTask = r => ({
  id: r.id, taskId: r.task_id, title: r.title, description: r.description,
  status: r.status, priority: r.priority, assignedTo: r.assigned_to,
  assignedName: r.assigned_name, dueDate: r.due_date,
  entityType: r.entity_type, entityId: r.entity_id,
  createdBy: r.created_by, completedAt: r.completed_at,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

router.get('/tasks', auth, can('tasks','read'), async (req, res) => {
  const { assignedTo, status, entityType, entityId, overdue } = req.query;
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const p = []; let i = 1;
  // Technicians and non-admin only see own tasks
  const userId = ['admin','management'].includes(req.user.role) ? null : req.user.userId;
  if (userId) { sql += ` AND assigned_to = $${i++}`; p.push(userId); }
  if (assignedTo) { sql += ` AND assigned_to = $${i++}`; p.push(assignedTo); }
  if (status)     { sql += ` AND status = $${i++}`; p.push(status); }
  if (entityType) { sql += ` AND entity_type = $${i++}`; p.push(entityType); }
  if (entityId)   { sql += ` AND entity_id = $${i++}`; p.push(entityId); }
  if (overdue === 'true') { sql += ` AND due_date < CURRENT_DATE AND status NOT IN ('Done','Cancelled')`; }
  sql += ' ORDER BY due_date ASC NULLS LAST, created_at DESC LIMIT 500';
  const { rows } = await query(sql, p);
  res.json({ data: rows.map(toTask), total: rows.length });
});

router.post('/tasks', auth, can('tasks','create'), async (req, res) => {
  const d = req.body;
  if (!d.title) return res.status(400).json({ message: 'title required' });
  const taskId = await nextId('seq_task', 'TSK');
  await query(
    `INSERT INTO tasks (task_id,title,description,status,priority,assigned_to,assigned_name,due_date,entity_type,entity_id,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [taskId, d.title, d.description||null, d.status||'Open', d.priority||'Medium',
     d.assignedTo||null, d.assignedName||null, d.dueDate||null,
     d.entityType||null, d.entityId||null, req.user.userId]
  );
  const { rows } = await query('SELECT * FROM tasks WHERE task_id = $1', [taskId]);
  res.status(201).json(toTask(rows[0]));
});

router.patch('/tasks/:id', auth, can('tasks','update'), async (req, res) => {
  const d = req.body;
  const { rows } = await query(
    `UPDATE tasks SET title=COALESCE($2,title), status=COALESCE($3,status),
     priority=COALESCE($4,priority), assigned_to=COALESCE($5,assigned_to),
     assigned_name=COALESCE($6,assigned_name), due_date=COALESCE($7,due_date),
     description=COALESCE($8,description),
     completed_at=CASE WHEN $3='Done' THEN NOW() ELSE completed_at END
     WHERE task_id=$1 RETURNING *`,
    [req.params.id, d.title||null, d.status||null, d.priority||null,
     d.assignedTo||null, d.assignedName||null, d.dueDate||null, d.description||null]
  );
  if (!rows.length) return res.status(404).json({ message: 'Task not found' });
  res.json(toTask(rows[0]));
});

// ════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ════════════════════════════════════════════════════════════
router.get('/notifications', auth, async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM notifications WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 50`,
    [req.user.userId]
  );
  const unread = rows.filter(n => !n.read).length;
  res.json({ data: rows, unread, total: rows.length });
});

router.patch('/notifications/:id/read', auth, async (req, res) => {
  await query(
    'UPDATE notifications SET read=TRUE, read_at=NOW() WHERE notif_id=$1 AND user_id=$2',
    [req.params.id, req.user.userId]
  );
  res.json({ message: 'Marked as read' });
});

router.patch('/notifications/read-all', auth, async (req, res) => {
  await query(
    'UPDATE notifications SET read=TRUE, read_at=NOW() WHERE user_id=$1 AND read=FALSE',
    [req.user.userId]
  );
  res.json({ message: 'All marked as read' });
});

module.exports = router;
