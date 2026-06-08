require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, pool } = require('./index');

const USERS = [
  { userId: 'USR-ADMIN001', name: 'System Admin',      email: 'admin@famsops.local',     role: 'admin',      dept: 'Management', password: 'admin123' },
  { userId: 'USR-SALES001', name: 'Sales Manager',     email: 'sales@famsops.local',     role: 'sales',      dept: 'Sales',      password: 'sales123' },
  { userId: 'USR-OPS001',   name: 'Operations Lead',   email: 'ops@famsops.local',       role: 'operations', dept: 'Operations', password: 'ops123' },
  { userId: 'USR-ACC001',   name: 'Accounts Manager',  email: 'accounts@famsops.local',  role: 'accounts',   dept: 'Finance',    password: 'accounts123' },
  { userId: 'USR-SUP001',   name: 'Support Agent',     email: 'support@famsops.local',   role: 'support',    dept: 'Support',    password: 'support123' },
  { userId: 'USR-MGMT001',  name: 'Senior Manager',    email: 'mgmt@famsops.local',      role: 'management', dept: 'Management', password: 'mgmt123' },
];

const CUSTOMERS = [
  { customerId: 'CUST-000001', customerName: 'Ahmed Raza Khan',     contact: '0300-1234567', city: 'Lahore',     customerType: 'individual', rac: 'ARK-001', company: '' },
  { customerId: 'CUST-000002', customerName: 'Pak Logistics Co.',   contact: '0321-9876543', city: 'Karachi',    customerType: 'corporate',  rac: 'PLC-001', company: 'Pak Logistics Co.' },
  { customerId: 'CUST-000003', customerName: 'Tariq Mehmood',       contact: '0333-4561234', city: 'Islamabad',  customerType: 'individual', rac: 'TM-001',  company: '' },
  { customerId: 'CUST-000004', customerName: 'Swift Courier Pvt.',  contact: '0345-6781234', city: 'Lahore',     customerType: 'fleet',      rac: 'SCP-001', company: 'Swift Courier Pvt. Ltd.' },
  { customerId: 'CUST-000005', customerName: 'Bilal Transport Ltd.', contact: '0311-1112233', city: 'Faisalabad', customerType: 'fleet',      rac: 'BTL-001', company: 'Bilal Transport Ltd.' },
];

async function seed() {
  console.log('🌱 Seeding Famsops database…\n');

  // Users
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const { rows: roleRow } = await query('SELECT id FROM roles WHERE name = $1', [u.role]);
    const roleId = roleRow[0]?.id || null;
    await query(`
      INSERT INTO users (user_id, name, email, password_hash, role, role_id, department)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (email) DO UPDATE SET role_id = EXCLUDED.role_id
    `, [u.userId, u.name, u.email, hash, u.role, roleId, u.dept]);
    console.log(`  👤 User: ${u.email} / ${u.password}  [${u.role}]`);
  }

  // Customers
  for (const c of CUSTOMERS) {
    await query(`
      INSERT INTO customers (customer_id, customer_name, contact, city, customer_type, rac, company)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (customer_id) DO NOTHING
    `, [c.customerId, c.customerName, c.contact, c.city, c.customerType, c.rac, c.company]);
    console.log(`  🏢 Customer: ${c.customerName}`);
  }

  // Trackers
  const trackers = [
    ['358899000123456', 'GT06N',    'Teltonika PK', '2024-01-10', 3500, 'Available'],
    ['358899000789012', 'FM3001',   'Teltonika PK', '2024-02-15', 4200, 'Available'],
    ['358899000345678', 'GT06N',    'Local Dist.',  '2024-03-01', 3200, 'Assigned'],
    ['358899000901234', 'FM3001',   'Teltonika PK', '2024-03-20', 4200, 'Available'],
    ['358899000567890', 'TK915',    'SinoTrack',    '2024-04-05', 2800, 'Faulty'],
  ];
  for (const [imei, model, supplier, received, price, status] of trackers) {
    await query(`
      INSERT INTO trackers (imei, model, supplier, date_received, purchase_price, status)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (imei) DO NOTHING
    `, [imei, model, supplier, received, price, status]);
  }
  console.log(`  📡 ${trackers.length} trackers seeded`);

  // SIMs
  const sims = [
    ['0311-0000001', 'Jazz', 'Fleet Data 1GB', 350, '2025-12-31', 'Available'],
    ['0321-0000002', 'Zong', 'Fleet Data 2GB', 450, '2025-11-30', 'Available'],
    ['0333-0000003', 'Telenor', 'Basic 500MB', 250, '2025-10-31', 'Installed'],
    ['0345-0000004', 'Jazz', 'Fleet Data 1GB', 350, '2025-12-31', 'Available'],
    ['0300-0000005', 'Ufone', 'Data 1GB',      300, '2025-09-30', 'Available'],
  ];
  for (const [simNumber, provider, pkg, rate, expiry, status] of sims) {
    await query(`
      INSERT INTO sims (sim_number, sim_provider, data_package, monthly_rate, expiry_date, status)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (sim_number) DO NOTHING
    `, [simNumber, provider, pkg, rate, expiry, status]);
  }
  console.log(`  💳 ${sims.length} SIMs seeded`);

  console.log('\n✅ Seed complete.\n');
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
