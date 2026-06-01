-- +goose Up
ALTER TABLE sites
    ADD COLUMN docker_volume_mounts TEXT NOT NULL DEFAULT '',
    ADD COLUMN docker_named_volumes TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE sites
    DROP COLUMN IF EXISTS docker_volume_mounts,
    DROP COLUMN IF EXISTS docker_named_volumes;
