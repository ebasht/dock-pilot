package deployments

import "errors"

var (
	ErrNotFound     = errors.New("deployment not found")
	ErrSiteNotFound = errors.New("site not found")
)
