-- +goose Up
ALTER TABLE notification_settings
    ADD COLUMN telegram_http_proxy TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE notification_settings DROP COLUMN IF EXISTS telegram_http_proxy;
