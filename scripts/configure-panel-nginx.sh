#!/usr/bin/env bash
# Configure host nginx for the DockPilot panel (run on VPS as root after stack is up).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing .env in ${ROOT}" >&2
  exit 1
fi

# shellcheck disable=SC1091
source .env

DOMAIN="${PANEL_DOMAIN:-}"
API_PORT="${API_PORT:-8080}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
EMAIL="${CERTBOT_EMAIL:-}"

[[ -n "$DOMAIN" ]] || { echo "Set PANEL_DOMAIN in .env" >&2; exit 1; }

# shellcheck source=scripts/install-lib.sh
source "${ROOT}/scripts/install-lib.sh"

PANEL_AVAILABLE="/etc/nginx/sites-available/dockpilot-panel.conf"
PANEL_TEMPLATE="${ROOT}/install/nginx-panel.conf.template"
[[ -f "$PANEL_TEMPLATE" ]] || { echo "Missing ${PANEL_TEMPLATE}" >&2; exit 1; }

write_panel_nginx "$PANEL_TEMPLATE" "$DOMAIN" "$API_PORT" "$FRONTEND_PORT" "$PANEL_AVAILABLE"
enable_panel_nginx /etc/nginx/sites-available /etc/nginx/sites-enabled

if [[ -n "$EMAIL" ]] && command -v certbot >/dev/null 2>&1; then
  log "Issuing Let's Encrypt certificate for ${DOMAIN}..."
  if issue_panel_cert "$DOMAIN" "$EMAIL"; then
    sed -i "s|^CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=https://${DOMAIN}|" .env
    docker compose -f docker-compose.full.yml up -d api 2>/dev/null \
      || docker compose -f docker-compose.dock-pilot.yml up -d api 2>/dev/null \
      || true
    log "Panel: https://${DOMAIN}"
  else
    log "certbot failed — panel available at http://${DOMAIN}"
  fi
else
  log "Panel nginx configured (HTTP). Set CERTBOT_EMAIL in .env and re-run for HTTPS."
  log "Panel: http://${DOMAIN}"
fi
