#!/usr/bin/env bash
# Build release tarball for GitHub Releases: images + compose + install files.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  VERSION="v$(date +%Y.%m.%d)"
fi
TAG="${VERSION#v}"
OUTPUT_DIR="${OUTPUT_DIR:-dist}"
RELEASE_DIR="${OUTPUT_DIR}/dock-pilot-${TAG}"
BUNDLE="${OUTPUT_DIR}/dock-pilot-${TAG}.tar.gz"

log() { echo "[release] $*"; }

log "Building Docker images (NEXT_PUBLIC_API_URL=auto)..."
export NEXT_PUBLIC_API_URL=auto
export DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
"$ROOT/scripts/docker-export.sh"

mkdir -p "$RELEASE_DIR"
cp "${OUTPUT_DIR}/dock-pilot-images.tar.gz" "$RELEASE_DIR/"
cp docker-compose.full.yml docker-compose.dock-pilot.yml docker-compose.dock-pilot-migrate.yml "$RELEASE_DIR/"
cp -r install scripts "$RELEASE_DIR/"
cp .env.dock-pilot.example "$RELEASE_DIR/"
echo "$VERSION" > "$RELEASE_DIR/VERSION"

tar -czf "$BUNDLE" -C "$OUTPUT_DIR" "dock-pilot-${TAG}"
ls -lh "$BUNDLE"

cat <<EOF

Release bundle: ${BUNDLE}

Upload to GitHub Release as: dock-pilot-${TAG}.tar.gz
Tag: ${VERSION}

One-line install on VPS (after release is published):

  curl -fsSL https://raw.githubusercontent.com/e-bashtan/dock-pilot/main/scripts/install.sh | sudo bash -s -- \\
    --domain deploy.example.com --email you@example.com --version ${VERSION}

EOF
