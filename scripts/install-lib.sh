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

# Postgres password is embedded in DATABASE_URL — must be URL-safe (no @ : / # etc).
rand_postgres_password() {
  tr -dc 'A-Za-z0-9' </dev/urandom | head -c "${1:-24}"
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

write_nginx_global_tuning() {
  local domain="$1"
  local bucket=64
  local len=${#domain}

  rm -f /etc/nginx/conf.d/00-vpsdeploy-global.conf 2>/dev/null || true

  while (( bucket < len )); do
    bucket=$((bucket * 2))
  done
  if (( bucket < 64 )); then
    bucket=64
  fi

  # conf.d snippet is included in http{} — do not duplicate if already in nginx.conf.
  if grep -qE '^\s*server_names_hash_bucket_size' /etc/nginx/nginx.conf 2>/dev/null; then
    log "nginx.conf already sets server_names_hash_bucket_size (increase there if nginx -t fails)"
    return 0
  fi

  cat > /etc/nginx/conf.d/00-dockpilot-global.conf <<EOF
# Managed by dock-pilot — long server_name values (e.g. ${domain})
server_names_hash_bucket_size ${bucket};
server_names_hash_max_size 512;
EOF
  log "Wrote /etc/nginx/conf.d/00-dockpilot-global.conf (bucket=${bucket})"
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
  # Legacy vps-deploy tuning file breaks nginx -t (duplicate server_names_hash_*).
  rm -f /etc/nginx/conf.d/00-vpsdeploy-global.conf 2>/dev/null || true
  # Ubuntu default site often captures port 80 before the panel vhost.
  rm -f "${enabled}/default" "${enabled}/default.conf" 2>/dev/null || true
  ln -sf "$available/$name" "$enabled/$name"
  nginx -t
  systemctl reload nginx
}

issue_panel_cert() {
  local domain="$1" email="$2"
  rm -f /etc/nginx/conf.d/00-vpsdeploy-global.conf 2>/dev/null || true
  certbot --nginx -d "$domain" --non-interactive --agree-tos -m "$email" --redirect --no-eff-email
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

postgres_container_health() {
  docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' dock-pilot-postgres 2>/dev/null \
    || echo "missing"
}

wait_for_postgres() {
  local tries=45
  local health
  health="$(postgres_container_health)"
  if [[ "$health" == "healthy" ]]; then
    return 0
  fi

  while ((tries-- > 0)); do
    health="$(postgres_container_health)"
    if [[ "$health" == "healthy" ]]; then
      return 0
    fi
    if [[ "$health" == "none" ]] && docker inspect --format='{{.State.Running}}' dock-pilot-postgres 2>/dev/null | grep -q true; then
      return 0
    fi
    if (( tries % 10 == 9 )); then
      log "Still waiting for PostgreSQL (${tries} checks left, health=${health})..."
    fi
    sleep 2
  done
  return 1
}

# True if something listens on this TCP port (any interface).
port_in_use() {
  local port="$1"
  ss -tln 2>/dev/null | awk '{print $4}' | grep -qE ":${port}$"
}

# Return the first free port starting at preferred (checks up to 100 candidates).
pick_free_port() {
  local preferred="$1"
  local p="$preferred"
  local limit=$((preferred + 100))
  while ((p < limit)); do
    if ! port_in_use "$p"; then
      echo "$p"
      return 0
    fi
    ((p++))
  done
  die "No free host port near ${preferred} (needed for DockPilot)"
}

postgres_volume_exists() {
  docker volume inspect dock-pilot_dock_pilot_pg >/dev/null 2>&1 \
    || docker volume inspect dock_pilot_pg >/dev/null 2>&1
}

# Write HTTP vhost, reload nginx, issue Let's Encrypt, update API CORS. Fails on cert error unless skip_cert.
configure_panel_nginx() {
  local install_dir="$1" domain="$2" email="$3" api_port="$4" frontend_port="$5" skip_cert="$6"
  local template="${install_dir}/install/nginx-panel.conf.template"
  local available="/etc/nginx/sites-available/dockpilot-panel.conf"

  [[ -f "$template" ]] || die "Missing ${template}"

  log "Writing panel nginx config for ${domain} (api=${api_port}, ui=${frontend_port}) ..."
  write_nginx_global_tuning "$domain"
  write_panel_nginx "$template" "$domain" "$api_port" "$frontend_port" "$available"
  log "Enabling nginx site and reloading ..."
  enable_panel_nginx /etc/nginx/sites-available /etc/nginx/sites-enabled

  if ! curl -fsS -H "Host: ${domain}" "http://127.0.0.1/" >/dev/null 2>&1; then
    log "WARN: HTTP probe for Host: ${domain} failed — check DNS and nginx"
  fi

  if [[ "$skip_cert" -eq 1 ]]; then
    log "Skipping TLS (--skip-cert)"
    return 0
  fi

  log "Issuing Let's Encrypt certificate for ${domain} ..."
  if ! issue_panel_cert "$domain" "$email"; then
    die "certbot failed for ${domain}. Check DNS → this VPS, ports 80/443 open, and: certbot --nginx -d ${domain}"
  fi

  log "TLS certificate installed for ${domain}"
}

verify_panel_https() {
  local domain="$1"
  curl -fsS "https://${domain}/" >/dev/null 2>&1
}
