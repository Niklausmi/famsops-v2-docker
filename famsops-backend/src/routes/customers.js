const router = require('express').Router();
const { query } = require('../db');
const { auth, rbac } = require('../middleware/auth');

// Camel ↔ snake helpers
const toRow = (d) => ({
  customer_id:       d.customerId,
  customer_name:     d.customerName,
  contact:           d.contact,
  email:             d.email,
  cnic:              d.cnic,
  father:            d.father,
  company:           d.company,
  rac:               d.rac,
  designation:       d.designation,
  industry:          d.industry,
  customer_type:     d.customerType,
  preferred_payment: d.preferredPayment,
  city:              d.city,
  area:              d.area,
  address:           d.address,
  notes:             d.notes,
});

const toJson = (r) => ({
  id:               r.id,
  customerId:       r.customer_id,
  customerName:     r.customer_name,
  contact:          r.contact,
  email:            r.email,
  cnic:             r.cnic,
  father:           r.father,
  company:          r.company,
  rac:              r.rac,
  designation:      r.designation,
  industry:         r.industry,
  customerType:     r.customer_type,
  preferredPayment: r.preferred_payment,
  city:             r.city,
  area:             r.area,
  address:          r.address,
  notes:            r.notes,
  totalJobs:        Number(r.total_jobs || 0),
  createdAt:        r.created_at,
  updatedAt:        r.updated_at,
});

// GET /api/v1/customers
router.get('/', auth, async (req, res) => {
  const { search, city, type, sort = 'name', limit = 500 } = req.query;
  let sql = `SELECT * FROM customers WHERE 1=1`;
  const params = [];
  let p = 1;

  if (search) {
    sql += ` AND (customer_name ILIKE $${p} OR contact ILIKE $${p} OR company ILIKE $${p} OR cnic ILIKE $${p} OR rac ILIKE $${p} OR customer_id ILIKE $${p} OR email ILIKE $${p})`;
    params.push(`%${search}%`); p++;
  }
  if (city) { sql += ` AND city = $${p}`; params.push(city); p++; }
  if (type) { sql += ` AND customer_type = $${p}`; params.push(type); p++; }

  const orderMap = { name: 'customer_name ASC', recent: 'created_at DESC', jobs: 'total_jobs DESC' };
  sql += ` ORDER BY ${orderMap[sort] || 'customer_name ASC'} LIMIT $${p}`;
  params.push(Number(limit));

  const { rows } = await query(sql, params);
  res.json({ data: rows.map(toJson), total: rows.length });
});

// GET /api/v1/customers/:id
router.get('/:id', auth, async (req, res) => {
  const { rows } = await query('SELECT * FROM customers WHERE customer_id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Customer not found' });
  res.json(toJson(rows[0]));
});

// GET /api/v1/customers/:id/hub  — all linked data
router.get('/:id/hub', auth, async (req, res) => {
  const id = req.params.id;
  const [custR, assetsR, ticketsR, jobsR, leadsR] = await Promise.all([
    query('SELECT * FROM customers WHERE customer_id = $1', [id]),
    query('SELECT * FROM assets  WHERE customer_id = $1 ORDER BY created_at DESC', [id]),
    query('SELECT * FROM tickets WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10', [id]),
    query('SELECT * FROM job_orders WHERE customer_id = $1 ORDER BY date DESC LIMIT 10', [id]),
    query('SELECT * FROM leads  WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10', [id]),
  ]);
  if (!custR.rows.length) return res.status(404).json({ message: 'Customer not found' });

  res.json({
    customer: toJson(custR.rows[0]),
    assets:   assetsR.rows.map(a => ({
      assetId:        a.asset_id,
      registrationNo: a.registration_no,
      make:           a.make,
      model:          a.model,
      color:          a.color,
      trackerIMEI:    a.tracker_imei,
      simNumber:      a.sim_number,
      status:         a.status,
      amcExpiry:      a.amc_expiry,
    })),
    tickets:  ticketsR.rows.map(t => ({
      ticketId:    t.ticket_id,
      type:        t.type,
      title:       t.title,
      status:      t.status,
      createdAt:   t.created_at,
    })),
    jobs:     jobsR.rows.map(j => ({
      invoiceNumber: j.invoice_number,
      toc:           j.toc,
      vehicle:       [j.vehicle_make, j.vehicle_model].filter(Boolean).join(' '),
      date:          j.date,
      customer:      j.customer_name,
    })),
    leads:    leadsR.rows.map(l => ({
      leadId:    l.lead_id,
      title:     l.title,
      status:    l.status,
      createdAt: l.created_at,
    })),
  });
});

// POST /api/v1/customers
router.post('/', auth, async (req, res) => {
  const d = toRow(req.body);
  if (!d.customer_name || !d.contact) {
    return res.status(400).json({ message: 'customer_name and contact are required' });
  }
  if (!d.customer_id) return res.status(400).json({ message: 'customerId is required' });

  await query(`
    INSERT INTO customers (customer_id, customer_name, contact, email, cnic, father, company, rac,
      designation, industry, customer_type, preferred_payment, city, area, address, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
  `, [d.customer_id, d.customer_name, d.contact, d.email||null, d.cnic||null, d.father||null,
      d.company||null, d.rac||null, d.designation||null, d.industry||null,
      d.customer_type||'individual', d.preferred_payment||null,
      d.city||null, d.area||null, d.address||null, d.notes||null]);

  const { rows } = await query('SELECT * FROM customers WHERE customer_id = $1', [d.customer_id]);
  res.status(201).json(toJson(rows[0]));
});

// PATCH /api/v1/customers/:id
router.patch('/:id', auth, async (req, res) => {
  const d = toRow(req.body);
  const id = req.params.id;

  const { rows } = await query(`
    UPDATE customers SET
      customer_name     = COALESCE($2, customer_name),
      contact           = COALESCE($3, contact),
      email             = COALESCE($4, email),
      cnic              = COALESCE($5, cnic),
      father            = COALESCE($6, father),
      company           = COALESCE($7, company),
      rac               = COALESCE($8, rac),
      customer_type     = COALESCE($9, customer_type),
      preferred_payment = COALESCE($10, preferred_payment),
      city              = COALESCE($11, city),
      area              = COALESCE($12, area),
      address           = COALESCE($13, address),
      notes             = COALESCE($14, notes)
    WHERE customer_id = $1
    RETURNING *
  `, [id, d.customer_name||null, d.contact||null, d.email||null, d.cnic||null,
      d.father||null, d.company||null, d.rac||null,
      d.customer_type||null, d.preferred_payment||null,
      d.city||null, d.area||null, d.address||null, d.notes||null]);

  if (!rows.length) return res.status(404).json({ message: 'Customer not found' });
  res.json(toJson(rows[0]));
});

module.exports = router;
