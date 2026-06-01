-- name: ListSiteDomains :many
SELECT * FROM site_domains WHERE site_id = $1 ORDER BY is_primary DESC, domain ASC;

-- name: UpsertSiteDomain :one
INSERT INTO site_domains (site_id, domain, is_primary)
VALUES ($1, $2, $3)
ON CONFLICT (site_id, domain) DO UPDATE SET is_primary = EXCLUDED.is_primary
RETURNING *;

-- name: DeleteSiteDomains :exec
DELETE FROM site_domains WHERE site_id = $1;

-- name: DeleteSiteDomain :exec
DELETE FROM site_domains WHERE site_id = $1 AND domain = $2;
