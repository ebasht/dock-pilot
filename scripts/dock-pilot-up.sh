#!/usr/bin/env bash
# VPS: start bundled PostgreSQL, migrate, then API + frontend.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
COMPOSE_FILE="${DOCK_PILOT_COMPOSE:-docker-compose.dock-pilot.yml}"

if [[ ! -f .env ]]; then
  echo "Create .env from .env.dock-pilot.example first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

for var in POSTGRES_PASSWORD DATABASE_URL SECRETS_ENCRYPTION_KEY API_TOKEN CORS_ALLOWED_ORIGINS CERTBOT_EMAIL; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing required variable in .env: ${var}" >&2
    exit 1
  fi
done

echo "Starting PostgreSQL..."
docker compose -f "$COMPOSE_FILE" up -d postgres

echo "Applying migrations..."
docker compose -f "$COMPOSE_FILE" run --rm migrate

echo "Starting API and frontend..."
docker compose -f "$COMPOSE_FILE" up -d api frontend

echo ""
docker compose -f "$COMPOSE_FILE" ps -a
