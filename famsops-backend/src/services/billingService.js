const { query, getClient } = require('../db');

/**
 * Resolve the applicable rate for a customer + rate type.
 * Customer override → standard rate → 0.
 */
async function resolveRate(customerId, rateType) {
  // Check customer override first
  if (customerId) {
    const { rows: ov } = await query(
      'SELECT custom_rate FROM pricing_overrides WHERE customer_id=$1 AND item_type=$2',
      [customerId, rateType]
    );
    if (ov.length) return Number(ov[0].custom_rate);
  }
  // Fall back to standard rate
  const { rows: sr } = await query(
    'SELECT amount FROM standard_rates WHERE rate_type=$1 AND is_active=TRUE',
    [rateType]
  );
  return sr.length ? Number(sr[0].amount) : 0;
}

/**
 * Build a preview of what will be billed for a given TOC.
 * Called BEFORE job completion so the user can review it.
 */
async function previewBilling(toc, customerId, registrationNo) {
  const { rows: rules } = await query(
    'SELECT * FROM toc_billing_rules WHERE toc=$1 AND is_active=TRUE',
    [toc]
  );
  if (!rules.length) return { supported: false, toc, items: [], total: 0 };

  const rule = rules[0];
  const chargeTypes = rule.charge_types || [];
  const items = [];
  let total = 0;

  for (const rateType of chargeTypes) {
    const { rows: sr } = await query(
      'SELECT label, unit FROM standard_rates WHERE rate_type=$1',
      [rateType]
    );
    const label  = sr[0]?.label || rateType;
    const unit   = sr[0]?.unit  || 'unit';
    const amount = await resolveRate(customerId, rateType);

    items.push({
      rateType,
      description: label + (registrationNo ? ` — ${registrationNo}` : ''),
      qty:    1,
      unit,
      unitPrice: amount,
      total:  amount,
      isCustomRate: await hasOverride(customerId, rateType),
    });
    total += amount;
  }

  // Monthly SaaS preview for 'create' action
  let subscriptionPreview = null;
  if (rule.subscription_action === 'create') {
    const monthlyRate = await resolveRate(customerId, 'monthly_saas');
    subscriptionPreview = {
      action:      'create',
      planName:    'Standard',
      billingCycle:'monthly',
      monthlyRate,
      note:        'A monthly subscription will be activated at PKR ' + monthlyRate.toLocaleString('en-PK') + '/vehicle/month',
    };
  } else if (rule.subscription_action === 'cancel') {
    subscriptionPreview = { action:'cancel', note:'Existing subscription will be cancelled.' };
  } else if (rule.subscription_action === 'renew') {
    subscriptionPreview = { action:'renew', note:'Subscription end date will be extended by 1 year.' };
  } else if (rule.subscription_action === 'continue') {
    subscriptionPreview = { action:'continue', note:'Existing subscription continues unchanged.' };
  } else if (rule.subscription_action === 'transfer') {
    subscriptionPreview = { action:'transfer', note:'Subscription will be transferred to the new owner/vehicle.' };
  }

  return {
    supported:           true,
    toc,
    rule: {
      subscriptionAction: rule.subscription_action,
      invoiceType:        rule.invoice_type,
      paymentDueDays:     rule.payment_due_days,
    },
    items,
    subtotal: total,
    total,
    subscriptionPreview,
    paymentDueDate: new Date(Date.now() + rule.payment_due_days * 86400000)
      .toISOString().split('T')[0],
  };
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
 * Manually trigger billing for a completed job order.
 * Used as a fallback if the DB trigger didn't fire (e.g. bulk update).
 * Safe to call multiple times — checks if invoice already exists.
 */
async function triggerBilling(invoiceNumber, userId) {
  // Check job exists and is Completed
  const { rows: jobs } = await query(
    'SELECT * FROM job_orders WHERE invoice_number=$1',
    [invoiceNumber]
  );
  if (!jobs.length)
    throw Object.assign(new Error('Job order not found'), { status: 404 });

  const job = jobs[0];
  if (job.status !== 'Completed')
    throw Object.assign(new Error('Job must be Completed before billing'), { status: 400 });

  // Check if invoice already exists for this work order
  const { rows: existing } = await query(
    'SELECT invoice_id FROM invoices WHERE work_order_id=$1',
    [invoiceNumber]
  );
  if (existing.length)
    return { alreadyBilled: true, invoiceId: existing[0].invoice_id };

  // Get billing rule
  const { rows: rules } = await query(
    'SELECT * FROM toc_billing_rules WHERE toc=$1 AND is_active=TRUE',
    [job.toc]
  );
  if (!rules.length)
    return { supported: false, message: `No billing rule for TOC: ${job.toc}` };

  const rule        = rules[0];
  const chargeTypes = rule.charge_types || [];
  const client      = await getClient();

  try {
    await client.query('BEGIN');

    // Invoice ID
    const { rows: seqRow } = await client.query("SELECT nextval('seq_invoice') AS n");
    const invId    = 'INV-' + String(seqRow[0].n).padStart(6, '0');
    const dueDate  = new Date(Date.now() + rule.payment_due_days * 86400000)
      .toISOString().split('T')[0];

    // Create invoice header
    await client.query(`
      INSERT INTO invoices (
        invoice_id, status, type,
        customer_id, customer_name, contact,
        work_order_id, issue_date, due_date,
        subtotal, total, currency, notes, created_by
      ) VALUES ($1,'Draft',$2,$3,$4,$5,$6,CURRENT_DATE,$7,0,0,'PKR',$8,$9)
    `, [invId, rule.invoice_type,
        job.customer_id, job.customer_name, job.contact,
        job.work_order_id || null, dueDate,
        `Auto-generated — Job: ${invoiceNumber} (${job.toc})`,
        userId || job.created_by || 'system']);

    // Line items
    let subtotal = 0;
    let sort     = 0;
    for (const rateType of chargeTypes) {
      const amount = await resolveRate(job.customer_id, rateType);
      const { rows: sr } = await query(
        'SELECT label, unit FROM standard_rates WHERE rate_type=$1', [rateType]
      );
      const label = (sr[0]?.label || rateType)
        + (job.registration_no ? ` — ${job.registration_no}` : '');

      await client.query(`
        INSERT INTO invoice_items (invoice_id, sort_order, description, qty, unit, unit_price)
        VALUES ($1,$2,$3,1,$4,$5)
      `, [invId, sort, label, sr[0]?.unit || 'vehicle', amount]);

      subtotal += amount;
      sort++;
    }

    // Update totals
    await client.query(
      'UPDATE invoices SET subtotal=$2, total=$2 WHERE invoice_id=$1',
      [invId, subtotal]
    );

    // Subscription handling
    let subId = null;
    if (rule.subscription_action === 'create') {
      const subRate = await resolveRate(job.customer_id, 'monthly_saas');
      const { rows: subSeq } = await client.query("SELECT nextval('seq_sub') AS n");
      subId = 'SUB-' + String(subSeq[0].n).padStart(6, '0');

      const nextBill = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      await client.query(`
        INSERT INTO subscriptions (
          subscription_id, status, customer_id, customer_name,
          asset_id, work_order_id,
          plan_name, billing_cycle,
          rate_per_vehicle, vehicle_count,
          start_date, next_billing_date,
          auto_renew, created_by
        ) VALUES ($1,'Active',$2,$3,$4,$5,$6,'monthly',$7,1,CURRENT_DATE,$8,TRUE,$9)
      `, [subId,
          job.customer_id, job.customer_name,
          'AST-' + invoiceNumber, job.work_order_id || null,
          job.package || 'Standard',
          subRate, nextBill,
          userId || job.created_by || 'system']);

      await client.query(
        'UPDATE invoices SET subscription_id=$2 WHERE invoice_id=$1',
        [invId, subId]
      );

    } else if (rule.subscription_action === 'cancel') {
      await client.query(`
        UPDATE subscriptions
        SET status='Cancelled', cancelled_at=NOW(),
            cancel_reason='Auto-cancelled via job: ' || $1
        WHERE asset_id=$2 AND customer_id=$3 AND status IN ('Active','Pending')
      `, [invoiceNumber, 'AST-' + invoiceNumber, job.customer_id]);

    } else if (rule.subscription_action === 'renew') {
      await client.query(`
        UPDATE subscriptions
        SET end_date=COALESCE(end_date, CURRENT_DATE) + INTERVAL '1 year',
            last_billed_date=CURRENT_DATE,
            next_billing_date=CURRENT_DATE + INTERVAL '1 year'
        WHERE asset_id=$1 AND customer_id=$2 AND status='Active'
      `, ['AST-' + invoiceNumber, job.customer_id]);
    }

    await client.query('COMMIT');

    return {
      success:       true,
      invoiceId:     invId,
      subscriptionId:subId,
      subtotal,
      lineItems:     chargeTypes.length,
      subscriptionAction: rule.subscription_action,
    };

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

module.exports = { previewBilling, triggerBilling, resolveRate, getRatesWithOverrides };
