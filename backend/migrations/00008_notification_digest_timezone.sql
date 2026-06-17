-- +goose Up
ALTER TABLE notification_settings
    ADD COLUMN daily_digest_timezone TEXT NOT NULL DEFAULT 'UTC';

-- +goose Down
ALTER TABLE notification_settings DROP COLUMN IF EXISTS daily_digest_timezone;
