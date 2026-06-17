#!/usr/bin/env bash
# Configure host nginx + TLS for the panel (used by install.sh and for repair re-runs).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GITHUB_REPO="${DOCK_PILOT_GITHUB_REPO:-e-bashtan/dock-pilot}"
SKIP_CERT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-cert) SKIP_CERT=1; shift ;;
    -h|--help)
      echo "Usage: configure-panel-nginx.sh [--skip-cert]"
      echo "Reads PANEL_DOMAIN, API_PORT, FRONTEND_PORT, CERTBOT_EMAIL from .env"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

[[ -f .env ]] || { echo "Missing .env in ${ROOT}" >&2; exit 1; }
set -a
# shellcheck disable=SC1091
source .env
set +a

DOMAIN="${PANEL_DOMAIN:-}"
EMAIL="${CERTBOT_EMAIL:-}"
API_PORT="${API_PORT:-8080}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

[[ -n "$DOMAIN" ]] || { echo "Set PANEL_DOMAIN in .env" >&2; exit 1; }
[[ -n "$EMAIL" ]] || { echo "Set CERTBOT_EMAIL in .env" >&2; exit 1; }

tmp="$(mktemp)"
if curl -fsSL "https://raw.githubusercontent.com/${GITHUB_REPO}/main/scripts/install-lib.sh" -o "$tmp" 2>/dev/null; then
  # shellcheck source=/dev/null
  source "$tmp"
else
  # shellcheck source=scripts/install-lib.sh
  source "${ROOT}/scripts/install-lib.sh"
fi
rm -f "$tmp"

configure_panel_nginx "$ROOT" "$DOMAIN" "$EMAIL" "$API_PORT" "$FRONTEND_PORT" "$SKIP_CERT"
PANEL_URL="https://${DOMAIN}"
[[ "$SKIP_CERT" -eq 1 ]] && PANEL_URL="http://${DOMAIN}"
sed -i "s|^CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=${PANEL_URL}|" .env
docker compose -f docker-compose.full.yml up -d api 2>/dev/null \
  || docker compose -f docker-compose.dock-pilot.yml up -d api
log "Panel: ${PANEL_URL}"
[[ -n "${API_TOKEN:-}" ]] && write_credentials_file "$ROOT" "$PANEL_URL" "$API_TOKEN"
