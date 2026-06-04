# Famsops v2 — Fleet Operations CRM

Full-stack CRM for FAMS-HPL Tracking & Telematics Division.  
Built with **React + Vite + Radix UI** (frontend) and **Node.js + Express + PostgreSQL** (backend).

---

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18 · Vite · Tailwind CSS · Radix UI · Zustand · Axios |
| Backend  | Node.js · Express · express-async-errors |
| Database | PostgreSQL 16 |
| Auth     | JWT (bcrypt passwords, role-based access) |
| DevOps   | Docker Compose |

---

## Modules

| Module     | Roles |
|------------|-------|
| Dashboard  | All |
| Customers  | All (hub: assets, tickets, jobs, leads per customer) |
| Tickets    | All (Lead / Query / Complaint) |
| Job Orders | Admin, Operations |
| Assets     | Admin, Operations, Management |
| Sales Leads| Admin, Sales, Management (Table + Kanban view) |
| Inventory  | Admin, Operations (Trackers + SIMs) |
| Payments   | Admin only |
| Users      | Admin only |

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
# 1. Clone and enter the project
git clone https://github.com/Niklausmi/Famsops.git famsops-v2
cd famsops-v2

# 2. Start everything (Postgres + API + Frontend)
docker compose up -d

# 3. Run migrations + seed
docker exec famsops-api node src/db/migrate.js
docker exec famsops-api node src/db/seed.js

# 4. Open http://localhost:5173
```

### Option B — Manual (no Docker)

**Prerequisites:** Node.js 20+, PostgreSQL 16

```bash
# 1. Create database
createdb famsops

# 2. Backend setup
cd famsops-backend
cp .env.example .env          # Edit DATABASE_URL and JWT_SECRET
npm install
npm run migrate               # Run schema migrations
node src/db/seed.js           # Seed default users + sample data
npm run dev                   # Starts on http://localhost:4000

# 3. Frontend setup (new terminal)
cd famsops-frontend
cp .env.example .env          # VITE_API_URL=http://localhost:4000/api/v1
npm install
npm run dev                   # Starts on http://localhost:5173
```

---

## Default Login Credentials

| Role       | Email                   | Password   |
|------------|-------------------------|------------|
| Admin      | admin@famsops.local     | admin123   |
| Sales      | sales@famsops.local     | sales123   |
| Operations | ops@famsops.local       | ops123     |
| Management | mgmt@famsops.local      | mgmt123    |

> **Change all passwords immediately in production.**

---

## Environment Variables

### Backend (`famsops-backend/.env`)

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/famsops
DB_SSL=false                          # true for Supabase/cloud Postgres
JWT_SECRET=your-64-char-secret-here
JWT_EXPIRES_IN=12h
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### Frontend (`famsops-frontend/.env`)

```env
VITE_API_URL=http://localhost:4000/api/v1
```

---

## API Reference

```
POST   /api/v1/auth/login
GET    /api/v1/auth/me

GET    /api/v1/customers
POST   /api/v1/customers
PATCH  /api/v1/customers/:id
GET    /api/v1/customers/:id/hub

GET    /api/v1/tickets
POST   /api/v1/tickets
PATCH  /api/v1/tickets/:id

GET    /api/v1/job-orders
POST   /api/v1/job-orders
PATCH  /api/v1/job-orders/:id

GET    /api/v1/leads
POST   /api/v1/leads
PATCH  /api/v1/leads/:id

GET    /api/v1/assets
POST   /api/v1/assets
PATCH  /api/v1/assets/:id

GET    /api/v1/inventory/trackers
GET    /api/v1/inventory/sims
POST   /api/v1/inventory/stock-in
PATCH  /api/v1/inventory/trackers/:id
PATCH  /api/v1/inventory/sims/:id

GET    /api/v1/payments
POST   /api/v1/payments
PATCH  /api/v1/payments/:id

GET    /api/v1/users
POST   /api/v1/users
PATCH  /api/v1/users/:id
PATCH  /api/v1/users/:id/toggle

GET    /api/v1/dashboard
```

---

## Database Schema (9 tables)

```
users          — team members with roles
customers      — customer registry (the hub)
assets         — registered vehicles + tracker/SIM links
trackers       — tracker inventory
sims           — SIM card inventory
job_orders     — installation / service orders
tickets        — leads, queries, complaints
leads          — sales pipeline
payments       — invoice & payment records
activity_log   — audit trail
```

---

## Migrating from the old GAS version

1. Export each Google Sheet tab to CSV
2. Map column headers to the field names in the schema above
3. Use `psql \copy` or pgAdmin import to load data into each table
4. The `customer_id`, `ticket_id`, etc. you already use map 1:1 to the new `*_id` columns

---

## ⚠️ Security Reminders

- The Supabase service key that was committed to the old repo must be **rotated immediately** in your Supabase dashboard
- Never commit `.env` files — they are gitignored
- Change all seed passwords before any production deployment
