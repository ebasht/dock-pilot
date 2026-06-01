package nginx

import "testing"

func TestServerNamesHashSettings_longDomain(t *testing.T) {
	domains := []string{"short.example.com", "this-hostname-is-longer-than-thirty-two-characters.example.org"}
	bucket, maxSize := serverNamesHashSettings(domains)
	if bucket < 64 {
		t.Fatalf("bucket %d too small for long domain", bucket)
	}
	if maxSize < 512 {
		t.Fatalf("maxSize %d too small", maxSize)
	}
}

func TestServerNamesHashSettings_defaultBump(t *testing.T) {
	bucket, _ := serverNamesHashSettings([]string{"x.example.com"})
	if bucket < 64 {
		t.Fatalf("expected at least 64, got %d", bucket)
	}
}
