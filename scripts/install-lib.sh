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
  local n="${1:-32}" raw
  if command -v openssl >/dev/null 2>&1; then
    raw="$(openssl rand -base64 64 | tr -dc 'A-Za-z0-9!@#%^&*-_=+')"
    echo -n "${raw:0:n}"
  else
  (
    set +o pipefail
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$n"
  )
  fi
}

# Postgres password is embedded in DATABASE_URL — must be URL-safe (no @ : / # etc).
rand_postgres_password() {
  local n="${1:-24}" hex
  if command -v openssl >/dev/null 2>&1; then
    hex="$(openssl rand -hex "$(( (n + 1) / 2 ))")"
    echo -n "${hex:0:n}"
  else
  (
    set +o pipefail
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$n"
  )
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

ensure_docker_nginx_running() {
  systemctl enable docker nginx 2>/dev/null || true
  systemctl start docker nginx 2>/dev/null || true
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

# Many VPS have no IPv6 — default Ubuntu nginx listens on [::]:80 and fails to start.
ipv6_available() {
  [[ -f /proc/net/if_inet6 ]] || return 1
  [[ "$(cat /proc/sys/net/ipv6/conf/all/disable_ipv6 2>/dev/null)" == "1" ]] && return 1
  return 0
}

fix_nginx_no_ipv6() {
  if ipv6_available; then
    return 0
  fi
  local f
  log "IPv6 not available on this host — commenting out listen [::] in nginx configs"
  while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    [[ "$f" == *".dpkg-"* ]] && continue
    if grep -qE '^\s*listen\s+\[::\]:' "$f" 2>/dev/null; then
      sed -i -E 's/^\s*listen\s+\[::\]:/# listen [::]:/' "$f"
      log "  patched: $f"
    fi
  done < <(find /etc/nginx -type f 2>/dev/null || true)
}

log_nginx_ipv6_listeners() {
  local hits
  hits="$(grep -rnE '^\s*listen\s+\[::\]:' /etc/nginx 2>/dev/null | head -5 || true)"
  if [[ -n "$hits" ]]; then
    log "Remaining listen [::] directives:"
    while IFS= read -r line; do
      [[ -n "$line" ]] && log "  $line"
    done <<<"$hits"
  fi
}

block_service_starts() {
  printf '%s\n' '#!/bin/sh' 'exit 101' > /usr/sbin/policy-rc.d
  chmod +x /usr/sbin/policy-rc.d
}

unblock_service_starts() {
  rm -f /usr/sbin/policy-rc.d
}

repair_apt_if_needed() {
  fix_nginx_no_ipv6
  if dpkg --audit 2>/dev/null | grep -q .; then
    log "Repairing interrupted apt/dpkg state..."
    block_service_starts
    apt-get install -y -f -qq 2>/dev/null || apt --fix-broken install -y -qq || true
    dpkg --configure -a 2>/dev/null || true
    unblock_service_starts
    fix_nginx_no_ipv6
  fi
}

install_nginx_package() {
  if command -v nginx >/dev/null 2>&1 \
    && nginx -t >/dev/null 2>&1; then
    fix_nginx_no_ipv6
    return 0
  fi

  if ipv6_available; then
    apt_install nginx
    return $?
  fi

  log "Installing nginx (deferring service start until [::] listeners are disabled)..."
  repair_apt_if_needed
  block_service_starts
  if ! apt_install nginx; then
    unblock_service_starts
    fix_nginx_no_ipv6
    block_service_starts
    apt-get install -y -f -qq 2>/dev/null || apt --fix-broken install -y -qq || true
    dpkg --configure -a 2>/dev/null || true
    apt_install nginx || {
      unblock_service_starts
      return 1
    }
  fi
  unblock_service_starts
  fix_nginx_no_ipv6
  if ! nginx -t; then
    log "nginx -t failed after IPv6 fix — check /etc/nginx"
    log_nginx_ipv6_listeners
    return 1
  fi
  systemctl enable nginx 2>/dev/null || true
  systemctl start nginx 2>/dev/null || true
  return 0
}

install_packages() {
  if host_prereqs_met; then
    log "docker, compose, nginx, and certbot already present — skipping apt"
    ensure_docker_nginx_running
    return 0
  fi

  local os
  os="$(detect_os)"
  case "$os" in
    ubuntu|debian)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq

      apt_install ca-certificates curl gnupg lsb-release || return 1

      repair_apt_if_needed

      if ! command -v nginx >/dev/null 2>&1 || ! nginx -t >/dev/null 2>&1; then
        install_nginx_package || return 1
      else
        log "nginx already installed — skipping"
        fix_nginx_no_ipv6
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
      ensure_docker_nginx_running
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

apply_nginx_hash_tuning() {
  local bucket="${1:-128}"
  local max_size="${2:-2048}"
  local nginx_conf="/etc/nginx/nginx.conf"
  local conf_snippet="/etc/nginx/conf.d/00-dockpilot-global.conf"

  rm -f /etc/nginx/conf.d/00-vpsdeploy-global.conf 2>/dev/null || true

  # Single source of truth: conf.d (API also writes this file on deploy).
  # Comment out active hash lines in nginx.conf — duplicates break nginx -t.
  if grep -qE '^\s*server_names_hash_bucket_size' "$nginx_conf" 2>/dev/null; then
    sed -i -E 's/^\s*server_names_hash_bucket_size\s+[^;]+;/# server_names_hash_bucket_size (use conf.d);/' "$nginx_conf"
  fi
  if grep -qE '^\s*server_names_hash_max_size' "$nginx_conf" 2>/dev/null; then
    sed -i -E 's/^\s*server_names_hash_max_size\s+[^;]+;/# server_names_hash_max_size (use conf.d);/' "$nginx_conf"
  fi

  cat >"$conf_snippet" <<EOF
# Managed by dock-pilot
server_names_hash_bucket_size ${bucket};
server_names_hash_max_size ${max_size};
EOF
}

write_nginx_global_tuning() {
  local domain="$1"
  local bucket=128
  local max_size=2048
  local len=${#domain}

  while (( bucket < len )); do
    bucket=$((bucket * 2))
  done

  apply_nginx_hash_tuning "$bucket" "$max_size"
  log "nginx hash tuning (bucket=${bucket}, max_size=${max_size}, domain=${domain})"
}

test_and_reload_nginx() {
  local domain="$1"
  local bucket=128
  local max_size=2048
  local len=${#domain}
  local attempt err

  while (( bucket < len )); do
    bucket=$((bucket * 2))
  done

  for attempt in 1 2 3 4 5; do
    apply_nginx_hash_tuning "$bucket" "$max_size"
    err="$(mktemp)"
    if nginx -t 2>"$err"; then
      rm -f "$err"
      systemctl reload nginx
      return 0
    fi
    if grep -q 'duplicate' "$err" 2>/dev/null && grep -q 'server_names_hash' "$err" 2>/dev/null; then
      log "Fixing duplicate server_names_hash (comment nginx.conf, keep conf.d) ..."
      sed -i -E 's/^\s*server_names_hash_bucket_size\s+[^;]+;/# server_names_hash_bucket_size (use conf.d);/' /etc/nginx/nginx.conf
      sed -i -E 's/^\s*server_names_hash_max_size\s+[^;]+;/# server_names_hash_max_size (use conf.d);/' /etc/nginx/nginx.conf
      rm -f "$err"
      continue
    fi
    if grep -q 'server_names_hash' "$err" 2>/dev/null; then
      log "nginx -t failed (server_names_hash bucket=${bucket}) — retrying with larger hash table ..."
      bucket=$((bucket * 2))
      max_size=$((max_size * 2))
      rm -f "$err"
      continue
    fi
    cat "$err" >&2
    rm -f "$err"
    return 1
  done
  die "nginx -t failed after tuning server_names_hash (last bucket=${bucket})"
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
  local available="$1" enabled="$2" domain="$3" name="dockpilot-panel.conf"
  rm -f /etc/nginx/conf.d/00-vpsdeploy-global.conf 2>/dev/null || true
  rm -f "${enabled}/default" "${enabled}/default.conf" 2>/dev/null || true
  fix_nginx_no_ipv6
  ln -sf "$available/$name" "$enabled/$name"
  test_and_reload_nginx "$domain"
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
  enable_panel_nginx /etc/nginx/sites-available /etc/nginx/sites-enabled "$domain"

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
