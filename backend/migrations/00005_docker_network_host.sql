-- +goose Up
ALTER TABLE sites
    ADD COLUMN docker_network_host BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE sites
    DROP COLUMN IF EXISTS docker_network_host;
