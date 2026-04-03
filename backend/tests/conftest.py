import asyncio
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.auth import create_jwt, hash_password
from app.models import Base, Booking, BrowserSession, Room, TabletAccount, User


# SQLite не поддерживает JSONB — рендерим как JSON
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
engine = create_async_engine(TEST_DB_URL)
TestSession = async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db():
    async with TestSession() as session:
        yield session


@pytest_asyncio.fixture
async def client(db):
    from app.main import app
    from app.database import get_db

    async def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def room(db):
    r = Room(name="Test Room", floor=3, capacity=8)
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return r


@pytest_asyncio.fixture
async def superadmin(db):
    u = User(
        first_name="Super", last_name="Admin", role="superadmin",
        telegram_id=900001, username="superadmin", is_registered=True,
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


@pytest_asyncio.fixture
async def user(db):
    u = User(
        first_name="Test", last_name="User", role="user",
        telegram_id=100001, username="testuser", is_registered=True,
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


@pytest_asyncio.fixture
async def booking(db, room, user):
    now = datetime.now(timezone.utc)
    b = Booking(
        room_id=room.id, user_id=user.id, title="Test Meeting",
        start_time=now + timedelta(hours=1), end_time=now + timedelta(hours=2),
    )
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return b


@pytest_asyncio.fixture
async def tablet_account(db, room):
    a = TabletAccount(
        username="tablet-test-room", password_hash=hash_password("testpass123"),
        room_id=room.id,
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


@pytest_asyncio.fixture
async def browser_session(db):
    # SQLite не хранит timezone, поэтому naive datetime
    s = BrowserSession(
        session_token="test-session-token",
        user_id=None,
        expires_at=datetime.utcnow() + timedelta(minutes=5),
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


def auth_header(user_id):
    return {"Authorization": f"Bearer {create_jwt(user_id)}"}


BOT_SECRET = "test-secret-123"


@pytest.fixture(autouse=True)
def set_bot_secret(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "bot_internal_secret", BOT_SECRET)
