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

	if !shouldSendDaily(last, 9, "UTC", now) {
		t.Fatal("expected daily send on new UTC day at matching hour")
	}
	if shouldSendDaily(last, 10, "UTC", now) {
		t.Fatal("expected no send when hour mismatches")
	}
	if shouldSendDaily(last, 9, "UTC", now.Add(-24*time.Hour)) {
		t.Fatal("expected no send when already sent today")
	}

	// 06:30 UTC = 09:30 Europe/Moscow
	moscowNow := time.Date(2026, 6, 15, 6, 30, 0, 0, time.UTC)
	if !shouldSendDaily(last, 9, "Europe/Moscow", moscowNow) {
		t.Fatal("expected daily send when local Moscow hour matches")
	}
	if shouldSendDaily(last, 9, "Europe/Moscow", now) {
		t.Fatal("expected no send when Moscow local hour is 12, not 9")
	}
}
