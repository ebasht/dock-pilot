-- name: ListSiteEnvVars :many
SELECT * FROM site_env_vars WHERE site_id = $1 ORDER BY key ASC;

-- name: UpsertSiteEnvVar :one
INSERT INTO site_env_vars (site_id, key, value)
VALUES ($1, $2, $3)
ON CONFLICT (site_id, key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = now()
RETURNING *;

-- name: DeleteSiteEnvVars :exec
DELETE FROM site_env_vars WHERE site_id = $1;

-- name: DeleteSiteEnvVar :exec
DELETE FROM site_env_vars WHERE site_id = $1 AND key = $2;
