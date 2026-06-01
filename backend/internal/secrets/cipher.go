package secrets

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
)

// Cipher encrypts and decrypts secret values at rest.
type Cipher struct {
	gcm cipher.AEAD
}

func NewCipher(key string) (*Cipher, error) {
	// Use first 32 bytes of the key material.
	keyBytes := []byte(key)
	if len(keyBytes) < 32 {
		return nil, fmt.Errorf("encryption key must be at least 32 bytes")
	}
	keyBytes = keyBytes[:32]

	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return nil, fmt.Errorf("create aes cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create gcm: %w", err)
	}

	return &Cipher{gcm: gcm}, nil
}

func (c *Cipher) Encrypt(plaintext string) ([]byte, error) {
	nonce := make([]byte, c.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("generate nonce: %w", err)
	}

	ciphertext := c.gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return ciphertext, nil
}

func (c *Cipher) Decrypt(ciphertext []byte) (string, error) {
	nonceSize := c.gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, data := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plain, err := c.gcm.Open(nil, nonce, data, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt: %w", err)
	}
	return string(plain), nil
}

// EncodeForDebug returns base64 of ciphertext (never used in API responses).
func EncodeForDebug(ciphertext []byte) string {
	return base64.StdEncoding.EncodeToString(ciphertext)
}
