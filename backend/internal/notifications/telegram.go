package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type TelegramClient struct {
	http *http.Client
}

func NewTelegramClient() *TelegramClient {
	return &TelegramClient{
		http: &http.Client{Timeout: 15 * time.Second},
	}
}

func (t *TelegramClient) SendMessage(ctx context.Context, botToken, chatID, text string) error {
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

	resp, err := t.http.Do(req)
	if err != nil {
		return err
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

func escapeHTML(s string) string {
	replacer := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;")
	return replacer.Replace(s)
}
