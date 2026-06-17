package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const qrCodeTTL = 5 * time.Minute

var (
	ErrQRInvalid   = errors.New("invalid or expired qr code")
	ErrQRUsed      = errors.New("qr code already used")
	ErrQRNotFound  = errors.New("qr code not found")
)

type QRService struct {
	pool     *pgxpool.Pool
	apiToken string
}

func NewQRService(pool *pgxpool.Pool, apiToken string) *QRService {
	return &QRService{pool: pool, apiToken: apiToken}
}

func (s *QRService) Create(ctx context.Context) (code string, expiresAt time.Time, err error) {
	code, err = randomCode()
	if err != nil {
		return "", time.Time{}, err
	}

	expiresAt = time.Now().UTC().Add(qrCodeTTL)

	_, err = s.pool.Exec(ctx, `
		DELETE FROM qr_auth_sessions WHERE expires_at < NOW()
	`)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("cleanup qr sessions: %w", err)
	}

	_, err = s.pool.Exec(ctx, `
		INSERT INTO qr_auth_sessions (code, expires_at) VALUES ($1, $2)
	`, code, expiresAt)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("insert qr session: %w", err)
	}

	return code, expiresAt, nil
}

func (s *QRService) Exchange(ctx context.Context, code string) (string, error) {
	if code == "" {
		return "", ErrQRInvalid
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var expiresAt time.Time
	var usedAt *time.Time
	err = tx.QueryRow(ctx, `
		SELECT expires_at, used_at FROM qr_auth_sessions WHERE code = $1 FOR UPDATE
	`, code).Scan(&expiresAt, &usedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrQRNotFound
		}
		return "", fmt.Errorf("select qr session: %w", err)
	}

	if usedAt != nil {
		return "", ErrQRUsed
	}
	if time.Now().UTC().After(expiresAt) {
		return "", ErrQRInvalid
	}

	now := time.Now().UTC()
	_, err = tx.Exec(ctx, `
		UPDATE qr_auth_sessions SET used_at = $1 WHERE code = $2
	`, now, code)
	if err != nil {
		return "", fmt.Errorf("mark qr used: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("commit tx: %w", err)
	}

	return s.apiToken, nil
}

func randomCode() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
