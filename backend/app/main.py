from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect as sa_inspect, text

from app.database import engine
from app.models import Base
from app.routers import auth, bookings, internal, rooms, slots, tablet, users


def _sync_schema(connection):
    """Создаёт недостающие таблицы и добавляет недостающие колонки в существующие."""
    Base.metadata.create_all(connection)

    inspector = sa_inspect(connection)
    existing_tables = inspector.get_table_names()

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue
        existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
        for col in table.columns:
            if col.name in existing_cols:
                continue
            col_type = col.type.compile(connection.engine.dialect)
            parts = [f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type}"]
            if not col.nullable and col.server_default:
                parts.append(f"NOT NULL DEFAULT {col.server_default.arg.text}")
            elif not col.nullable and col.default is not None and not callable(col.default.arg):
                default_val = col.default.arg
                if isinstance(default_val, bool):
                    default_val = str(default_val).upper()
                elif isinstance(default_val, str):
                    default_val = f"'{default_val}'"
                parts.append(f"NOT NULL DEFAULT {default_val}")
            connection.execute(text(" ".join(parts)))


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(_sync_schema)
    yield


app = FastAPI(title="CorpMeet API", lifespan=lifespan, root_path="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(bookings.router)
app.include_router(slots.router)
app.include_router(users.router)
app.include_router(tablet.router)
app.include_router(internal.router)
app.include_router(rooms.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
