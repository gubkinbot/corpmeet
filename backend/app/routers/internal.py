import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Booking, BrowserSession, User

router = APIRouter(prefix="/internal", tags=["internal"])


class UserOut(BaseModel):
    id: uuid.UUID
    telegram_id: int | None
    username: str | None
    first_name: str
    last_name: str | None

    class Config:
        from_attributes = True


class BookingBotInfo(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime
    guests: list | None
    prev_start_time: datetime | None
    prev_end_time: datetime | None
    deleted_at: datetime | None
    user: UserOut | None = None

    class Config:
        from_attributes = True


def _check_bot_secret(x_bot_secret: str = Header(...)) -> str:
    if not settings.bot_internal_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="BOT_SECRET not configured")
    if x_bot_secret != settings.bot_internal_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid bot secret")
    return x_bot_secret


# === POST /internal/auth/consume-session ===

class ConsumeSessionRequest(BaseModel):
    token: str
    telegram_id: int


@router.post("/auth/consume-session", status_code=200)
async def internal_consume_session(
    body: ConsumeSessionRequest,
    _secret: str = Depends(_check_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BrowserSession).where(BrowserSession.session_token == body.token)
    )
    session = result.scalars().first()

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.used:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Session already used")
    expires = session.expires_at if session.expires_at.tzinfo else session.expires_at.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Session expired")

    user_result = await db.execute(select(User).where(User.telegram_id == body.telegram_id))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    session.user_id = user.id
    await db.commit()

    return {"ok": True}


# === POST /internal/users/ensure ===

class EnsureUserRequest(BaseModel):
    telegram_id: int
    first_name: str
    last_name: str = ""
    username: str = ""
    full_name: str = ""


@router.post("/users/ensure", response_model=UserOut)
async def internal_ensure_user(
    body: EnsureUserRequest,
    _secret: str = Depends(_check_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.telegram_id == body.telegram_id))
    user = result.scalars().first()

    if user:
        if body.username and user.username != body.username:
            user.username = body.username
            await db.commit()
            await db.refresh(user)
        return UserOut.model_validate(user)

    user = User(
        telegram_id=body.telegram_id,
        username=body.username or None,
        first_name=body.first_name,
        last_name=body.last_name or None,
        is_registered=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return UserOut.model_validate(user)


# === GET /internal/users/search ===

@router.get("/users/search", response_model=list[UserOut])
async def internal_user_search(
    q: str = Query(..., min_length=1),
    _secret: str = Depends(_check_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    pattern = f"%{q}%"
    result = await db.execute(
        select(User).where(
            or_(
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                User.username.ilike(pattern),
            )
        ).limit(50)
    )
    return result.scalars().all()


# === GET /internal/bookings/since ===

@router.get("/bookings/since")
async def internal_bookings_since(
    updated_at: str = Query(...),
    _secret: str = Depends(_check_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.fromisoformat(updated_at)
    result = await db.execute(
        select(Booking).where(
            and_(Booking.updated_at > since, Booking.deleted_at.is_(None))
        ).order_by(Booking.updated_at)
    )
    bookings = result.scalars().all()

    out = []
    for b in bookings:
        user_res = await db.execute(select(User).where(User.id == b.user_id))
        user = user_res.scalars().first()
        info = BookingBotInfo.model_validate(b)
        info.user = UserOut.model_validate(user) if user else None
        out.append(info)
    return out


# === GET /internal/bookings/reminders ===

@router.get("/bookings/reminders")
async def internal_bookings_reminders(
    _secret: str = Depends(_check_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Booking).where(
            and_(
                Booking.deleted_at.is_(None),
                Booking.reminder_sent.is_(False),
                Booking.start_time > now + timedelta(minutes=14),
                Booking.start_time <= now + timedelta(minutes=16),
            )
        )
    )
    bookings = result.scalars().all()

    out = []
    for b in bookings:
        user_res = await db.execute(select(User).where(User.id == b.user_id))
        user = user_res.scalars().first()
        info = BookingBotInfo.model_validate(b)
        info.user = UserOut.model_validate(user) if user else None
        out.append(info)
    return out


# === POST /internal/bookings/{id}/mark-reminded ===

@router.post("/bookings/{booking_id}/mark-reminded", status_code=200)
async def internal_mark_reminded(
    booking_id: uuid.UUID,
    _secret: str = Depends(_check_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking.reminder_sent = True
    await db.commit()
    return {"ok": True}


# === GET /internal/bookings/deleted-since ===

@router.get("/bookings/deleted-since")
async def internal_bookings_deleted_since(
    since: str = Query(...),
    _secret: str = Depends(_check_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    since_dt = datetime.fromisoformat(since)
    result = await db.execute(
        select(Booking).where(
            and_(Booking.deleted_at.is_not(None), Booking.deleted_at > since_dt)
        ).order_by(Booking.deleted_at)
    )
    bookings = result.scalars().all()

    out = []
    for b in bookings:
        user_res = await db.execute(select(User).where(User.id == b.user_id))
        user = user_res.scalars().first()
        info = BookingBotInfo.model_validate(b)
        info.user = UserOut.model_validate(user) if user else None
        out.append(info)
    return out
