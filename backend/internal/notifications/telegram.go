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

	"golang.org/x/net/proxy"
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
	baseDialer := &net.Dialer{
		Timeout:   10 * time.Second,
		KeepAlive: 30 * time.Second,
	}
	transport := &http.Transport{
		Proxy:       http.ProxyFromEnvironment,
		DialContext: baseDialer.DialContext,
		TLSHandshakeTimeout: 10 * time.Second,
	}
	for _, candidate := range []string{proxyURL, telegramProxyFromEnv()} {
		if applyProxyToTransport(transport, baseDialer, candidate) {
			break
		}
	}
	return &http.Client{
		Timeout:   30 * time.Second,
		Transport: transport,
	}
}

func applyProxyToTransport(transport *http.Transport, baseDialer *net.Dialer, raw string) bool {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme == "" || u.Host == "" {
		return false
	}
	switch u.Scheme {
	case "http", "https":
		transport.Proxy = http.ProxyURL(u)
		transport.DialContext = baseDialer.DialContext
		return true
	case "socks5":
		var auth *proxy.Auth
		if u.User != nil {
			pass, _ := u.User.Password()
			auth = &proxy.Auth{
				User:     u.User.Username(),
				Password: pass,
			}
		}
		d, err := proxy.SOCKS5("tcp", u.Host, auth, baseDialer)
		if err != nil {
			return false
		}
		transport.Proxy = nil
		if cd, ok := d.(proxy.ContextDialer); ok {
			transport.DialContext = cd.DialContext
		} else {
			transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
				return d.Dial(network, addr)
			}
		}
		return true
	default:
		return false
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
	case "http", "https", "socks5":
		return nil
	default:
		return fmt.Errorf("%w: telegram_http_proxy scheme must be http, https, or socks5", ErrInvalidInput)
	}
}
