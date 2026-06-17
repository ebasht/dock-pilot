#!/usr/bin/env bash
# Reset bundled Postgres (fixes password mismatch after re-install). Destroys panel DB data.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${DOCK_PILOT_COMPOSE:-docker-compose.full.yml}"
[[ -f docker-compose.dock-pilot.yml ]] && [[ ! -f docker-compose.full.yml ]] && COMPOSE_FILE=docker-compose.dock-pilot.yml

if [[ ! -f .env ]]; then
  echo "Missing .env in ${ROOT}" >&2
  exit 1
fi

# shellcheck source=scripts/install-lib.sh
source "${ROOT}/scripts/install-lib.sh"

need_root

PW="$(rand_postgres_password 24)"
log "Stopping stack and removing Postgres volume..."
docker compose -f "$COMPOSE_FILE" down

for vol in dock-pilot_dock_pilot_pg dock_pilot_pg; do
  if docker volume inspect "$vol" >/dev/null 2>&1; then
    docker volume rm "$vol"
    log "Removed volume ${vol}"
  fi
done

set -a
# shellcheck disable=SC1091
source .env
set +a

API_TOKEN="${API_TOKEN:-$(rand_secret 32)}"
SECRETS_KEY="${SECRETS_ENCRYPTION_KEY:-$(rand_secret 32)}"

cat > .env <<EOF
# Reset by reset-postgres-volume.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
POSTGRES_USER=dockpilot
POSTGRES_PASSWORD=${PW}
POSTGRES_DB=dockpilot
POSTGRES_IMAGE=${POSTGRES_IMAGE:-dock-pilot-postgres:latest}
DATABASE_URL=postgres://dockpilot:${PW}@postgres:5432/dockpilot?sslmode=disable

HTTP_ADDR=${HTTP_ADDR:-:8080}
SECRETS_ENCRYPTION_KEY=${SECRETS_KEY}
API_TOKEN=${API_TOKEN}

PANEL_DOMAIN=${PANEL_DOMAIN:-}
CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS:-http://localhost:3000}

DEPLOY_MODE=${DEPLOY_MODE:-real}
DEPLOY_WORK_DIR=${DEPLOY_WORK_DIR:-/var/lib/dock-pilot}
HOST_ROOT=${HOST_ROOT:-/host}
NGINX_SITES_AVAILABLE=${NGINX_SITES_AVAILABLE:-/host/etc/nginx/sites-available}
NGINX_SITES_ENABLED=${NGINX_SITES_ENABLED:-/host/etc/nginx/sites-enabled}
CERTBOT_EMAIL=${CERTBOT_EMAIL:-}

API_PORT=${API_PORT:-8080}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

API_IMAGE=${API_IMAGE:-dock-pilot-api:latest}
FRONTEND_IMAGE=${FRONTEND_IMAGE:-dock-pilot-frontend:latest}
MIGRATE_IMAGE=${MIGRATE_IMAGE:-dock-pilot-migrate:latest}
EOF
chmod 600 .env

log "Starting Postgres with new password..."
docker compose -f "$COMPOSE_FILE" up -d postgres
sleep 5
docker compose -f "$COMPOSE_FILE" run --rm migrate
docker compose -f "$COMPOSE_FILE" up -d api frontend --no-deps

log "Done. API token: ${API_TOKEN}"
