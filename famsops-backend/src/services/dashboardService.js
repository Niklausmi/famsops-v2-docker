const { query } = require('../db');

async function getStats() {
  const [
    leadsTotal, leadsByStatus,
    jobsTotal, jobsRecent,
    trackers, sims,
    ticketsOpen,
    amcExpiring,
    paymentsOverdue,
  ] = await Promise.all([
    query('SELECT COUNT(*) FROM leads'),
    query('SELECT status, COUNT(*) as cnt FROM leads GROUP BY status'),
    query('SELECT COUNT(*) FROM job_orders'),
    query(`
      SELECT j.invoice_number, j.toc, j.date, j.status,
             j.registration_no, j.vehicle_make, j.vehicle_model,
             j.customer_id, c.customer_name,
             COALESCE(t.name, j.installer_name) as technician_name
      FROM job_orders j
      LEFT JOIN customers c ON c.customer_id = j.customer_id
      LEFT JOIN technicians t ON t.tech_id = j.technician_id
      ORDER BY j.date DESC, j.created_at DESC LIMIT 6`),
    query(`SELECT
             COUNT(*) FILTER (WHERE status = 'Available') as available,
             COUNT(*) FILTER (WHERE status = 'Assigned')  as assigned,
             COUNT(*) FILTER (WHERE status = 'Faulty')    as faulty,
             COUNT(*) as total FROM trackers`),
    query(`SELECT
             COUNT(*) FILTER (WHERE status = 'Available') as available,
             COUNT(*) FILTER (WHERE status = 'Installed') as assigned,
             COUNT(*) as total FROM sims`),
    query(`SELECT COUNT(*) FROM tickets WHERE status IN ('Open','In Progress')`),
    query(`SELECT COUNT(*) FROM assets
           WHERE amc_expiry IS NOT NULL
             AND amc_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + 30`),
    query(`SELECT COUNT(*), COALESCE(SUM(balance_due),0) as total
           FROM payments WHERE status IN ('Pending','Overdue')
             AND due_date < CURRENT_DATE`),
  ]);

  const byStatus = {};
  for (const r of leadsByStatus.rows) byStatus[r.status] = Number(r.cnt);

  return {
    leads: { total: Number(leadsTotal.rows[0].count), byStatus },
    jobs: {
      total: Number(jobsTotal.rows[0].count),
      recent: jobsRecent.rows.map(j => ({
        invoiceNumber:  j.invoice_number,
        toc:            j.toc,
        date:           j.date,
        status:         j.status,
        vehicle:        [j.vehicle_make, j.vehicle_model].filter(Boolean).join(' '),
        registrationNo: j.registration_no,
        customer:       j.customer_name,
        technicianName: j.technician_name,
      })),
    },
    trackers: {
      total:     Number(trackers.rows[0].total),
      available: Number(trackers.rows[0].available),
      assigned:  Number(trackers.rows[0].assigned),
      faulty:    Number(trackers.rows[0].faulty),
    },
    sims: {
      total:     Number(sims.rows[0].total),
      available: Number(sims.rows[0].available),
      assigned:  Number(sims.rows[0].assigned),
    },
    alerts: {
      openTickets:    Number(ticketsOpen.rows[0].count),
      amcExpiring:    Number(amcExpiring.rows[0].count),
      overduePayments:Number(paymentsOverdue.rows[0].count),
      overdueAmount:  Number(paymentsOverdue.rows[0].total || 0),
    },
  };
}

/**
 * Follow-up tasks due within the next N days across all modules.
 * Filtered by assignedTo when role is not admin/management.
 */
async function getTasks({ daysAhead = 7, userId, role } = {}) {
  const limit = `CURRENT_DATE + INTERVAL '${daysAhead} days'`;
  const isAdmin = ['admin', 'management'].includes(role);

  const [tickets, leads, jobs] = await Promise.all([
    query(`
      SELECT 'ticket' as entity_type, ticket_id as entity_id, title,
             followup_date, status, priority,
             customer_name, assigned_to,
             CASE WHEN followup_date < CURRENT_DATE THEN 'overdue'
                  WHEN followup_date = CURRENT_DATE THEN 'today'
                  ELSE 'upcoming' END as urgency
      FROM tickets
      WHERE followup_date IS NOT NULL
        AND followup_date <= ${limit}
        AND status NOT IN ('Resolved','Closed')
        ${!isAdmin ? `AND (assigned_to = $1 OR assigned_to IS NULL)` : ''}
      ORDER BY followup_date ASC
      LIMIT 50`,
      !isAdmin ? [userId] : []
    ),
    query(`
      SELECT 'lead' as entity_type, lead_id as entity_id, title,
             followup_date, status, priority,
             customer_name, salesperson as assigned_to,
             CASE WHEN followup_date < CURRENT_DATE THEN 'overdue'
                  WHEN followup_date = CURRENT_DATE THEN 'today'
                  ELSE 'upcoming' END as urgency
      FROM leads
      WHERE followup_date IS NOT NULL
        AND followup_date <= ${limit}
        AND status NOT IN ('Won','Lost')
        ${!isAdmin ? `AND salesperson = $1` : ''}
      ORDER BY followup_date ASC
      LIMIT 50`,
      !isAdmin ? [userId] : []
    ),
    query(`
      SELECT 'job' as entity_type, invoice_number as entity_id,
             CONCAT(registration_no, ' — ', toc) as title,
             followup_date, status, 'Medium' as priority,
             customer_name, installer_name as assigned_to,
             CASE WHEN followup_date < CURRENT_DATE THEN 'overdue'
                  WHEN followup_date = CURRENT_DATE THEN 'today'
                  ELSE 'upcoming' END as urgency
      FROM job_orders
      WHERE followup_date IS NOT NULL
        AND followup_date <= ${limit}
        AND status NOT IN ('Completed','Cancelled')
      ORDER BY followup_date ASC
      LIMIT 50`
    ),
  ]);

  const all = [
    ...tickets.rows,
    ...leads.rows,
    ...jobs.rows,
  ].sort((a, b) => new Date(a.followup_date) - new Date(b.followup_date));

  const overdue  = all.filter(t => t.urgency === 'overdue');
  const today    = all.filter(t => t.urgency === 'today');
  const upcoming = all.filter(t => t.urgency === 'upcoming');

  return { overdue, today, upcoming, total: all.length };
}

/**
 * AMC expiry report — assets expiring within N days.
 */
async function getAmcReport(daysAhead = 30) {
  const { rows } = await query(`
    SELECT a.asset_id, a.registration_no, a.make, a.model,
           a.amc_expiry, a.package,
           c.customer_name, c.contact, c.city,
           CASE WHEN a.amc_expiry < CURRENT_DATE THEN 'expired'
                WHEN a.amc_expiry <= CURRENT_DATE + $1 THEN 'expiring'
                ELSE 'active' END as amc_status
    FROM assets a
    LEFT JOIN customers c ON c.customer_id = a.customer_id
    WHERE a.amc_expiry IS NOT NULL
      AND a.amc_expiry <= CURRENT_DATE + $1
      AND a.status = 'Active'
    ORDER BY a.amc_expiry ASC
    LIMIT 200
  `, [daysAhead]);
  return rows;
}

module.exports = { getStats, getTasks, getAmcReport };
