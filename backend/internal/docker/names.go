package docker

import "strings"

// NamesForSite returns the Docker container name to run and all names to stop before start
// (slug and primary URL host — covers renames and older deployments).
func NamesForSite(slug, primaryURL string) (containerName string, stopNames []string) {
	seen := map[string]struct{}{}
	var ordered []string

	add := func(raw string) {
		n := SanitizeContainerName(raw)
		if n == "" {
			return
		}
		if _, ok := seen[n]; ok {
			return
		}
		seen[n] = struct{}{}
		ordered = append(ordered, n)
	}

	add(slug)
	add(HostFromURL(primaryURL))

	if len(ordered) == 0 {
		return "site", []string{"site"}
	}

	// Prefer slug for the running container; fall back to URL host.
	containerName = SanitizeContainerName(slug)
	if containerName == "" {
		containerName = ordered[len(ordered)-1]
	}
	return containerName, ordered
}

// HostFromURL extracts the hostname from a site primary URL (http/https only).
func HostFromURL(raw string) string {
	u := strings.TrimSpace(strings.ToLower(raw))
	if strings.HasPrefix(u, "telegram://") || strings.HasPrefix(u, "bot://") {
		return ""
	}
	u = strings.TrimPrefix(u, "https://")
	u = strings.TrimPrefix(u, "http://")
	if i := strings.Index(u, "/"); i >= 0 {
		u = u[:i]
	}
	if i := strings.Index(u, ":"); i >= 0 {
		u = u[:i]
	}
	return u
}

// SanitizeContainerName makes a string safe for docker container names.
func SanitizeContainerName(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	if s == "" {
		return ""
	}
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '.', r == '_':
			b.WriteRune('-')
		case r == '-':
			b.WriteRune('-')
		}
	}
	out := b.String()
	out = strings.Trim(out, "-")
	if len(out) > 63 {
		out = out[:63]
		out = strings.TrimRight(out, "-")
	}
	return out
}
