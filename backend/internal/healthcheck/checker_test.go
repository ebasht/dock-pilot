package healthcheck

import "testing"

func TestSiteURL(t *testing.T) {
	if got := siteURL("example.com"); got != "https://example.com" {
		t.Fatalf("got %q", got)
	}
	if got := siteURL("telegram://bot"); got != "" {
		t.Fatalf("telegram should be empty, got %q", got)
	}
}

func TestTelegramOverall(t *testing.T) {
	o, _ := telegramOverall(ContainerInfo{Found: true, Running: true, State: "running", Health: "none"})
	if o != "healthy" {
		t.Fatalf("expected healthy, got %s", o)
	}
	o, _ = telegramOverall(ContainerInfo{Found: false})
	if o != "unhealthy" {
		t.Fatalf("expected unhealthy, got %s", o)
	}
}

func TestHealthCheckPaths(t *testing.T) {
	if got := healthCheckPaths(""); len(got) != 2 || got[0] != "/health" {
		t.Fatalf("default paths: %#v", got)
	}
	if got := healthCheckPaths("/api/health"); len(got) != 1 || got[0] != "/api/health" {
		t.Fatalf("custom path: %#v", got)
	}
	if got := healthCheckPaths("api/health"); len(got) != 1 || got[0] != "/api/health" {
		t.Fatalf("custom path without slash: %#v", got)
	}
}
