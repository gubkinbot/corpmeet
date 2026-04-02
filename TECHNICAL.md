# CorpMeet — Общее техническое описание

---

## Архитектура системы

CorpMeet — сервис бронирования переговорных комнат. Монорепозиторий с шестью компонентами:

| Компонент | Описание | Домен / порт |
|---|---|---|
| `backend/` | FastAPI + PostgreSQL, единый API для всех клиентов | `:8000`, `/api/` |
| `frontend/` | React + Vite, основной веб-сайт | `corpmeet.uz` → `:3000` |
| `tg-bot/` | aiogram 3, Telegram-бот | — |
| `tg-webapp/` | React, Mini App внутри Telegram | `tg.corpmeet.uz` → `:3001` |
| `tablet/` | React + Vite, экран у входа в переговорную | `app.corpmeet.uz` → `:3002` |
| `db` | PostgreSQL 16, изолирован внутри Docker-сети | — |

**Принцип:** все клиенты ходят в один бэкенд по `/api/`. PostgreSQL наружу не торчит.

**Инфраструктура:** Docker Compose, Nginx (системный, ISPmanager), деплой через GitHub Actions при пуше в `main`. Сервер: `194.87.138.47`.

---

## Стек

**Backend:** Python 3.12 · FastAPI 0.115 · Uvicorn · SQLAlchemy 2.0 (async) · asyncpg · Pydantic v2 · PyJWT (HS256) · bcrypt · Alembic

**Frontend / Tablet / TG Webapp:** React 18 · Vite · React Router v7

**Frontend (доп. зависимости):** `qrcode.react` — генерация QR-кодов на клиенте

**Bot:** aiogram 3

---

## Модели данных

### `users`

| Поле | Тип | Описание |
|---|---|---|
| `id` | UUID (PK) | Внутренний идентификатор |
| `telegram_id` | BigInt, unique, nullable | ID пользователя в Telegram; `NULL` для веб-пользователей |
| `username` | String(255), nullable | @username из Telegram |
| `first_name` | String(255) | Имя |
| `last_name` | String(255), nullable | Фамилия |
| `created_at` | DateTime(tz) | Дата регистрации |

### `rooms`

| Поле | Тип | Описание |
|---|---|---|
| `id` | UUID (PK) | Идентификатор переговорной |
| `name` | String(255) | Название комнаты |
| `floor` | Integer | Этаж |
| `capacity` | Integer | Вместимость (человек) |
| `created_at` | DateTime(tz) | Дата добавления |

### `bookings`

| Поле | Тип | Описание |
|---|---|---|
| `id` | UUID (PK) | Идентификатор бронирования |
| `room_id` | UUID (FK → rooms) | Переговорная |
| `user_id` | UUID (FK → users) | Кто забронировал |
| `title` | String(255) | Название встречи |
| `start_time` | DateTime(tz) | Начало |
| `end_time` | DateTime(tz) | Конец |
| `created_at` | DateTime(tz) | Дата создания |

### `browser_sessions`

Используется в сценариях QR-авторизации и перехода Mini App → браузер.

| Поле | Тип | Описание |
|---|---|---|
| `id` | UUID (PK) | Идентификатор |
| `session_token` | String(64), unique, index | Одноразовый токен сессии |
| `user_id` | UUID (FK → users), nullable | `NULL` до подтверждения (QR-флоу); заполнен сразу (deep-link флоу) |
| `used` | Boolean | Флаг одноразовости: после получения JWT → `true` |
| `expires_at` | DateTime(tz) | Время истечения (TTL 5 минут) |
| `created_at` | DateTime(tz) | Дата создания |

### `tablet_accounts`

Учётные записи для экранов переговорных. Независимы от `users`.

| Поле | Тип | Описание |
|---|---|---|
| `id` | UUID (PK) | Идентификатор |
| `username` | String(255), unique | Логин планшета |
| `password_hash` | String(255) | bcrypt-хэш пароля |
| `room_id` | UUID (FK → rooms) | Привязанная переговорная |
| `created_at` | DateTime(tz) | Дата создания |

Записи создаются вручную через seed-скрипт:

```bash
python -m app.seed --tablet-username tablet-room1 --tablet-password secret --room-id <uuid>
```

---

## Конфигурация

Параметры читаются из `.env` через `pydantic-settings`:

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | URL подключения к PostgreSQL (`postgresql+asyncpg://...`) |
| `JWT_SECRET` | Секрет для подписи JWT (HS256) |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота (нужен для верификации `initData`) |
| `BOT_INTERNAL_SECRET` | Секрет для internal API-эндпоинтов (заголовок `X-Bot-Secret`) |
| `WEBAPP_URL` | URL tg-webapp, используется ботом для кнопки Mini App (default: `https://tg.corpmeet.uz`) |

---

## Клиентские приложения

### frontend (`corpmeet.uz`)

Основной веб-сайт. React 18 + React Router v7 + Vite.

**Маршруты:**

| Путь | Компонент | Описание |
|---|---|---|
| `/login` | `LoginPage` | Страница входа: auto-login через initData или QR-код |
| `/auth/session/:token` | `SessionAuthPage` | Приём deep-link сессии из Mini App |
| `/bookings` | `BookingsPage` | Главная страница пользователя |
| `*` | — | Редирект на `/bookings` |

**Хранение токена:** `localStorage`, ключ `corpmeet_token`.

**API-клиент (`src/lib/api.js`):** обёртка над `fetch` — автоматически добавляет заголовок `Authorization: Bearer <token>` и при ответе `401` чистит `localStorage` и перенаправляет на `/login`.

**Хук `useAuth`:** при монтировании читает токен из `localStorage`, вызывает `GET /api/auth/me` для проверки актуальности и получения профиля. При ошибке — удаляет токен.

**Статус:** авторизация реализована полностью. Интерфейс бронирований — заглушка (`в разработке`).

---

### tg-webapp (`tg.corpmeet.uz`)

Mini App в Telegram. Отображает приветствие с именем из `tg.initDataUnsafe.user`. Интеграция с API и авторизация через `initData` — в разработке.

---

### tablet (`app.corpmeet.uz`)

Экран у входа в переговорную. Отображает статус "Свободна". Авторизация через `POST /api/auth/tablet` и отображение расписания — в разработке.

---

### tg-bot

Telegram-бот на aiogram 3. Текущая реализация:
- При `/start` — отвечает кнопкой-ссылкой на Mini App (`WebAppInfo`).
- На любое другое сообщение — echo-ответ.

**Важно:** обработка `/start <token>` для QR-авторизации и вызов `POST /api/internal/auth/consume-session` в текущем коде **не реализованы** — этот сценарий описывает запланированный флоу.

---

## Сценарии авторизации

### Сценарий 1. Вход через Telegram Mini App

**Участники:** фронтенд (Mini App), бэкенд.

**Триггер:** пользователь открывает приложение внутри Telegram.

**Предусловие:** `window.Telegram.WebApp.initData` не пустой — приложение запущено в контексте Telegram.

**Флоу:**

1. `LoginPage` при монтировании проверяет `window.Telegram?.WebApp?.initData`.
2. Если пользователь регистрируется впервые — отправляет `POST /api/auth/register` с `init_data`, `first_name`, `last_name`.
3. Если пользователь уже зарегистрирован — отправляет `POST /api/auth/login` с `init_data`.
4. Бэкенд верифицирует подпись `initData` через HMAC-SHA256 с ключом `WebAppData` + `BOT_TOKEN`.
5. Бэкенд проверяет свежесть: `auth_date` не старше 5 минут.
6. Бэкенд находит или создаёт пользователя по `telegram_id`.
7. Бэкенд возвращает `access_token` (JWT, HS256, TTL 7 дней).
8. Фронтенд сохраняет JWT в `localStorage` (ключ `corpmeet_token`) и перенаправляет на `/bookings`.

**Результат:** пользователь авторизован, JWT в `localStorage`.

---

### Сценарий 2. QR-авторизация в браузере

**Участники:** браузер, TG Bot, бэкенд.

**Триггер:** пользователь открывает веб-версию напрямую в браузере (не через Telegram). `window.Telegram.WebApp.initData` пустой.

**Предусловие:** пользователь уже зарегистрирован в системе через Telegram. Бот обрабатывает `/start <token>` (в разработке).

**Флоу:**

1. `LoginPage` при монтировании видит пустой `initData` и вызывает `POST /api/auth/qr-session`.
2. Бэкенд создаёт запись `BrowserSession`: `session_token = secrets.token_urlsafe(32)`, `user_id = NULL`, `expires_at = now + 5 минут`.
3. Бэкенд возвращает `token` и `bot_url = https://t.me/corpmeetbot?start=<token>`.
4. `LoginPage` рендерит QR-код из `bot_url` через `QRCodeSVG` (qrcode.react) и запускает polling: каждые 2 секунды `GET /api/auth/session/<token>`.
5. Пока `user_id = NULL` — бэкенд отвечает `202 { "status": "pending" }`, цикл продолжается.
6. Пользователь сканирует QR в Telegram. Telegram отправляет боту `/start <token>`.
7. Бот вызывает `POST /api/internal/auth/consume-session` с `{ token, telegram_id }` и заголовком `X-Bot-Secret`.
8. Бэкенд находит сессию по токену, находит пользователя по `telegram_id`, устанавливает `session.user_id = user.id`.
9. На следующей итерации polling-а бэкенд видит заполненный `user_id`, помечает `used = true`, генерирует JWT и возвращает его браузеру.
10. Браузер сохраняет JWT в `localStorage`, перенаправляет на `/bookings`.

**Ошибки:**
- `410 Gone` — токен истёк (прошло более 5 минут) или уже использован. `LoginPage` показывает кнопку «Создать новый».
- `404 Not Found` — токен не найден в БД.

**Результат:** пользователь авторизован в браузере через подтверждение в Telegram.

---

### Сценарий 3. Переход из Mini App в браузер (Deep-link)

**Участники:** фронтенд (Mini App), браузер, бэкенд.

**Триггер:** пользователь нажимает кнопку «🌐 Открыть в браузере» внутри Mini App.

**Предусловие:** пользователь уже авторизован в Mini App, у фронтенда есть действующий JWT.

**Флоу:**

1. Фронтенд отправляет `POST /api/auth/browser/session` с JWT в заголовке `Authorization: Bearer <JWT>`.
2. Бэкенд по JWT определяет пользователя и создаёт `BrowserSession`: `session_token = secrets.token_urlsafe(32)`, `user_id` заполнен сразу, `expires_at = now + 5 минут`.
3. Бэкенд возвращает `session_token` и `browser_url = /auth/session/<session_token>`.
4. **JWT в ссылку не попадает.** В URL — только `session_token` (одноразовый ключ, TTL 5 минут). Защита от утечки через историю браузера, логи сервера и Referer-заголовки.
5. Фронтенд Mini App открывает `browser_url` через `tg.openLink()`.
6. Браузер загружает страницу `/auth/session/<session_token>` — компонент `SessionAuthPage`.
7. `SessionAuthPage` немедленно вызывает `GET /api/auth/session/<session_token>`.
8. Бэкенд находит сессию, видит заполненный `user_id`, помечает `used = true`, возвращает JWT.
9. `SessionAuthPage` сохраняет JWT в `localStorage` через `storage.setToken()`, перенаправляет на `/bookings`.

**Ошибки:**
- `410 Gone` или любая другая ошибка — `SessionAuthPage` показывает сообщение «Ссылка недействительна или истекла» и через 2 секунды редиректит на `/login`.

**Результат:** пользователь авторизован в браузере без QR-кода, без повторного ввода данных, без участия бота.

---

### Сценарий 4. Бот авторизуется от имени пользователя

**Участники:** TG Bot, бэкенд.

**Триггер:** бот получает от пользователя команду, требующую обращения к API.

**Предусловие:** пользователь зарегистрирован в системе.

**Флоу:**

1. Бот конструирует `initData` самостоятельно: собирает JSON пользователя из данных Telegram, устанавливает `auth_date = now`, вычисляет подпись через `HMAC-SHA256(WebAppData + BOT_TOKEN)`.
2. Отправляет `POST /api/auth/login` с построенной `initData`.
3. Бэкенд верифицирует подпись — она валидна, так как бот знает тот же `BOT_TOKEN`.
4. Бэкенд возвращает JWT.
5. Бот кэширует JWT в памяти (`_jwt_cache[telegram_id] = (token, exp)`), с запасом 1 час до истечения.
6. Все последующие запросы к API бот делает с этим JWT в заголовке `Authorization: Bearer`.

**Результат:** бот делает API-запросы от имени пользователя без хранения паролей.

---

### Сценарий 5. Авторизация планшета

**Участники:** клиент `tablet`, бэкенд.

**Триггер:** планшет у входа в переговорную запускается или перезагружается.

**Предусловие:** в БД есть запись `TabletAccount`, созданная через `app.seed`.

**Флоу:**

1. Планшет отправляет `POST /api/auth/tablet` с `username` и `password`.
2. Бэкенд ищет `TabletAccount` по `username`, проверяет пароль через bcrypt.
3. Бэкенд подгружает привязанную комнату по `room_id`.
4. Бэкенд возвращает JWT (`sub = tablet_account.id`) и объект комнаты.
5. Планшет сохраняет JWT и знает, какую переговорную отображать.

**Отличие от пользовательского JWT:** `sub` указывает на `tablet_accounts.id`, а не на `users.id`.

**Результат:** планшет авторизован и привязан к конкретной переговорной.

---

## Жизненный цикл токенов

| Токен | Где живёт | TTL | Одноразовый |
|---|---|---|---|
| `initData` | Строка в запросе, нигде не хранится | 5 минут от `auth_date` | Нет (но устаревает) |
| `JWT` (access_token) | `localStorage` браузера (`corpmeet_token`) / кэш бота / планшет | 7 дней | Нет |
| `session_token` (BrowserSession) | Таблица `browser_sessions` в БД | 5 минут | Да, поле `used` |
| `BOT_SECRET` | `.env` бэкенда и бота | Бессрочно | Нет |

---

## Эндпоинты

Базовый путь: `/api/`. Документация FastAPI (Swagger UI) доступна по `/api/docs`.

---

### Служебные

#### `GET /api/health`

Проверка состояния сервера.

| | |
|---|---|
| **Авторизация** | Не требуется |
| **Ответ** | `{ "status": "ok" }` |

---

### Авторизация (`/api/auth/`)

---

#### `POST /api/auth/register`

Регистрация нового пользователя через Telegram Mini App.

| | |
|---|---|
| **Авторизация** | Не требуется |
| **Тело запроса** | `{ "init_data": "...", "first_name": "Иван", "last_name": "Иванов" }` |
| **Ответ** | `201 { "access_token": "eyJ...", "expires_in": 604800 }` |
| **Ошибки** | `409` — пользователь уже зарегистрирован; `401` — невалидная или просроченная `initData` |

Верифицирует `initData` через HMAC-SHA256. Извлекает `telegram_id` из поля `user`. Создаёт запись в таблице `users`. Возвращает JWT.

---

#### `POST /api/auth/login`

Вход существующего пользователя через Telegram Mini App или от имени бота.

| | |
|---|---|
| **Авторизация** | Не требуется |
| **Тело запроса** | `{ "init_data": "..." }` |
| **Ответ** | `{ "access_token": "eyJ...", "expires_in": 604800 }` |
| **Ошибки** | `404` — пользователь не зарегистрирован; `401` — невалидная `initData` |

Верифицирует `initData`, находит пользователя по `telegram_id`. Если `username` изменился — обновляет в БД. Возвращает JWT.

---

#### `GET /api/auth/me`

Профиль текущего авторизованного пользователя.

| | |
|---|---|
| **Авторизация** | `Authorization: Bearer <JWT>` |
| **Ответ** | `{ "id": "...", "telegram_id": 123, "username": "...", "first_name": "...", "last_name": "..." }` |
| **Ошибки** | `401` — невалидный или просроченный JWT |

Используется хуком `useAuth` при каждом запуске приложения для проверки актуальности JWT и получения данных пользователя.

---

#### `POST /api/auth/qr-session`

Создание QR-сессии для авторизации в браузере.

| | |
|---|---|
| **Авторизация** | Не требуется |
| **Тело запроса** | Пустое |
| **Ответ** | `{ "token": "...", "bot_url": "https://t.me/corpmeetbot?start=...", "expires_in": 300 }` |

Создаёт `BrowserSession` с `user_id = NULL` и TTL 5 минут. Фронтенд генерирует QR-код из `bot_url` через `QRCodeSVG` и начинает polling на `GET /auth/session/{token}` каждые 2 секунды.

---

#### `POST /api/auth/browser/session`

Создание одноразовой сессии для перехода из Mini App в браузер.

| | |
|---|---|
| **Авторизация** | `Authorization: Bearer <JWT>` |
| **Тело запроса** | Пустое |
| **Ответ** | `{ "session_token": "...", "browser_url": "/auth/session/..." }` |

Создаёт `BrowserSession` с заполненным `user_id` (из JWT) и TTL 5 минут. JWT в ссылку не включается — только одноразовый `session_token`.

---

#### `GET /api/auth/session/{token}`

Проверка сессионного токена и получение JWT. Используется двумя способами: polling при QR-авторизации и компонентом `SessionAuthPage` при переходе из Mini App.

| | |
|---|---|
| **Авторизация** | Не требуется |
| **Ответ** | `202 { "status": "pending" }` — ещё не подтверждено |
| | `200 { "access_token": "eyJ...", "expires_in": 604800 }` — JWT готов |
| **Ошибки** | `404` — токен не найден; `410` — истёк или уже использован |

При успешном возврате JWT помечает сессию `used = true` — повторный вызов вернёт `410`.

---

#### `POST /api/auth/tablet`

Авторизация планшета у входа в переговорную.

| | |
|---|---|
| **Авторизация** | Не требуется |
| **Тело запроса** | `{ "username": "tablet-room1", "password": "..." }` |
| **Ответ** | `{ "token": "eyJ...", "room": { "id": "...", "name": "...", "floor": 3, "capacity": 8 } }` |
| **Ошибки** | `401` — неверный логин или пароль; `404` — привязанная комната не найдена |

Проверяет пароль через bcrypt. Возвращает JWT (`sub = tablet_account.id`) и данные привязанной переговорной.

---

### Переговорные комнаты (`/api/rooms/`)

---

#### `GET /api/rooms/`

Список всех переговорных комнат.

| | |
|---|---|
| **Авторизация** | `Authorization: Bearer <JWT>` |
| **Ответ** | Массив `[{ "id": "...", "name": "...", "floor": 3, "capacity": 8 }, ...]` |
| **Ошибки** | `401` — невалидный или просроченный JWT |

---

#### `POST /api/rooms/`

Создание новой переговорной комнаты.

| | |
|---|---|
| **Авторизация** | `Authorization: Bearer <JWT>` |
| **Тело запроса** | `{ "name": "Переговорная А", "floor": 3, "capacity": 8 }` |
| **Ответ** | `201` + созданный объект комнаты |
| **Ошибки** | `401` — невалидный или просроченный JWT |

---

### Бронирования (`/api/bookings/`)

---

#### `GET /api/bookings/`

Список бронирований. Поддерживает фильтрацию по комнате.

| | |
|---|---|
| **Авторизация** | `Authorization: Bearer <JWT>` |
| **Query-параметры** | `room_id` (UUID, необязательный) — фильтр по переговорной |
| **Ответ** | Массив `[{ "id", "room_id", "user_id", "title", "start_time", "end_time" }, ...]` |
| **Ошибки** | `401` — невалидный или просроченный JWT |

---

#### `POST /api/bookings/`

Создание бронирования переговорной.

| | |
|---|---|
| **Авторизация** | `Authorization: Bearer <JWT>` |
| **Тело запроса** | `{ "room_id": "...", "title": "Встреча команды", "start_time": "2026-04-01T10:00:00Z", "end_time": "2026-04-01T11:00:00Z" }` |
| **Ответ** | `201` + созданный объект бронирования |
| **Ошибки** | `401` — невалидный JWT; `409` — временной слот уже занят |

Перед созданием проверяет конфликт по времени: `start_time < existing.end_time AND end_time > existing.start_time`. При пересечении — `409 Time slot already booked`.

---

### Internal эндпоинты (`/api/internal/`)

Доступны только для TG Bot. Все запросы требуют заголовок `X-Bot-Secret: <BOT_INTERNAL_SECRET>`. При несовпадении — `403 Invalid bot secret`.

---

#### `POST /api/internal/auth/consume-session`

Привязка `telegram_id` к сессионному токену при QR-авторизации.

| | |
|---|---|
| **Авторизация** | `X-Bot-Secret` |
| **Тело запроса** | `{ "token": "...", "telegram_id": 123456789 }` |
| **Ответ** | `{ "ok": true }` |
| **Ошибки** | `404` — токен не найден; `410` — истёк или уже использован; `404` — пользователь с таким `telegram_id` не зарегистрирован |

Вызывается ботом при получении команды `/start <token>`. После этого браузер на следующем polling-запросе получит JWT.

---

#### `POST /api/internal/users/ensure`

Создание или обновление пользователя из данных Telegram.

| | |
|---|---|
| **Авторизация** | `X-Bot-Secret` |
| **Тело запроса** | `{ "telegram_id": 123, "first_name": "...", "last_name": "...", "username": "...", "full_name": "..." }` |
| **Ответ** | Объект пользователя (`id`, `telegram_id`, `username`, `first_name`, `last_name`) |

Вызывается при `/start` без токена. Создаёт запись, если её нет. Если пользователь существует и изменился `username` — обновляет его.

---

#### `GET /api/internal/users/by-username/{username}`

Получение `telegram_id` пользователя по @username.

| | |
|---|---|
| **Авторизация** | `X-Bot-Secret` |
| **Ответ** | `{ "telegram_id": 123456789 }` |
| **Ошибки** | `404` — пользователь не найден |

Используется для отправки личных уведомлений в Telegram по username, известному из бронирования.
