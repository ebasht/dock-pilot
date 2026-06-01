#!/usr/bin/env bash
# Starts backend + frontend after DB is up (run `make up` first, or this calls it).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! docker compose ps postgres 2>/dev/null | grep -q "running"; then
  "$ROOT/scripts/local-up.sh"
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

export DATABASE_URL="${DATABASE_URL:-postgres://dockpilot:dockpilot@localhost:5432/dockpilot?sslmode=disable}"
export HTTP_ADDR="${HTTP_ADDR:-:8080}"
export SECRETS_ENCRYPTION_KEY="${SECRETS_ENCRYPTION_KEY:?SECRETS_ENCRYPTION_KEY must be set in .env}"
export API_TOKEN="${API_TOKEN:?API_TOKEN must be set in .env}"

cleanup() {
  trap - EXIT INT TERM
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend on ${HTTP_ADDR}..."
(cd backend && go run ./cmd/server) &
BACK_PID=$!

echo "Starting frontend on http://localhost:3000 ..."
(cd frontend && npm run dev) &
FRONT_PID=$!

wait $BACK_PID $FRONT_PID
