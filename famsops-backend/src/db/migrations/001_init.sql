-- ============================================================
-- Famsops v2 — Full PostgreSQL Schema
-- Run: node src/db/migrate.js
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── updated_at trigger function ──────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT        UNIQUE NOT NULL,
  name         TEXT        NOT NULL,
  email        TEXT        UNIQUE NOT NULL,
  password_hash TEXT       NOT NULL,
  role         TEXT        NOT NULL DEFAULT 'operations'
                           CHECK (role IN ('admin','sales','operations','management')),
  department   TEXT,
  phone        TEXT,
  avatar       TEXT,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  last_login   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── CUSTOMERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         TEXT        UNIQUE NOT NULL,
  customer_name       TEXT        NOT NULL,
  contact             TEXT        NOT NULL,
  email               TEXT,
  cnic                TEXT,
  father              TEXT,
  company             TEXT,
  rac                 TEXT,
  designation         TEXT,
  industry            TEXT,
  customer_type       TEXT        DEFAULT 'individual',
  preferred_payment   TEXT,
  city                TEXT,
  area                TEXT,
  address             TEXT,
  notes               TEXT,
  total_jobs          INT         NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_name    ON customers (customer_name);
CREATE INDEX IF NOT EXISTS idx_customers_contact ON customers (contact);
CREATE INDEX IF NOT EXISTS idx_customers_city    ON customers (city);
CREATE INDEX IF NOT EXISTS idx_customers_rac     ON customers (rac);
CREATE INDEX IF NOT EXISTS idx_customers_cnic    ON customers (cnic);

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── ASSETS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id         TEXT        UNIQUE NOT NULL,
  registration_no  TEXT        NOT NULL,
  make             TEXT        NOT NULL,
  model            TEXT,
  color            TEXT,
  year             TEXT,
  engine_no        TEXT,
  chassis_no       TEXT,
  status           TEXT        NOT NULL DEFAULT 'Active'
                               CHECK (status IN ('Active','Inactive','Transferred')),
  customer_id      TEXT        REFERENCES customers(customer_id) ON DELETE SET NULL,
  customer_name    TEXT,
  contact          TEXT,
  city             TEXT,
  tracker_imei     TEXT,
  sim_number       TEXT,
  installer_name   TEXT,
  install_date     DATE,
  package          TEXT,
  amc_duration     TEXT,
  amc_expiry       DATE,
  install_city     TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_customer   ON assets (customer_id);
CREATE INDEX IF NOT EXISTS idx_assets_reg        ON assets (registration_no);
CREATE INDEX IF NOT EXISTS idx_assets_imei       ON assets (tracker_imei);
CREATE INDEX IF NOT EXISTS idx_assets_amc_expiry ON assets (amc_expiry);

CREATE TRIGGER assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── TRACKERS (Inventory) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS trackers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  imei            TEXT        UNIQUE NOT NULL,
  model           TEXT,
  supplier        TEXT,
  date_received   DATE,
  purchase_price  NUMERIC(10,2),
  status          TEXT        NOT NULL DEFAULT 'Available'
                              CHECK (status IN ('Available','Assigned','Faulty','Removed')),
  assigned_to     TEXT,
  installer       TEXT,
  city            TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trackers_status ON trackers (status);
CREATE INDEX IF NOT EXISTS idx_trackers_imei   ON trackers (imei);

CREATE TRIGGER trackers_updated_at
  BEFORE UPDATE ON trackers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── SIMS (Inventory) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sims (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sim_number      TEXT        UNIQUE NOT NULL,
  sim_provider    TEXT,
  data_package    TEXT,
  monthly_rate    NUMERIC(10,2),
  expiry_date     DATE,
  status          TEXT        NOT NULL DEFAULT 'Available'
                              CHECK (status IN ('Available','Installed','Lost','Disabled')),
  assigned_to     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sims_status ON sims (status);

CREATE TRIGGER sims_updated_at
  BEFORE UPDATE ON sims
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── JOB ORDERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_orders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   TEXT        UNIQUE NOT NULL,
  toc              TEXT        NOT NULL DEFAULT 'New Installation',
  date             DATE        NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT        NOT NULL DEFAULT 'Scheduled'
                               CHECK (status IN ('Scheduled','In Progress','Completed','Cancelled','On Hold')),
  customer_id      TEXT        REFERENCES customers(customer_id) ON DELETE SET NULL,
  customer_name    TEXT,
  contact          TEXT,
  city             TEXT,
  rac              TEXT,
  company          TEXT,
  registration_no  TEXT,
  vehicle_make     TEXT,
  vehicle_model    TEXT,
  vehicle_color    TEXT,
  vehicle_year     TEXT,
  tracker_imei     TEXT        REFERENCES trackers(imei) ON DELETE SET NULL,
  sim_number       TEXT        REFERENCES sims(sim_number) ON DELETE SET NULL,
  installer_name   TEXT,
  install_city     TEXT,
  package          TEXT,
  amc_duration     TEXT,
  amc_expiry       DATE,
  amount           NUMERIC(12,2),
  payment_status   TEXT,
  payment_method   TEXT,
  notes            TEXT,
  followup_date    DATE,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_customer ON job_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_date     ON job_orders (date);
CREATE INDEX IF NOT EXISTS idx_jobs_status   ON job_orders (status);
CREATE INDEX IF NOT EXISTS idx_jobs_imei     ON job_orders (tracker_imei);

CREATE TRIGGER job_orders_updated_at
  BEFORE UPDATE ON job_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── TICKETS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       TEXT        UNIQUE NOT NULL,
  type            TEXT        NOT NULL DEFAULT 'Query'
                              CHECK (type IN ('Lead','Query','Complaint')),
  title           TEXT        NOT NULL,
  description     TEXT,
  category        TEXT,
  priority        TEXT        NOT NULL DEFAULT 'Medium'
                              CHECK (priority IN ('Low','Medium','High','Critical')),
  status          TEXT        NOT NULL DEFAULT 'Open'
                              CHECK (status IN ('Open','In Progress','Resolved','Closed')),
  customer_id     TEXT        REFERENCES customers(customer_id) ON DELETE SET NULL,
  customer_name   TEXT,
  contact         TEXT,
  city            TEXT,
  asset_id        TEXT,
  assigned_to     TEXT,
  followup_date   DATE,
  due_date        DATE,
  incident_date   DATE,
  severity        TEXT,
  lead_source     TEXT,
  salesperson     TEXT,
  vehicles        TEXT,
  budget          TEXT,
  timeline        TEXT,
  preferred_payment TEXT,
  package         TEXT,
  notes           TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets (customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_type     ON tickets (type);

CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── SALES LEADS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          TEXT        UNIQUE NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'New Lead'
                               CHECK (status IN ('New Lead','Contacted','Interested','Negotiation','Won','Lost')),
  title            TEXT        NOT NULL,
  description      TEXT,
  customer_id      TEXT        REFERENCES customers(customer_id) ON DELETE SET NULL,
  customer_name    TEXT,
  contact          TEXT,
  city             TEXT,
  company          TEXT,
  package          TEXT,
  vehicles         TEXT,
  budget           TEXT,
  timeline         TEXT,
  preferred_payment TEXT,
  source           TEXT,
  salesperson      TEXT,
  followup_date    DATE,
  priority         TEXT        DEFAULT 'Medium',
  amount           NUMERIC(12,2),
  closed_date      DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_customer ON leads (customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_status   ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads (followup_date);

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── PAYMENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id       TEXT        UNIQUE NOT NULL,
  type             TEXT        NOT NULL DEFAULT 'Installation Fee',
  method           TEXT        NOT NULL DEFAULT 'Cash',
  status           TEXT        NOT NULL DEFAULT 'Pending'
                               CHECK (status IN ('Pending','Received','Partial','Overdue','Refunded')),
  amount           NUMERIC(12,2) NOT NULL,
  paid_amount      NUMERIC(12,2) DEFAULT 0,
  balance_due      NUMERIC(12,2) GENERATED ALWAYS AS (amount - COALESCE(paid_amount,0)) STORED,
  customer_id      TEXT        REFERENCES customers(customer_id) ON DELETE SET NULL,
  customer_name    TEXT,
  contact          TEXT,
  invoice_ref      TEXT,
  payment_date     DATE,
  due_date         DATE,
  cheque_no        TEXT,
  bank_name        TEXT,
  transaction_ref  TEXT,
  notes            TEXT,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments (customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_date     ON payments (payment_date);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── ACTIVITY LOG ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT,
  user_name   TEXT,
  action      TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  entity_id   TEXT,
  description TEXT,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_user   ON activity_log (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_time   ON activity_log (created_at DESC);
