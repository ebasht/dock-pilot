package deployments

import (
	"github.com/jackc/pgx/v5/pgtype"
)

func textVal(s string) pgtype.Text {
	return pgtype.Text{String: s, Valid: true}
}
