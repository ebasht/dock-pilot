# DockPilot

Панель для управления сайтами и ботами на Docker на VPS: деплой, nginx, SSL, мониторинг, Telegram-уведомления.

Стек: Go API · Next.js UI · PostgreSQL · Docker · nginx · certbot.

---

## VPS: первая установка

**Нужно:** Ubuntu/Debian, Docker (скрипт может поставить сам), домен панели с A-записью на сервер, порты 80 и 443.

Скачайте скрипт в файл (не `curl | bash` — иначе может оборваться на миграциях):

```bash
curl -fsSL -H "Accept: application/vnd.github.raw+json" \
  "https://api.github.com/repos/ebasht/dock-pilot/contents/scripts/install.sh?ref=main" \
  -o /tmp/dock-pilot-install.sh

sudo bash /tmp/dock-pilot-install.sh \
  --domain panel.example.com \
  --email you@example.com \
  --version latest
```

Опции:

| Флаг | Зачем |
|------|--------|
| `--version v0.1.19` | Конкретный релиз вместо `latest` |
| `--skip-packages` | Docker/nginx/certbot уже установлены |
| `--reset-db` | Сбросить volume PostgreSQL (данные панели пропадут) |

После установки:

- Панель: `https://panel.example.com`
- API-токен: в выводе скрипта и в `/opt/dock-pilot/credentials.txt`
- Файлы: `/opt/dock-pilot`

В UI введите токен (хранится в `localStorage` до выхода). На телефоне можно войти по QR с десктопа.

---

## VPS: обновление

Повторный `install.sh` **не** подтягивает новые образы. Для обновления:

```bash
curl -fsSL -H "Accept: application/vnd.github.raw+json" \
  "https://api.github.com/repos/ebasht/dock-pilot/contents/scripts/dock-pilot-upgrade.sh?ref=main" \
  -o /tmp/dock-pilot-upgrade.sh

sudo bash /tmp/dock-pilot-upgrade.sh v0.1.7
```

или последний релиз:

```bash
sudo bash /tmp/dock-pilot-upgrade.sh latest
```

Скрипт: скачивает release → `docker load` → миграции → пересоздаёт `postgres`, `api`, `frontend` → обновляет nginx. Токен и данные БД сохраняются.

Проверка: версия в шапке панели (например `v0.1.19`).

Релизы: [github.com/ebasht/dock-pilot/releases](https://github.com/ebasht/dock-pilot/releases)

---

## Локальная разработка

Требования: Docker, Go 1.22+, Node.js 20+.

```bash
make setup    # зависимости + .env
make up       # PostgreSQL + миграции
make dev-run  # API :8080 + UI :3000
```

`DEPLOY_MODE=stub` в `.env` — деплой без реального Docker (только логи). На VPS — `DEPLOY_MODE=real`.

Полезное: `make migrate`, `make down`, `make reset`, `make docker-export` (образы для VPS).

---

## Авторизация

- Сервер: `API_TOKEN` в `.env` (≥ 16 символов)
- Клиент: `Authorization: Bearer <token>` на все `/api/*`
- `GET /health` — без токена
- SSE-логи: `?token=...` в URL

---

## Сборка релиза (maintainer)

```bash
make release VERSION=v0.1.0
git tag v0.1.0 && git push origin v0.1.0
```
