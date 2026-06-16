package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

func (t *TelegramClient) SendMessage(ctx context.Context, botToken, chatID, text, proxyURL string) error {
	botToken = strings.TrimSpace(botToken)
	chatID = strings.TrimSpace(chatID)
	if botToken == "" || chatID == "" {
		return fmt.Errorf("telegram bot token and chat id are required")
	}

	endpoint := "https://api.telegram.org/bot" + botToken + "/sendMessage"
	body, err := json.Marshal(map[string]string{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "HTML",
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := httpClientFor(proxyURL)
	resp, err := client.Do(req)
	if err != nil {
		if strings.Contains(err.Error(), "context deadline exceeded") ||
			strings.Contains(err.Error(), "Client.Timeout") {
			return fmt.Errorf("telegram: timeout reaching api.telegram.org — check HTTP proxy settings: %w", err)
		}
		return fmt.Errorf("telegram: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("telegram API %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var parsed struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	if err := json.Unmarshal(raw, &parsed); err == nil && !parsed.OK {
		if parsed.Description != "" {
			return fmt.Errorf("telegram: %s", parsed.Description)
		}
		return fmt.Errorf("telegram send failed")
	}
	return nil
}

type TelegramClient struct{}

func NewTelegramClient() *TelegramClient {
	return &TelegramClient{}
}

func httpClientFor(proxyURL string) *http.Client {
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout: 10 * time.Second,
	}
	for _, candidate := range []string{proxyURL, telegramProxyFromEnv()} {
		if u, err := url.Parse(strings.TrimSpace(candidate)); err == nil && u.Scheme != "" && u.Host != "" {
			transport.Proxy = http.ProxyURL(u)
			break
		}
	}
	return &http.Client{
		Timeout:   30 * time.Second,
		Transport: transport,
	}
}

func telegramProxyFromEnv() string {
	if v := strings.TrimSpace(os.Getenv("TELEGRAM_HTTP_PROXY")); v != "" {
		return v
	}
	return strings.TrimSpace(os.Getenv("HTTPS_PROXY"))
}

func escapeHTML(s string) string {
	replacer := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;")
	return replacer.Replace(s)
}

func validateProxyURL(raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return fmt.Errorf("%w: telegram_http_proxy must be a URL like http://host:3128", ErrInvalidInput)
	}
	switch u.Scheme {
	case "http", "https":
		return nil
	default:
		return fmt.Errorf("%w: telegram_http_proxy scheme must be http or https", ErrInvalidInput)
	}
}
