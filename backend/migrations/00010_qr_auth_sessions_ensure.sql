-- +goose Up
CREATE TABLE IF NOT EXISTS qr_auth_sessions (
    code TEXT PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS qr_auth_sessions_expires_at_idx ON qr_auth_sessions (expires_at);

-- +goose Down
DROP TABLE IF EXISTS qr_auth_sessions;
