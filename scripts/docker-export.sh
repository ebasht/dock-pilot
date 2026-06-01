#!/usr/bin/env bash
# Build images and save to dist/*.tar.gz for copying to a VPS (docker load).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

API_IMAGE="${API_IMAGE:-dock-pilot-api:latest}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-dock-pilot-frontend:latest}"
MIGRATE_IMAGE="${MIGRATE_IMAGE:-dock-pilot-migrate:latest}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-dock-pilot-postgres:latest}"
POSTGRES_BASE="${POSTGRES_BASE:-postgres:16-alpine}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
export DOCKER_PLATFORM
OUTPUT_DIR="${OUTPUT_DIR:-dist}"
BUNDLE="${BUNDLE:-${OUTPUT_DIR}/dock-pilot-images.tar.gz}"

mkdir -p "$OUTPUT_DIR"

"$ROOT/scripts/docker-build.sh"

echo "Building migrate image (${DOCKER_PLATFORM})..."
docker build --platform "$DOCKER_PLATFORM" -t "$MIGRATE_IMAGE" -f backend/Dockerfile.migrate backend

echo "Pulling PostgreSQL (${POSTGRES_BASE}) for ${DOCKER_PLATFORM}..."
docker pull --platform "$DOCKER_PLATFORM" "$POSTGRES_BASE"
docker tag "$POSTGRES_BASE" "$POSTGRES_IMAGE"

echo "Saving images to ${BUNDLE}..."
docker save \
  "$API_IMAGE" \
  "$FRONTEND_IMAGE" \
  "$MIGRATE_IMAGE" \
  "$POSTGRES_IMAGE" \
  | gzip > "$BUNDLE"

ls -lh "$BUNDLE"

cat <<EOF

Export ready (${POSTGRES_IMAGE} included — no separate Postgres install needed).

  scp ${BUNDLE} docker-compose.dock-pilot.yml .env.dock-pilot.example scripts/dock-pilot-*.sh user@your-vps:/opt/dock-pilot/

On VPS:

  cd /opt/dock-pilot
  cp .env.dock-pilot.example .env && chmod 600 .env
  gunzip -c dock-pilot-images.tar.gz | docker load
  chmod +x scripts/dock-pilot-*.sh
  ./scripts/dock-pilot-up.sh

Or use the one-line installer: scripts/install.sh

EOF
