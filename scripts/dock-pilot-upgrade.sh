#!/usr/bin/env bash
# Upgrade DockPilot on VPS: download release, load images, migrate, recreate containers.
#
#   sudo bash scripts/dock-pilot-upgrade.sh v0.1.7
#   sudo bash scripts/dock-pilot-upgrade.sh latest
#
set -euo pipefail

ROOT="${DOCK_PILOT_INSTALL_DIR:-/opt/dock-pilot}"
GITHUB_REPO="${DOCK_PILOT_GITHUB_REPO:-ebasht/dock-pilot}"
VERSION="${1:-latest}"

log() { echo "[dock-pilot] $*"; }
die() { echo "[dock-pilot] ERROR: $*" >&2; exit 1; }

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  die "Run as root: sudo $0 [VERSION]"
fi

[[ -d "$ROOT" ]] || die "Install dir not found: ${ROOT}"
cd "$ROOT"
[[ -f .env ]] || die "Missing ${ROOT}/.env"

if [[ "$VERSION" == "latest" ]]; then
  VERSION="$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" \
    | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4)"
fi
[[ -n "$VERSION" ]] || die "Could not resolve release version"

FILE_TAG="${VERSION#v}"
BUNDLE="/tmp/dock-pilot-${FILE_TAG}.tar.gz"
URL="https://github.com/${GITHUB_REPO}/releases/download/${VERSION}/dock-pilot-${FILE_TAG}.tar.gz"

log "Downloading ${URL} ..."
curl -fsSL "$URL" -o "$BUNDLE"

EXTRACT="$(mktemp -d)"
trap 'rm -rf "$EXTRACT"' EXIT
tar -xzf "$BUNDLE" -C "$EXTRACT" --strip-components=1

IMAGES="${EXTRACT}/dock-pilot-images.tar.gz"
[[ -f "$IMAGES" ]] || die "dock-pilot-images.tar.gz missing in ${VERSION} release"

log "Loading Docker images (replaces :latest tags)..."
gunzip -c "$IMAGES" | docker load

if [[ -f "${EXTRACT}/docker-compose.full.yml" ]]; then
  cp "${EXTRACT}/docker-compose.full.yml" "${ROOT}/docker-compose.full.yml"
  log "Updated docker-compose.full.yml"
fi
if [[ -d "${EXTRACT}/scripts" ]]; then
  cp -a "${EXTRACT}/scripts/." "${ROOT}/scripts/"
  chmod +x "${ROOT}/scripts/"*.sh 2>/dev/null || true
  log "Updated scripts/"
fi

COMPOSE="docker-compose.full.yml"
[[ -f "$COMPOSE" ]] || COMPOSE="docker-compose.dock-pilot.yml"

log "Running migrations..."
set +e
docker compose -f "$COMPOSE" run --rm -T migrate
set -e

log "Recreating postgres + api + frontend (picks up new images and compose)..."
docker rm -f dock-pilot-telegram-socks-relay 2>/dev/null || true
docker compose -f "$COMPOSE" up -d --force-recreate postgres api frontend

if [[ -x "${ROOT}/scripts/configure-panel-nginx.sh" ]]; then
  log "Refreshing nginx panel config..."
  bash "${ROOT}/scripts/configure-panel-nginx.sh" || log "WARN: configure-panel-nginx failed — check nginx manually"
fi

log "Upgrade complete → ${VERSION}"
docker compose -f "$COMPOSE" ps
log "Check version in panel header (e.g. ${VERSION}) or: docker inspect dock-pilot-frontend --format '{{.Image}}'"
