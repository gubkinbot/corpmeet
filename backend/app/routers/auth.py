import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    JWT_EXPIRATION_DAYS,
    create_jwt,
    get_current_user,
    verify_password,
    verify_telegram_init_data,
)
from app.config import settings
from app.database import get_db
from app.models import BrowserSession, Room, TabletAccount, User

router = APIRouter(prefix="/auth", tags=["auth"])

SESSION_TTL_MINUTES = 5
EXPIRES_IN_SECONDS = JWT_EXPIRATION_DAYS * 24 * 3600


# === Pydantic schemas ===

class TelegramLoginRequest(BaseModel):
    init_data: str


class TelegramRegisterRequest(BaseModel):
    init_data: str
    first_name: str
    last_name: str = ""


class WebRegisterRequest(BaseModel):
    first_name: str
    last_name: str


class UserOut(BaseModel):
    id: uuid.UUID
    telegram_id: int | None
    username: str | None
    first_name: str
    last_name: str | None
    role: str

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    expires_in: int


class QrSessionResponse(BaseModel):
    token: str
    bot_url: str
    expires_in: int


class BrowserSessionResponse(BaseModel):
    session_token: str
    browser_url: str


class SessionTokenResponse(BaseModel):
    access_token: str
    expires_in: int


class TabletLoginRequest(BaseModel):
    username: str
    password: str


class RoomOut(BaseModel):
    id: uuid.UUID
    name: str
    floor: int
    capacity: int

    class Config:
        from_attributes = True


class TabletLoginResponse(BaseModel):
    token: str
    room: RoomOut


# === 1. POST /auth/login ===

@router.post("/login", response_model=AuthResponse)
async def telegram_login(body: TelegramLoginRequest, db: AsyncSession = Depends(get_db)):
    tg_user = verify_telegram_init_data(body.init_data, settings.telegram_bot_token)
    telegram_id = tg_user["id"]

    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not registered")

    tg_username = tg_user.get("username")
    if tg_username and user.username != tg_username:
        user.username = tg_username
        await db.commit()
        await db.refresh(user)

    return AuthResponse(access_token=create_jwt(user.id), expires_in=EXPIRES_IN_SECONDS)


# === 2. POST /auth/register ===

@router.post("/register", response_model=AuthResponse, status_code=201)
async def telegram_register(body: TelegramRegisterRequest, db: AsyncSession = Depends(get_db)):
    tg_user = verify_telegram_init_data(body.init_data, settings.telegram_bot_token)
    telegram_id = tg_user["id"]

    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    if result.scalars().first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

    user = User(
        telegram_id=telegram_id,
        username=tg_user.get("username"),
        first_name=body.first_name,
        last_name=body.last_name or None,
        is_registered=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return AuthResponse(access_token=create_jwt(user.id), expires_in=EXPIRES_IN_SECONDS)


# === 3. POST /auth/web-register ===

@router.post("/web-register", response_model=AuthResponse, status_code=201)
async def web_register(body: WebRegisterRequest, db: AsyncSession = Depends(get_db)):
    user = User(
        first_name=body.first_name,
        last_name=body.last_name,
        is_registered=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return AuthResponse(access_token=create_jwt(user.id), expires_in=EXPIRES_IN_SECONDS)


# === 4. POST /auth/dev-login ===

@router.post("/dev-login", response_model=AuthResponse)
async def dev_login(db: AsyncSession = Depends(get_db)):
    if settings.corpmeet_dev != "1":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    result = await db.execute(select(User).where(User.telegram_id == 999000001))
    user = result.scalars().first()

    if not user:
        user = User(
            telegram_id=999000001,
            first_name="Dev",
            last_name="User",
            username="devuser",
            role="superadmin",
            is_registered=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return AuthResponse(access_token=create_jwt(user.id), expires_in=EXPIRES_IN_SECONDS)


# === 5. GET /auth/me ===

@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


# === 6. POST /auth/qr-session ===

@router.post("/qr-session", response_model=QrSessionResponse)
async def create_qr_session(db: AsyncSession = Depends(get_db)):
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=SESSION_TTL_MINUTES)

    session = BrowserSession(
        session_token=session_token,
        user_id=None,
        expires_at=expires_at,
    )
    db.add(session)
    await db.commit()

    return QrSessionResponse(
        token=session_token,
        bot_url=f"https://t.me/{settings.tg_bot_username}?start={session_token}",
        expires_in=SESSION_TTL_MINUTES * 60,
    )


# === 7. POST /auth/browser/session ===

@router.post("/browser/session", response_model=BrowserSessionResponse)
async def create_browser_session(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=SESSION_TTL_MINUTES)

    session = BrowserSession(
        session_token=session_token,
        user_id=user.id,
        expires_at=expires_at,
    )
    db.add(session)
    await db.commit()

    return BrowserSessionResponse(
        session_token=session_token,
        browser_url=f"/auth/session/{session_token}",
    )


# === 8. GET /auth/session/{token} ===

@router.get("/session/{token}")
async def get_session(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BrowserSession).where(BrowserSession.session_token == token)
    )
    session = result.scalars().first()

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if session.used:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Session already used")

    if session.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Session expired")

    if session.user_id is None:
        return JSONResponse(status_code=202, content={"status": "pending"})

    session.used = True
    session.used_at = datetime.now(timezone.utc)
    await db.commit()

    user_result = await db.execute(select(User).where(User.id == session.user_id))
    user = user_result.scalars().first()

    return SessionTokenResponse(
        access_token=create_jwt(user.id),
        expires_in=EXPIRES_IN_SECONDS,
    )


# === 9. POST /auth/tablet ===

@router.post("/tablet", response_model=TabletLoginResponse)
async def tablet_login(body: TabletLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TabletAccount).where(TabletAccount.username == body.username)
    )
    account = result.scalars().first()

    if not account or not verify_password(body.password, account.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    room_result = await db.execute(select(Room).where(Room.id == account.room_id))
    room = room_result.scalars().first()

    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    token = create_jwt(account.id)

    return TabletLoginResponse(
        token=token,
        room=RoomOut.model_validate(room),
    )
