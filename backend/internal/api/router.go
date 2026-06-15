package api

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	deploysvc "github.com/ebash/dock-pilot/backend/internal/deployments"
	secretpkg "github.com/ebash/dock-pilot/backend/internal/secrets"
	sitesvc "github.com/ebash/dock-pilot/backend/internal/sites"
)

type Handlers struct {
	Sites       *SitesHandler
	Secrets     *SecretsHandler
	Deployments *DeploymentsHandler
}

func NewRouter(h Handlers, apiToken string, corsOrigins []string) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Logger)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   corsOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-API-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api", func(r chi.Router) {
		r.Use(BearerTokenAuth(apiToken))

		r.Route("/sites", func(r chi.Router) {
			r.Post("/", h.Sites.Create)
			r.Get("/", h.Sites.List)
			r.Get("/health", h.Sites.HealthAll)

			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", h.Sites.Get)
				r.Get("/health", h.Sites.Health)
				r.Get("/logs/stream", h.Sites.StreamContainerLogs)
				r.Patch("/", h.Sites.Update)
				r.Delete("/", h.Sites.Delete)

				r.Post("/deploy", h.Deployments.Deploy)
				r.Get("/deployments", h.Deployments.ListBySite)

				r.Route("/secrets", func(r chi.Router) {
					r.Get("/", h.Secrets.List)
					r.Post("/", h.Secrets.CreateMany)
					r.Put("/{key}", h.Secrets.Upsert)
					r.Delete("/{key}", h.Secrets.Delete)
				})
			})
		})

		r.Get("/deployments/{id}/logs/stream", h.Deployments.StreamLogs)
	})

	return r
}

func Mount(logger *slog.Logger, apiToken string, corsOrigins []string, sites *sitesvc.Service, secrets *secretpkg.Service, deployments *deploysvc.Service) http.Handler {
	_ = logger
	return NewRouter(Handlers{
		Sites:       NewSitesHandler(sites),
		Secrets:     NewSecretsHandler(secrets),
		Deployments: NewDeploymentsHandler(deployments),
	}, apiToken, corsOrigins)
}
