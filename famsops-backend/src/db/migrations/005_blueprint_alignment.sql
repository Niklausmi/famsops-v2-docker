-- ============================================================
-- Famsops v2 — Migration 005: Blueprint Alignment
-- Aligns schema with Operations & CRM Workflow Blueprint
-- ============================================================

-- ── 1. Update Job Order Classifications ──────────────────────
ALTER TABLE job_orders DROP CONSTRAINT IF EXISTS job_orders_status_check;
ALTER TABLE job_orders ADD CONSTRAINT job_orders_status_check
  CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled', 'On Hold'));

-- Update toc (Type of Case) check constraint
ALTER TABLE job_orders DROP CONSTRAINT IF EXISTS job_orders_toc_check;
ALTER TABLE job_orders ADD CONSTRAINT job_orders_toc_check
  CHECK (toc IN ('New Installation', 'Vehicle Transfer', 'Ownership Transfer', 'Reinstallation', 'Inspection', 'Replacement', 'Removal'));

-- Add Classification-specific columns to job_orders
ALTER TABLE job_orders 
  ADD COLUMN IF NOT EXISTS old_tracker_imei TEXT,
  ADD COLUMN IF NOT EXISTS old_sim_number TEXT,
  ADD COLUMN IF NOT EXISTS transfer_from_customer_id TEXT REFERENCES customers(customer_id),
  ADD COLUMN IF NOT EXISTS transfer_to_customer_id TEXT REFERENCES customers(customer_id),
  ADD COLUMN IF NOT EXISTS removal_type TEXT CHECK (removal_type IN ('Temporary', 'Permanent')),
  ADD COLUMN IF NOT EXISTS consent_log TEXT,
  ADD COLUMN IF NOT EXISTS pairing_verified BOOLEAN DEFAULT FALSE;

-- ── 2. Update Inventory Statuses ─────────────────────────────
ALTER TABLE trackers DROP CONSTRAINT IF EXISTS trackers_status_check;
ALTER TABLE trackers ADD CONSTRAINT trackers_status_check
  CHECK (status IN ('Available', 'Reserved', 'Assigned', 'Faulty', 'Removed', 'In Transit', 'In Repair'));

ALTER TABLE sims DROP CONSTRAINT IF EXISTS sims_status_check;
ALTER TABLE sims ADD CONSTRAINT sims_status_check
  CHECK (status IN ('Available', 'Reserved', 'Installed', 'Lost', 'Disabled', 'In Transit', 'In Repair'));

-- ── 3. Pricing Overrides Table ────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  item_type   TEXT NOT NULL, -- 'service', 'hardware', 'subscription'
  custom_rate NUMERIC(12,2) NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, item_type)
);

CREATE TRIGGER pricing_overrides_updated_at
  BEFORE UPDATE ON pricing_overrides
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 4. Assets: Pairing Verification ─────────────────────────
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_pairing_verified BOOLEAN DEFAULT FALSE;
