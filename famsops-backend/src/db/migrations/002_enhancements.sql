-- ============================================================
-- Famsops v2 — Migration 002
-- Fixes:
--   1. total_jobs → computed via trigger (drop manual counter)
--   2. Remove type='Lead' from tickets (tickets = Query|Complaint only)
--   3. payments.invoice_ref → FK to job_orders
--   4. Add technicians table
--   5. Add lead_id FK on job_orders (Won lead → Job Order link)
--   6. Add amc_renewal_job_id on assets (AMC renewal tracking)
--   7. Server-side ID sequences for all entities
--   8. Follow-up index for dashboard tasks query
-- ============================================================

-- ── 1. Technicians table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS technicians (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tech_id        TEXT        UNIQUE NOT NULL,
  name           TEXT        NOT NULL,
  phone          TEXT,
  city           TEXT,
  active         BOOLEAN     NOT NULL DEFAULT TRUE,
  fuel_allowance NUMERIC(10,2) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER technicians_updated_at
  BEFORE UPDATE ON technicians
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. ID sequences (server-side, collision-free) ────────────
CREATE SEQUENCE IF NOT EXISTS seq_ticket    START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_lead      START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_job       START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_asset     START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_payment   START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_customer  START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_tech      START 100;

-- ── 3. Fix tickets — remove Lead type, add Complaint-only cols ─
ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_type_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_type_check
    CHECK (type IN ('Query','Complaint'));

-- Drop lead-specific columns from tickets (they belong in leads table)
ALTER TABLE tickets DROP COLUMN IF EXISTS lead_source;
ALTER TABLE tickets DROP COLUMN IF EXISTS vehicles;
ALTER TABLE tickets DROP COLUMN IF EXISTS budget;
ALTER TABLE tickets DROP COLUMN IF EXISTS timeline;
ALTER TABLE tickets DROP COLUMN IF EXISTS preferred_payment;
ALTER TABLE tickets DROP COLUMN IF EXISTS package;

-- Add asset_reg_no for complaint context (which vehicle is affected)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS asset_reg_no TEXT;

-- ── 4. Leads — link to originating ticket (optional) ─────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_ticket_id TEXT
  REFERENCES tickets(ticket_id) ON DELETE SET NULL;

-- Leads — link to converted job order
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_job_id TEXT
  REFERENCES job_orders(invoice_number) ON DELETE SET NULL;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- ── 5. Job Orders — link back to originating lead ────────────
ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS lead_id TEXT
  REFERENCES leads(lead_id) ON DELETE SET NULL;

-- Job Orders — link to technician (proper FK)
ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS technician_id TEXT
  REFERENCES technicians(tech_id) ON DELETE SET NULL;

-- ── 6. Assets — AMC renewal tracking ─────────────────────────
ALTER TABLE assets ADD COLUMN IF NOT EXISTS renewal_job_id TEXT
  REFERENCES job_orders(invoice_number) ON DELETE SET NULL;

ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_renewal_date DATE;

-- ── 7. Fix payments — invoice_ref as proper FK ───────────────
-- First clean up any orphan refs that don't match real invoices
UPDATE payments SET invoice_ref = NULL
  WHERE invoice_ref IS NOT NULL
    AND invoice_ref NOT IN (SELECT invoice_number FROM job_orders);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_invoice_ref_fk;
ALTER TABLE payments ADD CONSTRAINT payments_invoice_ref_fk
  FOREIGN KEY (invoice_ref) REFERENCES job_orders(invoice_number)
  ON DELETE SET NULL;

-- ── 8. Replace total_jobs counter with trigger ────────────────
-- Drop the old drift-prone column
ALTER TABLE customers DROP COLUMN IF EXISTS total_jobs;

-- Add it back as a real-time computed column via trigger
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_jobs INT NOT NULL DEFAULT 0;

-- Trigger: recalculate on every job_order insert/update/delete
CREATE OR REPLACE FUNCTION sync_customer_job_count()
RETURNS TRIGGER AS $$
DECLARE
  cid TEXT;
BEGIN
  -- Get the affected customer_id
  IF TG_OP = 'DELETE' THEN cid := OLD.customer_id;
  ELSE cid := NEW.customer_id; END IF;

  IF cid IS NOT NULL THEN
    UPDATE customers
    SET total_jobs = (
      SELECT COUNT(*) FROM job_orders
      WHERE customer_id = cid AND status = 'Completed'
    )
    WHERE customer_id = cid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_order_sync_count ON job_orders;
CREATE TRIGGER job_order_sync_count
  AFTER INSERT OR UPDATE OR DELETE ON job_orders
  FOR EACH ROW EXECUTE FUNCTION sync_customer_job_count();

-- ── 9. Tracker/SIM status sync trigger ───────────────────────
-- When a job order assigns a tracker/SIM → mark it Assigned/Installed
-- When a job is cancelled/removed → return to Available
CREATE OR REPLACE FUNCTION sync_device_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle tracker IMEI changes
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.tracker_imei IS DISTINCT FROM OLD.tracker_imei) THEN
    -- Release old tracker if switching
    IF TG_OP = 'UPDATE' AND OLD.tracker_imei IS NOT NULL THEN
      UPDATE trackers SET status = 'Available', assigned_to = NULL
        WHERE imei = OLD.tracker_imei AND status = 'Assigned';
    END IF;
    -- Assign new tracker
    IF NEW.tracker_imei IS NOT NULL AND NEW.status NOT IN ('Cancelled') THEN
      UPDATE trackers SET status = 'Assigned', assigned_to = NEW.invoice_number
        WHERE imei = NEW.tracker_imei;
    END IF;
  END IF;

  -- Handle SIM number changes
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.sim_number IS DISTINCT FROM OLD.sim_number) THEN
    IF TG_OP = 'UPDATE' AND OLD.sim_number IS NOT NULL THEN
      UPDATE sims SET status = 'Available', assigned_to = NULL
        WHERE sim_number = OLD.sim_number AND status = 'Installed';
    END IF;
    IF NEW.sim_number IS NOT NULL AND NEW.status NOT IN ('Cancelled') THEN
      UPDATE sims SET status = 'Installed', assigned_to = NEW.invoice_number
        WHERE sim_number = NEW.sim_number;
    END IF;
  END IF;

  -- On cancel — release both devices
  IF TG_OP = 'UPDATE' AND NEW.status = 'Cancelled' THEN
    IF NEW.tracker_imei IS NOT NULL THEN
      UPDATE trackers SET status = 'Available', assigned_to = NULL
        WHERE imei = NEW.tracker_imei AND assigned_to = NEW.invoice_number;
    END IF;
    IF NEW.sim_number IS NOT NULL THEN
      UPDATE sims SET status = 'Available', assigned_to = NULL
        WHERE sim_number = NEW.sim_number AND assigned_to = NEW.invoice_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_order_device_sync ON job_orders;
CREATE TRIGGER job_order_device_sync
  AFTER INSERT OR UPDATE ON job_orders
  FOR EACH ROW EXECUTE FUNCTION sync_device_status();

-- ── 10. Auto-upsert asset on job completion ───────────────────
CREATE OR REPLACE FUNCTION auto_upsert_asset()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when status transitions TO Completed
  IF NEW.status = 'Completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'Completed')
     AND NEW.registration_no IS NOT NULL
     AND NEW.customer_id IS NOT NULL
  THEN
    INSERT INTO assets (
      asset_id, registration_no, make, model, color, year,
      customer_id, tracker_imei, sim_number,
      installer_name, install_date, package,
      amc_duration, amc_expiry, install_city, status
    ) VALUES (
      'AST-' || NEW.invoice_number,
      NEW.registration_no, NEW.vehicle_make, NEW.vehicle_model,
      NEW.vehicle_color, NEW.vehicle_year,
      NEW.customer_id, NEW.tracker_imei, NEW.sim_number,
      NEW.installer_name, NEW.date, NEW.package,
      NEW.amc_duration, NEW.amc_expiry, NEW.install_city, 'Active'
    )
    ON CONFLICT (asset_id) DO UPDATE SET
      tracker_imei   = EXCLUDED.tracker_imei,
      sim_number     = EXCLUDED.sim_number,
      installer_name = EXCLUDED.installer_name,
      install_date   = EXCLUDED.install_date,
      package        = EXCLUDED.package,
      amc_duration   = EXCLUDED.amc_duration,
      amc_expiry     = EXCLUDED.amc_expiry,
      status         = 'Active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_order_auto_asset ON job_orders;
CREATE TRIGGER job_order_auto_asset
  AFTER INSERT OR UPDATE ON job_orders
  FOR EACH ROW EXECUTE FUNCTION auto_upsert_asset();

-- ── 11. Follow-up index (dashboard tasks) ────────────────────
CREATE INDEX IF NOT EXISTS idx_tickets_followup ON tickets (followup_date) WHERE followup_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_followup2  ON leads   (followup_date) WHERE followup_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_followup    ON job_orders (followup_date) WHERE followup_date IS NOT NULL;

-- ── 12. Seed default technicians ─────────────────────────────
INSERT INTO technicians (tech_id, name, phone, city, active)
VALUES
  ('TECH-001', 'Zahid Hussain', '0300-0000001', 'Lahore', TRUE),
  ('TECH-002', 'Saif Ullah',    '0300-0000002', 'Lahore', TRUE)
ON CONFLICT (tech_id) DO NOTHING;
