-- ============================================================
-- Famsops — Migration 010: Job order price overrides
-- Adds price_overrides JSONB column to job_orders so per-job
-- manual pricing can be stored and used during auto-billing.
-- Format: {"installation_fee": 3000, "hardware_unit": 5000}
-- ============================================================

ALTER TABLE job_orders
  ADD COLUMN IF NOT EXISTS price_overrides JSONB DEFAULT NULL;

COMMENT ON COLUMN job_orders.price_overrides IS
  'Per-job manual rate overrides. Keys are rate_type strings, '
  'values are PKR amounts. Overrides both standard_rates and '
  'pricing_overrides tables for this specific job only.';

-- Update the billing trigger to respect job-level overrides
CREATE OR REPLACE FUNCTION resolve_rate_for_job(
  p_customer_id    TEXT,
  p_rate_type      TEXT,
  p_job_overrides  JSONB
)
RETURNS NUMERIC AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  -- Priority 1: job-level manual override
  IF p_job_overrides IS NOT NULL
     AND p_job_overrides ? p_rate_type THEN
    RETURN (p_job_overrides ->> p_rate_type)::NUMERIC;
  END IF;

  -- Priority 2: customer pricing override
  IF p_customer_id IS NOT NULL THEN
    SELECT custom_rate INTO v_rate
    FROM pricing_overrides
    WHERE customer_id = p_customer_id
      AND item_type   = p_rate_type
    LIMIT 1;
    IF FOUND THEN RETURN v_rate; END IF;
  END IF;

  -- Priority 3: standard rate
  SELECT amount INTO v_rate
  FROM standard_rates
  WHERE rate_type = p_rate_type AND is_active = TRUE
  LIMIT 1;

  RETURN COALESCE(v_rate, 0);
END;
$$ LANGUAGE plpgsql;

-- ── Recreate billing trigger using job-level override function ──
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
  IF NEW.status <> 'Completed' THEN RETURN NEW; END IF;
  IF OLD.status = 'Completed'  THEN RETURN NEW; END IF;

  -- Guard: skip if invoice already exists
  IF EXISTS (SELECT 1 FROM invoices WHERE work_order_id = NEW.invoice_number) THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_rule
  FROM toc_billing_rules
  WHERE toc = NEW.toc AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Create invoice
  v_inv_id := 'INV-' || LPAD(nextval('seq_invoice')::TEXT, 6, '0');
  v_due    := CURRENT_DATE + v_rule.payment_due_days;

  INSERT INTO invoices (
    invoice_id, status, type,
    customer_id, customer_name, contact,
    work_order_id, issue_date, due_date,
    subtotal, total, currency, notes, created_by
  ) VALUES (
    v_inv_id, 'Draft', v_rule.invoice_type,
    NEW.customer_id, NEW.customer_name, NEW.contact,
    NEW.invoice_number, CURRENT_DATE, v_due,
    0, 0, 'PKR',
    'Auto-generated — Job: ' || NEW.invoice_number || ' (' || NEW.toc || ')'
      || CASE WHEN NEW.price_overrides IS NOT NULL
         THEN ' [custom rates applied]' ELSE '' END,
    COALESCE(NEW.created_by, 'system')
  );

  -- Line items — uses job override → customer override → standard rate
  FOR v_rate_type IN
    SELECT jsonb_array_elements_text(v_rule.charge_types)
  LOOP
    v_rate  := resolve_rate_for_job(NEW.customer_id, v_rate_type, NEW.price_overrides);
    v_label := COALESCE(rate_label(v_rate_type), v_rate_type);

    INSERT INTO invoice_items (
      invoice_id, sort_order, description, qty, unit, unit_price
    ) VALUES (
      v_inv_id, v_sort,
      v_label
        || CASE WHEN NEW.registration_no IS NOT NULL
           THEN ' — ' || NEW.registration_no ELSE '' END
        || CASE WHEN NEW.price_overrides IS NOT NULL
              AND NEW.price_overrides ? v_rate_type
           THEN ' *' ELSE '' END,
      1, 'vehicle', v_rate
    );

    v_subtotal := v_subtotal + v_rate;
    v_sort     := v_sort + 1;
  END LOOP;

  -- Also add lead amount as a separate line if it differs from sum
  -- (accounts can review and reconcile)
  IF NEW.amount IS NOT NULL
     AND NEW.amount > 0
     AND NEW.amount <> v_subtotal
     AND NEW.lead_id IS NOT NULL THEN
    INSERT INTO invoice_items (
      invoice_id, sort_order, description, qty, unit, unit_price
    ) VALUES (
      v_inv_id, v_sort,
      'Agreed amount from lead ' || NEW.lead_id || ' (reconcile with line items above)',
      1, 'reference', NEW.amount
    );
    v_sort := v_sort + 1;
  END IF;

  UPDATE invoices SET subtotal = v_subtotal, total = v_subtotal
  WHERE invoice_id = v_inv_id;

  -- Subscription handling
  CASE v_rule.subscription_action
    WHEN 'create' THEN
      v_sub_rate  := resolve_rate_for_job(NEW.customer_id, 'monthly_saas', NEW.price_overrides);
      v_next_bill := CURRENT_DATE + 30;
      v_sub_id    := 'SUB-' || LPAD(nextval('seq_sub')::TEXT, 6, '0');

      INSERT INTO subscriptions (
        subscription_id, status, customer_id, customer_name,
        asset_id, work_order_id, plan_name, billing_cycle,
        rate_per_vehicle, vehicle_count, start_date, next_billing_date,
        auto_renew, created_by
      ) VALUES (
        v_sub_id, 'Active', NEW.customer_id, NEW.customer_name,
        'AST-' || NEW.invoice_number, NEW.invoice_number,
        COALESCE(NEW.package, 'Standard'), 'monthly',
        v_sub_rate, 1, CURRENT_DATE, v_next_bill,
        TRUE, COALESCE(NEW.created_by, 'system')
      );

      UPDATE invoices SET subscription_id = v_sub_id WHERE invoice_id = v_inv_id;

    WHEN 'cancel' THEN
      UPDATE subscriptions
      SET status = 'Cancelled', cancelled_at = NOW(),
          cancel_reason = 'Auto-cancelled via job: ' || NEW.invoice_number
      WHERE asset_id = 'AST-' || NEW.invoice_number
        AND customer_id = NEW.customer_id
        AND status IN ('Active','Pending');

    WHEN 'renew' THEN
      UPDATE subscriptions
      SET end_date = COALESCE(end_date, CURRENT_DATE) + INTERVAL '1 year',
          last_billed_date = CURRENT_DATE,
          next_billing_date = CURRENT_DATE + INTERVAL '1 year'
      WHERE asset_id = 'AST-' || NEW.invoice_number
        AND customer_id = NEW.customer_id
        AND status = 'Active';

    ELSE NULL;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_order_auto_billing ON job_orders;
CREATE TRIGGER job_order_auto_billing
  AFTER UPDATE ON job_orders
  FOR EACH ROW
  WHEN (NEW.status = 'Completed' AND OLD.status IS DISTINCT FROM 'Completed')
  EXECUTE FUNCTION auto_billing_on_completion();
