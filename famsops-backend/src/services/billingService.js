const { query, getClient } = require('../db');

/**
 * Rate resolution priority:
 *   1. Job-level manual override (price_overrides JSONB on job_order)
 *   2. Customer pricing override (pricing_overrides table)
 *   3. Standard rate (standard_rates table)
 *   4. Zero (triggers warning in preview)
 */
async function resolveRateForJob(customerId, rateType, jobOverrides) {
  // 1. Job-level override
  if (jobOverrides && jobOverrides[rateType] != null) {
    return Number(jobOverrides[rateType]);
  }
  // 2. Customer override
  if (customerId) {
    const { rows } = await query(
      'SELECT custom_rate FROM pricing_overrides WHERE customer_id=$1 AND item_type=$2',
      [customerId, rateType]
    );
    if (rows.length) return Number(rows[0].custom_rate);
  }
  // 3. Standard rate
  const { rows } = await query(
    'SELECT amount FROM standard_rates WHERE rate_type=$1 AND is_active=TRUE',
    [rateType]
  );
  return rows.length ? Number(rows[0].amount) : 0;
}

// Backwards compat alias
async function resolveRate(customerId, rateType) {
  return resolveRateForJob(customerId, rateType, null);
}

async function hasOverride(customerId, rateType) {
  if (!customerId) return false;
  const { rows } = await query(
    'SELECT 1 FROM pricing_overrides WHERE customer_id=$1 AND item_type=$2',
    [customerId, rateType]
  );
  return rows.length > 0;
}

/**
 * Preview what will be billed for a given TOC.
 * Accepts optional jobOverrides so the form can show live preview
 * as the user edits manual prices.
 */
async function previewBilling(toc, customerId, registrationNo, jobOverrides) {
  const { rows: rules } = await query(
    'SELECT * FROM toc_billing_rules WHERE toc=$1 AND is_active=TRUE',
    [toc]
  );
  if (!rules.length) return { supported: false, toc, items: [], total: 0 };

  const rule        = rules[0];
  const chargeTypes = rule.charge_types || [];
  const items       = [];
  let   total       = 0;

  for (const rateType of chargeTypes) {
    const { rows: sr } = await query(
      'SELECT label, unit FROM standard_rates WHERE rate_type=$1', [rateType]
    );
    const label        = sr[0]?.label || rateType;
    const unit         = sr[0]?.unit  || 'unit';
    const standardRate = await resolveRate(customerId, rateType);
    const effectiveRate= await resolveRateForJob(customerId, rateType, jobOverrides);
    const isJobOverride    = jobOverrides && jobOverrides[rateType] != null;
    const isCustomerOverride = !isJobOverride && await hasOverride(customerId, rateType);

    items.push({
      rateType,
      description:    label + (registrationNo ? ` — ${registrationNo}` : ''),
      qty:            1,
      unit,
      standardRate,
      unitPrice:      effectiveRate,
      total:          effectiveRate,
      isJobOverride,
      isCustomerOverride,
      overrideLabel:  isJobOverride     ? 'JOB OVERRIDE'
                    : isCustomerOverride ? 'CUSTOMER RATE' : null,
    });
    total += effectiveRate;
  }

  // Monthly SaaS preview for subscription create
  let subscriptionPreview = null;
  const subActionLabels = {
    create:   'New subscription will be created',
    continue: 'Existing subscription continues',
    cancel:   'Subscription will be cancelled',
    renew:    'Subscription extended +1 year',
    transfer: 'Subscription will be transferred',
    none:     'No subscription change',
  };

  if (rule.subscription_action === 'create') {
    const monthlyRate = await resolveRateForJob(customerId, 'monthly_saas', jobOverrides);
    subscriptionPreview = {
      action: 'create',
      monthlyRate,
      note: `Monthly subscription activated at PKR ${monthlyRate.toLocaleString('en-PK')}/vehicle/month`,
    };
  } else {
    subscriptionPreview = {
      action: rule.subscription_action,
      note:   subActionLabels[rule.subscription_action] || 'No change',
    };
  }

  return {
    supported:     true,
    toc,
    rule: {
      subscriptionAction: rule.subscription_action,
      invoiceType:        rule.invoice_type,
      paymentDueDays:     rule.payment_due_days,
    },
    items,
    subtotal:      total,
    total,
    subscriptionPreview,
    paymentDueDate: new Date(Date.now() + rule.payment_due_days * 86400000)
      .toISOString().split('T')[0],
  };
}

/**
 * Manually trigger billing for a completed job.
 * Safe — skips if invoice already exists.
 * Respects job.price_overrides JSONB.
 */
async function triggerBilling(invoiceNumber, userId) {
  const { rows: jobs } = await query(
    'SELECT * FROM job_orders WHERE invoice_number=$1', [invoiceNumber]
  );
  if (!jobs.length)
    throw Object.assign(new Error('Job order not found'), { status: 404 });

  const job = jobs[0];
  if (job.status !== 'Completed')
    throw Object.assign(new Error('Job must be Completed before billing'), { status: 400 });

  // Skip if already billed
  const { rows: existing } = await query(
    'SELECT invoice_id FROM invoices WHERE work_order_id=$1', [invoiceNumber]
  );
  if (existing.length)
    return { alreadyBilled: true, invoiceId: existing[0].invoice_id };

  const { rows: rules } = await query(
    'SELECT * FROM toc_billing_rules WHERE toc=$1 AND is_active=TRUE', [job.toc]
  );
  if (!rules.length)
    return { supported: false, message: `No billing rule for TOC: ${job.toc}` };

  const rule        = rules[0];
  const chargeTypes = rule.charge_types || [];
  const jobOverrides= job.price_overrides || null;
  const client      = await getClient();

  try {
    await client.query('BEGIN');

    const { rows: seqRow } = await client.query("SELECT nextval('seq_invoice') AS n");
    const invId   = 'INV-' + String(seqRow[0].n).padStart(6, '0');
    const dueDate = new Date(Date.now() + rule.payment_due_days * 86400000)
      .toISOString().split('T')[0];

    await client.query(`
      INSERT INTO invoices (
        invoice_id, status, type,
        customer_id, customer_name, contact,
        work_order_id, issue_date, due_date,
        subtotal, total, currency, notes, created_by
      ) VALUES ($1,'Draft',$2,$3,$4,$5,$6,CURRENT_DATE,$7,0,0,'PKR',$8,$9)
    `, [invId, rule.invoice_type,
        job.customer_id, job.customer_name, job.contact,
        invoiceNumber, dueDate,
        `Auto-generated — Job: ${invoiceNumber} (${job.toc})`
          + (jobOverrides ? ' [custom rates applied]' : ''),
        userId || job.created_by || 'system']);

    let subtotal = 0;
    let sort     = 0;

    for (const rateType of chargeTypes) {
      const amount = await resolveRateForJob(job.customer_id, rateType, jobOverrides);
      const { rows: sr } = await query(
        'SELECT label, unit FROM standard_rates WHERE rate_type=$1', [rateType]
      );
      const isOverridden = jobOverrides && jobOverrides[rateType] != null;
      const label = (sr[0]?.label || rateType)
        + (job.registration_no ? ` — ${job.registration_no}` : '')
        + (isOverridden ? ' *' : '');

      await client.query(`
        INSERT INTO invoice_items (invoice_id, sort_order, description, qty, unit, unit_price)
        VALUES ($1,$2,$3,1,$4,$5)
      `, [invId, sort, label, sr[0]?.unit || 'vehicle', amount]);

      subtotal += amount;
      sort++;
    }

    // Add lead reference line if amount differs from calculated total
    if (job.amount && Number(job.amount) > 0 &&
        Number(job.amount) !== subtotal && job.lead_id) {
      await client.query(`
        INSERT INTO invoice_items (invoice_id, sort_order, description, qty, unit, unit_price)
        VALUES ($1,$2,$3,1,'reference',$4)
      `, [invId, sort,
          `Agreed amount from lead ${job.lead_id} (reconcile with items above)`,
          job.amount]);
      sort++;
    }

    await client.query(
      'UPDATE invoices SET subtotal=$2, total=$2 WHERE invoice_id=$1',
      [invId, subtotal]
    );

    let subId = null;

    if (rule.subscription_action === 'create') {
      const subRate = await resolveRateForJob(job.customer_id, 'monthly_saas', jobOverrides);
      const { rows: subSeq } = await client.query("SELECT nextval('seq_sub') AS n");
      subId = 'SUB-' + String(subSeq[0].n).padStart(6, '0');
      const nextBill = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      await client.query(`
        INSERT INTO subscriptions (
          subscription_id, status, customer_id, customer_name,
          asset_id, work_order_id, plan_name, billing_cycle,
          rate_per_vehicle, vehicle_count, start_date, next_billing_date,
          auto_renew, created_by
        ) VALUES ($1,'Active',$2,$3,$4,$5,$6,'monthly',$7,1,CURRENT_DATE,$8,TRUE,$9)
      `, [subId, job.customer_id, job.customer_name,
          'AST-' + invoiceNumber, invoiceNumber,
          job.package || 'Standard', subRate, nextBill,
          userId || job.created_by || 'system']);

      await client.query(
        'UPDATE invoices SET subscription_id=$2 WHERE invoice_id=$1', [invId, subId]
      );

    } else if (rule.subscription_action === 'cancel') {
      await client.query(`
        UPDATE subscriptions SET status='Cancelled', cancelled_at=NOW(),
          cancel_reason='Auto-cancelled via job: '||$1
        WHERE asset_id=$2 AND customer_id=$3 AND status IN ('Active','Pending')
      `, [invoiceNumber, 'AST-' + invoiceNumber, job.customer_id]);

    } else if (rule.subscription_action === 'renew') {
      await client.query(`
        UPDATE subscriptions
        SET end_date=COALESCE(end_date,CURRENT_DATE)+INTERVAL '1 year',
            last_billed_date=CURRENT_DATE,
            next_billing_date=CURRENT_DATE+INTERVAL '1 year'
        WHERE asset_id=$1 AND customer_id=$2 AND status='Active'
      `, ['AST-' + invoiceNumber, job.customer_id]);
    }

    await client.query('COMMIT');
    return { success: true, invoiceId: invId, subscriptionId: subId, subtotal, sort };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get all standard rates with customer override status.
 */
async function getRatesWithOverrides(customerId) {
  const { rows: rates } = await query(
    'SELECT * FROM standard_rates ORDER BY rate_type ASC'
  );
  let overrides = {};
  if (customerId) {
    const { rows: ov } = await query(
      'SELECT item_type, custom_rate, notes FROM pricing_overrides WHERE customer_id=$1',
      [customerId]
    );
    ov.forEach(o => { overrides[o.item_type] = { rate: Number(o.custom_rate), notes: o.notes }; });
  }
  return rates.map(r => ({
    rateType:     r.rate_type,
    label:        r.label,
    standardRate: Number(r.amount),
    unit:         r.unit,
    description:  r.description,
    isActive:     r.is_active,
    override:     overrides[r.rate_type] || null,
    effectiveRate:overrides[r.rate_type]
      ? Number(overrides[r.rate_type].rate)
      : Number(r.amount),
  }));
}

module.exports = {
  previewBilling,
  triggerBilling,
  resolveRate,
  resolveRateForJob,
  getRatesWithOverrides,
};
