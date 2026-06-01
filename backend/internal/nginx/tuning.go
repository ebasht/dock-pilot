package nginx

import (
	"context"
	"fmt"
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
	if bucket < 64 {
		bucket = 64
	}

	maxSize = 512
	need := count * 128
	if need < 512 {
		need = 512
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

func (m *RealManager) ensureGlobalTuning(ctx context.Context, domains []string) error {
	bucket, maxSize := serverNamesHashSettings(domains)
	path := m.host.ChrootPath(globalTuningHostPath)
	if err := m.host.MkdirAll(m.host.ChrootPath("/etc/nginx/conf.d"), 0o755); err != nil {
		return fmt.Errorf("mkdir nginx conf.d: %w", err)
	}
	content := globalTuningConfig(bucket, maxSize)
	if err := m.host.WriteFile(path, []byte(content), 0o644); err != nil {
		return fmt.Errorf("write nginx global tuning: %w", err)
	}
	m.logger.InfoContext(ctx, "nginx global tuning written",
		"path", globalTuningHostPath,
		"server_names_hash_bucket_size", bucket,
		"server_names_hash_max_size", maxSize,
	)
	return nil
}
