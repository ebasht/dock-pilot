-- +goose Up
ALTER TABLE sites
    ADD COLUMN health_check_path TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE sites DROP COLUMN IF EXISTS health_check_path;
