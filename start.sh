#!/usr/bin/env bash
# ============================================================
#  Famsops v2 — Docker Start Script
#
#  Usage:
#    chmod +x start.sh
#    ./start.sh            → first-time setup + seed + start
#    ./start.sh start      → start containers (no seed)
#    ./start.sh stop       → stop all containers
#    ./start.sh restart    → stop + start
#    ./start.sh reset      → wipe volumes + rebuild + reseed
#    ./start.sh build      → rebuild images only
#    ./start.sh logs       → tail all logs
#    ./start.sh logs api   → tail backend only
#    ./start.sh logs web   → tail frontend only
#    ./start.sh status     → show container status
#    ./start.sh shell api  → open shell in backend container
#    ./start.sh shell db   → open psql in postgres container
#    ./start.sh migrate    → run migrations manually
#    ./start.sh seed       → run seed manually
# ============================================================

set -euo pipefail

RED='\033[0;31m';   GREEN='\033[0;32m';  YELLOW='\033[1;33m'
CYAN='\033[0;36m';  BOLD='\033[1m';      DIM='\033[2m';  RESET='\033[0m'

info()    { echo -e "${CYAN}  ●${RESET} $*"; }
success() { echo -e "${GREEN}  ✔${RESET} $*"; }
warn()    { echo -e "${YELLOW}  ⚠${RESET}  $*"; }
err()     { echo -e "${RED}  ✘${RESET} $*"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}── $* ${RESET}"; }
divider() { echo -e "${DIM}  ──────────────────────────────────────${RESET}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
SEED_FLAG="$SCRIPT_DIR/.seeded"
MODE="${1:-setup}"

# ── Banner ───────────────────────────────────────────────────
print_banner() {
  echo ""
  echo -e "${BOLD}${CYAN}"
  echo "  ╔═══════════════════════════════════════╗"
  echo "  ║   Famsops v2 — Fleet Operations CRM  ║"
  echo "  ║   Docker Deployment                   ║"
  echo "  ╚═══════════════════════════════════════╝"
  echo -e "${RESET}"
  echo -e "  Mode: ${YELLOW}${BOLD}${MODE}${RESET}"
  divider
}

# ── Detect docker compose command ────────────────────────────
check_docker() {
  step "Checking prerequisites"
  command -v docker &>/dev/null || err "Docker not found. Install from https://docs.docker.com/get-docker/"
  docker info &>/dev/null       || err "Docker daemon not running. Start Docker Desktop or 'sudo systemctl start docker'"
  success "Docker $(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"

  if docker compose version &>/dev/null 2>&1; then
    COMPOSE="docker compose"
    success "Docker Compose (plugin)"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE="docker-compose"
    success "docker-compose standalone"
  else
    err "Docker Compose not found. Install from https://docs.docker.com/compose/install/"
  fi
  export COMPOSE
}

# ── .env setup ───────────────────────────────────────────────
setup_env() {
  step "Environment"
  if [ ! -f "$ENV_FILE" ]; then
    cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
    # Auto-generate JWT secret
    if command -v openssl &>/dev/null; then
      SECRET=$(openssl rand -hex 32)
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|famsops-dev-jwt-secret-change-in-production-64chars|${SECRET}|" "$ENV_FILE"
      else
        sed -i "s|famsops-dev-jwt-secret-change-in-production-64chars|${SECRET}|" "$ENV_FILE"
      fi
      success "Generated JWT secret"
    fi
    success "Created .env from template"
    echo ""
    warn "Default DB password is ${BOLD}famsops_dev_pass${RESET}${YELLOW} — change for production."
    read -rp "  Press ENTER to continue, or Ctrl+C to edit .env first: "
  else
    success ".env exists"
  fi
  set -a; source "$ENV_FILE"; set +a
}

# ── Build ────────────────────────────────────────────────────
build_images() {
  step "Building Docker images"
  info "Building backend and frontend images (first run takes ~2 min)…"
  $COMPOSE build --parallel
  success "Images built"
}

# ── Start ────────────────────────────────────────────────────
start_containers() {
  local seed="${1:-false}"
  step "Starting containers"
  SEED=$seed $COMPOSE up -d
  success "Containers started"
}

# ── Wait for healthy ─────────────────────────────────────────
wait_healthy() {
  step "Waiting for services"
  local timeout=120 elapsed=0

  declare -A LABELS=(["famsops-db"]="PostgreSQL" ["famsops-api"]="Backend API" ["famsops-web"]="Frontend")
  for name in famsops-db famsops-api famsops-web; do
    local label="${LABELS[$name]}"
    info "Checking ${label}…"
    elapsed=0
    while true; do
      local health running
      health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null || echo "missing")
      running=$(docker inspect --format='{{.State.Running}}' "$name" 2>/dev/null || echo "false")

      if [ "$running" = "false" ] || [ "$health" = "missing" ]; then
        sleep 3; elapsed=$((elapsed+3))
      elif [ "$health" = "unhealthy" ]; then
        warn "${label} reported unhealthy — check: ./start.sh logs"
        break
      elif [ "$health" = "healthy" ] || [ "$health" = "none" -a "$running" = "true" ]; then
        success "${label} ready"
        break
      else
        sleep 3; elapsed=$((elapsed+3))
      fi

      if [ "$elapsed" -ge "$timeout" ]; then
        warn "${label} timed out — run './start.sh logs' to debug"
        break
      fi
    done
  done
}

# ── Summary ──────────────────────────────────────────────────
print_summary() {
  local fe="${FRONTEND_PORT:-80}"
  local api="${API_PORT:-4000}"
  local fe_url="http://localhost"; [[ "$fe" != "80" ]] && fe_url="http://localhost:${fe}"
  echo ""
  echo -e "${BOLD}${GREEN}  ╔══════════════════════════════════════════╗"
  echo -e "  ║   ✅  Famsops is running!                ║"
  echo -e "  ╚══════════════════════════════════════════╝${RESET}"
  echo ""
  echo -e "  🌐  ${BOLD}App${RESET}        → ${CYAN}${fe_url}${RESET}"
  echo -e "  🔌  ${BOLD}API${RESET}        → ${CYAN}http://localhost:${api}/api/v1${RESET}"
  echo -e "  💓  ${BOLD}Health${RESET}     → ${CYAN}http://localhost:${api}/health${RESET}"
  echo -e "  🗄  ${BOLD}Postgres${RESET}   → ${CYAN}localhost:${DB_PORT:-5432}${RESET}  (db: ${POSTGRES_DB:-famsops})"
  echo ""
  echo -e "  ${BOLD}Default Logins:${RESET}"
  echo -e "  ${DIM}  admin@famsops.local      / admin123   [admin]${RESET}"
  echo -e "  ${DIM}  sales@famsops.local      / sales123   [sales]${RESET}"
  echo -e "  ${DIM}  ops@famsops.local        / ops123     [operations]${RESET}"
  echo -e "  ${DIM}  mgmt@famsops.local       / mgmt123    [management]${RESET}"
  echo ""
  echo -e "  ${BOLD}Handy commands:${RESET}"
  echo -e "  ${DIM}  ./start.sh logs    ${RESET}→ tail all logs"
  echo -e "  ${DIM}  ./start.sh status  ${RESET}→ health check"
  echo -e "  ${DIM}  ./start.sh stop    ${RESET}→ stop everything"
  echo -e "  ${DIM}  ./start.sh shell api${RESET}→ backend shell"
  echo -e "  ${DIM}  ./start.sh shell db ${RESET}→ psql shell"
  divider; echo ""
}

# ── Command implementations ──────────────────────────────────
cmd_setup() {
  print_banner; check_docker; setup_env; build_images
  local do_seed="false"
  [ ! -f "$SEED_FLAG" ] && do_seed="true"
  start_containers "$do_seed"
  wait_healthy
  [ "$do_seed" = "true" ] && touch "$SEED_FLAG" && success "Seed complete (will not run again automatically)"
  print_summary
}

cmd_start() {
  print_banner; check_docker; setup_env
  SEED=false $COMPOSE up -d
  wait_healthy; print_summary
}

cmd_stop() {
  print_banner; check_docker
  step "Stopping"
  $COMPOSE down
  success "All containers stopped"; echo ""
}

cmd_restart() {
  check_docker
  step "Restarting"
  $COMPOSE down
  setup_env
  SEED=false $COMPOSE up -d
  wait_healthy; MODE="restart" print_summary
}

cmd_reset() {
  print_banner; check_docker; setup_env
  step "Reset — WARNING: all data will be wiped"
  warn "This deletes the database volume. All data will be lost."
  echo ""
  read -rp "  Type 'yes' to confirm: " confirm
  [[ "$confirm" != "yes" ]] && { info "Cancelled."; exit 0; }
  $COMPOSE down -v
  rm -f "$SEED_FLAG"
  success "Volumes removed"
  build_images
  start_containers "true"
  wait_healthy
  touch "$SEED_FLAG"
  print_summary
}

cmd_build() {
  print_banner; check_docker
  step "Rebuilding images (no cache)"
  $COMPOSE build --no-cache --parallel
  success "Done. Run './start.sh start' to launch."; echo ""
}

cmd_logs() {
  check_docker
  case "${2:-all}" in
    api|backend)  docker logs -f --tail=100 famsops-api ;;
    web|frontend) docker logs -f --tail=100 famsops-web ;;
    db|postgres)  docker logs -f --tail=100 famsops-db  ;;
    *)
      echo -e "\n${BOLD}All logs (Ctrl+C to stop)…${RESET}\n"
      $COMPOSE logs -f --tail=50
      ;;
  esac
}

cmd_status() {
  check_docker
  step "Container status"
  $COMPOSE ps
  echo ""
  step "Health checks"
  for name in famsops-db famsops-api famsops-web; do
    local h r
    h=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}—{{end}}' "$name" 2>/dev/null || echo "not found")
    r=$(docker inspect --format='{{.State.Running}}' "$name" 2>/dev/null || echo "false")
    if [ "$r" = "true" ]; then success "$name  [ $h ]"
    else warn "$name  [ stopped ]"; fi
  done
  echo ""
}

cmd_shell() {
  check_docker
  case "${2:-api}" in
    api|backend)  docker exec -it famsops-api sh ;;
    db|postgres)
      set -a; source "$ENV_FILE" 2>/dev/null || true; set +a
      docker exec -it famsops-db psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-famsops}" ;;
    web|frontend) docker exec -it famsops-web sh ;;
    *) err "Unknown target. Use: api | db | web" ;;
  esac
}

cmd_migrate() {
  check_docker
  step "Running migrations"
  docker exec famsops-api node src/db/migrate.js
  success "Done"; echo ""
}

cmd_seed() {
  check_docker
  step "Running seed"
  docker exec famsops-api node src/db/seed.js
  touch "$SEED_FLAG"
  success "Done"; echo ""
}

cmd_help() {
  echo ""
  echo -e "${BOLD}Famsops v2 — Docker Commands${RESET}"
  echo ""
  echo -e "  ${CYAN}./start.sh${RESET}              First-time setup: build, seed, start"
  echo -e "  ${CYAN}./start.sh start${RESET}        Start without rebuild/seed"
  echo -e "  ${CYAN}./start.sh stop${RESET}         Stop all containers"
  echo -e "  ${CYAN}./start.sh restart${RESET}      Stop then start"
  echo -e "  ${CYAN}./start.sh reset${RESET}        Wipe data, rebuild, reseed"
  echo -e "  ${CYAN}./start.sh build${RESET}        Rebuild images only"
  echo -e "  ${CYAN}./start.sh logs [api|web|db]${RESET}  Tail logs"
  echo -e "  ${CYAN}./start.sh status${RESET}       Container health"
  echo -e "  ${CYAN}./start.sh shell [api|db|web]${RESET} Shell into container"
  echo -e "  ${CYAN}./start.sh migrate${RESET}      Run DB migrations"
  echo -e "  ${CYAN}./start.sh seed${RESET}         Run DB seed"
  echo ""
}

# ── Router ───────────────────────────────────────────────────
case "$MODE" in
  setup|"")   cmd_setup ;;
  start)      cmd_start ;;
  stop)       cmd_stop ;;
  restart)    cmd_restart ;;
  reset)      cmd_reset ;;
  build)      cmd_build ;;
  logs)       cmd_logs "$@" ;;
  status)     cmd_status ;;
  shell)      cmd_shell "$@" ;;
  migrate)    cmd_migrate ;;
  seed)       cmd_seed ;;
  help|--help) cmd_help ;;
  *)
    warn "Unknown command: $MODE"
    cmd_help; exit 1 ;;
esac
