#!/bin/sh
set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Famsops API — starting up"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "[entrypoint] Waiting for PostgreSQL…"
until node -e "
  const { Pool } = require('pg');
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  p.query('SELECT 1').then(() => { console.log('DB ready'); p.end(); process.exit(0); })
   .catch(() => { p.end(); process.exit(1); });
" 2>/dev/null; do
  echo "[entrypoint] DB not ready — retrying in 2s…"
  sleep 2
done

echo "[entrypoint] Running migrations (001, 002, 003)…"
node src/db/migrate.js

if [ "${SEED:-false}" = "true" ]; then
  echo "[entrypoint] Seeding database…"
  node src/db/seed.js
fi

echo "[entrypoint] Starting API…"
exec node src/app.js
