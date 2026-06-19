CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    primary_url TEXT NOT NULL,
    git_repo_url TEXT NOT NULL DEFAULT '',
    git_branch TEXT NOT NULL DEFAULT 'main',
    dockerfile_path TEXT NOT NULL DEFAULT 'Dockerfile',
    build_context TEXT NOT NULL DEFAULT '.',
    container_port INT NOT NULL DEFAULT 3000,
    host_port INT,
    nginx_ssl_enabled BOOLEAN NOT NULL DEFAULT true,
    nginx_force_https BOOLEAN NOT NULL DEFAULT true,
    site_type TEXT NOT NULL DEFAULT 'web',
    docker_volume_mounts TEXT NOT NULL DEFAULT '',
    docker_named_volumes TEXT NOT NULL DEFAULT '',
    docker_network_host BOOLEAN NOT NULL DEFAULT false,
    health_check_path TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE site_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (site_id, domain)
);

CREATE TABLE site_env_vars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (site_id, key),
    CONSTRAINT site_env_vars_key_not_empty CHECK (length(trim(key)) > 0)
);

CREATE TABLE site_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    encrypted_value BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (site_id, key),
    CONSTRAINT site_secrets_key_not_empty CHECK (length(trim(key)) > 0)
);

CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    message TEXT NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deployment_logs (
    id BIGSERIAL PRIMARY KEY,
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    level TEXT NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT false,
    telegram_chat_id TEXT NOT NULL DEFAULT '',
    telegram_http_proxy TEXT NOT NULL DEFAULT '',
    daily_digest_enabled BOOLEAN NOT NULL DEFAULT false,
    daily_digest_hour INT NOT NULL DEFAULT 9 CHECK (daily_digest_hour >= 0 AND daily_digest_hour <= 23),
    daily_digest_timezone TEXT NOT NULL DEFAULT 'UTC',
    alert_on_incident_enabled BOOLEAN NOT NULL DEFAULT true,
    encrypted_telegram_bot_token BYTEA,
    last_daily_sent_at TIMESTAMPTZ,
    last_overall_by_site JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
