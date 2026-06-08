-- ============================================================
-- Famsops v2 — Migration 003: Full Revamp
-- Adds: roles, permissions, role_permissions (replaces text role)
--       quotations + quotation_items
--       work_orders (bridge: quotation → installation jobs)
--       subscriptions
--       invoices + invoice_items
--       contacts (multiple per customer)
--       drivers (linked to assets)
--       ticket_comments
--       tasks (proper entity, not just followup_date)
--       notifications
--       lead_activities (timeline)
-- Fixes: users.role → users.role_id FK
--        inventory: Reserved status added
-- ============================================================

-- ── ROLES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL      PRIMARY KEY,
  name        TEXT        UNIQUE NOT NULL,
  label       TEXT        NOT NULL,
  description TEXT,
  color       TEXT        DEFAULT '#38d9f5',
  is_system   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PERMISSIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  id      SERIAL PRIMARY KEY,
  module  TEXT   NOT NULL,
  action  TEXT   NOT NULL,
  label   TEXT,
  UNIQUE(module, action)
);

-- ── ROLE_PERMISSIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INT REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ── Migrate users.role text → role_id FK ─────────────────────
-- Step 1: Add role_id column (nullable first)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INT REFERENCES roles(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS technician_id TEXT REFERENCES technicians(tech_id) ON DELETE SET NULL;

-- Step 2: Expand users.role CHECK to include new roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin','sales','operations','management','accounts','support','technician'));

-- ── SEQUENCES ────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS seq_quotation  START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_workorder  START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_invoice    START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_sub        START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_task       START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_contact    START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_driver     START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_notif      START 1000;

-- ── CONTACTS (multiple per customer) ─────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   TEXT        UNIQUE NOT NULL,
  customer_id  TEXT        NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  phone        TEXT,
  email        TEXT,
  role         TEXT,           -- 'Primary','Billing','Technical','Fleet Manager'
  cnic         TEXT,
  is_primary   BOOLEAN     NOT NULL DEFAULT FALSE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_customer ON contacts (customer_id);
CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── DRIVERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    TEXT        UNIQUE NOT NULL,
  customer_id  TEXT        REFERENCES customers(customer_id) ON DELETE SET NULL,
  asset_id     TEXT        REFERENCES assets(asset_id) ON DELETE SET NULL,
  name         TEXT        NOT NULL,
  phone        TEXT,
  cnic         TEXT,
  license_no   TEXT,
  license_expiry DATE,
  status       TEXT        NOT NULL DEFAULT 'Active'
                           CHECK (status IN ('Active','Inactive','Terminated')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_customer ON drivers (customer_id);
CREATE INDEX IF NOT EXISTS idx_drivers_asset    ON drivers (asset_id);
CREATE TRIGGER drivers_updated_at
  BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── LEAD ACTIVITIES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_activities (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     TEXT        NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
  user_id     TEXT,
  user_name   TEXT,
  type        TEXT        NOT NULL, -- 'call','email','meeting','note','status_change','whatsapp'
  title       TEXT        NOT NULL,
  description TEXT,
  outcome     TEXT,
  next_action TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities (lead_id);

-- ── QUOTATIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id   TEXT        UNIQUE NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'Draft'
                             CHECK (status IN ('Draft','Sent','Approved','Rejected','Expired','Invoiced')),
  customer_id    TEXT        REFERENCES customers(customer_id) ON DELETE SET NULL,
  customer_name  TEXT,
  contact        TEXT,
  city           TEXT,
  lead_id        TEXT        REFERENCES leads(lead_id) ON DELETE SET NULL,
  title          TEXT        NOT NULL,
  description    TEXT,
  valid_until    DATE,
  subtotal       NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_pct   NUMERIC(5,2)  DEFAULT 0,
  tax_pct        NUMERIC(5,2)  DEFAULT 0,
  total          NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency       TEXT          DEFAULT 'PKR',
  payment_terms  TEXT,
  notes          TEXT,
  terms          TEXT,
  sent_at        TIMESTAMPTZ,
  approved_at    TIMESTAMPTZ,
  rejected_at    TIMESTAMPTZ,
  rejected_reason TEXT,
  created_by     TEXT,
  approved_by    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations (customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status   ON quotations (status);
CREATE TRIGGER quotations_updated_at
  BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── QUOTATION ITEMS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotation_items (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id   TEXT        NOT NULL REFERENCES quotations(quotation_id) ON DELETE CASCADE,
  sort_order     INT         NOT NULL DEFAULT 0,
  item_type      TEXT        NOT NULL DEFAULT 'service',
                             -- 'hardware','installation','subscription','amc','sim','other'
  description    TEXT        NOT NULL,
  qty            NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit           TEXT        DEFAULT 'unit',  -- 'unit','vehicle','month','year'
  unit_price     NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_pct   NUMERIC(5,2)  DEFAULT 0,
  total          NUMERIC(14,2) GENERATED ALWAYS AS (qty * unit_price * (1 - COALESCE(discount_pct,0)/100)) STORED,
  is_recurring   BOOLEAN     NOT NULL DEFAULT FALSE,
  billing_cycle  TEXT,        -- 'monthly','annual' for recurring items
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qitems_quotation ON quotation_items (quotation_id);

-- ── WORK ORDERS ──────────────────────────────────────────────
-- Bridge between approved quotation and installation job orders
CREATE TABLE IF NOT EXISTS work_orders (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id  TEXT        UNIQUE NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'Pending'
                             CHECK (status IN ('Pending','Assigned','In Progress','Completed','Cancelled')),
  customer_id    TEXT        REFERENCES customers(customer_id) ON DELETE SET NULL,
  customer_name  TEXT,
  quotation_id   TEXT        REFERENCES quotations(quotation_id) ON DELETE SET NULL,
  lead_id        TEXT        REFERENCES leads(lead_id) ON DELETE SET NULL,
  title          TEXT        NOT NULL,
  vehicle_count  INT         NOT NULL DEFAULT 1,
  scheduled_date DATE,
  completed_date DATE,
  assigned_to    TEXT,       -- operations team lead
  notes          TEXT,
  created_by     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workorders_customer  ON work_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_workorders_quotation ON work_orders (quotation_id);
CREATE TRIGGER work_orders_updated_at
  BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Link job_orders back to work_order
ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS work_order_id TEXT
  REFERENCES work_orders(work_order_id) ON DELETE SET NULL;

-- ── SUBSCRIPTIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   TEXT        UNIQUE NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'Pending'
                                CHECK (status IN ('Pending','Active','Suspended','Cancelled','Expired')),
  customer_id       TEXT        REFERENCES customers(customer_id) ON DELETE SET NULL,
  customer_name     TEXT,
  asset_id          TEXT        REFERENCES assets(asset_id) ON DELETE SET NULL,
  work_order_id     TEXT        REFERENCES work_orders(work_order_id) ON DELETE SET NULL,
  quotation_id      TEXT        REFERENCES quotations(quotation_id) ON DELETE SET NULL,
  plan_name         TEXT        NOT NULL,   -- 'Basic','Standard','Premium','Fleet'
  billing_cycle     TEXT        NOT NULL DEFAULT 'monthly'
                                CHECK (billing_cycle IN ('monthly','quarterly','annual')),
  rate_per_vehicle  NUMERIC(10,2) NOT NULL DEFAULT 0,
  vehicle_count     INT           NOT NULL DEFAULT 1,
  monthly_amount    NUMERIC(12,2) GENERATED ALWAYS AS (
                      CASE billing_cycle
                        WHEN 'monthly'   THEN rate_per_vehicle * vehicle_count
                        WHEN 'quarterly' THEN rate_per_vehicle * vehicle_count
                        WHEN 'annual'    THEN rate_per_vehicle * vehicle_count
                      END
                    ) STORED,
  start_date        DATE        NOT NULL,
  end_date          DATE,
  next_billing_date DATE,
  last_billed_date  DATE,
  auto_renew        BOOLEAN     NOT NULL DEFAULT TRUE,
  notes             TEXT,
  created_by        TEXT,
  cancelled_at      TIMESTAMPTZ,
  cancel_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subs_customer      ON subscriptions (customer_id);
CREATE INDEX IF NOT EXISTS idx_subs_status        ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subs_next_billing  ON subscriptions (next_billing_date);
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── INVOICES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       TEXT        UNIQUE NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'Draft'
                               CHECK (status IN ('Draft','Sent','Paid','Partial','Overdue','Cancelled','Void')),
  type             TEXT        NOT NULL DEFAULT 'one_time'
                               CHECK (type IN ('one_time','recurring','renewal','credit_note')),
  customer_id      TEXT        REFERENCES customers(customer_id) ON DELETE SET NULL,
  customer_name    TEXT,
  contact          TEXT,
  subscription_id  TEXT        REFERENCES subscriptions(subscription_id) ON DELETE SET NULL,
  work_order_id    TEXT        REFERENCES work_orders(work_order_id) ON DELETE SET NULL,
  quotation_id     TEXT        REFERENCES quotations(quotation_id) ON DELETE SET NULL,
  billing_period_start DATE,
  billing_period_end   DATE,
  issue_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  due_date         DATE,
  subtotal         NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_pct     NUMERIC(5,2)  DEFAULT 0,
  tax_pct          NUMERIC(5,2)  DEFAULT 0,
  total            NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance_due      NUMERIC(14,2) GENERATED ALWAYS AS (total - COALESCE(paid_amount,0)) STORED,
  currency         TEXT          DEFAULT 'PKR',
  notes            TEXT,
  sent_at          TIMESTAMPTZ,
  paid_at          TIMESTAMPTZ,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer     ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status       ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_due          ON invoices (due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices (subscription_id);
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── INVOICE ITEMS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   TEXT        NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  sort_order   INT         NOT NULL DEFAULT 0,
  description  TEXT        NOT NULL,
  qty          NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit         TEXT        DEFAULT 'unit',
  unit_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total        NUMERIC(14,2) GENERATED ALWAYS AS (qty * unit_price) STORED,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_items_invoice ON invoice_items (invoice_id);

-- Link payments to invoices (replaces free-floating invoice_ref text)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id TEXT
  REFERENCES invoices(invoice_id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS subscription_id TEXT
  REFERENCES subscriptions(subscription_id) ON DELETE SET NULL;

-- ── TICKET COMMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_comments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    TEXT        NOT NULL REFERENCES tickets(ticket_id) ON DELETE CASCADE,
  user_id      TEXT,
  user_name    TEXT,
  user_role    TEXT,
  body         TEXT        NOT NULL,
  is_internal  BOOLEAN     NOT NULL DEFAULT FALSE,  -- internal = not visible to customer
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tc_ticket ON ticket_comments (ticket_id);
CREATE TRIGGER ticket_comments_updated_at
  BEFORE UPDATE ON ticket_comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── TASKS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      TEXT        UNIQUE NOT NULL,
  title        TEXT        NOT NULL,
  description  TEXT,
  status       TEXT        NOT NULL DEFAULT 'Open'
                           CHECK (status IN ('Open','In Progress','Done','Cancelled')),
  priority     TEXT        NOT NULL DEFAULT 'Medium'
                           CHECK (priority IN ('Low','Medium','High','Critical')),
  assigned_to  TEXT,       -- user_id
  assigned_name TEXT,
  due_date     DATE,
  -- Polymorphic link to any entity
  entity_type  TEXT,       -- 'lead','ticket','quotation','subscription','customer'
  entity_id    TEXT,
  created_by   TEXT,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned   ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due        ON tasks (due_date) WHERE status NOT IN ('Done','Cancelled');
CREATE INDEX IF NOT EXISTS idx_tasks_entity     ON tasks (entity_type, entity_id);
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── NOTIFICATIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notif_id     TEXT        UNIQUE NOT NULL,
  user_id      TEXT        NOT NULL,
  type         TEXT        NOT NULL,  -- 'task_due','amc_expiry','payment_due','ticket_assigned','lead_assigned'
  title        TEXT        NOT NULL,
  body         TEXT,
  entity_type  TEXT,
  entity_id    TEXT,
  read         BOOLEAN     NOT NULL DEFAULT FALSE,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications (user_id, read, created_at DESC);

-- ── SEED: Roles ───────────────────────────────────────────────
INSERT INTO roles (name, label, description, color, is_system) VALUES
  ('admin',       'System Admin',     'Full access to all modules',                         '#ff7eb3', TRUE),
  ('sales',       'Sales Team',       'Leads, quotations, customers',                        '#38d9f5', TRUE),
  ('operations',  'Operations Team',  'Job orders, assets, inventory, technicians',          '#7b6fff', TRUE),
  ('accounts',    'Accounts Team',    'Subscriptions, invoices, payments',                   '#3dffa0', TRUE),
  ('support',     'Support Team',     'Tickets and customer support',                        '#ffb347', TRUE),
  ('management',  'Management',       'Read-all + approve quotations and renewals',          '#ff5f6d', TRUE),
  ('technician',  'Field Technician', 'View and complete own assigned installation jobs',    '#38d9f5', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ── SEED: Permissions ────────────────────────────────────────
INSERT INTO permissions (module, action, label) VALUES
  -- customers
  ('customers','read',      'View customers'),
  ('customers','create',    'Add customers'),
  ('customers','update',    'Edit customers'),
  ('customers','delete',    'Delete customers'),
  -- contacts
  ('contacts','read',       'View contacts'),
  ('contacts','create',     'Add contacts'),
  ('contacts','update',     'Edit contacts'),
  -- drivers
  ('drivers','read',        'View drivers'),
  ('drivers','create',      'Add drivers'),
  ('drivers','update',      'Edit drivers'),
  -- leads
  ('leads','read',          'View leads'),
  ('leads','create',        'Create leads'),
  ('leads','update',        'Edit leads'),
  ('leads','delete',        'Delete leads'),
  -- quotations
  ('quotations','read',     'View quotations'),
  ('quotations','create',   'Create quotations'),
  ('quotations','update',   'Edit quotations'),
  ('quotations','send',     'Send quotations to customer'),
  ('quotations','approve',  'Approve quotations'),
  ('quotations','delete',   'Delete quotations'),
  -- work_orders
  ('work_orders','read',    'View work orders'),
  ('work_orders','create',  'Create work orders'),
  ('work_orders','update',  'Edit work orders'),
  -- job_orders
  ('job_orders','read',     'View job orders'),
  ('job_orders','create',   'Create job orders'),
  ('job_orders','update',   'Edit job orders'),
  ('job_orders','own',      'View own assigned jobs only'),
  -- assets
  ('assets','read',         'View assets'),
  ('assets','create',       'Add assets'),
  ('assets','update',       'Edit assets'),
  -- inventory
  ('inventory','read',      'View inventory'),
  ('inventory','create',    'Add to inventory'),
  ('inventory','update',    'Edit inventory items'),
  -- subscriptions
  ('subscriptions','read',  'View subscriptions'),
  ('subscriptions','create','Create subscriptions'),
  ('subscriptions','update','Edit subscriptions'),
  ('subscriptions','cancel','Cancel subscriptions'),
  -- invoices
  ('invoices','read',       'View invoices'),
  ('invoices','create',     'Create invoices'),
  ('invoices','update',     'Edit invoices'),
  ('invoices','send',       'Send invoices'),
  ('invoices','void',       'Void invoices'),
  -- payments
  ('payments','read',       'View payments'),
  ('payments','create',     'Record payments'),
  ('payments','update',     'Edit payments'),
  ('payments','export',     'Export payment data'),
  -- tickets
  ('tickets','read',        'View tickets'),
  ('tickets','create',      'Create tickets'),
  ('tickets','update',      'Edit / resolve tickets'),
  ('tickets','assign',      'Assign tickets to agents'),
  ('tickets','delete',      'Delete tickets'),
  -- technicians
  ('technicians','read',    'View technicians'),
  ('technicians','create',  'Add technicians'),
  ('technicians','update',  'Edit technicians'),
  -- tasks
  ('tasks','read',          'View tasks'),
  ('tasks','create',        'Create tasks'),
  ('tasks','update',        'Edit tasks'),
  -- users
  ('users','read',          'View users'),
  ('users','create',        'Create users'),
  ('users','update',        'Edit users'),
  ('users','toggle',        'Enable/disable users'),
  -- reports
  ('reports','read',        'View reports and analytics'),
  ('reports','export',      'Export reports'),
  -- dashboard
  ('dashboard','read',      'View dashboard')
ON CONFLICT (module, action) DO NOTHING;

-- ── SEED: Role-Permission assignments ────────────────────────

-- Helper: grant all permissions of a module to a role
-- We use a DO block to keep this readable
DO $$
DECLARE
  r_admin      INT; r_sales INT; r_ops INT;
  r_accounts   INT; r_support INT; r_mgmt INT; r_tech INT;
BEGIN
  SELECT id INTO r_admin   FROM roles WHERE name='admin';
  SELECT id INTO r_sales   FROM roles WHERE name='sales';
  SELECT id INTO r_ops     FROM roles WHERE name='operations';
  SELECT id INTO r_accounts FROM roles WHERE name='accounts';
  SELECT id INTO r_support  FROM roles WHERE name='support';
  SELECT id INTO r_mgmt    FROM roles WHERE name='management';
  SELECT id INTO r_tech    FROM roles WHERE name='technician';

  -- ADMIN: everything
  INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_admin, id FROM permissions
    ON CONFLICT DO NOTHING;

  -- SALES: customers(r,c,u), contacts(all), leads(all), quotations(r,c,u,send), tasks(all), dashboard
  INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_sales, id FROM permissions WHERE
      (module='customers'   AND action IN ('read','create','update')) OR
      (module='contacts'    AND action IN ('read','create','update')) OR
      (module='leads'       AND action IN ('read','create','update','delete')) OR
      (module='quotations'  AND action IN ('read','create','update','send')) OR
      (module='tickets'     AND action IN ('read','create')) OR
      (module='tasks'       AND action IN ('read','create','update')) OR
      (module='dashboard'   AND action = 'read')
    ON CONFLICT DO NOTHING;

  -- OPERATIONS: customers(r), assets(all), inventory(all), job_orders(all), work_orders(all),
  --             tickets(r), technicians(r), tasks(all), dashboard
  INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_ops, id FROM permissions WHERE
      (module='customers'   AND action IN ('read','update')) OR
      (module='contacts'    AND action = 'read') OR
      (module='drivers'     AND action IN ('read','create','update')) OR
      (module='assets'      AND action IN ('read','create','update')) OR
      (module='inventory'   AND action IN ('read','create','update')) OR
      (module='job_orders'  AND action IN ('read','create','update')) OR
      (module='work_orders' AND action IN ('read','create','update')) OR
      (module='tickets'     AND action = 'read') OR
      (module='technicians' AND action IN ('read','create','update')) OR
      (module='tasks'       AND action IN ('read','create','update')) OR
      (module='dashboard'   AND action = 'read')
    ON CONFLICT DO NOTHING;

  -- ACCOUNTS: customers(r), subscriptions(all), invoices(all), payments(all), reports(all), dashboard
  INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_accounts, id FROM permissions WHERE
      (module='customers'     AND action = 'read') OR
      (module='subscriptions' AND action IN ('read','create','update','cancel')) OR
      (module='invoices'      AND action IN ('read','create','update','send','void')) OR
      (module='payments'      AND action IN ('read','create','update','export')) OR
      (module='reports'       AND action IN ('read','export')) OR
      (module='tasks'         AND action IN ('read','create','update')) OR
      (module='dashboard'     AND action = 'read')
    ON CONFLICT DO NOTHING;

  -- SUPPORT: customers(r), assets(r), tickets(all), tasks(r,c,u), dashboard
  INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_support, id FROM permissions WHERE
      (module='customers'   AND action = 'read') OR
      (module='assets'      AND action = 'read') OR
      (module='tickets'     AND action IN ('read','create','update','assign')) OR
      (module='tasks'       AND action IN ('read','create','update')) OR
      (module='dashboard'   AND action = 'read')
    ON CONFLICT DO NOTHING;

  -- MANAGEMENT: read everything + approve quotations + export reports
  INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_mgmt, id FROM permissions WHERE
      action IN ('read','approve','export') OR
      (module='quotations' AND action='approve') OR
      (module='subscriptions' AND action IN ('read','update')) OR
      (module='invoices' AND action IN ('read','send'))
    ON CONFLICT DO NOTHING;

  -- TECHNICIAN: only own job orders
  INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_tech, id FROM permissions WHERE
      (module='job_orders' AND action IN ('read','own','update')) OR
      (module='dashboard'  AND action = 'read')
    ON CONFLICT DO NOTHING;

END $$;

-- ── Update users.role_id from existing users.role text ────────
UPDATE users u
SET role_id = r.id
FROM roles r
WHERE r.name = u.role
  AND u.role_id IS NULL;

-- ── AUTO-RENEW: subscription expiry → renewal task ───────────
CREATE OR REPLACE FUNCTION create_renewal_task()
RETURNS TRIGGER AS $$
BEGIN
  -- When a subscription's end_date is set and is within 30 days
  IF NEW.end_date IS NOT NULL
     AND NEW.end_date <= CURRENT_DATE + 30
     AND NEW.status = 'Active'
     AND (OLD.end_date IS NULL OR OLD.end_date != NEW.end_date)
  THEN
    INSERT INTO tasks (
      task_id, title, description, priority, entity_type, entity_id,
      due_date, status
    ) VALUES (
      'TSK-' || nextval('seq_task'),
      'Renewal due: ' || COALESCE(NEW.customer_name, NEW.subscription_id),
      'Subscription ' || NEW.subscription_id || ' expires on ' || NEW.end_date::TEXT || '. Create renewal quotation.',
      'High',
      'subscription', NEW.subscription_id,
      NEW.end_date - 14,
      'Open'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscription_renewal_task ON subscriptions;
CREATE TRIGGER subscription_renewal_task
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION create_renewal_task();

-- ── AUTO-INVOICE: subscription activation → first invoice ────
CREATE OR REPLACE FUNCTION auto_create_invoice()
RETURNS TRIGGER AS $$
DECLARE
  inv_id TEXT;
BEGIN
  -- Only on transition to Active
  IF NEW.status = 'Active' AND (OLD.status IS NULL OR OLD.status != 'Active') THEN
    inv_id := 'INV-' || LPAD(nextval('seq_invoice')::TEXT, 6, '0');
    INSERT INTO invoices (
      invoice_id, status, type, customer_id, customer_name,
      subscription_id, issue_date, due_date,
      billing_period_start, billing_period_end,
      subtotal, total
    ) VALUES (
      inv_id, 'Draft', 'recurring',
      NEW.customer_id, NEW.customer_name,
      NEW.subscription_id,
      CURRENT_DATE,
      CURRENT_DATE + (CASE NEW.billing_cycle WHEN 'monthly' THEN 30 WHEN 'quarterly' THEN 90 ELSE 365 END),
      NEW.start_date, NEW.next_billing_date,
      NEW.rate_per_vehicle * NEW.vehicle_count,
      NEW.rate_per_vehicle * NEW.vehicle_count
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscription_auto_invoice ON subscriptions;
CREATE TRIGGER subscription_auto_invoice
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION auto_create_invoice();

-- ── Tracker/SIM: add Reserved status ─────────────────────────
ALTER TABLE trackers DROP CONSTRAINT IF EXISTS trackers_status_check;
ALTER TABLE trackers ADD CONSTRAINT trackers_status_check
  CHECK (status IN ('Available','Reserved','Assigned','Faulty','Removed'));

ALTER TABLE sims DROP CONSTRAINT IF EXISTS sims_status_check;
ALTER TABLE sims ADD CONSTRAINT sims_status_check
  CHECK (status IN ('Available','Reserved','Installed','Lost','Disabled'));
