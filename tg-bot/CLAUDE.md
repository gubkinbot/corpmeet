# tg-bot — Телеграм-бот CorpMeet

## Режим работы

Claude **не выполняет команды самостоятельно** — только выводит команды и код в чат. Пользователь вручную выполняет команды и дополняет код. После обратной связи от пользователя Claude проверяет файлы на корректность.

После вывода предлагаемого кода — давать **подробное описание**: что делает каждый блок, зачем нужен, как связан с остальными модулями.

## Владелец модуля

Артём — Telegram-бот + Mini App webapp

## Стек

- Python 3.12, aiogram 3
- React (webapp на tg.corpmeet.uz)
- Docker

## Архитектура авторизации

Бот реализует:
- `/start` — проверка членства в группе (`getChatMember`), ввод имени/фамилии (латиница), регистрация через backend API, показ 2 кнопок
- `/start <token>` — QR-авторизация: вызов `POST /api/v1/internal/auth/consume-session` с заголовком `X-Bot-Secret`
- Кнопка "Открыть Telegram App" — WebApp-кнопка (tg.corpmeet.uz), авторизация через initData
- Кнопка "Открыть Web" — вызов `POST /api/v1/internal/auth/create-session` с `X-Bot-Secret` → отправка URL-кнопки `corpmeet.uz/auth/session/<token>`

## Взаимодействие с backend

- Backend — чужой модуль (Тимур), не модифицируем
- Все запросы к backend через HTTP
- Internal API (бот → backend) авторизуется заголовком `X-Bot-Secret`
- initData проверяется на стороне backend

## Переменные окружения (.env)

- `BOT_TOKEN` — токен бота от @BotFather
- `BOT_SECRET` — общий секрет для internal API (бот ↔ backend)
- `GROUP_ID` — ID группы для проверки членства
- `BACKEND_URL` — URL backend API (например http://backend:8000)

## Git

- Ветки: `artem/тип-описание` (например `artem/feat-auth`)
- Коммиты: `feat:`, `fix:`, `refactor:`, `docs:`
- PR в `main`, ревьюер — Иван (@gubkinbot)
- Коммитить только в `tg-bot/`