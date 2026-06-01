#!/usr/bin/env bash
# Apply SQL migrations to bundled PostgreSQL from DATABASE_URL in .env.
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

echo "Ensuring PostgreSQL is running..."
docker compose -f "$COMPOSE_FILE" up -d postgres

echo "Running migrations (goose up)..."
docker compose -f "$COMPOSE_FILE" run --rm migrate

echo ""
echo "Migration status:"
docker compose -f "$COMPOSE_FILE" run --rm migrate status

echo ""
echo "Done."
