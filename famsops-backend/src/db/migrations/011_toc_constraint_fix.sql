-- ============================================================
-- Famsops — Migration 011: Fix TOC constraint
-- Problem: job_orders_toc_check constraint was missing values
--   that the frontend sends and renewAmc/auto-billing use:
--   'AMC Visit', 'Repair / Service', 'Relocation', 'SIM Swap'
-- Also adds billing rules for the new TOC types.
-- ============================================================

-- ── 1. Drop old constraint and recreate with all valid TOC values ──
ALTER TABLE job_orders DROP CONSTRAINT IF EXISTS job_orders_toc_check;

ALTER TABLE job_orders ADD CONSTRAINT job_orders_toc_check
  CHECK (toc IN (
    'New Installation',
    'Vehicle Transfer',
    'Ownership Transfer',
    'Reinstallation',
    'Inspection',
    'Replacement',
    'Removal',
    'AMC Visit',
    'Repair / Service',
    'Relocation',
    'SIM Swap'
  ));

-- ── 2. Add missing billing rules for new TOC types ────────────
INSERT INTO toc_billing_rules (toc, charge_types, subscription_action, invoice_type, payment_due_days, notes)
VALUES
  ('AMC Visit',
   '["inspection_fee"]',
   'renew', 'renewal', 7,
   'AMC visit. Renews subscription on completion.'),

  ('Repair / Service',
   '["inspection_fee"]',
   'none', 'one_time', 7,
   'Repair or service visit. No subscription change.'),

  ('Relocation',
   '["reinstallation_fee"]',
   'continue', 'one_time', 7,
   'Device moved to another vehicle. Subscription continues.'),

  ('SIM Swap',
   '["sim_card"]',
   'continue', 'one_time', 7,
   'SIM replacement only. Subscription continues.')

ON CONFLICT (toc) DO NOTHING;
