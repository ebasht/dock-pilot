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

func (m *RealManager) nginxConfHostPath() string {
	return m.host.ChrootPath("/etc/nginx/nginx.conf")
}

func (m *RealManager) globalTuningConfHostPath() string {
	return m.host.ChrootPath(globalTuningHostPath)
}

// pruneDuplicateHashTuning removes conf.d hash snippet when nginx.conf already defines it.
func (m *RealManager) pruneDuplicateHashTuning(ctx context.Context) {
	nginxConf := m.nginxConfHostPath()
	confPath := m.globalTuningConfHostPath()

	b, err := os.ReadFile(nginxConf)
	if err != nil || !nginxConfHasActiveHashBucket(string(b)) {
		return
	}
	if err := m.host.Remove(confPath); err != nil {
		if !os.IsNotExist(err) {
			m.logger.WarnContext(ctx, "could not remove duplicate nginx hash conf.d",
				"path", globalTuningHostPath,
				"error", err,
			)
		}
		return
	}
	m.logger.InfoContext(ctx, "removed duplicate nginx hash conf.d (nginx.conf already sets it)",
		"path", globalTuningHostPath,
	)
}

func patchNginxConfHashScript(bucket, maxSize int) string {
	return fmt.Sprintf(`set -e
NGINX=/etc/nginx/nginx.conf
BUCKET=%d
MAX=%d
CONF=/etc/nginx/conf.d/00-dockpilot-global.conf
rm -f /etc/nginx/conf.d/00-vpsdeploy-global.conf 2>/dev/null || true
if grep -qE '^\s*server_names_hash_bucket_size' "$NGINX" 2>/dev/null; then
  sed -i -E "s/^\s*server_names_hash_bucket_size\s+[^;]+;/server_names_hash_bucket_size ${BUCKET};/" "$NGINX"
elif grep -qE '^\s*#\s*server_names_hash_bucket_size' "$NGINX" 2>/dev/null; then
  sed -i -E "s/^\s*#\s*server_names_hash_bucket_size\s+[^;]*;/server_names_hash_bucket_size ${BUCKET};/" "$NGINX"
else
  exit 1
fi
if grep -qE '^\s*server_names_hash_max_size' "$NGINX" 2>/dev/null; then
  sed -i -E "s/^\s*server_names_hash_max_size\s+[^;]+;/server_names_hash_max_size ${MAX};/" "$NGINX"
else
  sed -i "/^\s*server_names_hash_bucket_size/a server_names_hash_max_size ${MAX};" "$NGINX"
fi
rm -f "$CONF"
`, bucket, maxSize)
}

func (m *RealManager) ensureGlobalTuning(ctx context.Context, domains []string) error {
	bucket, maxSize := serverNamesHashSettings(domains)
	confPath := m.globalTuningConfHostPath()
	nginxConf := m.nginxConfHostPath()

	m.pruneDuplicateHashTuning(ctx)

	if b, err := os.ReadFile(nginxConf); err == nil && nginxConfHasActiveHashBucket(string(b)) {
		return nil
	}

	if err := m.host.RunShell(ctx, patchNginxConfHashScript(bucket, maxSize)); err == nil {
		if b, err := os.ReadFile(nginxConf); err == nil && nginxConfHasActiveHashBucket(string(b)) {
			_ = m.host.Remove(confPath)
			m.logger.InfoContext(ctx, "nginx hash tuning patched in nginx.conf",
				"server_names_hash_bucket_size", bucket,
				"server_names_hash_max_size", maxSize,
			)
			return nil
		}
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
