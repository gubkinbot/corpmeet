# Backend — FastAPI + PostgreSQL

## Зона ответственности
Единый API-сервер для всех клиентов (frontend, tg-webapp, tablet).

## Стек
- Python 3.12, FastAPI, Uvicorn
- SQLAlchemy 2.0 (async), asyncpg
- Pydantic v2 для валидации
- Alembic для миграций (когда понадобится)

## Структура
```
backend/
├── app/
│   ├── main.py          # Точка входа, CORS, lifespan
│   ├── config.py        # Pydantic Settings
│   ├── database.py      # Async engine, session
│   ├── models.py        # SQLAlchemy модели
│   └── routers/         # API-роутеры
│       ├── rooms.py     # CRUD переговорных
│       └── bookings.py  # CRUD бронирований
```

## Правила
- Все функции-хэндлеры — async
- Dependency injection через FastAPI `Depends()`
- Входные данные — Pydantic модели (BaseModel), не dict
- Ответы — Pydantic модели с `from_attributes = True`
- Проверка конфликтов по времени при бронировании обязательна
- Все новые эндпоинты добавлять через роутеры в `app/routers/`

## Запуск локально
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## API
- `GET /health` — проверка состояния
- `GET /rooms/` — список комнат
- `POST /rooms/` — создать комнату
- `GET /bookings/` — список бронирований (фильтр по room_id)
- `POST /bookings/` — забронировать (с проверкой конфликтов)
