# CorpMeet — Общие правила проекта

## Описание
Сервис бронирования переговорных комнат. Монорепозиторий с 4 модулями:
- `backend/` — FastAPI + PostgreSQL (единый API)
- `frontend/` — React + Vite (основной сайт, corpmeet.uz)
- `tg-bot/` — aiogram 3 + React webapp (tg.corpmeet.uz)
- `tablet/` — React + Vite (экран переговорной, app.corpmeet.uz)

## Архитектура
- Все клиенты (frontend, tg-webapp, tablet) работают через единый backend API
- Backend доступен по `/api/` на всех доменах
- Каждый модуль — отдельный Docker-контейнер
- PostgreSQL — внутри Docker, не торчит наружу

## Стек
- Python 3.12, FastAPI, SQLAlchemy (async), Pydantic
- React 18, Vite
- aiogram 3
- Docker Compose, Nginx (системный, ISPmanager)

## Стиль кода
- Python: snake_case, 4 пробела, type hints на всех публичных функциях
- JavaScript/JSX: camelCase для переменных, PascalCase для компонентов, 2 пробела
- Осмысленные имена переменных, без однобуквенных (кроме циклов)
- Комментарии объясняют «почему», а не «что»

## Git-конвенции
- Коммиты на русском или английском, с префиксами: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `ci:`
- Каждый контрибьютор коммитит только в свою папку
- Ветки: `feat/описание`, `fix/описание`
- Не пушить в main напрямую — только через PR (когда настроим)

## Безопасность
- Никогда не коммитить секреты, токены, пароли
- `.env` файлы в .gitignore
- Валидировать входные данные на границах системы (API-эндпоинты)

## Запуск
- Локально: `docker compose up --build`
- Деплой: автоматический через GitHub Actions при пуше в main
- Сервер: 194.87.138.47, Docker Compose в `/var/www/www-root/data/www/corpmeet.uz/`
