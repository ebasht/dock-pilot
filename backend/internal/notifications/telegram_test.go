package notifications

import "testing"

func TestResolveTelegramProxyURL(t *testing.T) {
	t.Setenv("TELEGRAM_SOCKS_RELAY_HOST", "")
	t.Setenv("TELEGRAM_SOCKS_RELAY_PORT", "")

	tests := []struct {
		in   string
		want string
	}{
		{"", ""},
		{"socks5://127.0.0.1:1080", "socks5://172.17.0.1:1081"},
		{"socks5://localhost:1080", "socks5://172.17.0.1:1081"},
		{"http://127.0.0.1:3128", "http://127.0.0.1:3128"},
		{"socks5://proxy.example.com:1080", "socks5://proxy.example.com:1080"},
		{"socks5://172.17.0.1:1080", "socks5://172.17.0.1:1080"},
	}
	for _, tc := range tests {
		if got := resolveTelegramProxyURL(tc.in); got != tc.want {
			t.Errorf("resolveTelegramProxyURL(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}

	t.Setenv("TELEGRAM_SOCKS_RELAY_HOST", "10.0.0.1")
	t.Setenv("TELEGRAM_SOCKS_RELAY_PORT", "9999")
	if got := resolveTelegramProxyURL("socks5://127.0.0.1:1080"); got != "socks5://10.0.0.1:9999" {
		t.Fatalf("custom relay env: got %q", got)
	}
}
