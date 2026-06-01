package sites

import (
	"github.com/jackc/pgx/v5/pgtype"
)

func textPtr(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: *s, Valid: true}
}

func int4Opt(v *int32) pgtype.Int4 {
	if v == nil {
		return pgtype.Int4{Valid: false}
	}
	return pgtype.Int4{Int32: *v, Valid: true}
}

func boolOpt(v *bool) pgtype.Bool {
	if v == nil {
		return pgtype.Bool{Valid: false}
	}
	return pgtype.Bool{Bool: *v, Valid: true}
}
