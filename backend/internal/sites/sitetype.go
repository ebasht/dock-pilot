package sites

import "strings"

const (
	SiteTypeWeb         = "web"
	SiteTypeTelegramBot = "telegram_bot"
)

func NormalizeSiteType(t string) string {
	switch strings.TrimSpace(strings.ToLower(t)) {
	case SiteTypeTelegramBot:
		return SiteTypeTelegramBot
	default:
		return SiteTypeWeb
	}
}

func IsTelegramBot(siteType string) bool {
	return NormalizeSiteType(siteType) == SiteTypeTelegramBot
}

func IsWebSite(siteType string) bool {
	return !IsTelegramBot(siteType)
}
