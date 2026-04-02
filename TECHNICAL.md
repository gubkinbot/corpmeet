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
| `telegram_id` | BigInt, unique, nullable | ID пользователя в Telegram |
| `username` | String(255), nullable | @username из Telegram |
| `first_name` | String(255) | Имя |
| `last_name` | String(255), nullable | Фамилия |
| `role` | String(15), default `"user"` | Роль: `user`, `admin`, `superadmin` |
| `is_active` | Boolean, default `true` | Активен ли аккаунт |
| `is_registered` | Boolean, default `false` | Завершил ли пользователь регистрацию |
| `feed_token` | String(64), unique, nullable | Токен для iCal-фида (генерируется по запросу) |
| `created_at` | DateTime(tz) | Дата регистрации |
| `updated_at` | DateTime(tz) | Дата последнего изменения |

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
| `description` | String(2000), nullable | Описание |
| `start_time` | DateTime(tz) | Начало |
| `end_time` | DateTime(tz) | Конец |
| `guests` | JSONB, default `[]` | Список гостей (массив строк) |
| `recurrence` | String(10), default `"none"` | Повтор: `none`, `daily`, `weekly`, `custom` |
| `recurrence_until` | Date, nullable | До какой даты повторять |
| `recurrence_group_id` | BigInteger, nullable | ID серии повторяющихся встреч |
| `recurrence_days` | JSONB, nullable | Дни недели для `custom` (0=пн … 6=вс) |
| `reminder_sent` | Boolean, default `false` | Отправлено ли напоминание боту |
| `deleted_at` | DateTime(tz), nullable | Мягкое удаление |
| `prev_start_time` | DateTime(tz), nullable | Предыдущее начало (для уведомлений об изменении) |
| `prev_end_time` | DateTime(tz), nullable | Предыдущий конец (для уведомлений об изменении) |
| `created_at` | DateTime(tz) | Дата создания |
| `updated_at` | DateTime(tz) | Дата последнего изменения |

### `browser_sessions`

Используется в сценариях QR-авторизации и перехода Mini App → браузер.

| Поле | Тип | Описание |
|---|---|---|
| `id` | UUID (PK) | Идентификатор |
| `session_token` | String(64), unique, index | Одноразовый токен сессии |
| `user_id` | UUID (FK → users), nullable | `NULL` до подтверждения (QR-флоу); заполнен сразу (deep-link флоу) |
| `used` | Boolean | Флаг одноразовости |
| `used_at` | DateTime(tz), nullable | Когда токен был использован |
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

| Переменная | Default | Описание |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://corpmeet:changeme@db:5432/corpmeet` | URL подключения к PostgreSQL |
| `JWT_SECRET` | `change-me-in-production` | Секрет для подписи JWT (HS256) |
| `TELEGRAM_BOT_TOKEN` | `""` | Токен Telegram-бота (нужен для верификации `initData`) |
| `BOT_INTERNAL_SECRET` | `""` | Секрет для internal API-эндпоинтов (`X-Bot-Secret`) |
| `TG_BOT_USERNAME` | `corpmeetbot` | Username бота, используется в `bot_url` при QR-сессии |
| `FRONTEND_URL` | `http://localhost:3000` | URL фронтенда (используется при генерации ссылок) |
| `APP_TIMEZONE` | `Asia/Tashkent` | Временная зона приложения |
| `CORPMEET_DEV` | `""` | При значении `"1"` включает эндпоинт `/auth/dev-login` |

---

## Роли и права доступа

| Роль | Описание | Доступ |
|---|---|---|
| `user` | Обычный пользователь | Свои бронирования, просмотр расписания |
| `admin` | Администратор | Управление всеми бронированиями и пользователями |
| `superadmin` | Суперадмин | Всё, включая смену ролей других пользователей |

В коде права проверяются через зависимости FastAPI:
- `get_current_user` — любой авторизованный пользователь
- `get_admin_user` — `role in ("admin", "superadmin")`
- `get_superadmin_user` — `role == "superadmin"`
- `get_current_tablet` — JWT с `sub = tablet_account.id`

Изменение и удаление чужих бронирований разрешено только `admin` и `superadmin`.

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

Экран у входа в переговорную. Отображает статус "Свободна". Авторизация через `POST /api/auth/tablet` и работа с `/api/tablet/` — в разработке.

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
6. Бэкенд находит или создаёт пользователя по `telegram_id`, выставляет `is_registered = true`.
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
3. Бэкенд возвращает `token` и `bot_url = https://t.me/<TG_BOT_USERNAME>?start=<token>`.
4. `LoginPage` рендерит QR-код из `bot_url` через `QRCodeSVG` (qrcode.react) и запускает polling: каждые 2 секунды `GET /api/auth/session/<token>`.
5. Пока `user_id = NULL` — бэкенд отвечает `202 { "status": "pending" }`, цикл продолжается.
6. Пользователь сканирует QR в Telegram. Telegram отправляет боту `/start <token>`.
7. Бот вызывает `POST /api/internal/auth/consume-session` с `{ token, telegram_id }` и заголовком `X-Bot-Secret`.
8. Бэкенд находит сессию по токену, находит пользователя по `telegram_id`, устанавливает `session.user_id = user.id`.
9. На следующей итерации polling-а бэкенд видит заполненный `user_id`, помечает `used = true`, `used_at = now`, генерирует JWT и возвращает его браузеру.
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
8. Бэкенд находит сессию, видит заполненный `user_id`, помечает `used = true`, `used_at = now`, возвращает JWT.
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
5. Планшет сохраняет JWT и использует его для всех запросов к `/api/tablet/`.

**Отличие от пользовательского JWT:** `sub` указывает на `tablet_accounts.id`, а не на `users.id`. Зависимость `get_current_tablet` проверяет именно эту таблицу.

**Результат:** планшет авторизован и привязан к конкретной переговорной.

---

## Жизненный цикл токенов

| Токен | Где живёт | TTL | Одноразовый |
|---|---|---|---|
| `initData` | Строка в запросе, нигде не хранится | 5 минут от `auth_date` | Нет (но устаревает) |
| `JWT` (access_token) | `localStorage` браузера (`corpmeet_token`) / кэш бота / планшет | 7 дней | Нет |
| `session_token` (BrowserSession) | Таблица `browser_sessions` в БД | 5 минут | Да, поле `used` + `used_at` |
| `feed_token` | Таблица `users`, поле `feed_token` | Бессрочно | Нет (пока нет ротации) |
| `BOT_SECRET` | `.env` бэкенда и бота | Бессрочно | Нет |

---

## Эндпоинты

Базовый путь: `/api/`. Документация FastAPI (Swagger UI) доступна по `/api/docs`.

---

### Служебные

#### `GET /api/health`

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

---

#### `POST /api/auth/login`

Вход существующего пользователя через Telegram Mini App или от имени бота.

| | |
|---|---|
| **Авторизация** | Не требуется |
| **Тело запроса** | `{ "init_data": "..." }` |
| **Ответ** | `{ "access_token": "eyJ...", "expires_in": 604800 }` |
| **Ошибки** | `404` — пользователь не зарегистрирован; `401` — невалидная `initData` |

---

#### `POST /api/auth/web-register`

Регистрация без Telegram (пользователь без `telegram_id`).

| | |
|---|---|
| **Авторизация** | Не требуется |
| **Тело запроса** | `{ "first_name": "Иван", "last_name": "Иванов" }` |
| **Ответ** | `201 { "access_token": "eyJ...", "expires_in": 604800 }` |

Создаёт пользователя с `telegram_id = NULL` и `is_registered = true`.

---

#### `POST /api/auth/dev-login` *(только при `CORPMEET_DEV=1`)*

Мгновенный вход для разработки без Telegram.

| | |
|---|---|
| **Авторизация** | Не требуется |
| **Ответ** | JWT для пользователя с `telegram_id = 999000001`, `role = "superadmin"` |
| **Ошибки** | `404` — если `CORPMEET_DEV != "1"` |

---

#### `GET /api/auth/me`

Профиль текущего авторизованного пользователя.

| | |
|---|---|
| **Авторизация** | `Authorization: Bearer <JWT>` |
| **Ответ** | `{ "id", "telegram_id", "username", "first_name", "last_name", "role" }` |
| **Ошибки** | `401` — невалидный или просроченный JWT |

---

#### `POST /api/auth/qr-session`

Создание QR-сессии для авторизации в браузере.

| | |
|---|---|
| **Авторизация** | Не требуется |
| **Ответ** | `{ "token": "...", "bot_url": "https://t.me/<TG_BOT_USERNAME>?start=...", "expires_in": 300 }` |

---

#### `POST /api/auth/browser/session`

Создание одноразовой сессии для перехода из Mini App в браузер.

| | |
|---|---|
| **Авторизация** | `Authorization: Bearer <JWT>` |
| **Ответ** | `{ "session_token": "...", "browser_url": "/auth/session/..." }` |

---

#### `GET /api/auth/session/{token}`

Проверка сессионного токена и получение JWT. Используется при QR-авторизации (polling) и в `SessionAuthPage` (deep-link).

| | |
|---|---|
| **Авторизация** | Не требуется |
| **Ответ** | `202 { "status": "pending" }` — QR ещё не отсканирован |
| | `200 { "access_token": "eyJ...", "expires_in": 604800 }` — JWT готов |
| **Ошибки** | `404` — токен не найден; `410` — истёк или уже использован |

При успешном возврате JWT помечает `used = true`, записывает `used_at`.

---

#### `POST /api/auth/tablet`

Авторизация планшета у входа в переговорную.

| | |
|---|---|
| **Авторизация** | Не требуется |
| **Тело запроса** | `{ "username": "tablet-room1", "password": "..." }` |
| **Ответ** | `{ "token": "eyJ...", "room": { "id", "name", "floor", "capacity" } }` |
| **Ошибки** | `401` — неверный логин или пароль; `404` — привязанная комната не найдена |

---

### Переговорные комнаты (`/api/rooms/`)

---

#### `GET /api/rooms/`

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>` |
| **Ответ** | `[{ "id", "name", "floor", "capacity" }, ...]` |

---

#### `POST /api/rooms/`

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>` |
| **Тело запроса** | `{ "name": "Переговорная А", "floor": 3, "capacity": 8 }` |
| **Ответ** | `201` + объект комнаты |

---

### Слоты (`/api/slots/`)

---

#### `GET /api/slots/`

Сетка свободных/занятых 30-минутных слотов на конкретный день (09:00–20:00).

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>` |
| **Query-параметры** | `date` (Date, обязательный) · `room_id` (UUID, необязательный) |
| **Ответ** | `[{ "start": "09:00", "end": "09:30", "available": true }, ...]` |

Возвращает 22 слота с шагом 30 минут. Слот `available = false`, если хотя бы одно активное бронирование перекрывает его период.

---

### Бронирования (`/api/bookings/`)

---

#### `GET /api/bookings/`

Список бронирований за период.

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>` |
| **Query-параметры** | `date_from` (Date, **обязательный**) · `date_to` (Date, необязательный, по умолчанию = `date_from`) · `room_id` (UUID, необязательный) |
| **Ответ** | Массив `BookingOut`, отсортированный по `start_time` |
| **Ошибки** | `401` |

Исключает мягко удалённые бронирования (`deleted_at IS NOT NULL`).

---

#### `POST /api/bookings/`

Создание бронирования (одиночного или повторяющегося).

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>` |
| **Тело запроса** | `{ "room_id", "title", "description"?, "start_time", "end_time", "guests"?: [...], "recurrence"?, "recurrence_until"?, "recurrence_days"?: [...] }` |
| **Ответ** | `201` + массив созданных бронирований `[BookingOut, ...]` |
| **Ошибки** | `409` — слот занят; `400` — не задан `recurrence_until` для повторяющегося |

**Повторяющиеся встречи:** `recurrence` может быть `daily`, `weekly` или `custom`. При `custom` нужно передать `recurrence_days` — массив номеров дней недели (0=пн, 6=вс). При конфликте отдельных дат серия создаётся частично (конфликтные даты пропускаются). Все встречи серии объединены одним `recurrence_group_id`.

---

#### `PATCH /api/bookings/{booking_id}`

Обновление бронирования.

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>` |
| **Тело запроса** | `{ "title"?, "description"?, "start_time"?, "end_time"?, "guests"?: [...] }` |
| **Ответ** | Обновлённый `BookingOut` |
| **Ошибки** | `403` — чужое бронирование (без прав admin); `404` — не найдено; `409` — конфликт времени |

При изменении времени сохраняет предыдущие значения в `prev_start_time` / `prev_end_time` для уведомлений бота.

---

#### `DELETE /api/bookings/{booking_id}`

Мягкое удаление бронирования (устанавливает `deleted_at`).

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>` |
| **Query-параметры** | `delete_series=true` — удалить всю серию по `recurrence_group_id` |
| **Ответ** | `{ "ok": true }` |
| **Ошибки** | `403` — чужое бронирование; `404` — не найдено |

---

#### `GET /api/bookings/active`

Предстоящие бронирования текущего пользователя (ближайшие 30 дней).

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>` |
| **Ответ** | Массив `BookingOut`, отсортированный по `start_time` |

---

#### `GET /api/bookings/export`

Экспорт всех бронирований текущего пользователя в формате iCal.

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>` |
| **Ответ** | Файл `corpmeet.ics` (`Content-Type: text/calendar`) |

---

#### `GET /api/bookings/feed/{feed_token}`

Публичный iCal-фид пользователя. Авторизация не требуется — используется для подключения к календарным приложениям.

| | |
|---|---|
| **Авторизация** | Не требуется |
| **Ответ** | iCal-поток (`text/calendar`) с бронированиями пользователя |
| **Ошибки** | `404` — токен не найден |

Токен генерируется через `POST /api/users/feed-token`. Обновляется каждые 15 минут (`REFRESH-INTERVAL:PT15M`).

---

#### `GET /api/bookings/admin/all` *(admin)*

Последние 200 бронирований по всем пользователям.

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>`, роль `admin` или `superadmin` |
| **Ответ** | Массив `BookingOut`, отсортированный по `created_at DESC` |
| **Ошибки** | `403` |

---

### Пользователи (`/api/users/`)

---

#### `GET /api/users/me`

Профиль текущего пользователя (расширенный, с полями `is_active`, `is_registered`).

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>` |
| **Ответ** | `{ "id", "telegram_id", "username", "first_name", "last_name", "role", "is_active", "is_registered" }` |

---

#### `GET /api/users/search`

Поиск пользователей по имени, фамилии или @username (нечёткий, без учёта регистра).

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>` |
| **Query-параметры** | `q` (строка, min 1 символ) |
| **Ответ** | Массив `UserOut`, max 50 результатов |

---

#### `POST /api/users/feed-token`

Получить или создать токен для iCal-фида.

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>` |
| **Ответ** | `{ "feed_token": "...", "feed_url": "/bookings/feed/<token>" }` |

Если `feed_token` у пользователя уже есть — возвращает существующий. Иначе генерирует новый через `secrets.token_urlsafe(32)` и сохраняет в БД.

---

#### `GET /api/users/admin/users` *(admin)*

Список всех пользователей.

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>`, роль `admin` или `superadmin` |
| **Ответ** | Массив `UserOut`, отсортированный по `created_at DESC` |

---

#### `POST /api/users/admin/users` *(admin)*

Создание пользователя вручную (без Telegram).

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>`, роль `admin` или `superadmin` |
| **Тело запроса** | `{ "first_name", "last_name"?, "telegram_id"?, "username"?, "role"? }` |
| **Ответ** | `201` + `UserOut` |

---

#### `DELETE /api/users/admin/users/{user_id}` *(admin)*

Удаление пользователя. Все его активные бронирования мягко удаляются.

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>`, роль `admin` или `superadmin` |
| **Ответ** | `{ "ok": true }` |
| **Ошибки** | `404` |

---

#### `GET /api/users/admin/stats` *(admin)*

Статистика системы.

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>`, роль `admin` или `superadmin` |
| **Ответ** | `{ "total_users": N, "total_bookings": N, "active_bookings": N }` |

`active_bookings` — бронирования с `deleted_at IS NULL` и `end_time > now`.

---

#### `PATCH /api/users/admin/users/{user_id}/role` *(superadmin)*

Изменение роли пользователя.

| | |
|---|---|
| **Авторизация** | `Bearer <JWT>`, роль `superadmin` |
| **Тело запроса** | `{ "role": "user" | "admin" | "superadmin" }` |
| **Ответ** | Обновлённый `UserOut` |
| **Ошибки** | `400` — невалидная роль или попытка изменить свою роль; `404` |

---

### Tablet API (`/api/tablet/`)

Все эндпоинты требуют JWT планшета (`sub = tablet_account.id`), полученного через `POST /api/auth/tablet`.

---

#### `GET /api/tablet/room`

Данные переговорной, привязанной к текущему планшету.

| | |
|---|---|
| **Авторизация** | `Bearer <tablet JWT>` |
| **Ответ** | `{ "id", "name", "floor", "capacity" }` |

---

#### `GET /api/tablet/bookings`

Список бронирований переговорной на конкретный день.

| | |
|---|---|
| **Авторизация** | `Bearer <tablet JWT>` |
| **Query-параметры** | `date` (Date, обязательный) |
| **Ответ** | Массив бронирований, отсортированный по `start_time` |

---

#### `GET /api/tablet/bookings/current`

Текущее активное бронирование переговорной (идущее прямо сейчас).

| | |
|---|---|
| **Авторизация** | `Bearer <tablet JWT>` |
| **Ответ** | Объект бронирования или `null` |

---

#### `GET /api/tablet/bookings/next`

Ближайшее предстоящее бронирование переговорной.

| | |
|---|---|
| **Авторизация** | `Bearer <tablet JWT>` |
| **Ответ** | Объект бронирования или `null` |

---

#### `GET /api/tablet/slots`

Сетка 30-минутных слотов переговорной на конкретный день (09:00–20:00).

| | |
|---|---|
| **Авторизация** | `Bearer <tablet JWT>` |
| **Query-параметры** | `date` (Date, обязательный) |
| **Ответ** | `[{ "start": "09:00", "end": "09:30", "available": true }, ...]` |

---

### Internal эндпоинты (`/api/internal/`)

Доступны только для TG Bot. Все запросы требуют заголовок `X-Bot-Secret: <BOT_INTERNAL_SECRET>`.

- `403 Invalid bot secret` — секрет не совпадает.
- `503 BOT_SECRET not configured` — переменная `BOT_INTERNAL_SECRET` не задана в `.env`.

---

#### `POST /api/internal/auth/consume-session`

Привязка `telegram_id` к сессионному токену при QR-авторизации.

| | |
|---|---|
| **Авторизация** | `X-Bot-Secret` |
| **Тело запроса** | `{ "token": "...", "telegram_id": 123456789 }` |
| **Ответ** | `{ "ok": true }` |
| **Ошибки** | `404` — токен не найден; `410` — истёк или использован; `404` — пользователь не зарегистрирован |

---

#### `POST /api/internal/users/ensure`

Создание или обновление пользователя из данных Telegram.

| | |
|---|---|
| **Авторизация** | `X-Bot-Secret` |
| **Тело запроса** | `{ "telegram_id", "first_name", "last_name"?, "username"?, "full_name"? }` |
| **Ответ** | Объект пользователя |

Создаёт запись с `is_registered = true`, если её нет. При изменении `username` — обновляет.

---

#### `GET /api/internal/users/by-username/{username}`

Получение `telegram_id` пользователя по @username.

| | |
|---|---|
| **Авторизация** | `X-Bot-Secret` |
| **Ответ** | `{ "telegram_id": 123456789 }` |
| **Ошибки** | `404` |

---

#### `GET /api/internal/users/search`

Поиск пользователей по имени, фамилии или @username (нечёткий, без учёта регистра).

| | |
|---|---|
| **Авторизация** | `X-Bot-Secret` |
| **Query-параметры** | `q` (строка, min 1 символ) |
| **Ответ** | Массив пользователей, max 50 результатов |

---

#### `GET /api/internal/bookings/since`

Бронирования, изменённые после указанного момента (исключает удалённые).

| | |
|---|---|
| **Авторизация** | `X-Bot-Secret` |
| **Query-параметры** | `updated_at` (ISO datetime) |
| **Ответ** | Массив `BookingBotInfo` с вложенным объектом `user` |

Используется фоновой задачей уведомлений. Бот вызывает каждые 60 секунд, передаёт `last_check_time`. При наличии `prev_start_time` или `prev_end_time` — бронирование было перенесено.

---

#### `GET /api/internal/bookings/reminders`

Бронирования, начинающиеся через 14–16 минут с `reminder_sent = false`.

| | |
|---|---|
| **Авторизация** | `X-Bot-Secret` |
| **Ответ** | Массив `BookingBotInfo` с вложенным `user` |

Бот вызывает каждые 60 секунд. После отправки напоминания вызывает `mark-reminded`.

---

#### `POST /api/internal/bookings/{booking_id}/mark-reminded`

Устанавливает `reminder_sent = true`.

| | |
|---|---|
| **Авторизация** | `X-Bot-Secret` |
| **Ответ** | `{ "ok": true }` |
| **Ошибки** | `404` |

Предотвращает повторную отправку напоминания.

---

#### `GET /api/internal/bookings/deleted-since`

Бронирования, мягко удалённые после указанного момента.

| | |
|---|---|
| **Авторизация** | `X-Bot-Secret` |
| **Query-параметры** | `since` (ISO datetime) |
| **Ответ** | Массив `BookingBotInfo` с вложенным `user` |

Используется для отправки уведомлений об отмене встреч.
