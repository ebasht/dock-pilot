package sites

import (
	"fmt"
	"strings"
)

// NormalizeHealthCheckPath returns a URL path for HTTP health probes, or "" for defaults (/health, /).
func NormalizeHealthCheckPath(path string) string {
	p := strings.TrimSpace(path)
	if p == "" {
		return ""
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	return p
}

func validateHealthCheckPath(path string) error {
	p := NormalizeHealthCheckPath(path)
	if p == "" {
		return nil
	}
	if strings.ContainsAny(p, " \t\r\n?#") {
		return fmt.Errorf("%w: health_check_path must be a path without spaces or query", ErrInvalidInput)
	}
	return nil
}
