package notifications

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ebash/dock-pilot/backend/internal/db"
	"github.com/ebash/dock-pilot/backend/internal/healthcheck"
	"github.com/ebash/dock-pilot/backend/internal/secrets"
	sitesvc "github.com/ebash/dock-pilot/backend/internal/sites"
)

type Service struct {
	queries  *db.Queries
	cipher   *secrets.Cipher
	sites    *sitesvc.Service
	telegram *TelegramClient
}

func NewService(queries *db.Queries, cipher *secrets.Cipher, sites *sitesvc.Service) *Service {
	return &Service{
		queries:  queries,
		cipher:   cipher,
		sites:    sites,
		telegram: NewTelegramClient(),
	}
}

func (s *Service) GetSettings(ctx context.Context) (SettingsResponse, error) {
	row, err := s.getSettingsRow(ctx)
	if err != nil {
		return SettingsResponse{}, err
	}
	return toSettingsResponse(row), nil
}

func (s *Service) UpdateSettings(ctx context.Context, req UpdateSettingsRequest) (SettingsResponse, error) {
	current, err := s.getSettingsRow(ctx)
	if err != nil {
		return SettingsResponse{}, err
	}

	if err := validateUpdate(req, current); err != nil {
		return SettingsResponse{}, err
	}

	if req.ClearTelegramBotToken {
		if err := s.queries.ClearNotificationToken(ctx); err != nil {
			return SettingsResponse{}, fmt.Errorf("clear telegram token: %w", err)
		}
	} else if token := strings.TrimSpace(req.TelegramBotToken); token != "" {
		encrypted, err := s.cipher.Encrypt(token)
		if err != nil {
			return SettingsResponse{}, fmt.Errorf("encrypt telegram token: %w", err)
		}
		if err := s.queries.UpdateNotificationToken(ctx, encrypted); err != nil {
			return SettingsResponse{}, fmt.Errorf("save telegram token: %w", err)
		}
	}

	row, err := s.queries.UpdateNotificationSettings(ctx, db.UpdateNotificationSettingsParams{
		Enabled:                req.Enabled,
		TelegramChatID:         strings.TrimSpace(req.TelegramChatID),
		DailyDigestEnabled:     req.DailyDigestEnabled,
		DailyDigestHour:        int32(req.DailyDigestHour),
		AlertOnIncidentEnabled: req.AlertOnIncidentEnabled,
	})
	if err != nil {
		return SettingsResponse{}, err
	}
	return toSettingsResponse(row), nil
}

func (s *Service) SendTest(ctx context.Context) error {
	settings, token, err := s.loadTelegramConfig(ctx)
	if err != nil {
		return err
	}
	text := "<b>DockPilot</b>\nТестовое уведомление — Telegram настроен."
	if err := s.telegram.SendMessage(ctx, token, settings.TelegramChatID, text); err != nil {
		return fmt.Errorf("telegram: %w", err)
	}
	return nil
}

func (s *Service) RunCheck(ctx context.Context) error {
	settings, token, err := s.loadTelegramConfig(ctx)
	if err != nil {
		if errors.Is(err, ErrNotConfigured) {
			return nil
		}
		return err
	}

	healthRows, err := s.sites.HealthAll(ctx)
	if err != nil {
		return err
	}

	siteRows, err := s.queries.ListSites(ctx)
	if err != nil {
		return err
	}
	names := make(map[string]string, len(siteRows))
	for _, site := range siteRows {
		names[site.ID.String()] = site.Name
	}

	prev := decodeOverallMap(settings.LastOverallBySite)
	now := time.Now().UTC()

	if settings.DailyDigestEnabled && shouldSendDaily(settings.LastDailySentAt, settings.DailyDigestHour, now) {
		msg := formatDailyDigest(healthRows, names, now)
		if err := s.telegram.SendMessage(ctx, token, settings.TelegramChatID, msg); err != nil {
			return fmt.Errorf("daily digest: %w", err)
		}
		if err := s.queries.UpdateNotificationLastDailySent(ctx, pgtype.Timestamptz{Time: now, Valid: true}); err != nil {
			return err
		}
	}

	if settings.AlertOnIncidentEnabled {
		for _, h := range healthRows {
			sid := h.SiteID.String()
			prevOverall := prev[sid]
			if isIncidentTransition(prevOverall, h.Overall) {
				name := names[sid]
				if name == "" {
					name = sid
				}
				msg := formatIncident(name, h)
				if err := s.telegram.SendMessage(ctx, token, settings.TelegramChatID, msg); err != nil {
					return fmt.Errorf("incident alert: %w", err)
				}
			}
		}
	}

	next := make(map[string]string, len(healthRows))
	for _, h := range healthRows {
		next[h.SiteID.String()] = h.Overall
	}
	raw, err := json.Marshal(next)
	if err != nil {
		return err
	}
	return s.queries.UpdateNotificationLastOverall(ctx, raw)
}

func (s *Service) loadTelegramConfig(ctx context.Context) (db.NotificationSettings, string, error) {
	row, err := s.queries.GetNotificationSettings(ctx)
	if err != nil {
		return db.NotificationSettings{}, "", err
	}
	if !row.Enabled {
		return row, "", ErrNotConfigured
	}
	if len(row.EncryptedTelegramBotToken) == 0 {
		return row, "", ErrNotConfigured
	}
	if strings.TrimSpace(row.TelegramChatID) == "" {
		return row, "", ErrNotConfigured
	}
	token, err := s.cipher.Decrypt(row.EncryptedTelegramBotToken)
	if err != nil {
		return row, "", fmt.Errorf("decrypt telegram token: %w", err)
	}
	return row, token, nil
}

func (s *Service) getSettingsRow(ctx context.Context) (db.NotificationSettings, error) {
	row, err := s.queries.GetNotificationSettings(ctx)
	if err == nil {
		return row, nil
	}
	if mapped := mapDBErr(err); mapped != nil {
		return db.NotificationSettings{}, mapped
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return db.NotificationSettings{}, err
	}
	row, err = s.queries.EnsureNotificationSettings(ctx)
	if err != nil {
		if mapped := mapDBErr(err); mapped != nil {
			return db.NotificationSettings{}, mapped
		}
		return db.NotificationSettings{}, err
	}
	return row, nil
}

func mapDBErr(err error) error {
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "42P01" {
		return fmt.Errorf("%w: apply migration 00006_notification_settings", ErrMigration)
	}
	return nil
}

func validateUpdate(req UpdateSettingsRequest, current db.NotificationSettings) error {
	if req.DailyDigestHour < 0 || req.DailyDigestHour > 23 {
		return ErrInvalidInput
	}
	if !req.Enabled {
		return nil
	}
	if strings.TrimSpace(req.TelegramChatID) == "" {
		return fmt.Errorf("%w: telegram_chat_id is required when enabled", ErrInvalidInput)
	}
	hasToken := len(current.EncryptedTelegramBotToken) > 0 && !req.ClearTelegramBotToken
	if strings.TrimSpace(req.TelegramBotToken) != "" {
		hasToken = true
	}
	if !hasToken {
		return fmt.Errorf("%w: telegram_bot_token is required when enabled", ErrInvalidInput)
	}
	return nil
}

func toSettingsResponse(row db.NotificationSettings) SettingsResponse {
	return SettingsResponse{
		Enabled:                row.Enabled,
		TelegramChatID:         row.TelegramChatID,
		TelegramBotTokenSet:    len(row.EncryptedTelegramBotToken) > 0,
		DailyDigestEnabled:     row.DailyDigestEnabled,
		DailyDigestHour:        int(row.DailyDigestHour),
		AlertOnIncidentEnabled: row.AlertOnIncidentEnabled,
	}
}

func decodeOverallMap(raw []byte) map[string]string {
	out := map[string]string{}
	if len(raw) == 0 {
		return out
	}
	_ = json.Unmarshal(raw, &out)
	return out
}

func shouldSendDaily(last pgtype.Timestamptz, hour int32, now time.Time) bool {
	if int(now.Hour()) != int(hour) {
		return false
	}
	if !last.Valid {
		return true
	}
	y1, m1, d1 := last.Time.UTC().Date()
	y2, m2, d2 := now.Date()
	return y1 != y2 || m1 != m2 || d1 != d2
}

func isIncidentTransition(prev, current string) bool {
	if current != "unhealthy" && current != "degraded" {
		return false
	}
	if prev == "" {
		// First observation after restart — alert only if already bad.
		return current == "unhealthy" || current == "degraded"
	}
	if prev == current {
		return false
	}
	if current == "unhealthy" {
		return prev != "unhealthy"
	}
	// degraded: alert when worsening from healthy only
	return prev == "healthy"
}

func formatDailyDigest(rows []healthcheck.Result, names map[string]string, now time.Time) string {
	var b strings.Builder
	fmt.Fprintf(&b, "<b>DockPilot — ежедневный отчёт</b>\n%s UTC\n\n", now.Format("2006-01-02 15:04"))
	if len(rows) == 0 {
		b.WriteString("Нет сайтов в панели.")
		return b.String()
	}
	counts := map[string]int{}
	for _, h := range rows {
		counts[h.Overall]++
	}
	fmt.Fprintf(&b, "Всего: %d\n", len(rows))
	fmt.Fprintf(&b, "Здоровые: %d\n", counts["healthy"])
	fmt.Fprintf(&b, "Проблемы: %d\n", counts["degraded"])
	fmt.Fprintf(&b, "Авария: %d\n", counts["unhealthy"])
	fmt.Fprintf(&b, "Неизвестно: %d\n\n", counts["unknown"])
	for _, h := range rows {
		name := names[h.SiteID.String()]
		if name == "" {
			name = h.SiteID.String()
		}
		fmt.Fprintf(&b, "• %s — <b>%s</b>\n  %s\n", escapeHTML(name), h.Overall, escapeHTML(h.Message))
	}
	return b.String()
}

func formatIncident(name string, h healthcheck.Result) string {
	title := "авария"
	if h.Overall == "degraded" {
		title = "проблема"
	}
	return fmt.Sprintf(
		"<b>DockPilot — %s</b>\nСайт: %s\nСтатус: <b>%s</b>\n%s",
		title,
		escapeHTML(name),
		h.Overall,
		escapeHTML(h.Message),
	)
}
