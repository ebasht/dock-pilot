-- name: CreateDeployment :one
INSERT INTO deployments (site_id, status, message, started_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetDeployment :one
SELECT * FROM deployments WHERE id = $1;

-- name: ListDeploymentsBySite :many
SELECT * FROM deployments WHERE site_id = $1 ORDER BY created_at DESC;

-- name: UpdateDeployment :one
UPDATE deployments SET
    status = COALESCE(sqlc.narg('status'), status),
    message = COALESCE(sqlc.narg('message'), message),
    started_at = COALESCE(sqlc.narg('started_at'), started_at),
    finished_at = COALESCE(sqlc.narg('finished_at'), finished_at)
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: AppendDeploymentLog :one
INSERT INTO deployment_logs (deployment_id, level, message)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListDeploymentLogs :many
SELECT * FROM deployment_logs WHERE deployment_id = $1 ORDER BY created_at ASC;

-- name: ListDeploymentLogsAfter :many
SELECT * FROM deployment_logs
WHERE deployment_id = $1 AND id > $2
ORDER BY created_at ASC;
