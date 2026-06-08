const { query } = require('../db');

/**
 * Pricing Override Service
 * Handles custom customer-specific rates for services, hardware, and subscriptions
 */

const toJson = (r) => ({
  id:         r.id,
  customerId: r.customer_id,
  itemType:   r.item_type,
  customRate: Number(r.custom_rate),
  notes:      r.notes,
  createdAt:  r.created_at,
  updatedAt:  r.updated_at,
});

/**
 * Get the applicable rate for a customer and item type
 * Returns custom_rate if override exists, otherwise returns the standardRate provided
 */
async function getRate(customerId, itemType, standardRate) {
  if (!customerId) return Number(standardRate);

  const { rows } = await query(
    'SELECT custom_rate FROM pricing_overrides WHERE customer_id = $1 AND item_type = $2',
    [customerId, itemType]
  );

  if (rows.length > 0) {
    return Number(rows[0].custom_rate);
  }

  return Number(standardRate);
}

async function listByCustomer(customerId) {
  const { rows } = await query(
    'SELECT * FROM pricing_overrides WHERE customer_id = $1 ORDER BY item_type ASC',
    [customerId]
  );
  return rows.map(toJson);
}

async function upsertOverride(data) {
  const { rows } = await query(`
    INSERT INTO pricing_overrides (customer_id, item_type, custom_rate, notes)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (customer_id, item_type) DO UPDATE SET
      custom_rate = EXCLUDED.custom_rate,
      notes       = EXCLUDED.notes,
      updated_at  = NOW()
    RETURNING *
  `, [data.customerId, data.itemType, data.customRate, data.notes || null]);

  return toJson(rows[0]);
}

async function removeOverride(customerId, itemType) {
  await query(
    'DELETE FROM pricing_overrides WHERE customer_id = $1 AND item_type = $2',
    [customerId, itemType]
  );
  return true;
}

module.exports = {
  getRate,
  listByCustomer,
  upsertOverride,
  removeOverride
};
