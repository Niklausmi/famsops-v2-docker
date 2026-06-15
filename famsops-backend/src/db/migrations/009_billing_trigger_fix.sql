-- ============================================================
-- Famsops — Migration 009: Billing trigger fix
-- Problems fixed:
--   1. Trigger fired on every UPDATE of a Completed job —
--      now guarded by checking invoice already exists
--   2. Add UNIQUE constraint on invoices(work_order_id) so
--      ON CONFLICT can prevent duplicate invoices
--   3. Trigger now uses EXISTS check instead of relying on
--      status transition alone
-- ============================================================

-- ── Guard: unique invoice per job order ───────────────────────
-- Prevents the trigger from creating a second invoice if the
-- job is updated after being marked Completed
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_work_order_unique
  ON invoices (work_order_id)
  WHERE work_order_id IS NOT NULL;

-- ── Drop and recreate the trigger function with proper guard ──
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
  -- ── Guard 1: only on transition TO Completed ─────────────
  IF NEW.status <> 'Completed' THEN RETURN NEW; END IF;
  IF OLD.status = 'Completed'  THEN RETURN NEW; END IF;

  -- ── Guard 2: skip if invoice already exists for this job ──
  IF EXISTS (
    SELECT 1 FROM invoices WHERE work_order_id = NEW.invoice_number
  ) THEN
    RETURN NEW;
  END IF;

  -- ── Guard 3: customer must be set ─────────────────────────
  IF NEW.customer_id IS NULL THEN RETURN NEW; END IF;

  -- Load billing rule
  SELECT * INTO v_rule
  FROM toc_billing_rules
  WHERE toc = NEW.toc AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- ── Create invoice ─────────────────────────────────────────
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
    NEW.invoice_number,
    CURRENT_DATE, v_due,
    0, 0, 'PKR',
    'Auto-generated — Job: ' || NEW.invoice_number || ' (' || NEW.toc || ')',
    COALESCE(NEW.created_by, 'system')
  );

  -- ── Insert line items ──────────────────────────────────────
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

  -- ── Update invoice totals ──────────────────────────────────
  UPDATE invoices
  SET subtotal = v_subtotal, total = v_subtotal
  WHERE invoice_id = v_inv_id;

  -- ── Handle subscription ────────────────────────────────────
  CASE v_rule.subscription_action

    WHEN 'create' THEN
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
        'AST-' || NEW.invoice_number, NEW.invoice_number,
        COALESCE(NEW.package, 'Standard'), 'monthly',
        v_sub_rate, 1,
        CURRENT_DATE, v_next_bill,
        TRUE, COALESCE(NEW.created_by, 'system')
      );

      UPDATE invoices SET subscription_id = v_sub_id WHERE invoice_id = v_inv_id;

    WHEN 'cancel' THEN
      UPDATE subscriptions
      SET status       = 'Cancelled',
          cancelled_at = NOW(),
          cancel_reason = 'Auto-cancelled via job: ' || NEW.invoice_number
      WHERE asset_id    = 'AST-' || NEW.invoice_number
        AND customer_id = NEW.customer_id
        AND status IN ('Active','Pending');

    WHEN 'renew' THEN
      UPDATE subscriptions
      SET end_date          = COALESCE(end_date, CURRENT_DATE) + INTERVAL '1 year',
          last_billed_date  = CURRENT_DATE,
          next_billing_date = CURRENT_DATE + INTERVAL '1 year'
      WHERE asset_id    = 'AST-' || NEW.invoice_number
        AND customer_id = NEW.customer_id
        AND status      = 'Active';

    ELSE NULL;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger and recreate
DROP TRIGGER IF EXISTS job_order_auto_billing ON job_orders;

CREATE TRIGGER job_order_auto_billing
  AFTER UPDATE ON job_orders
  FOR EACH ROW
  WHEN (NEW.status = 'Completed' AND OLD.status IS DISTINCT FROM 'Completed')
  EXECUTE FUNCTION auto_billing_on_completion();
