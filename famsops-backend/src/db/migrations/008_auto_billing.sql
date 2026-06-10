-- ============================================================
-- Famsops — Migration 008: Automated Billing
-- Adds standard_rates, toc_billing_rules, auto-billing trigger
-- ============================================================

-- ── Standard Rates ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS standard_rates (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_type   TEXT          UNIQUE NOT NULL,
  label       TEXT          NOT NULL,
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit        TEXT          NOT NULL DEFAULT 'unit',
  description TEXT,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER standard_rates_updated_at
  BEFORE UPDATE ON standard_rates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── TOC Billing Rules ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS toc_billing_rules (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  toc                 TEXT    UNIQUE NOT NULL,
  charge_types        JSONB   NOT NULL DEFAULT '[]',
  subscription_action TEXT    NOT NULL DEFAULT 'none'
    CHECK (subscription_action IN ('create','continue','cancel','transfer','renew','none')),
  invoice_type        TEXT    NOT NULL DEFAULT 'one_time'
    CHECK (invoice_type IN ('one_time','recurring','renewal')),
  payment_due_days    INT     NOT NULL DEFAULT 7,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  notes               TEXT
);

-- ── Seed: Standard Rates ─────────────────────────────────────
INSERT INTO standard_rates (rate_type, label, amount, unit, description) VALUES
  ('installation_fee',   'Installation Fee',        3500, 'vehicle', 'Labour per vehicle installation'),
  ('hardware_unit',      'Tracker Hardware',        5500, 'unit',    'GPS tracker device'),
  ('sim_card',           'SIM Card',                 500, 'unit',    'SIM card supply'),
  ('monthly_saas',       'Monthly SaaS Fee',        1200, 'vehicle', 'Monthly platform fee per vehicle'),
  ('annual_amc',         'Annual AMC',              9000, 'vehicle', 'Annual maintenance contract'),
  ('replacement_fee',    'Replacement Fee',         2500, 'vehicle', 'Device replacement labour'),
  ('reinstallation_fee', 'Reinstallation Fee',      2000, 'vehicle', 'Remove and reinstall labour'),
  ('removal_fee',        'Removal Fee',             1500, 'vehicle', 'Device removal labour'),
  ('transfer_fee',       'Transfer Fee',            1000, 'vehicle', 'Vehicle/ownership transfer'),
  ('inspection_fee',     'Inspection Fee',          1500, 'visit',   'AMC visit / inspection'),
  ('hardware_replacement','Hardware Replacement',   5500, 'unit',    'Replacement tracker unit')
ON CONFLICT (rate_type) DO NOTHING;

-- ── Seed: TOC Billing Rules ───────────────────────────────────
INSERT INTO toc_billing_rules (toc, charge_types, subscription_action, invoice_type, payment_due_days, notes)
VALUES
  ('New Installation',
   '["installation_fee","hardware_unit","sim_card"]',
   'create', 'one_time', 7,
   'Installation + hardware + SIM. Creates monthly subscription.'),

  ('Replacement',
   '["replacement_fee","hardware_replacement"]',
   'continue', 'one_time', 7,
   'Replacement labour + hardware. Existing subscription continues.'),

  ('Reinstallation',
   '["reinstallation_fee"]',
   'continue', 'one_time', 7,
   'Labour only. Subscription continues.'),

  ('Removal',
   '["removal_fee"]',
   'cancel', 'one_time', 7,
   'Removal fee. Subscription cancelled.'),

  ('Vehicle Transfer',
   '["transfer_fee"]',
   'transfer', 'one_time', 7,
   'Transfer fee. Subscription moves to new vehicle.'),

  ('Ownership Transfer',
   '["transfer_fee"]',
   'transfer', 'one_time', 7,
   'Transfer fee. Subscription moves to new owner.'),

  ('Inspection',
   '["inspection_fee"]',
   'none', 'one_time', 7,
   'Visit fee only. No subscription change.')
ON CONFLICT (toc) DO NOTHING;

-- ── Helper: resolve rate for a customer + type ─────────────────
-- Returns custom override if set, else standard rate, else 0
CREATE OR REPLACE FUNCTION resolve_rate(p_customer_id TEXT, p_rate_type TEXT)
RETURNS NUMERIC AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  -- Customer override first
  SELECT custom_rate INTO v_rate
  FROM pricing_overrides
  WHERE customer_id = p_customer_id AND item_type = p_rate_type
  LIMIT 1;

  IF v_rate IS NOT NULL THEN RETURN v_rate; END IF;

  -- Fall back to standard rate
  SELECT amount INTO v_rate
  FROM standard_rates
  WHERE rate_type = p_rate_type AND is_active = TRUE
  LIMIT 1;

  RETURN COALESCE(v_rate, 0);
END;
$$ LANGUAGE plpgsql;

-- ── Helper: get label for a rate type ────────────────────────
CREATE OR REPLACE FUNCTION rate_label(p_rate_type TEXT)
RETURNS TEXT AS $$
  SELECT COALESCE(label, p_rate_type)
  FROM standard_rates WHERE rate_type = p_rate_type LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ── Auto-billing trigger function ─────────────────────────────
CREATE OR REPLACE FUNCTION auto_billing_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_rule        RECORD;
  v_rate_type   TEXT;
  v_rate        NUMERIC;
  v_label       TEXT;
  v_inv_id      TEXT;
  v_sub_id      TEXT;
  v_sub_rate    NUMERIC;
  v_subtotal    NUMERIC := 0;
  v_sort        INT     := 0;
  v_due         DATE;
  v_next_bill   DATE;
BEGIN
  -- Guard: only on Completed transition, customer must be set
  IF NEW.customer_id IS NULL THEN RETURN NEW; END IF;

  -- Load billing rule
  SELECT * INTO v_rule
  FROM toc_billing_rules
  WHERE toc = NEW.toc AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- ── Create invoice ──────────────────────────────────────
  v_inv_id  := 'INV-' || LPAD(nextval('seq_invoice')::TEXT, 6, '0');
  v_due     := CURRENT_DATE + v_rule.payment_due_days;

  INSERT INTO invoices (
    invoice_id, status, type,
    customer_id, customer_name, contact,
    work_order_id,
    issue_date, due_date,
    subtotal, total, currency,
    notes, created_by
  ) VALUES (
    v_inv_id, 'Draft', v_rule.invoice_type,
    NEW.customer_id, NEW.customer_name, NEW.contact,
    NEW.work_order_id,
    CURRENT_DATE, v_due,
    0, 0, 'PKR',
    'Auto-generated — Job: ' || NEW.invoice_number || ' (' || NEW.toc || ')',
    COALESCE(NEW.created_by, 'system')
  );

  -- ── Insert line items ───────────────────────────────────
  FOR v_rate_type IN
    SELECT jsonb_array_elements_text(v_rule.charge_types)
  LOOP
    v_rate  := resolve_rate(NEW.customer_id, v_rate_type);
    v_label := COALESCE(rate_label(v_rate_type), v_rate_type);

    INSERT INTO invoice_items (
      invoice_id, sort_order, description, qty, unit, unit_price
    ) VALUES (
      v_inv_id, v_sort,
      v_label || CASE WHEN NEW.registration_no IS NOT NULL
                 THEN ' — ' || NEW.registration_no ELSE '' END,
      1, 'vehicle', v_rate
    );

    v_subtotal := v_subtotal + v_rate;
    v_sort     := v_sort + 1;
  END LOOP;

  -- ── Update invoice totals ───────────────────────────────
  UPDATE invoices
  SET subtotal = v_subtotal, total = v_subtotal
  WHERE invoice_id = v_inv_id;

  -- ── Handle subscription ─────────────────────────────────
  IF v_rule.subscription_action = 'create' THEN
    v_sub_rate  := resolve_rate(NEW.customer_id, 'monthly_saas');
    v_next_bill := CURRENT_DATE + 30;
    v_sub_id    := 'SUB-' || LPAD(nextval('seq_sub')::TEXT, 6, '0');

    INSERT INTO subscriptions (
      subscription_id, status,
      customer_id, customer_name,
      asset_id, work_order_id,
      plan_name, billing_cycle,
      rate_per_vehicle, vehicle_count,
      start_date, next_billing_date,
      auto_renew, created_by
    ) VALUES (
      v_sub_id, 'Active',
      NEW.customer_id, NEW.customer_name,
      'AST-' || NEW.invoice_number, NEW.work_order_id,
      COALESCE(NEW.package, 'Standard'), 'monthly',
      v_sub_rate, 1,
      CURRENT_DATE, v_next_bill,
      TRUE, COALESCE(NEW.created_by, 'system')
    );

    UPDATE invoices SET subscription_id = v_sub_id WHERE invoice_id = v_inv_id;

  ELSIF v_rule.subscription_action = 'cancel' THEN
    UPDATE subscriptions
    SET status       = 'Cancelled',
        cancelled_at = NOW(),
        cancel_reason = 'Auto-cancelled via job: ' || NEW.invoice_number
    WHERE asset_id    = 'AST-' || NEW.invoice_number
      AND customer_id = NEW.customer_id
      AND status IN ('Active','Pending');

  ELSIF v_rule.subscription_action = 'renew' THEN
    UPDATE subscriptions
    SET end_date          = COALESCE(end_date, CURRENT_DATE) + INTERVAL '1 year',
        last_billed_date  = CURRENT_DATE,
        next_billing_date = CURRENT_DATE + INTERVAL '1 year'
    WHERE asset_id    = 'AST-' || NEW.invoice_number
      AND customer_id = NEW.customer_id
      AND status      = 'Active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_order_auto_billing ON job_orders;
CREATE TRIGGER job_order_auto_billing
  AFTER UPDATE ON job_orders
  FOR EACH ROW
  WHEN (NEW.status = 'Completed' AND OLD.status IS DISTINCT FROM 'Completed')
  EXECUTE FUNCTION auto_billing_on_completion();
