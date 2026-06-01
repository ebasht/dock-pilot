-- name: ListSiteSecrets :many
SELECT id, site_id, key, created_at, updated_at FROM site_secrets WHERE site_id = $1 ORDER BY key ASC;

-- name: GetSiteSecret :one
SELECT * FROM site_secrets WHERE site_id = $1 AND key = $2;

-- name: UpsertSiteSecret :one
INSERT INTO site_secrets (site_id, key, encrypted_value)
VALUES ($1, $2, $3)
ON CONFLICT (site_id, key) DO UPDATE SET
    encrypted_value = EXCLUDED.encrypted_value,
    updated_at = now()
RETURNING id, site_id, key, created_at, updated_at;

-- name: DeleteSiteSecret :exec
DELETE FROM site_secrets WHERE site_id = $1 AND key = $2;
