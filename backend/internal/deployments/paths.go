package deployments

import "path/filepath"

func siteWorkDir(base, slug string) string {
	return filepath.Join(base, "sites", slug)
}

func siteSourceDir(base, slug string) string {
	return filepath.Join(siteWorkDir(base, slug), "src")
}
