package nginx

import (
	"context"
	"fmt"
	"os"
	"strings"
)

const globalTuningHostPath = "/etc/nginx/conf.d/00-dockpilot-global.conf"

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

func globalTuningConfig(bucketSize, maxSize int) string {
	return fmt.Sprintf(`# Managed by dock-pilot — required for long server_name values
server_names_hash_bucket_size %d;
server_names_hash_max_size %d;
`, bucketSize, maxSize)
}

func (m *RealManager) globalTuningConfHostPath() string {
	return m.host.ChrootPath(globalTuningHostPath)
}

// Hash tuning lives only in conf.d/00-dockpilot-global.conf; active copies elsewhere break nginx -t.
const commentNginxConfHashScript = `KEEP=/etc/nginx/conf.d/00-dockpilot-global.conf
for f in /etc/nginx/nginx.conf /etc/nginx/conf.d/*.conf; do
  [ -f "$f" ] || continue
  [ "$f" = "$KEEP" ] && continue
  sed -i -E '/^[[:space:]]*#/! s/^[[:space:]]*(server_names_hash_(bucket_size|max_size)[^;]*;)/# \1/' "$f" 2>/dev/null || true
done
`

func (m *RealManager) ensureConfOnlyHashTuning(ctx context.Context) error {
	return m.host.RunShell(ctx, commentNginxConfHashScript)
}

func (m *RealManager) ensureGlobalTuning(ctx context.Context, domains []string) error {
	bucket, maxSize := serverNamesHashSettings(domains)
	confPath := m.globalTuningConfHostPath()

	if err := m.ensureConfOnlyHashTuning(ctx); err != nil {
		return fmt.Errorf("comment nginx.conf hash tuning: %w", err)
	}

	if err := m.host.MkdirAll(m.host.ChrootPath("/etc/nginx/conf.d"), 0o755); err != nil {
		return fmt.Errorf("mkdir nginx conf.d: %w", err)
	}
	content := globalTuningConfig(bucket, maxSize)
	if err := m.host.WriteFile(confPath, []byte(content), 0o644); err != nil {
		return fmt.Errorf("write nginx global tuning: %w", err)
	}
	m.logger.InfoContext(ctx, "nginx global tuning written",
		"path", globalTuningHostPath,
		"server_names_hash_bucket_size", bucket,
		"server_names_hash_max_size", maxSize,
	)
	return nil
}

// pruneDuplicateHashTuning comments nginx.conf hash lines when conf.d snippet is present.
func (m *RealManager) pruneDuplicateHashTuning(ctx context.Context) {
	confPath := m.globalTuningConfHostPath()
	if _, err := os.Stat(confPath); err != nil {
		return
	}
	if err := m.ensureConfOnlyHashTuning(ctx); err != nil {
		m.logger.WarnContext(ctx, "could not comment nginx.conf hash tuning", "error", err)
	}
}
