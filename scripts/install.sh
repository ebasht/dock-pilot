#!/usr/bin/env bash
# One-command VPS install: Docker stack + nginx + Let's Encrypt for the control panel.
#
#   curl -fsSL https://raw.githubusercontent.com/e-bashtan/dock-pilot/main/scripts/install.sh | sudo bash -s -- \
#     --domain deploy.example.com \
#     --email you@example.com
#
set -euo pipefail

INSTALL_DIR="${DOCK_PILOT_INSTALL_DIR:-/opt/dock-pilot}"
GITHUB_REPO="${DOCK_PILOT_GITHUB_REPO:-e-bashtan/dock-pilot}"
VERSION="${DOCK_PILOT_VERSION:-latest}"
DOMAIN=""
EMAIL=""
API_TOKEN=""
FROM_DIR=""
SKIP_CERT=0
SKIP_PACKAGES=0

usage() {
  cat <<EOF
Usage: install.sh --domain DOMAIN --email EMAIL [options]

Required:
  --domain DOMAIN     Public hostname for the panel (DNS A/AAAA → this VPS)
  --email EMAIL       Email for Let's Encrypt

Options:
  --token TOKEN       API token (generated if omitted)
  --install-dir DIR   Install path (default: /opt/dock-pilot)
  --repo OWNER/REPO   GitHub repo (default: e-bashtan/dock-pilot)
  --version TAG       Release tag v0.1.0 or latest
  --from-dir DIR      Use an unpacked release directory
  --skip-cert         HTTP only (testing)
  --skip-packages     Skip apt install of docker/nginx/certbot
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --domain) DOMAIN="$2"; shift 2 ;;
      --email) EMAIL="$2"; shift 2 ;;
      --token) API_TOKEN="$2"; shift 2 ;;
      --install-dir) INSTALL_DIR="$2"; shift 2 ;;
      --repo) GITHUB_REPO="$2"; shift 2 ;;
      --version) VERSION="$2"; shift 2 ;;
      --from-dir) FROM_DIR="$2"; shift 2 ;;
      --skip-cert) SKIP_CERT=1; shift ;;
      --skip-packages) SKIP_PACKAGES=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    esac
  done
}

parse_args "$@"

# --- Bootstrap: download release when not yet on disk (curl | bash) ---
if [[ -z "$FROM_DIR" && ! -f "${INSTALL_DIR}/docker-compose.full.yml" ]]; then
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "[dock-pilot] ERROR: Run as root: sudo bash -s -- ..." >&2
    exit 1
  fi
  [[ -n "$DOMAIN" && -n "$EMAIL" ]] || { usage; exit 1; }

  if [[ "$VERSION" == "latest" ]]; then
    VERSION="$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" \
      | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4)"
    [[ -n "$VERSION" ]] || { echo "No GitHub release found for ${GITHUB_REPO}" >&2; exit 1; }
  fi
  FILE_TAG="${VERSION#v}"
  URL="https://github.com/${GITHUB_REPO}/releases/download/${VERSION}/dock-pilot-${FILE_TAG}.tar.gz"
  echo "[dock-pilot] Downloading ${URL} ..."
  mkdir -p "$INSTALL_DIR"
  curl -fsSL "$URL" | tar -xzf - -C "$INSTALL_DIR" --strip-components=1
  FROM_DIR="$INSTALL_DIR"
fi

SCRIPT_ROOT="${FROM_DIR:-$INSTALL_DIR}"
[[ -f "${SCRIPT_ROOT}/docker-compose.full.yml" ]] || {
  echo "[dock-pilot] ERROR: docker-compose.full.yml not found in ${SCRIPT_ROOT}" >&2
  echo "Publish a GitHub release first, or use --from-dir with a local bundle." >&2
  exit 1
}

# Release tarballs ship frozen scripts; pull latest installer helpers from main when online.
source_install_lib() {
  local bundled="${SCRIPT_ROOT}/scripts/install-lib.sh"
  local url="https://raw.githubusercontent.com/${GITHUB_REPO}/main/scripts/install-lib.sh"
  local tmp
  tmp="$(mktemp)"
  if curl -fsSL "$url" -o "$tmp" 2>/dev/null && [[ -s "$tmp" ]]; then
    # shellcheck source=/dev/null
    source "$tmp"
    rm -f "$tmp"
    log "Installer helpers: ${GITHUB_REPO}@main"
  elif [[ -f "$bundled" ]]; then
    # shellcheck source=/dev/null
    source "$bundled"
    log "Installer helpers: bundled in ${SCRIPT_ROOT} (offline or raw fetch failed)"
  else
    die "install-lib.sh not found"
  fi
}

source_install_lib

[[ -n "$DOMAIN" ]] || { usage; die "--domain is required"; }
[[ -n "$EMAIL" ]] || { usage; die "--email is required"; }
need_root

if [[ "$SKIP_PACKAGES" -eq 0 ]]; then
  log "Installing system packages (docker, nginx, certbot)..."
  if ! install_packages; then
    if host_prereqs_met; then
      log "WARN: apt failed but docker, compose, nginx, and certbot are already installed — continuing"
    else
      die "apt install failed. Fix conflicts (apt --fix-broken install; apt-mark showhold) or install prerequisites manually, then re-run with --skip-packages"
    fi
  fi
fi

command -v docker >/dev/null || die "docker not found"
docker compose version >/dev/null 2>&1 || die "docker compose plugin not found"
command -v nginx >/dev/null || die "nginx not found (install nginx or fix apt, then re-run)"
command -v certbot >/dev/null || die "certbot not found (install certbot or re-run with working apt)"

mkdir -p "$INSTALL_DIR"
if [[ -n "$FROM_DIR" && "$FROM_DIR" != "$INSTALL_DIR" ]]; then
  cp -a "${FROM_DIR}/." "$INSTALL_DIR/"
fi
cd "$INSTALL_DIR"

IMAGES=""
for f in dock-pilot-images.tar.gz dist/dock-pilot-images.tar.gz; do
  [[ -f "$f" ]] && IMAGES="$f" && break
done
[[ -n "$IMAGES" ]] || die "dock-pilot-images.tar.gz not found"
log "Loading Docker images..."
gunzip -c "$IMAGES" | docker load

POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(rand_secret 24)}"
SECRETS_KEY="${SECRETS_ENCRYPTION_KEY:-$(rand_secret 32)}"
API_TOKEN="${API_TOKEN:-$(rand_secret 32)}"
API_PORT="${API_PORT:-8080}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
PANEL_URL="https://${DOMAIN}"
[[ "$SKIP_CERT" -eq 1 ]] && PANEL_URL="http://${DOMAIN}"

cat > .env <<EOF
# Generated by install.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
POSTGRES_USER=dockpilot
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=dockpilot
POSTGRES_IMAGE=dock-pilot-postgres:latest
DATABASE_URL=postgres://dockpilot:${POSTGRES_PASSWORD}@postgres:5432/dockpilot?sslmode=disable

HTTP_ADDR=:8080
SECRETS_ENCRYPTION_KEY=${SECRETS_KEY}
API_TOKEN=${API_TOKEN}

PANEL_DOMAIN=${DOMAIN}
CORS_ALLOWED_ORIGINS=${PANEL_URL}

DEPLOY_MODE=real
DEPLOY_WORK_DIR=/var/lib/dock-pilot
HOST_ROOT=/host
NGINX_SITES_AVAILABLE=/host/etc/nginx/sites-available
NGINX_SITES_ENABLED=/host/etc/nginx/sites-enabled
CERTBOT_EMAIL=${EMAIL}

API_PORT=${API_PORT}
FRONTEND_PORT=${FRONTEND_PORT}

API_IMAGE=dock-pilot-api:latest
FRONTEND_IMAGE=dock-pilot-frontend:latest
MIGRATE_IMAGE=dock-pilot-migrate:latest
EOF
chmod 600 .env

log "Starting stack (postgres → migrate → api → frontend)..."
docker compose -f docker-compose.full.yml up -d postgres
docker compose -f docker-compose.full.yml run --rm migrate
docker compose -f docker-compose.full.yml up -d api frontend

log "Waiting for API..."
wait_for_api "$API_PORT" || die "API not healthy on 127.0.0.1:${API_PORT}"

PANEL_AVAILABLE="/etc/nginx/sites-available/dockpilot-panel.conf"
PANEL_TEMPLATE="${INSTALL_DIR}/install/nginx-panel.conf.template"
write_panel_nginx "$PANEL_TEMPLATE" "$DOMAIN" "$API_PORT" "$FRONTEND_PORT" "$PANEL_AVAILABLE"
enable_panel_nginx /etc/nginx/sites-available /etc/nginx/sites-enabled

if [[ "$SKIP_CERT" -eq 0 ]]; then
  log "Issuing Let's Encrypt certificate for ${DOMAIN}..."
  if issue_panel_cert "$DOMAIN" "$EMAIL"; then
    PANEL_URL="https://${DOMAIN}"
    sed -i "s|^CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=${PANEL_URL}|" .env
    docker compose -f docker-compose.full.yml up -d api
  else
    log "WARN: certbot failed — use http://${DOMAIN} (check DNS → VPS and ports 80/443)"
    PANEL_URL="http://${DOMAIN}"
  fi
fi

CREDENTIALS="${INSTALL_DIR}/credentials.txt"
cat > "$CREDENTIALS" <<EOF
DockPilot — $(date -u +%Y-%m-%dT%H:%M:%SZ)

Panel URL:  ${PANEL_URL}
API token:  ${API_TOKEN}
EOF
chmod 600 "$CREDENTIALS"

cat <<EOF

================================================================================
  DockPilot is ready.

  Panel:     ${PANEL_URL}
  API token: ${API_TOKEN}

  Saved to:  ${CREDENTIALS}

  1. Open the panel and enter the API token.
  2. Add a site with your app domain (DNS must point here).
  3. Deploy — SSL for app domains is issued automatically.

  cd ${INSTALL_DIR} && docker compose -f docker-compose.full.yml ps
================================================================================

EOF
