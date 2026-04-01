# CorpMeet — Сервис бронирования переговорных комнат

## Команда

| Имя | Роль | Зона ответственности | Папки |
|-----|------|---------------------|-------|
| Иван | Тимлид, архитектор | Планшет + общая архитектура | `tablet/`, корневые файлы |
| Тимур | Разработчик | Бэкенд + фронтенд сайта | `backend/`, `frontend/` |
| Артём | Разработчик | Телеграм-бот + веб-апп | `tg-bot/` |

## Домены

| Адрес | Что показывает | Папка |
|-------|---------------|-------|
| https://corpmeet.uz | Основной сайт | `frontend/` |
| https://corpmeet.uz/api/docs | API документация (Swagger) | `backend/` |
| https://tg.corpmeet.uz | Telegram Web App | `tg-bot/webapp/` |
| https://app.corpmeet.uz | Экран переговорной | `tablet/` |

## Быстрый старт (локально)

```bash
git clone https://github.com/gubkinbot/corpmeet.git
cd corpmeet
cp .env.example .env        # заполнить TELEGRAM_BOT_TOKEN
docker compose up --build
```

Сайт откроется на `http://localhost`, API документация — `http://localhost/api/docs`.

## Как работать с Git

### Ветки

Каждый работает в своей ветке, потом делает PR в `main`:

```
main                          ← сюда мержим через PR
├── timur/feat-room-list      ← Тимур: список комнат
├── artem/feat-bot-booking    ← Артём: бронирование через бота
└── ivan/feat-tablet-status   ← Иван: статус комнаты на планшете
```

Формат имени ветки: `имя/тип-описание`
- `timur/feat-room-list` — новая фича
- `artem/fix-bot-crash` — баг-фикс
- `ivan/refactor-tablet-ui` — рефакторинг

### Последовательность работы

```bash
# 1. Обновить main
git checkout main
git pull

# 2. Создать ветку
git checkout -b имя/feat-описание

# 3. Работать, коммитить
git add backend/          # только свои папки!
git commit -m "feat: добавил список комнат"

# 4. Запушить ветку
git push -u origin имя/feat-описание

# 5. Создать Pull Request на GitHub
#    main ← имя/feat-описание
#    Дождаться ревью (или самому вмержить, если срочно)

# 6. После мержа — обновить main локально
git checkout main
git pull
```

### Правила коммитов

Префиксы: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `ci:`

```
feat: добавил эндпоинт отмены бронирования
fix: исправил конфликт времени при бронировании
docs: обновил README
```

### Золотое правило

> Коммить только в свои папки. Если нужно изменить чужую — согласуй с владельцем.

## Деплой

Автоматический. При мерже PR в `main`:
1. GitHub Actions подключается к серверу по SSH
2. Делает `git pull` + `docker compose up --build -d`
3. Через ~1 минуту изменения на проде

**Не нужно** заходить на сервер вручную.

## Структура проекта

```
corpmeet/
├── backend/        → Тимур    FastAPI + PostgreSQL
├── frontend/       → Тимур    React (corpmeet.uz)
├── tg-bot/         → Артём    aiogram 3 + React webapp (tg.corpmeet.uz)
├── tablet/         → Иван     React (app.corpmeet.uz)
├── nginx/          → общее    конфиг для локальной разработки
├── docker-compose.yml         все сервисы
├── .env.example               шаблон переменных
└── CLAUDE.md                  правила для Claude Code
```

## Claude Code

Каждый модуль содержит свой `CLAUDE.md` с инструкциями. При работе в VS Code с расширением Claude Code:
- Открывай проект из корня `corpmeet/`
- Claude автоматически загрузит общие правила + правила твоей папки
- Используй Claude для написания кода, он знает архитектуру проекта

## Полезные команды

```bash
# Запустить всё локально
docker compose up --build

# Пересобрать один сервис
docker compose up --build backend

# Логи конкретного сервиса
docker compose logs -f backend

# Остановить всё
docker compose down
```
