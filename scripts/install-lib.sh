#!/usr/bin/env bash
# Shared helpers for install.sh
set -euo pipefail

log() { echo "[dock-pilot] $*"; }
die() { echo "[dock-pilot] ERROR: $*" >&2; exit 1; }

need_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "Run as root: sudo $0 $*"
  fi
}

rand_secret() {
  local n="${1:-32}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -dc 'A-Za-z0-9!@#%^&*-_=+' | head -c "$n"
  else
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$n"
  fi
}

detect_os() {
  if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    source /etc/os-release
    echo "${ID:-unknown}"
  else
    echo unknown
  fi
}

# True when the host can run DockPilot without apt (docker compose + nginx + certbot).
host_prereqs_met() {
  command -v docker >/dev/null 2>&1 \
    && docker compose version >/dev/null 2>&1 \
    && command -v nginx >/dev/null 2>&1 \
    && command -v certbot >/dev/null 2>&1
}

apt_install() {
  # shellcheck disable=SC2068
  apt-get install -y -qq "$@" || {
    log "apt install failed for: $*"
    log "Try: apt --fix-broken install && apt-get update"
    log "Held packages: apt-mark showhold"
    log "If docker/nginx/certbot are already installed, re-run with --skip-packages"
    return 1
  }
}

install_packages() {
  if host_prereqs_met; then
    log "docker, compose, nginx, and certbot already present — skipping apt"
    return 0
  fi

  local os
  os="$(detect_os)"
  case "$os" in
    ubuntu|debian)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq

      apt_install ca-certificates curl gnupg lsb-release || return 1

      if ! command -v nginx >/dev/null 2>&1; then
        apt_install nginx || return 1
      else
        log "nginx already installed — skipping"
      fi

      if ! command -v certbot >/dev/null 2>&1; then
        apt_install certbot python3-certbot-nginx || return 1
      else
        log "certbot already installed — skipping"
      fi

      if ! command -v docker >/dev/null 2>&1; then
        apt_install docker.io || return 1
      else
        log "docker already installed — skipping"
      fi

      if ! docker compose version >/dev/null 2>&1; then
        apt_install docker-compose-plugin || apt_install docker-compose-v2 || return 1
      else
        log "docker compose already available — skipping"
      fi

      systemctl enable docker nginx 2>/dev/null || true
      systemctl start docker nginx 2>/dev/null || true
      ;;
    *)
      die "Unsupported OS: $os (need Ubuntu/Debian). Install docker, nginx, certbot manually."
      ;;
  esac
}

github_latest_tag() {
  local repo="$1"
  curl -fsSL "https://api.github.com/repos/${repo}/releases/latest" \
    | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4
}

download_release() {
  local repo="$1" version="$2" dest="$3"
  local url
  if [[ "$version" == "latest" ]]; then
    version="$(github_latest_tag "$repo")"
    [[ -n "$version" ]] || die "Could not resolve latest release for ${repo}"
  fi
  url="https://github.com/${repo}/releases/download/${version}/dock-pilot-${version#v}.tar.gz"
  log "Downloading ${url} ..."
  curl -fsSL "$url" -o "$dest"
}

write_panel_nginx() {
  local template="$1" domain="$2" api_port="$3" frontend_port="$4" out="$5"
  sed \
    -e "s/{{DOMAIN}}/${domain}/g" \
    -e "s/{{API_PORT}}/${api_port}/g" \
    -e "s/{{FRONTEND_PORT}}/${frontend_port}/g" \
    "$template" >"$out"
}

enable_panel_nginx() {
  local available="$1" enabled="$2" name="dockpilot-panel.conf"
  # Ubuntu default site often captures port 80 before the panel vhost.
  rm -f "${enabled}/default" "${enabled}/default.conf" 2>/dev/null || true
  ln -sf "$available/$name" "$enabled/$name"
  nginx -t
  systemctl reload nginx
}

issue_panel_cert() {
  local domain="$1" email="$2"
  certbot --nginx -d "$domain" --non-interactive --agree-tos -m "$email" --redirect
}

wait_for_api() {
  local port="$1" tries=60
  while ((tries-- > 0)); do
    if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}
