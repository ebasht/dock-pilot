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

install_packages() {
  local os
  os="$(detect_os)"
  case "$os" in
    ubuntu|debian)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq
      apt-get install -y -qq \
        ca-certificates curl gnupg lsb-release \
        nginx certbot python3-certbot-nginx \
        docker.io docker-compose-v2 2>/dev/null \
        || apt-get install -y -qq docker.io docker-compose-plugin
      systemctl enable --now docker nginx
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
