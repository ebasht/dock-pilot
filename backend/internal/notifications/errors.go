package notifications

import "errors"

var (
	ErrNotFound      = errors.New("notification settings not found")
	ErrInvalidInput  = errors.New("invalid notification settings")
	ErrNotConfigured = errors.New("telegram notifications not configured")
	ErrMigration     = errors.New("run database migrations (notification_settings table missing)")
)
