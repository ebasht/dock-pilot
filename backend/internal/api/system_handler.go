package api

import (
	"net/http"

	"github.com/ebash/dock-pilot/backend/internal/system"
)

type SystemHandler struct {
	system *system.Service
}

func NewSystemHandler(svc *system.Service) *SystemHandler {
	return &SystemHandler{system: svc}
}

func (h *SystemHandler) Status(w http.ResponseWriter, r *http.Request) {
	st, err := h.system.Status(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (h *SystemHandler) PruneDocker(w http.ResponseWriter, r *http.Request) {
	result, err := h.system.PruneDocker(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
