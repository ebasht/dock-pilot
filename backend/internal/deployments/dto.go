package deployments

import (
	"time"

	"github.com/google/uuid"
)

type DeploymentResponse struct {
	ID         uuid.UUID  `json:"id"`
	SiteID     uuid.UUID  `json:"site_id"`
	Status     string     `json:"status"`
	Message    string     `json:"message"`
	StartedAt  *time.Time `json:"started_at,omitempty"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

type LogEntry struct {
	ID        int64     `json:"id"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}
