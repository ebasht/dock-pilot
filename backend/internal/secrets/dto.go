package secrets

import "time"

type SecretResponse struct {
	Key       string    `json:"key"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type SetSecretRequest struct {
	Value string `json:"value"`
}

type SetSecretsRequest struct {
	Secrets map[string]string `json:"secrets"`
}
