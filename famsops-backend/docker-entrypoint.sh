#!/bin/sh
# docker-entrypoint.sh
# Runs DB migrations (and optional seed), then starts the API.
set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Famsops API — starting up"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Wait for Postgres to be ready
echo "[entrypoint] Waiting for PostgreSQL…"
until node -e "
  const { Pool } = require('pg');
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  p.query('SELECT 1').then(() => { console.log('DB ready'); p.end(); process.exit(0); })
   .catch(() => { p.end(); process.exit(1); });
" 2>/dev/null; do
  echo "[entrypoint] DB not ready yet — retrying in 2s…"
  sleep 2
done

# Run migrations
echo "[entrypoint] Running migrations…"
node src/db/migrate.js

# Seed only if SEED=true (set in docker-compose for first run)
if [ "${SEED:-false}" = "true" ]; then
  echo "[entrypoint] Seeding database…"
  node src/db/seed.js
fi

echo "[entrypoint] Starting API server…"
exec node src/app.js
