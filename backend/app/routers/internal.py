import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import BrowserSession, User

router = APIRouter(prefix="/internal", tags=["internal"])


class UserOut(BaseModel):
    id: uuid.UUID
    telegram_id: int | None
    username: str | None
    first_name: str
    last_name: str | None

    class Config:
        from_attributes = True


def _check_bot_secret(x_bot_secret: str = Header(...)) -> str:
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
    from datetime import datetime, timezone

    result = await db.execute(
        select(BrowserSession).where(BrowserSession.session_token == body.token)
    )
    session = result.scalars().first()

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if session.used:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Session already used")

    if session.expires_at < datetime.now(timezone.utc):
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
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return UserOut.model_validate(user)


# === GET /internal/users/by-username/{username} ===

@router.get("/users/by-username/{username}")
async def internal_user_by_username(
    username: str,
    _secret: str = Depends(_check_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return {"telegram_id": user.telegram_id}
