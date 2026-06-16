package notifications

type SettingsResponse struct {
	Enabled                bool   `json:"enabled"`
	TelegramChatID         string `json:"telegram_chat_id"`
	TelegramBotTokenSet    bool   `json:"telegram_bot_token_set"`
	DailyDigestEnabled     bool   `json:"daily_digest_enabled"`
	DailyDigestHour        int    `json:"daily_digest_hour"`
	AlertOnIncidentEnabled bool   `json:"alert_on_incident_enabled"`
}

type UpdateSettingsRequest struct {
	Enabled                bool   `json:"enabled"`
	TelegramChatID         string `json:"telegram_chat_id"`
	TelegramBotToken       string `json:"telegram_bot_token,omitempty"`
	ClearTelegramBotToken  bool   `json:"clear_telegram_bot_token,omitempty"`
	DailyDigestEnabled     bool   `json:"daily_digest_enabled"`
	DailyDigestHour        int    `json:"daily_digest_hour"`
	AlertOnIncidentEnabled bool   `json:"alert_on_incident_enabled"`
}
