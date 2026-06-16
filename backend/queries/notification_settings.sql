-- name: EnsureNotificationSettings :one
INSERT INTO notification_settings (id) VALUES (1)
ON CONFLICT (id) DO UPDATE SET updated_at = notification_settings.updated_at
RETURNING id, enabled, telegram_chat_id, daily_digest_enabled, daily_digest_hour, alert_on_incident_enabled, encrypted_telegram_bot_token, last_daily_sent_at, last_overall_by_site, updated_at;

-- name: GetNotificationSettings :one
SELECT * FROM notification_settings WHERE id = 1;

-- name: UpdateNotificationSettings :one
UPDATE notification_settings SET
    enabled = $1,
    telegram_chat_id = $2,
    telegram_http_proxy = $3,
    daily_digest_enabled = $4,
    daily_digest_hour = $5,
    alert_on_incident_enabled = $6,
    updated_at = now()
WHERE id = 1
RETURNING *;

-- name: UpdateNotificationToken :exec
UPDATE notification_settings
SET encrypted_telegram_bot_token = $1, updated_at = now()
WHERE id = 1;

-- name: ClearNotificationToken :exec
UPDATE notification_settings
SET encrypted_telegram_bot_token = NULL, updated_at = now()
WHERE id = 1;

-- name: UpdateNotificationLastDailySent :exec
UPDATE notification_settings
SET last_daily_sent_at = $1, updated_at = now()
WHERE id = 1;

-- name: UpdateNotificationLastOverall :exec
UPDATE notification_settings
SET last_overall_by_site = $1, updated_at = now()
WHERE id = 1;
