.PHONY: up down reset migrate logs backend frontend dev dev-run setup \
	docker-build docker-export docker-build-api docker-build-frontend \
	release install

# --- Docker (PostgreSQL) ---

up:
	@chmod +x scripts/*.sh 2>/dev/null || true
	@./scripts/local-up.sh

down:
	@./scripts/local-down.sh

reset: down
	docker volume rm dock-pilot_postgres_data 2>/dev/null || docker volume rm $$(docker volume ls -q | grep postgres_data) 2>/dev/null || true
	@$(MAKE) up

migrate:
	@./scripts/migrate.sh

logs:
	docker compose logs -f postgres

# --- App (runs on host, DB in Docker) ---

setup:
	@test -f .env || cp .env.example .env
	@cd frontend && npm install
	@cd backend && go mod download
	@echo "Run 'make up' to start PostgreSQL, then 'make dev-run'"

backend:
	@set -a && . ./.env && set +a && cd backend && go run ./cmd/server

frontend:
	@cd frontend && npm run dev

# DB + migrations only (legacy alias)
dev: up

# Backend + frontend together (DB must be running)
dev-run:
	@chmod +x scripts/*.sh 2>/dev/null || true
	@./scripts/dev-run.sh

# --- Production images (copy to VPS) ---

docker-build:
	@chmod +x scripts/*.sh 2>/dev/null || true
	@./scripts/docker-build.sh

docker-build-api:
	@set -a && . ./.env 2>/dev/null || true; set +a; \
		docker compose -f docker-compose.build.yml build api

docker-build-frontend:
	@set -a && . ./.env 2>/dev/null || true; set +a; \
		docker compose -f docker-compose.build.yml build frontend

docker-export:
	@chmod +x scripts/*.sh 2>/dev/null || true
	@./scripts/docker-export.sh

dock-pilot-migrate:
	@./scripts/dock-pilot-migrate.sh

release:
	@chmod +x scripts/*.sh 2>/dev/null || true
	@./scripts/make-release.sh $(VERSION)

install:
	@chmod +x scripts/*.sh 2>/dev/null || true
	@./scripts/install.sh $(ARGS)
