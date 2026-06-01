package secrets

import "errors"

var (
	ErrNotFound     = errors.New("secret not found")
	ErrSiteNotFound = errors.New("site not found")
	ErrInvalidInput = errors.New("invalid secret input")
)
