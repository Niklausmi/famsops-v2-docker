const { query, getClient } = require('../db');
const { nextId } = require('../utils/ids');

const toJson = (r) => ({
  id: r.id, invoiceNumber: r.invoice_number, toc: r.toc, date: r.date,
  status: r.status, customerId: r.customer_id, customerName: r.customer_name,
  contact: r.contact, city: r.city, rac: r.rac, company: r.company,
  registrationNo: r.registration_no, vehicleMake: r.vehicle_make,
  vehicleModel: r.vehicle_model, vehicleColor: r.vehicle_color,
  vehicleYear: r.vehicle_year, trackerIMEI: r.tracker_imei,
  simNumber: r.sim_number, installerName: r.installer_name,
  technicianId: r.technician_id, installCity: r.install_city,
  package: r.package, amcDuration: r.amc_duration, amcExpiry: r.amc_expiry,
  amount: r.amount, paymentStatus: r.payment_status, paymentMethod: r.payment_method,
  notes: r.notes, followupDate: r.followup_date,
  leadId: r.lead_id, createdBy: r.created_by, priceOverrides: r.price_overrides,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

async function list({ toc, status, search, from, to, customerId } = {}) {
  let sql = `
    SELECT j.*, COALESCE(t.name, j.installer_name) as technician_name
    FROM job_orders j
    LEFT JOIN technicians t ON t.tech_id = j.technician_id
    WHERE 1=1`;
  const params = []; let p = 1;
  if (customerId){ sql += ` AND j.customer_id = $${p}`; params.push(customerId); p++; }
  if (toc)       { sql += ` AND j.toc = $${p}`; params.push(toc); p++; }
  if (status)    { sql += ` AND j.status = $${p}`; params.push(status); p++; }
  if (from)      { sql += ` AND j.date >= $${p}`; params.push(from); p++; }
  if (to)        { sql += ` AND j.date <= $${p}`; params.push(to); p++; }
  if (search)    {
    sql += ` AND (j.customer_name ILIKE $${p} OR j.invoice_number ILIKE $${p}
              OR j.registration_no ILIKE $${p} OR j.tracker_imei ILIKE $${p}
              OR j.installer_name ILIKE $${p})`;
    params.push(`%${search}%`); p++;
  }
  sql += ' ORDER BY j.date DESC, j.created_at DESC LIMIT 1000';
  const { rows } = await query(sql, params);
  return rows.map(r => ({ ...toJson(r), technicianName: r.technician_name }));
}

async function getById(invoiceNumber) {
  const { rows } = await query(
    `SELECT j.*, t.name as technician_name
     FROM job_orders j
     LEFT JOIN technicians t ON t.tech_id = j.technician_id
     WHERE j.invoice_number = $1`,
    [invoiceNumber]
  );
  return rows.length ? { ...toJson(rows[0]), technicianName: rows[0].technician_name } : null;
}

async function create(data, userId) {
  const invoiceNumber = data.invoiceNumber || await nextId('seq_job', 'INV');

  // Validate tracker and SIM exist + are available if provided
  if (data.trackerIMEI) {
    const { rows } = await query('SELECT status FROM trackers WHERE imei = $1', [data.trackerIMEI]);
    if (!rows.length) throw Object.assign(new Error('Tracker IMEI not found in inventory'), { status: 404 });
    if (rows[0].status === 'Faulty') throw Object.assign(new Error('Tracker is marked as Faulty'), { status: 400 });
  }
  if (data.simNumber) {
    const { rows } = await query('SELECT status FROM sims WHERE sim_number = $1', [data.simNumber]);
    if (!rows.length) throw Object.assign(new Error('SIM not found in inventory'), { status: 404 });
    if (rows[0].status === 'Disabled') throw Object.assign(new Error('SIM is disabled'), { status: 400 });
  }

  await query(`
    INSERT INTO job_orders (invoice_number,toc,date,status,
      customer_id,customer_name,contact,city,rac,company,
      registration_no,vehicle_make,vehicle_model,vehicle_color,vehicle_year,
      tracker_imei,sim_number,installer_name,technician_id,install_city,package,
      amc_duration,amc_expiry,amount,payment_status,payment_method,
      notes,followup_date,lead_id,created_by,price_overrides)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
  `, [invoiceNumber, data.toc||'New Installation',
      data.date||new Date().toISOString().split('T')[0],
      data.status||'Scheduled',
      data.customerId||null, data.customerName||null, data.contact||null,
      data.city||null, data.rac||null, data.company||null,
      data.registrationNo||null, data.vehicleMake||null, data.vehicleModel||null,
      data.vehicleColor||null, data.vehicleYear||null,
      data.trackerIMEI||null, data.simNumber||null,
      data.installerName||null, data.technicianId||null,
      data.installCity||null, data.package||null,
      data.amcDuration||null, data.amcExpiry||null,
      data.amount||null, data.paymentStatus||null, data.paymentMethod||null,
      data.notes||null, data.followupDate||null,
      data.leadId||null, userId,
     data.priceOverrides ? JSON.stringify(data.priceOverrides) : null]);

  // DB triggers handle: device status sync, asset upsert, job count
  return getById(invoiceNumber);
}

async function update(invoiceNumber, data) {
  const fields = {
    toc: data.toc, date: data.date, status: data.status,
    registration_no: data.registrationNo, vehicle_make: data.vehicleMake,
    vehicle_model: data.vehicleModel, vehicle_color: data.vehicleColor,
    tracker_imei: data.trackerIMEI, sim_number: data.simNumber,
    installer_name: data.installerName, technician_id: data.technicianId,
    install_city: data.installCity, package: data.package,
    amc_duration: data.amcDuration, amc_expiry: data.amcExpiry||null,
    amount: data.amount, payment_status: data.paymentStatus,
    payment_method: data.paymentMethod,
    notes: data.notes, followup_date: data.followupDate||null,
    price_overrides: data.priceOverrides !== undefined
      ? JSON.stringify(data.priceOverrides) : undefined,
  };
  const sets = []; const vals = []; let p = 2;
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) { sets.push(`${col} = $${p++}`); vals.push(val === '' ? null : val); }
  }
  if (!sets.length) return getById(invoiceNumber);
  await query(
    `UPDATE job_orders SET ${sets.join(',')} WHERE invoice_number = $1`,
    [invoiceNumber, ...vals]
  );
  // Triggers fire automatically
  return getById(invoiceNumber);
}

/**
 * Convert a Won lead into a Job Order — pre-fills all lead data.
 * Returns the new job order.
 */
async function convertFromLead(leadId, userId) {
  const { rows: lr } = await query('SELECT * FROM leads WHERE lead_id = $1', [leadId]);
  if (!lr.length) throw Object.assign(new Error('Lead not found'), { status: 404 });
  const lead = lr[0];
  if (lead.status !== 'Won') throw Object.assign(new Error('Only Won leads can be converted'), { status: 400 });
  if (lead.converted_job_id) throw Object.assign(new Error('Lead already converted to ' + lead.converted_job_id), { status: 409 });

  const invoiceNumber = await nextId('seq_job', 'INV');

  await query(`
    INSERT INTO job_orders (invoice_number, toc, date, status,
      customer_id, customer_name, contact, city, company, package,
      amc_duration, amount, notes, lead_id, created_by,
      registration_no, vehicle_make, vehicle_model, vehicle_color)
    VALUES ($1,'New Installation',$2,'Scheduled',$3,$4,$5,$6,$7,$8,'1 Year',$9,$10,$11,$12,$13,$14,$15,$16,$17)
  `, [invoiceNumber, new Date().toISOString().split('T')[0],
      lead.customer_id, lead.customer_name, lead.contact,
      lead.city, lead.company||null, lead.package||null,
      lead.amount||null,
      `Converted from lead ${leadId}. ${lead.description||''}`.trim(),
      leadId, userId,
      lead.plate_number||null, lead.vehicle_make||null,
      lead.vehicle_model||null, lead.vehicle_color||null]);

  // Mark lead as converted
  await query(
    'UPDATE leads SET converted_job_id = $2, converted_at = NOW() WHERE lead_id = $1',
    [leadId, invoiceNumber]
  );

  return getById(invoiceNumber);
}

/**
 * Create an AMC Renewal job order from an existing asset.
 */
async function renewAmc(assetId, data, userId) {
  const { rows: ar } = await query('SELECT * FROM assets WHERE asset_id = $1', [assetId]);
  if (!ar.length) throw Object.assign(new Error('Asset not found'), { status: 404 });
  const asset = ar[0];

  const invoiceNumber = await nextId('seq_job', 'INV');
  const newExpiry = data.newAmcExpiry || null;

  await query(`
    INSERT INTO job_orders (invoice_number, toc, date, status,
      customer_id, registration_no, vehicle_make, vehicle_model,
      tracker_imei, sim_number, package,
      amc_duration, amc_expiry, amount, payment_status, notes, created_by)
    VALUES ($1,'AMC Visit',$2,'Scheduled',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Pending',$13,$14)
  `, [invoiceNumber, new Date().toISOString().split('T')[0],
      asset.customer_id, asset.registration_no,
      asset.make, asset.model,
      asset.tracker_imei, asset.sim_number,
      asset.package, data.amcDuration||'1 Year',
      newExpiry, data.amount||null,
      `AMC renewal for ${asset.registration_no}`,
      userId]);

  // Update asset with new expiry and renewal job reference
  if (newExpiry) {
    await query(
      'UPDATE assets SET amc_expiry = $2, renewal_job_id = $3, last_renewal_date = CURRENT_DATE WHERE asset_id = $1',
      [assetId, newExpiry, invoiceNumber]
    );
  }

  return getById(invoiceNumber);
}

module.exports = { list, getById, create, update, convertFromLead, renewAmc };
