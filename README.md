# DockPilot

Platform for managing Docker-based websites on a VPS. A Next.js web UI talks to a Go API that manages sites, deployments, containers, nginx, and SSL certificates.

## Stack

- **Backend:** Go (chi, pgx, sqlc, goose)
- **Frontend:** Next.js (App Router, TypeScript)
- **Database:** PostgreSQL (Docker for local dev)
- **Runtime:** Docker (`DEPLOY_MODE=stub` locally, `real` on VPS)
- **Reverse proxy:** nginx (writes configs on host, reload via chroot)
- **SSL:** certbot (`certonly --nginx` on host)

## Локальный запуск (БД в Docker)

Требования: [Docker](https://docs.docker.com/get-docker/), Go 1.22+, Node.js 20+.

```bash
# 1. Первичная настройка (зависимости + .env)
make setup

# 2. Поднять PostgreSQL в Docker и применить миграции
make up

# 3. Запустить API и UI (одной командой)
make dev-run
```

Или в двух терминалах после `make up`:

```bash
make backend   # http://localhost:8080
make frontend  # http://localhost:3000
```

### Полезные команды

| Команда | Описание |
|---------|----------|
| `make up` | Запуск Postgres в Docker + миграции |
| `make down` | Остановка контейнеров |
| `make reset` | Удалить volume с данными и поднять заново |
| `make migrate` | Только миграции (Postgres уже запущен) |
| `make logs` | Логи PostgreSQL |
| `make dev-run` | Backend + frontend на хосте |

Строка подключения к БД:

```
postgres://dockpilot:dockpilot@localhost:5432/dockpilot?sslmode=disable
```

Скопируйте `.env.example` в `.env` (скрипт `make up` делает это автоматически). Для фронтенда создаётся `frontend/.env.local` с `NEXT_PUBLIC_API_URL`. Токен API вводится в браузере при первом входе.

По умолчанию `DEPLOY_MODE=stub` — деплой только пишет логи, без Docker/nginx/certbot. Для реального деплоя на VPS см. ниже.

### Авторизация

- **Backend:** `API_TOKEN` в `.env` (минимум 16 символов), все `/api/*` требуют `Authorization: Bearer <token>`
- **Frontend:** при открытии UI запрашивается тот же токен; сохраняется в `sessionStorage` до закрытия вкладки
- **CORS:** в `.env` API задайте `CORS_ALLOWED_ORIGINS` — URL, с которого открываете UI (с портом), например `http://77.238.238.224:3001`
- SSE-логи: `?token=...` в URL

`GET /health` без авторизации.

`NEXT_PUBLIC_API_URL` вшивается в frontend **при сборке образа**. На экране входа показан фактический URL — если там `localhost`, пересоберите frontend.

## Установка на VPS (одна команда)

Требования: **Ubuntu/Debian**, чистый VPS, домен панели (`deploy.example.com`) уже указывает на IP сервера, порты **80** и **443** открыты.

После [публикации релиза на GitHub](https://github.com/e-bashtan/dock-pilot/releases):

```bash
curl -fsSL -H "Accept: application/vnd.github.raw+json" \
  "https://api.github.com/repos/e-bashtan/dock-pilot/contents/scripts/install.sh?ref=main" \
  -o /tmp/dock-pilot-install.sh

sudo bash /tmp/dock-pilot-install.sh \
  --domain deploy.example.com \
  --email you@example.com \
  --version v0.1.0 \
  --skip-packages
```

> Не используйте `curl | bash` — `docker compose run` может съесть stdin и оборвать установку после миграций. Сохраняйте скрипт в файл (`-o`), как выше.

> `raw.githubusercontent.com` может отдавать устаревший `install.sh` (CDN). Используйте GitHub API (команда выше) или `cdn.jsdelivr.net/gh/e-bashtan/dock-pilot@main/scripts/install.sh`.

Скрипт автоматически:

1. Ставит Docker, nginx, certbot
2. Скачивает дистрибутив с GitHub Releases
3. Поднимает PostgreSQL + API + UI
4. Настраивает nginx и выпускает **Let's Encrypt** для домена панели
5. Печатает **API token** для входа в UI

Токен также сохраняется в `/opt/dock-pilot/credentials.txt`.

Повторный запуск установки (починит nginx + certbot, подберёт свободные порты):

```bash
curl -fsSL -H "Accept: application/vnd.github.raw+json" \
  "https://api.github.com/repos/e-bashtan/dock-pilot/contents/scripts/install.sh?ref=main" \
  -o /tmp/dock-pilot-install.sh

sudo bash /tmp/dock-pilot-install.sh \
  --domain panel.example.com \
  --email you@example.com \
  --version v0.1.0 \
  --skip-packages
```

Если Postgres ругается на пароль после прошлых попыток: добавьте `--reset-db` (удалит данные панели в Docker volume).

Если на сервере уже стоят Docker, nginx и certbot, но `apt` ругается на конфликты пакетов — используйте `--skip-packages`.

### Обновление на VPS (новые образы)

Повторный `install.sh` **не подтягивает новые образы**, если в `/opt/dock-pilot` уже есть `docker-compose.full.yml` и теги `dock-pilot-*:latest`. Используйте скрипт обновления:

```bash
curl -fsSL -H "Accept: application/vnd.github.raw+json" \
  "https://api.github.com/repos/e-bashtan/dock-pilot/contents/scripts/dock-pilot-upgrade.sh?ref=main" \
  -o /tmp/dock-pilot-upgrade.sh

sudo bash /tmp/dock-pilot-upgrade.sh v0.1.7
# или последний релиз:
sudo bash /tmp/dock-pilot-upgrade.sh latest
```

Скрипт: скачивает release с GitHub → `docker load` → миграции → `up -d --force-recreate api frontend` → обновляет nginx.

Вручную (то же самое):

```bash
cd /opt/dock-pilot
VERSION=v0.1.7
curl -fsSL -o /tmp/bundle.tar.gz \
  "https://github.com/e-bashtan/dock-pilot/releases/download/${VERSION}/dock-pilot-${VERSION#v}.tar.gz"
tar -xzf /tmp/bundle.tar.gz -C /tmp
gunzip -c /tmp/dock-pilot-images.tar.gz | docker load
docker compose -f docker-compose.full.yml run --rm -T migrate
docker compose -f docker-compose.full.yml up -d --force-recreate api frontend
sudo bash scripts/configure-panel-nginx.sh
```

Проверка: в шапке панели должна появиться версия (`v0.1.7`). API-токен и данные БД сохраняются (`.env` и volume не трогаются).

Дальше в панели создайте сайт с **вашим доменом приложения** (DNS → тот же VPS) и нажмите Deploy — certbot выдаст сертификат для сайта автоматически.

### Сборка релиза (maintainer)

```bash
make release VERSION=v0.1.0
# → dist/dock-pilot-0.1.0.tar.gz — загрузить в GitHub Release
git tag v0.1.0 && git push origin v0.1.0   # CI соберёт образы автоматически
```

### Локальная установка из собранного bundle

```bash
make release VERSION=v0.1.0
sudo ./scripts/install.sh --from-dir dist/dock-pilot-0.1.0 \
  --domain deploy.example.com --email you@example.com
```

---

## Docker-образы для VPS (ручной режим)

Соберите API и frontend, упакуйте в архив и перенесите на сервер.

### Сборка (на своей машине)

В `.env` задайте публичный URL API **как его видит браузер** (вшивается в frontend при сборке):

```bash
NEXT_PUBLIC_API_URL=https://your-vps.example.com:8080
API_TOKEN=<секретный токен — вводится в браузере при входе в UI>
```

```bash
make docker-export
# → dist/dock-pilot-images.tar.gz (api + frontend + migrate + postgres)
```

По умолчанию образы собираются для **`linux/amd64`** (типичный VPS). На Mac (ARM) это уже учтено; явно:

```bash
DOCKER_PLATFORM=linux/amd64 make docker-export
```

Только образы без архива:

```bash
make docker-build
```

### Деплой на VPS (PostgreSQL в Docker)

PostgreSQL входит в архив образов (`dock-pilot-postgres:latest`, на базе `postgres:16-alpine`). Отдельно ставить Postgres на VPS не нужно.

```bash
# Скопировать на сервер
scp dist/dock-pilot-images.tar.gz docker-compose.dock-pilot.yml .env.dock-pilot.example scripts/dock-pilot-*.sh user@vps:/opt/dock-pilot/

# На VPS
cd /opt/dock-pilot
cp .env.dock-pilot.example .env && chmod 600 .env
# Задайте POSTGRES_PASSWORD, SECRETS_ENCRYPTION_KEY, API_TOKEN, CORS_ALLOWED_ORIGINS, CERTBOT_EMAIL
gunzip -c dock-pilot-images.tar.gz | docker load
chmod +x scripts/dock-pilot-*.sh
./scripts/dock-pilot-db-check.sh    # проверка PostgreSQL (опционально)
./scripts/dock-pilot-migrate.sh     # только миграции (goose up)
./scripts/dock-pilot-up.sh          # postgres + миграции + api + frontend
```

Данные БД хранятся в Docker volume `dock_pilot_pg`. В `.env` `DATABASE_URL` должен указывать на сервис `postgres` в compose:

```bash
DATABASE_URL=postgres://dockpilot:PASSWORD@postgres:5432/dockpilot?sslmode=disable
```

Сервисы: API `:8080`, UI `:3000` (или `FRONTEND_PORT` в `.env`).

### Реальный деплой на VPS (`DEPLOY_MODE=real`)

На сервере должны быть установлены **Docker**, **nginx**, **certbot** (пакеты в ОС, не в контейнере API). API-контейнер монтирует `/var/run/docker.sock` и корень хоста в `/host`. Nginx на хосте должен быть запущен (`systemctl start nginx`); reload идёт через `systemctl reload nginx` (через chroot).

В `.env` на VPS:

| Переменная | Назначение |
|------------|------------|
| `DEPLOY_MODE=real` | git clone, docker build/run, nginx, certbot |
| `CERTBOT_EMAIL` | email для Let's Encrypt |
| `HOST_ROOT=/host` | chroot для `nginx -t`, reload, certbot |
| `NGINX_SITES_*` | пути **внутри контейнера**, обычно `/host/etc/nginx/sites-available` |
| `CORS_ALLOWED_ORIGINS` | URL UI, например `http://IP:3001` |

Домены сайта должны указывать на VPS (DNS). Порты **80/443** на хосте должны быть свободны для nginx и certbot.

Пересборка образов после изменений бэкенда:

```bash
DOCKER_PLATFORM=linux/amd64 make docker-export
```

### Частые ошибки на VPS

| Ошибка | Решение |
|--------|---------|
| `platform (linux/arm64) does not match (linux/amd64)` | `DOCKER_PLATFORM=linux/amd64 make docker-export` и заново `docker load` |
| `bind: address already in use` на `:3000` | `FRONTEND_PORT=3001` в `.env` |
| Таблиц в БД нет | `./scripts/dock-pilot-migrate.sh` |
| PostgreSQL не стартует | `docker compose -f docker-compose.dock-pilot.yml logs postgres` |

| Файл | Назначение |
|------|------------|
| `backend/Dockerfile` | Go API |
| `frontend/Dockerfile` | Next.js standalone |
| `docker-compose.build.yml` | сборка образов |
| `docker-compose.dock-pilot.yml` | запуск на VPS (postgres + api + frontend) |

## Quick start (manual)

### 1. Start PostgreSQL

```bash
docker compose up -d postgres
./scripts/wait-for-postgres.sh
./scripts/migrate.sh
```

### 2. Backend

```bash
cp .env.example .env
set -a && source .env && set +a
cd backend && go run ./cmd/server
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Project layout

```
backend/          Go API, migrations, sqlc queries
frontend/         Next.js App Router UI
scripts/          Local dev helpers
docker-compose.yml
```

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sites` | Create site |
| GET | `/api/sites` | List sites |
| GET | `/api/sites/{id}` | Get site |
| PATCH | `/api/sites/{id}` | Update site |
| DELETE | `/api/sites/{id}` | Delete site |
| GET | `/api/sites/{id}/health` | Site health (container + HTTP) |
| GET | `/api/sites/{id}/logs/stream` | SSE container stdout/stderr (`?token=`) |
| POST | `/api/sites/{id}/deploy` | Start deployment |
| GET | `/api/sites/{id}/deployments` | List deployments |
| GET | `/api/deployments/{id}/logs/stream` | SSE log stream |
| GET/POST/PUT/DELETE | `/api/sites/{id}/secrets` | Manage encrypted secrets |

## Secrets

Secrets are encrypted at rest with AES-256-GCM. After saving, values are never returned in API responses—only keys and metadata.

## API authentication

Set `API_TOKEN` in `.env`. Clients must send `Authorization: Bearer <token>` or `X-API-Token: <token>`. Deployment log SSE accepts `?token=<token>` in the URL.

## Deployment worker

Worker steps: **git clone** → **docker build** → **allocate port** → **docker run** → **nginx config** → **nginx test/reload** → **certbot** (если SSL включён).

- `DEPLOY_MODE=stub` — шаги выполняются с заглушками (локальная разработка).
- `DEPLOY_MODE=real` — реальные команды; на VPS нужны Docker socket, nginx и certbot на хосте (см. `docker-compose.dock-pilot.yml`).
