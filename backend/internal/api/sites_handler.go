package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	sitesvc "github.com/ebash/dock-pilot/backend/internal/sites"
)

type SitesHandler struct {
	sites *sitesvc.Service
}

func NewSitesHandler(sites *sitesvc.Service) *SitesHandler {
	return &SitesHandler{sites: sites}
}

func (h *SitesHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req sitesvc.CreateSiteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, sitesvc.ErrInvalidInput)
		return
	}

	site, err := h.sites.Create(r.Context(), req)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, site)
}

func (h *SitesHandler) List(w http.ResponseWriter, r *http.Request) {
	sites, err := h.sites.List(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	if sites == nil {
		sites = []sitesvc.SiteListItem{}
	}
	writeJSON(w, http.StatusOK, sites)
}

func (h *SitesHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, sitesvc.ErrInvalidInput)
		return
	}

	site, err := h.sites.Get(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, site)
}

func (h *SitesHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, sitesvc.ErrInvalidInput)
		return
	}

	var req sitesvc.UpdateSiteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, sitesvc.ErrInvalidInput)
		return
	}

	site, err := h.sites.Update(r.Context(), id, req)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, site)
}

func (h *SitesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, sitesvc.ErrInvalidInput)
		return
	}

	if err := h.sites.Delete(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}
