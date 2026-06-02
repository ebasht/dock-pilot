package nginx

import "strings"

// configDeclaresDomain reports whether nginx config text routes the given domain.
func configDeclaresDomain(content, domain string) bool {
	domain = strings.TrimSpace(domain)
	if domain == "" {
		return false
	}
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "#") {
			continue
		}
		if !strings.HasPrefix(line, "server_name") {
			continue
		}
		rest := strings.TrimSuffix(strings.TrimSpace(strings.TrimPrefix(line, "server_name")), ";")
		for _, part := range strings.Fields(rest) {
			if part == domain {
				return true
			}
		}
	}
	return false
}

// nginxConfHasActiveHashBucket reports an uncommented server_names_hash_bucket_size in nginx.conf.
func nginxConfHasActiveHashBucket(content string) bool {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "server_names_hash_bucket_size") {
			return true
		}
	}
	return false
}
