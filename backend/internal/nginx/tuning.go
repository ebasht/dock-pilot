package nginx

import (
	"context"
	"fmt"
	"strings"
)

const (
	nginxConfHostPath   = "/etc/nginx/nginx.conf"
	hashBeginMarker     = "# BEGIN dock-pilot nginx hash"
	hashEndMarker       = "# END dock-pilot nginx hash"
	legacyConfDHashPath = "/etc/nginx/conf.d/00-dockpilot-global.conf"
)

// serverNamesHashSettings returns nginx http-level hash settings for the given domain list.
func serverNamesHashSettings(domains []string) (bucketSize, maxSize int) {
	longest := 0
	count := 0
	for _, d := range domains {
		d = strings.TrimSpace(d)
		if d == "" {
			continue
		}
		count++
		if len(d) > longest {
			longest = len(d)
		}
	}

	bucket := 32
	for bucket < longest {
		bucket *= 2
	}
	if bucket < 128 {
		bucket = 128
	}

	maxSize = 512
	need := count * 128
	if need < 2048 {
		need = 2048
	}
	for maxSize < need {
		maxSize *= 2
	}
	if maxSize > 8192 {
		maxSize = 8192
	}
	return bucket, maxSize
}

func applyNginxHashTuningScript(bucketSize, maxSize int) string {
	return fmt.Sprintf(`set -e
NGINX=%q
BEGIN=%q
END=%q
BUCKET=%d
MAX=%d

rm -f %q /etc/nginx/conf.d/00-vpsdeploy-global.conf

for f in /etc/nginx/conf.d/*.conf; do
  [ -f "$f" ] || continue
  sed -i -E '/^[[:space:]]*#/! s/^[[:space:]]*(server_names_hash_(bucket_size|max_size)[^;]*;)/# \1/' "$f" 2>/dev/null || true
done

sed -i "/${BEGIN}/,/${END}/d" "$NGINX" 2>/dev/null || true
sed -i -E '/^[[:space:]]*#/! s/^[[:space:]]*(server_names_hash_(bucket_size|max_size)[^;]*;)/# \1/' "$NGINX" 2>/dev/null || true

sed -i "/^[[:space:]]*http[[:space:]]*{/a\\
    ${BEGIN}\\
    server_names_hash_bucket_size ${BUCKET};\\
    server_names_hash_max_size ${MAX};\\
    ${END}" "$NGINX"
`, nginxConfHostPath, hashBeginMarker, hashEndMarker, bucketSize, maxSize, legacyConfDHashPath)
}

func (m *RealManager) ensureGlobalTuning(ctx context.Context, domains []string) error {
	bucket, maxSize := serverNamesHashSettings(domains)
	if err := m.host.RunShell(ctx, applyNginxHashTuningScript(bucket, maxSize)); err != nil {
		return fmt.Errorf("apply nginx hash tuning: %w", err)
	}
	m.logger.InfoContext(ctx, "nginx global tuning written",
		"path", nginxConfHostPath,
		"server_names_hash_bucket_size", bucket,
		"server_names_hash_max_size", maxSize,
	)
	return nil
}

func (m *RealManager) pruneDuplicateHashTuning(ctx context.Context) {
	script := fmt.Sprintf(`rm -f %q /etc/nginx/conf.d/00-vpsdeploy-global.conf
sed -i -E '/^[[:space:]]*#/! s/^[[:space:]]*(server_names_hash_(bucket_size|max_size)[^;]*;)/# \1/' %q 2>/dev/null || true
for f in /etc/nginx/conf.d/*.conf; do
  [ -f "$f" ] || continue
  sed -i -E '/^[[:space:]]*#/! s/^[[:space:]]*(server_names_hash_(bucket_size|max_size)[^;]*;)/# \1/' "$f" 2>/dev/null || true
done
`, legacyConfDHashPath, nginxConfHostPath)
	if err := m.host.RunShell(ctx, script); err != nil {
		m.logger.WarnContext(ctx, "could not prune duplicate nginx hash tuning", "error", err)
	}
}
