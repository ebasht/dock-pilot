-- +goose Up
DELETE FROM site_secrets WHERE length(trim(key)) = 0;
DELETE FROM site_env_vars WHERE length(trim(key)) = 0;

ALTER TABLE site_secrets
    ADD CONSTRAINT site_secrets_key_not_empty CHECK (length(trim(key)) > 0);

ALTER TABLE site_env_vars
    ADD CONSTRAINT site_env_vars_key_not_empty CHECK (length(trim(key)) > 0);

-- +goose Down
ALTER TABLE site_env_vars DROP CONSTRAINT IF EXISTS site_env_vars_key_not_empty;
ALTER TABLE site_secrets DROP CONSTRAINT IF EXISTS site_secrets_key_not_empty;
