const { query, getClient } = require('../db');
const { nextId } = require('../utils/ids');

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

async function list({ search, city, type, sort = 'name', limit = 500 }) {
  let sql = 'SELECT * FROM customers WHERE 1=1';
  const params = []; let p = 1;
  if (search) {
    sql += ` AND (customer_name ILIKE $${p} OR contact ILIKE $${p} OR company ILIKE $${p}
              OR cnic ILIKE $${p} OR rac ILIKE $${p} OR customer_id ILIKE $${p} OR email ILIKE $${p})`;
    params.push(`%${search}%`); p++;
  }
  if (city) { sql += ` AND city = $${p}`; params.push(city); p++; }
  if (type) { sql += ` AND customer_type = $${p}`; params.push(type); p++; }
  const orderMap = { name: 'customer_name ASC', recent: 'created_at DESC', jobs: 'total_jobs DESC' };
  sql += ` ORDER BY ${orderMap[sort] || 'customer_name ASC'} LIMIT $${p}`;
  params.push(Number(limit));
  const { rows } = await query(sql, params);
  return rows.map(toJson);
}

async function getById(customerId) {
  const { rows } = await query('SELECT * FROM customers WHERE customer_id = $1', [customerId]);
  return rows.length ? toJson(rows[0]) : null;
}

async function getHub(customerId) {
  const [custR, assetsR, ticketsR, jobsR, leadsR, paymentsR, invoicesR] = await Promise.all([
    query('SELECT * FROM customers WHERE customer_id = $1', [customerId]),

    query(`SELECT a.*, t.model as tracker_model
           FROM assets a
           LEFT JOIN trackers t ON t.imei = a.tracker_imei
           WHERE a.customer_id = $1
           ORDER BY a.created_at DESC`, [customerId]),

    query(`SELECT ticket_id, type, title, status, priority, assigned_to, created_at, followup_date
           FROM tickets WHERE customer_id = $1
           ORDER BY created_at DESC LIMIT 10`, [customerId]),

    query(`SELECT j.invoice_number, j.toc, j.date, j.status,
                  j.registration_no, j.vehicle_make, j.vehicle_model,
                  j.installer_name, j.amount, j.payment_status,
                  COALESCE(t.name, j.installer_name) as technician_name
           FROM job_orders j
           LEFT JOIN technicians t ON t.tech_id = j.technician_id
           WHERE j.customer_id = $1
           ORDER BY j.date DESC LIMIT 10`, [customerId]),

    query(`SELECT lead_id, title, status, salesperson, followup_date, amount, converted_job_id
           FROM leads WHERE customer_id = $1
           ORDER BY created_at DESC LIMIT 5`, [customerId]),

    query(`SELECT payment_id, type, amount, paid_amount, balance_due, status, payment_date
           FROM payments WHERE customer_id = $1
           ORDER BY payment_date DESC LIMIT 5`, [customerId]),
    query(`SELECT invoice_id, type, total, paid_amount, balance_due, status, issue_date, due_date
           FROM invoices WHERE customer_id = $1
           ORDER BY issue_date DESC LIMIT 5`, [customerId]),
  ]);

  if (!custR.rows.length) return null;

  const c = toJson(custR.rows[0]);

  return {
    customer: c,
    assets: assetsR.rows.map(a => ({
      assetId:        a.asset_id,
      registrationNo: a.registration_no,
      make:           a.make,
      model:          a.model,
      color:          a.color,
      trackerIMEI:    a.tracker_imei,
      trackerModel:   a.tracker_model,
      simNumber:      a.sim_number,
      status:         a.status,
      amcExpiry:      a.amc_expiry,
      package:        a.package,
    })),
    tickets: ticketsR.rows.map(t => ({
      ticketId:    t.ticket_id,
      type:        t.type,
      title:       t.title,
      status:      t.status,
      priority:    t.priority,
      assignedTo:  t.assigned_to,
      followupDate:t.followup_date,
      createdAt:   t.created_at,
    })),
    jobs: jobsR.rows.map(j => ({
      invoiceNumber:  j.invoice_number,
      toc:            j.toc,
      date:           j.date,
      status:         j.status,
      vehicle:        [j.vehicle_make, j.vehicle_model].filter(Boolean).join(' '),
      registrationNo: j.registration_no,
      technicianName: j.technician_name,
      amount:         j.amount,
      paymentStatus:  j.payment_status,
    })),
    leads: leadsR.rows.map(l => ({
      leadId:        l.lead_id,
      title:         l.title,
      status:        l.status,
      salesperson:   l.salesperson,
      followupDate:  l.followup_date,
      amount:        l.amount,
      convertedJobId:l.converted_job_id,
    })),
    payments: paymentsR.rows.map(p => ({
      paymentId:   p.payment_id,
      type:        p.type,
      amount:      p.amount,
      paidAmount:  p.paid_amount,
      balanceDue:  p.balance_due,
      status:      p.status,
      paymentDate: p.payment_date,
    })),
    invoices: invoicesR.rows.map(i => ({
      invoiceId:   i.invoice_id,
      type:        i.type,
      total:       i.total,
      paidAmount:  i.paid_amount,
      balanceDue:  i.balance_due,
      status:      i.status,
      issueDate:   i.issue_date,
      dueDate:     i.due_date,
    })),
    summary: {
      totalAssets:      assetsR.rows.length,
      totalJobs:        c.totalJobs,
      openTickets:      ticketsR.rows.filter(t => t.status === 'Open').length,
      activeLeads:      leadsR.rows.filter(l => !['Won','Lost'].includes(l.status)).length,
      totalPaid:        paymentsR.rows.reduce((s, p) => s + Number(p.paid_amount || 0), 0),
      totalOutstanding: paymentsR.rows.reduce((s, p) => s + Number(p.balance_due || 0), 0),
      amcExpiring:      assetsR.rows.filter(a => {
        if (!a.amc_expiry) return false;
        const d = new Date(a.amc_expiry) - Date.now();
        return d > 0 && d < 30 * 24 * 60 * 60 * 1000;
      }).length,
    },
  };
}

async function create(data) {
  const customerId = data.customerId || await nextId('seq_customer', 'CUST');
  await query(`
    INSERT INTO customers (customer_id, customer_name, contact, email, cnic, father,
      company, rac, designation, industry, customer_type, preferred_payment,
      city, area, address, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
  `, [customerId, data.customerName, data.contact, data.email||null, data.cnic||null,
      data.father||null, data.company||null, data.rac||null, data.designation||null,
      data.industry||null, data.customerType||'individual', data.preferredPayment||null,
      data.city||null, data.area||null, data.address||null, data.notes||null]);

  const { rows } = await query('SELECT * FROM customers WHERE customer_id = $1', [customerId]);
  return toJson(rows[0]);
}

async function update(customerId, data) {
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
    WHERE customer_id = $1 RETURNING *
  `, [customerId, data.customerName||null, data.contact||null, data.email||null,
      data.cnic||null, data.father||null, data.company||null, data.rac||null,
      data.customerType||null, data.preferredPayment||null, data.city||null,
      data.area||null, data.address||null, data.notes||null]);
  return rows.length ? toJson(rows[0]) : null;
}

module.exports = { list, getById, getHub, create, update };
