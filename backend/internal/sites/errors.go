package sites

import "errors"

var (
	ErrNotFound      = errors.New("site not found")
	ErrSlugConflict  = errors.New("site slug already exists")
	ErrInvalidInput  = errors.New("invalid site input")
)
