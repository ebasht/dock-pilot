-- +goose Up
ALTER TABLE sites ADD COLUMN site_type TEXT NOT NULL DEFAULT 'web';
ALTER TABLE sites ADD CONSTRAINT sites_site_type_check CHECK (site_type IN ('web', 'telegram_bot'));

-- +goose Down
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_site_type_check;
ALTER TABLE sites DROP COLUMN IF EXISTS site_type;
