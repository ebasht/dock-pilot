#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Running database migrations (Docker)..."
docker compose run --rm migrate
echo "Migrations applied."
