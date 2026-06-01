#!/usr/bin/env bash
# Check bundled PostgreSQL connectivity using DATABASE_URL from .env.
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

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set in .env" >&2
  exit 1
fi

SAFE_URL="${DATABASE_URL//:\/\/[^@]*@/://***@}"
echo "DATABASE_URL=${SAFE_URL}"

echo "Starting PostgreSQL if needed..."
docker compose -f "$COMPOSE_FILE" up -d postgres

echo "Waiting for postgres..."
for i in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "${POSTGRES_USER:-dockpilot}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Migration status:"
docker compose -f "$COMPOSE_FILE" run --rm migrate status || true

echo ""
echo "Tables (via migrate container):"
if docker compose -f "$COMPOSE_FILE" run --rm --entrypoint sh migrate -c \
  "command -v psql >/dev/null && psql \"\$GOOSE_DBSTRING\" -c '\\dt' || goose -dir /migrations postgres \"\$GOOSE_DBSTRING\" status" 2>/dev/null; then
  echo "OK"
else
  echo "Could not list tables (run ./scripts/dock-pilot-migrate.sh first)." >&2
fi
