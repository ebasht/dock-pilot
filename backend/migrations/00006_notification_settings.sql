-- +goose Up
CREATE TABLE notification_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT false,
    telegram_chat_id TEXT NOT NULL DEFAULT '',
    daily_digest_enabled BOOLEAN NOT NULL DEFAULT false,
    daily_digest_hour INT NOT NULL DEFAULT 9 CHECK (daily_digest_hour >= 0 AND daily_digest_hour <= 23),
    alert_on_incident_enabled BOOLEAN NOT NULL DEFAULT true,
    encrypted_telegram_bot_token BYTEA,
    last_daily_sent_at TIMESTAMPTZ,
    last_overall_by_site JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO notification_settings (id) VALUES (1);

-- +goose Down
DROP TABLE IF EXISTS notification_settings;
