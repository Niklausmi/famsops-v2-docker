-- ============================================================
-- Famsops v2 — Migration 007: Job Order Chassis Number & Trigger Fix
-- Adds chassis_no to job_orders and updates auto_upsert_asset
-- ============================================================

-- 1. Add chassis_no to job_orders
ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS chassis_no TEXT;

-- 2. Update auto_upsert_asset trigger to include chassis_no and vehicle_color
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
      asset_id, registration_no, make, model, color, year, chassis_no,
      customer_id, tracker_imei, sim_number,
      installer_name, install_date, package,
      amc_duration, amc_expiry, install_city, status
    ) VALUES (
      'AST-' || NEW.invoice_number,
      NEW.registration_no,
      NEW.vehicle_make,
      NEW.vehicle_model,
      NEW.vehicle_color,
      NEW.vehicle_year,
      NEW.chassis_no,
      NEW.customer_id,
      NEW.tracker_imei,
      NEW.sim_number,
      NEW.installer_name,
      NEW.date, -- install_date
      NEW.package,
      NEW.amc_duration,
      NEW.amc_expiry,
      NEW.install_city,
      'Active'
    )
    ON CONFLICT (registration_no) DO UPDATE SET
      make           = EXCLUDED.make,
      model          = EXCLUDED.model,
      color          = EXCLUDED.color,
      year           = EXCLUDED.year,
      chassis_no     = EXCLUDED.chassis_no,
      customer_id    = EXCLUDED.customer_id,
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
