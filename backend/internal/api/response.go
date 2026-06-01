package api

import (
	"encoding/json"
	"errors"
	"net/http"

	deploysvc "github.com/ebash/dock-pilot/backend/internal/deployments"
	secretpkg "github.com/ebash/dock-pilot/backend/internal/secrets"
	sitesvc "github.com/ebash/dock-pilot/backend/internal/sites"
)

type errorBody struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	msg := "internal server error"

	switch {
	case errors.Is(err, sitesvc.ErrNotFound),
		errors.Is(err, deploysvc.ErrNotFound),
		errors.Is(err, secretpkg.ErrNotFound):
		status = http.StatusNotFound
		msg = err.Error()
	case errors.Is(err, sitesvc.ErrSlugConflict):
		status = http.StatusConflict
		msg = err.Error()
	case errors.Is(err, sitesvc.ErrInvalidInput),
		errors.Is(err, secretpkg.ErrInvalidInput):
		status = http.StatusBadRequest
		msg = err.Error()
	}

	writeJSON(w, status, errorBody{Error: msg})
}
