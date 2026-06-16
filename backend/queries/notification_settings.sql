-- name: GetNotificationSettings :one
SELECT * FROM notification_settings WHERE id = 1;

-- name: UpdateNotificationSettings :one
UPDATE notification_settings SET
    enabled = $1,
    telegram_chat_id = $2,
    daily_digest_enabled = $3,
    daily_digest_hour = $4,
    alert_on_incident_enabled = $5,
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
