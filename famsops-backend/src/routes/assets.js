const router = require('express').Router();
const { query } = require('../db');
const { auth } = require('../middleware/auth');
const { nextId } = require('../utils/ids');
const jobSvc = require('../services/jobOrderService');

const toJson = (r) => ({
  id: r.id, assetId: r.asset_id, registrationNo: r.registration_no,
  make: r.make, model: r.model, color: r.color, year: r.year,
  engineNo: r.engine_no, chassisNo: r.chassis_no, status: r.status,
  customerId: r.customer_id, customerName: r.customer_name,
  contact: r.contact, city: r.city,
  trackerIMEI: r.tracker_imei, trackerModel: r.tracker_model,
  simNumber: r.sim_number, simProvider: r.sim_provider,
  installerName: r.installer_name, installDate: r.install_date,
  package: r.package, amcDuration: r.amc_duration, amcExpiry: r.amc_expiry,
  installCity: r.install_city, notes: r.notes,
  renewalJobId: r.renewal_job_id, lastRenewalDate: r.last_renewal_date,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

// GET /api/v1/assets  — with tracker model and SIM provider from inventory
router.get('/', auth, async (req, res) => {
  const { status, city, search, customerId, amcExpiring } = req.query;
  let sql = `
    SELECT a.*,
           t.model  AS tracker_model,
           s.sim_provider
    FROM assets a
    LEFT JOIN trackers t ON t.imei  = a.tracker_imei
    LEFT JOIN sims     s ON s.sim_number = a.sim_number
    WHERE 1=1`;
  const params = []; let p = 1;
  if (customerId) { sql += ` AND a.customer_id = $${p}`; params.push(customerId); p++; }
  if (status)     { sql += ` AND a.status = $${p}`; params.push(status); p++; }
  if (city)       { sql += ` AND (a.install_city = $${p} OR a.city = $${p})`; params.push(city); p++; }
  if (amcExpiring === 'true') {
    sql += ` AND a.amc_expiry IS NOT NULL AND a.amc_expiry <= CURRENT_DATE + 30`;
  }
  if (search) {
    sql += ` AND (a.registration_no ILIKE $${p} OR a.customer_name ILIKE $${p}
              OR a.tracker_imei ILIKE $${p} OR a.sim_number ILIKE $${p}
              OR a.make ILIKE $${p} OR a.model ILIKE $${p})`;
    params.push(`%${search}%`); p++;
  }
  sql += ' ORDER BY a.created_at DESC LIMIT 2000';
  const { rows } = await query(sql, params);
  res.json({ data: rows.map(toJson), total: rows.length });
});

// GET /api/v1/assets/:id
router.get('/:id', auth, async (req, res) => {
  const { rows } = await query(`
    SELECT a.*, t.model AS tracker_model, s.sim_provider
    FROM assets a
    LEFT JOIN trackers t ON t.imei = a.tracker_imei
    LEFT JOIN sims     s ON s.sim_number = a.sim_number
    WHERE a.asset_id = $1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Asset not found' });
  res.json(toJson(rows[0]));
});

// POST /api/v1/assets
router.post('/', auth, async (req, res) => {
  const d = req.body;
  if (!d.registrationNo) return res.status(400).json({ message: 'registrationNo required' });
  if (!d.make)           return res.status(400).json({ message: 'make required' });
  if (!d.customerId)     return res.status(400).json({ message: 'customerId required' });

  const assetId = d.assetId || await nextId('seq_asset', 'AST');

  await query(`
    INSERT INTO assets (asset_id, registration_no, make, model, color, year,
      engine_no, chassis_no, status, customer_id, customer_name, contact, city,
      tracker_imei, sim_number, installer_name, install_date, package,
      amc_duration, amc_expiry, install_city, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
  `, [assetId, d.registrationNo, d.make, d.model||null, d.color||null,
      d.year||null, d.engineNo||null, d.chassisNo||null,
      d.status||'Active', d.customerId, d.customerName||null,
      d.contact||null, d.city||null,
      d.trackerIMEI||null, d.simNumber||null, d.installerName||null,
      d.installDate||null, d.package||null,
      d.amcDuration||null, d.amcExpiry||null, d.installCity||null, d.notes||null]);

  const { rows } = await query(`
    SELECT a.*, t.model AS tracker_model, s.sim_provider
    FROM assets a
    LEFT JOIN trackers t ON t.imei = a.tracker_imei
    LEFT JOIN sims     s ON s.sim_number = a.sim_number
    WHERE a.asset_id = $1`, [assetId]);
  res.status(201).json(toJson(rows[0]));
});

// PATCH /api/v1/assets/:id
router.patch('/:id', auth, async (req, res) => {
  const d = req.body; const id = req.params.id;
  const fields = {
    registration_no: d.registrationNo, make: d.make, model: d.model,
    color: d.color, year: d.year, engine_no: d.engineNo, chassis_no: d.chassisNo,
    status: d.status, tracker_imei: d.trackerIMEI, sim_number: d.simNumber,
    installer_name: d.installerName, install_date: d.installDate||null,
    package: d.package, amc_duration: d.amcDuration, amc_expiry: d.amcExpiry||null,
    install_city: d.installCity, notes: d.notes,
  };
  const sets = []; const vals = []; let p = 2;
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) { sets.push(`${col} = $${p++}`); vals.push(val === '' ? null : val); }
  }
  if (!sets.length) return res.json({ message: 'Nothing to update' });
  const { rows } = await query(
    `UPDATE assets SET ${sets.join(',')} WHERE asset_id = $1 RETURNING *`,
    [id, ...vals]
  );
  if (!rows.length) return res.status(404).json({ message: 'Asset not found' });
  res.json(toJson(rows[0]));
});

// POST /api/v1/assets/:id/renew-amc
router.post('/:id/renew-amc', auth, async (req, res) => {
  const job = await jobSvc.renewAmc(req.params.id, req.body, req.user.user_id);
  res.status(201).json(job);
});

module.exports = router;
