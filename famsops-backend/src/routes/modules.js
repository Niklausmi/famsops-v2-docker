// ── Generic CRUD factory ──────────────────────────────────────
// Each module defines a table name, camel→snake map, and validation.
// Keeps the route files DRY.

const router  = require('express').Router();
const { query } = require('../db');
const { auth, rbac } = require('../middleware/auth');

// ── Helpers ───────────────────────────────────────────────────
const snake = (s) => s.replace(/([A-Z])/g, '_$1').toLowerCase();

function buildUpdate(fields, startIdx = 2) {
  const sets  = [];
  const vals  = [];
  let   p     = startIdx;
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) { sets.push(`${col} = $${p++}`); vals.push(val === '' ? null : val); }
  }
  return { sets, vals, nextP: p };
}

// ── TICKETS ───────────────────────────────────────────────────
const ticketCols = [
  'ticket_id','type','title','description','category','priority','status',
  'customer_id','customer_name','contact','city','asset_id','assigned_to',
  'followup_date','due_date','incident_date','severity',
  'lead_source','salesperson','vehicles','budget','timeline',
  'preferred_payment','package','notes',
];

const toTicket = (r) => ({
  id: r.id, ticketId: r.ticket_id, type: r.type, title: r.title,
  description: r.description, category: r.category, priority: r.priority,
  status: r.status, customerId: r.customer_id, customerName: r.customer_name,
  contact: r.contact, city: r.city, assetId: r.asset_id,
  assignedTo: r.assigned_to, followupDate: r.followup_date,
  dueDate: r.due_date, incidentDate: r.incident_date, severity: r.severity,
  leadSource: r.lead_source, salesperson: r.salesperson, vehicles: r.vehicles,
  budget: r.budget, timeline: r.timeline, preferredPayment: r.preferred_payment,
  package: r.package, notes: r.notes, resolvedAt: r.resolved_at,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

router.get('/tickets', auth, async (req, res) => {
  const { type, status, priority, search } = req.query;
  let sql = 'SELECT * FROM tickets WHERE 1=1';
  const params = [];
  let p = 1;
  if (type)   { sql += ` AND type = $${p}`; params.push(type); p++; }
  if (status) { sql += ` AND status = $${p}`; params.push(status); p++; }
  if (priority){ sql += ` AND priority = $${p}`; params.push(priority); p++; }
  if (search) { sql += ` AND (title ILIKE $${p} OR customer_name ILIKE $${p} OR ticket_id ILIKE $${p})`; params.push(`%${search}%`); p++; }
  sql += ' ORDER BY created_at DESC LIMIT 1000';
  const { rows } = await query(sql, params);
  res.json({ data: rows.map(toTicket), total: rows.length });
});

router.get('/tickets/:id', auth, async (req, res) => {
  const { rows } = await query('SELECT * FROM tickets WHERE ticket_id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Ticket not found' });
  res.json(toTicket(rows[0]));
});

router.post('/tickets', auth, async (req, res) => {
  const d = req.body;
  if (!d.ticketId) return res.status(400).json({ message: 'ticketId required' });
  if (!d.title)    return res.status(400).json({ message: 'title required' });

  await query(`
    INSERT INTO tickets (ticket_id,type,title,description,category,priority,status,
      customer_id,customer_name,contact,city,asset_id,assigned_to,
      followup_date,due_date,incident_date,severity,
      lead_source,salesperson,vehicles,budget,timeline,preferred_payment,package,notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
  `, [d.ticketId, d.type||'Query', d.title, d.description||null, d.category||null,
      d.priority||'Medium', d.status||'Open', d.customerId||null, d.customerName||null,
      d.contact||null, d.city||null, d.assetId||null, d.assignedTo||null,
      d.followupDate||null, d.dueDate||null, d.incidentDate||null, d.severity||null,
      d.leadSource||null, d.salesperson||null, d.vehicles||null, d.budget||null,
      d.timeline||null, d.preferredPayment||null, d.package||null, d.notes||null]);

  const { rows } = await query('SELECT * FROM tickets WHERE ticket_id = $1', [d.ticketId]);
  res.status(201).json(toTicket(rows[0]));
});

router.patch('/tickets/:id', auth, async (req, res) => {
  const d   = req.body;
  const id  = req.params.id;
  const map = {
    type: d.type, title: d.title, description: d.description, category: d.category,
    priority: d.priority, status: d.status, assigned_to: d.assignedTo,
    followup_date: d.followupDate||null, due_date: d.dueDate||null,
    notes: d.notes, severity: d.severity, salesperson: d.salesperson,
    vehicles: d.vehicles, budget: d.budget, timeline: d.timeline,
    package: d.package, lead_source: d.leadSource,
    resolved_at: d.status === 'Resolved' ? new Date().toISOString() : undefined,
  };
  const { sets, vals } = buildUpdate(map);
  if (!sets.length) return res.json({ message: 'Nothing to update' });
  const { rows } = await query(
    `UPDATE tickets SET ${sets.join(',')} WHERE ticket_id = $1 RETURNING *`,
    [id, ...vals]
  );
  if (!rows.length) return res.status(404).json({ message: 'Ticket not found' });
  res.json(toTicket(rows[0]));
});

// ── JOB ORDERS ────────────────────────────────────────────────
const toJob = (r) => ({
  id: r.id, invoiceNumber: r.invoice_number, toc: r.toc, date: r.date,
  status: r.status, customerId: r.customer_id, customerName: r.customer_name,
  contact: r.contact, city: r.city, rac: r.rac, company: r.company,
  registrationNo: r.registration_no, vehicleMake: r.vehicle_make,
  vehicleModel: r.vehicle_model, vehicleColor: r.vehicle_color,
  vehicleYear: r.vehicle_year, trackerIMEI: r.tracker_imei,
  simNumber: r.sim_number, installerName: r.installer_name,
  installCity: r.install_city, package: r.package,
  amcDuration: r.amc_duration, amcExpiry: r.amc_expiry,
  amount: r.amount, paymentStatus: r.payment_status,
  paymentMethod: r.payment_method, notes: r.notes,
  followupDate: r.followup_date, createdAt: r.created_at, updatedAt: r.updated_at,
});

router.get('/job-orders', auth, async (req, res) => {
  const { toc, status, search, from, to } = req.query;
  let sql = 'SELECT * FROM job_orders WHERE 1=1';
  const params = []; let p = 1;
  if (toc)    { sql += ` AND toc = $${p}`; params.push(toc); p++; }
  if (status) { sql += ` AND status = $${p}`; params.push(status); p++; }
  if (from)   { sql += ` AND date >= $${p}`; params.push(from); p++; }
  if (to)     { sql += ` AND date <= $${p}`; params.push(to); p++; }
  if (search) { sql += ` AND (customer_name ILIKE $${p} OR invoice_number ILIKE $${p} OR registration_no ILIKE $${p} OR tracker_imei ILIKE $${p} OR installer_name ILIKE $${p})`; params.push(`%${search}%`); p++; }
  sql += ' ORDER BY date DESC, created_at DESC LIMIT 1000';
  const { rows } = await query(sql, params);
  res.json({ data: rows.map(toJob), total: rows.length });
});

router.get('/job-orders/:id', auth, async (req, res) => {
  const { rows } = await query('SELECT * FROM job_orders WHERE invoice_number = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Job order not found' });
  res.json(toJob(rows[0]));
});

router.post('/job-orders', auth, async (req, res) => {
  const d = req.body;
  if (!d.invoiceNumber) return res.status(400).json({ message: 'invoiceNumber required' });

  await query(`
    INSERT INTO job_orders (invoice_number,toc,date,status,
      customer_id,customer_name,contact,city,rac,company,
      registration_no,vehicle_make,vehicle_model,vehicle_color,vehicle_year,
      tracker_imei,sim_number,installer_name,install_city,package,
      amc_duration,amc_expiry,amount,payment_status,payment_method,notes,followup_date,created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
  `, [d.invoiceNumber, d.toc||'New Installation', d.date||new Date().toISOString().split('T')[0],
      d.status||'Scheduled', d.customerId||null, d.customerName||null,
      d.contact||null, d.city||null, d.rac||null, d.company||null,
      d.registrationNo||null, d.vehicleMake||null, d.vehicleModel||null,
      d.vehicleColor||null, d.vehicleYear||null,
      d.trackerIMEI||null, d.simNumber||null, d.installerName||null,
      d.installCity||null, d.package||null,
      d.amcDuration||null, d.amcExpiry||null,
      d.amount||null, d.paymentStatus||null, d.paymentMethod||null,
      d.notes||null, d.followupDate||null, req.user.user_id]);

  // Auto-create/update asset when job is completed
  if (d.status === 'Completed' && d.registrationNo && d.customerId) {
    const assetId = `AST-${d.invoiceNumber}`;
    await query(`
      INSERT INTO assets (asset_id, registration_no, make, model, color, year,
        customer_id, customer_name, contact, city,
        tracker_imei, sim_number, installer_name, install_date,
        package, amc_duration, amc_expiry, install_city, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'Active')
      ON CONFLICT (asset_id) DO NOTHING
    `, [assetId, d.registrationNo, d.vehicleMake||null, d.vehicleModel||null,
        d.vehicleColor||null, d.vehicleYear||null,
        d.customerId, d.customerName||null, d.contact||null, d.city||null,
        d.trackerIMEI||null, d.simNumber||null, d.installerName||null,
        d.date||null, d.package||null, d.amcDuration||null,
        d.amcExpiry||null, d.installCity||null]);
    // Bump customer total_jobs
    await query('UPDATE customers SET total_jobs = total_jobs + 1 WHERE customer_id = $1', [d.customerId]);
  }

  const { rows } = await query('SELECT * FROM job_orders WHERE invoice_number = $1', [d.invoiceNumber]);
  res.status(201).json(toJob(rows[0]));
});

router.patch('/job-orders/:id', auth, async (req, res) => {
  const d  = req.body;
  const id = req.params.id;
  const map = {
    toc: d.toc, date: d.date, status: d.status,
    registration_no: d.registrationNo, vehicle_make: d.vehicleMake,
    vehicle_model: d.vehicleModel, vehicle_color: d.vehicleColor,
    tracker_imei: d.trackerIMEI, sim_number: d.simNumber,
    installer_name: d.installerName, install_city: d.installCity,
    package: d.package, amc_duration: d.amcDuration, amc_expiry: d.amcExpiry||null,
    amount: d.amount, payment_status: d.paymentStatus, payment_method: d.paymentMethod,
    notes: d.notes,
  };
  const { sets, vals } = buildUpdate(map);
  if (!sets.length) return res.json({ message: 'Nothing to update' });
  const { rows } = await query(
    `UPDATE job_orders SET ${sets.join(',')} WHERE invoice_number = $1 RETURNING *`,
    [id, ...vals]
  );
  if (!rows.length) return res.status(404).json({ message: 'Job order not found' });
  res.json(toJob(rows[0]));
});

// ── LEADS ─────────────────────────────────────────────────────
const toLead = (r) => ({
  id: r.id, leadId: r.lead_id, status: r.status, title: r.title,
  description: r.description, customerId: r.customer_id,
  customerName: r.customer_name, contact: r.contact, city: r.city,
  company: r.company, package: r.package, vehicles: r.vehicles,
  budget: r.budget, timeline: r.timeline, preferredPayment: r.preferred_payment,
  source: r.source, salesperson: r.salesperson, followupDate: r.followup_date,
  priority: r.priority, amount: r.amount, closedDate: r.closed_date,
  notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at,
});

router.get('/leads', auth, async (req, res) => {
  const { status, search } = req.query;
  let sql = 'SELECT * FROM leads WHERE 1=1';
  const params = []; let p = 1;
  if (status) { sql += ` AND status = $${p}`; params.push(status); p++; }
  if (search) { sql += ` AND (title ILIKE $${p} OR customer_name ILIKE $${p} OR salesperson ILIKE $${p})`; params.push(`%${search}%`); p++; }
  sql += ' ORDER BY created_at DESC LIMIT 1000';
  const { rows } = await query(sql, params);
  res.json({ data: rows.map(toLead), total: rows.length });
});

router.get('/leads/:id', auth, async (req, res) => {
  const { rows } = await query('SELECT * FROM leads WHERE lead_id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Lead not found' });
  res.json(toLead(rows[0]));
});

router.post('/leads', auth, async (req, res) => {
  const d = req.body;
  if (!d.leadId) return res.status(400).json({ message: 'leadId required' });
  if (!d.title)  return res.status(400).json({ message: 'title required' });

  await query(`
    INSERT INTO leads (lead_id,status,title,description,customer_id,customer_name,
      contact,city,company,package,vehicles,budget,timeline,
      preferred_payment,source,salesperson,followup_date,priority,amount,notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
  `, [d.leadId, d.status||'New Lead', d.title, d.description||null,
      d.customerId||null, d.customerName||null, d.contact||null, d.city||null,
      d.company||null, d.package||null, d.vehicles||null, d.budget||null,
      d.timeline||null, d.preferredPayment||null, d.source||null,
      d.salesperson||null, d.followupDate||null, d.priority||'Medium',
      d.amount||null, d.notes||null]);

  const { rows } = await query('SELECT * FROM leads WHERE lead_id = $1', [d.leadId]);
  res.status(201).json(toLead(rows[0]));
});

router.patch('/leads/:id', auth, async (req, res) => {
  const d  = req.body;
  const id = req.params.id;
  const map = {
    status: d.status, title: d.title, description: d.description,
    package: d.package, vehicles: d.vehicles, budget: d.budget,
    timeline: d.timeline, preferred_payment: d.preferredPayment,
    source: d.source, salesperson: d.salesperson,
    followup_date: d.followupDate||null, priority: d.priority,
    amount: d.amount, notes: d.notes,
    closed_date: (d.status === 'Won' || d.status === 'Lost') ? new Date().toISOString().split('T')[0] : undefined,
  };
  const { sets, vals } = buildUpdate(map);
  if (!sets.length) return res.json({ message: 'Nothing to update' });
  const { rows } = await query(
    `UPDATE leads SET ${sets.join(',')} WHERE lead_id = $1 RETURNING *`,
    [id, ...vals]
  );
  if (!rows.length) return res.status(404).json({ message: 'Lead not found' });
  res.json(toLead(rows[0]));
});

// ── ASSETS ────────────────────────────────────────────────────
const toAsset = (r) => ({
  id: r.id, assetId: r.asset_id, registrationNo: r.registration_no,
  make: r.make, model: r.model, color: r.color, year: r.year,
  engineNo: r.engine_no, chassisNo: r.chassis_no, status: r.status,
  customerId: r.customer_id, customerName: r.customer_name,
  contact: r.contact, city: r.city, trackerIMEI: r.tracker_imei,
  simNumber: r.sim_number, installerName: r.installer_name,
  installDate: r.install_date, package: r.package,
  amcDuration: r.amc_duration, amcExpiry: r.amc_expiry,
  installCity: r.install_city, notes: r.notes,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

router.get('/assets', auth, async (req, res) => {
  const { status, city, search } = req.query;
  let sql = 'SELECT * FROM assets WHERE 1=1';
  const params = []; let p = 1;
  if (status) { sql += ` AND status = $${p}`; params.push(status); p++; }
  if (city)   { sql += ` AND (install_city = $${p} OR city = $${p})`; params.push(city); p++; }
  if (search) { sql += ` AND (registration_no ILIKE $${p} OR customer_name ILIKE $${p} OR tracker_imei ILIKE $${p} OR sim_number ILIKE $${p} OR make ILIKE $${p} OR model ILIKE $${p})`; params.push(`%${search}%`); p++; }
  sql += ' ORDER BY created_at DESC LIMIT 2000';
  const { rows } = await query(sql, params);
  res.json({ data: rows.map(toAsset), total: rows.length });
});

router.get('/assets/:id', auth, async (req, res) => {
  const { rows } = await query('SELECT * FROM assets WHERE asset_id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Asset not found' });
  res.json(toAsset(rows[0]));
});

router.post('/assets', auth, async (req, res) => {
  const d = req.body;
  if (!d.assetId)        return res.status(400).json({ message: 'assetId required' });
  if (!d.registrationNo) return res.status(400).json({ message: 'registrationNo required' });
  if (!d.make)           return res.status(400).json({ message: 'make required' });

  await query(`
    INSERT INTO assets (asset_id, registration_no, make, model, color, year, engine_no, chassis_no,
      status, customer_id, customer_name, contact, city,
      tracker_imei, sim_number, installer_name, install_date,
      package, amc_duration, amc_expiry, install_city, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
  `, [d.assetId, d.registrationNo, d.make, d.model||null, d.color||null,
      d.year||null, d.engineNo||null, d.chassisNo||null,
      d.status||'Active', d.customerId||null, d.customerName||null,
      d.contact||null, d.city||null, d.trackerIMEI||null, d.simNumber||null,
      d.installerName||null, d.installDate||null, d.package||null,
      d.amcDuration||null, d.amcExpiry||null, d.installCity||null, d.notes||null]);

  if (d.customerId) {
    await query('UPDATE customers SET total_jobs = total_jobs + 1 WHERE customer_id = $1', [d.customerId]);
  }

  const { rows } = await query('SELECT * FROM assets WHERE asset_id = $1', [d.assetId]);
  res.status(201).json(toAsset(rows[0]));
});

router.patch('/assets/:id', auth, async (req, res) => {
  const d  = req.body;
  const id = req.params.id;
  const map = {
    registration_no: d.registrationNo, make: d.make, model: d.model,
    color: d.color, year: d.year, engine_no: d.engineNo, chassis_no: d.chassisNo,
    status: d.status, tracker_imei: d.trackerIMEI, sim_number: d.simNumber,
    installer_name: d.installerName, install_date: d.installDate||null,
    package: d.package, amc_duration: d.amcDuration, amc_expiry: d.amcExpiry||null,
    install_city: d.installCity, notes: d.notes,
  };
  const { sets, vals } = buildUpdate(map);
  if (!sets.length) return res.json({ message: 'Nothing to update' });
  const { rows } = await query(
    `UPDATE assets SET ${sets.join(',')} WHERE asset_id = $1 RETURNING *`,
    [id, ...vals]
  );
  if (!rows.length) return res.status(404).json({ message: 'Asset not found' });
  res.json(toAsset(rows[0]));
});

module.exports = router;
