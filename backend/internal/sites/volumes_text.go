package sites

import (
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
)

func volumeLinesToText(lines []string) string {
	var b strings.Builder
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if b.Len() > 0 {
			b.WriteByte('\n')
		}
		b.WriteString(line)
	}
	return b.String()
}

func volumeLinesFromText(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	var out []string
	for _, line := range strings.Split(s, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		out = append(out, line)
	}
	return out
}

func volumeTextPtr(lines *[]string) pgtype.Text {
	if lines == nil {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: volumeLinesToText(*lines), Valid: true}
}
