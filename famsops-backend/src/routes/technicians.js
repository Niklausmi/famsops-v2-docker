const router = require('express').Router();
const { query } = require('../db');
const { auth, rbac } = require('../middleware/auth');
const { nextId } = require('../utils/ids');

const toJson = (r) => ({
  id: r.id, techId: r.tech_id, name: r.name, phone: r.phone,
  city: r.city, active: r.active, fuelAllowance: r.fuel_allowance,
  notes: r.notes, createdAt: r.created_at,
  // aggregated on list queries
  totalJobs:      r.total_jobs      !== undefined ? Number(r.total_jobs)      : undefined,
  completedJobs:  r.completed_jobs  !== undefined ? Number(r.completed_jobs)  : undefined,
  thisMonthJobs:  r.this_month_jobs !== undefined ? Number(r.this_month_jobs) : undefined,
});

// GET /api/v1/technicians — with job counts
router.get('/', auth, async (req, res) => {
  const { rows } = await query(`
    SELECT t.*,
      COUNT(j.invoice_number)                                          AS total_jobs,
      COUNT(j.invoice_number) FILTER (WHERE j.status = 'Completed')   AS completed_jobs,
      COUNT(j.invoice_number) FILTER (
        WHERE j.status = 'Completed'
          AND date_trunc('month', j.date) = date_trunc('month', CURRENT_DATE)
      ) AS this_month_jobs
    FROM technicians t
    LEFT JOIN job_orders j ON j.technician_id = t.tech_id
    GROUP BY t.id
    ORDER BY t.name ASC
  `);
  res.json({ data: rows.map(toJson), total: rows.length });
});

// GET /api/v1/technicians/:id — with full job history
router.get('/:id', auth, async (req, res) => {
  const { rows } = await query('SELECT * FROM technicians WHERE tech_id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Technician not found' });

  const { rows: jobs } = await query(`
    SELECT invoice_number, toc, date, status, registration_no,
           vehicle_make, vehicle_model, customer_name, install_city, amount
    FROM job_orders WHERE technician_id = $1
    ORDER BY date DESC LIMIT 50
  `, [req.params.id]);

  const { rows: monthly } = await query(`
    SELECT TO_CHAR(date_trunc('month', date), 'Mon YYYY') AS month,
           COUNT(*) FILTER (WHERE status = 'Completed') AS completed,
           COUNT(*) AS total
    FROM job_orders
    WHERE technician_id = $1
      AND date >= CURRENT_DATE - INTERVAL '6 months'
    GROUP BY date_trunc('month', date)
    ORDER BY date_trunc('month', date) DESC
  `, [req.params.id]);

  res.json({ ...toJson(rows[0]), jobs, monthlyStats: monthly });
});

// POST /api/v1/technicians
router.post('/', auth, rbac('admin', 'management'), async (req, res) => {
  const d = req.body;
  if (!d.name) return res.status(400).json({ message: 'name required' });
  const techId = d.techId || await nextId('seq_tech', 'TECH');
  await query(`
    INSERT INTO technicians (tech_id, name, phone, city, fuel_allowance, notes)
    VALUES ($1,$2,$3,$4,$5,$6)
  `, [techId, d.name, d.phone||null, d.city||null, d.fuelAllowance||0, d.notes||null]);
  const { rows } = await query('SELECT * FROM technicians WHERE tech_id = $1', [techId]);
  res.status(201).json(toJson(rows[0]));
});

// PATCH /api/v1/technicians/:id
router.patch('/:id', auth, rbac('admin', 'management'), async (req, res) => {
  const d = req.body;
  const { rows } = await query(`
    UPDATE technicians SET
      name           = COALESCE($2, name),
      phone          = COALESCE($3, phone),
      city           = COALESCE($4, city),
      active         = COALESCE($5, active),
      fuel_allowance = COALESCE($6, fuel_allowance),
      notes          = COALESCE($7, notes)
    WHERE tech_id = $1 RETURNING *
  `, [req.params.id, d.name||null, d.phone||null, d.city||null,
      d.active !== undefined ? d.active : null,
      d.fuelAllowance !== undefined ? d.fuelAllowance : null, d.notes||null]);
  if (!rows.length) return res.status(404).json({ message: 'Technician not found' });
  res.json(toJson(rows[0]));
});

module.exports = router;
