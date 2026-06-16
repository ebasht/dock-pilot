package notifications

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

func TestIsIncidentTransition(t *testing.T) {
	t.Parallel()
	cases := []struct {
		prev, current string
		want          bool
	}{
		{"healthy", "unhealthy", true},
		{"healthy", "degraded", true},
		{"degraded", "unhealthy", true},
		{"unhealthy", "unhealthy", false},
		{"healthy", "healthy", false},
		{"degraded", "degraded", false},
		{"", "unhealthy", true},
		{"", "healthy", false},
	}
	for _, tc := range cases {
		if got := isIncidentTransition(tc.prev, tc.current); got != tc.want {
			t.Fatalf("isIncidentTransition(%q,%q)=%v want %v", tc.prev, tc.current, got, tc.want)
		}
	}
}

func TestShouldSendDaily(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 6, 15, 9, 30, 0, 0, time.UTC)
	last := pgtype.Timestamptz{Time: time.Date(2026, 6, 14, 9, 0, 0, 0, time.UTC), Valid: true}

	if !shouldSendDaily(last, 9, now) {
		t.Fatal("expected daily send on new UTC day at matching hour")
	}
	if shouldSendDaily(last, 10, now) {
		t.Fatal("expected no send when hour mismatches")
	}
	if shouldSendDaily(last, 9, now.Add(-24*time.Hour)) {
		t.Fatal("expected no send when already sent today")
	}
}
