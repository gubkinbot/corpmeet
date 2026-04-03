import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_admin_user, get_current_user, get_superadmin_user
from app.database import get_db
from app.models import Booking, User

router = APIRouter(prefix="/users", tags=["users"])


class UserOut(BaseModel):
    id: uuid.UUID
    telegram_id: int | None
    username: str | None
    first_name: str
    last_name: str | None
    role: str
    room_id: uuid.UUID | None = None
    allowed_rooms: list | None = None
    is_active: bool
    is_registered: bool

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    first_name: str
    last_name: str = ""
    telegram_id: int | None = None
    username: str | None = None
    role: str = "user"
    room_id: uuid.UUID | None = None


class RoleUpdate(BaseModel):
    role: str


class StatsOut(BaseModel):
    total_users: int
    total_bookings: int
    active_bookings: int


class FeedTokenOut(BaseModel):
    feed_token: str
    feed_url: str


# === GET /users/me ===

@router.get("/me", response_model=UserOut)
async def users_me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


# === GET /users/search ===

@router.get("/search", response_model=list[UserOut])
async def search_users(
    q: str = Query(..., min_length=1),
    _user: User = Depends(get_current_user),
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


# === POST /users/feed-token ===

@router.post("/feed-token", response_model=FeedTokenOut)
async def get_or_create_feed_token(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.feed_token:
        user.feed_token = secrets.token_urlsafe(32)
        await db.commit()
        await db.refresh(user)

    return FeedTokenOut(
        feed_token=user.feed_token,
        feed_url=f"/bookings/feed/{user.feed_token}",
    )


# === Admin endpoints (admin or superadmin) ===

@router.get("/admin/users", response_model=list[UserOut])
async def admin_list_users(
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.post("/admin/users", response_model=UserOut, status_code=201)
async def admin_create_user(
    body: UserCreate,
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    user = User(
        first_name=body.first_name,
        last_name=body.last_name or None,
        telegram_id=body.telegram_id,
        username=body.username,
        role=body.role,
        room_id=body.room_id,
        is_registered=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/admin/users/{user_id}", status_code=200)
async def admin_delete_user(
    user_id: uuid.UUID,
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Soft-delete all bookings
    now = datetime.now(timezone.utc)
    bookings = await db.execute(
        select(Booking).where(and_(Booking.user_id == user_id, Booking.deleted_at.is_(None)))
    )
    for b in bookings.scalars().all():
        b.deleted_at = now

    await db.delete(user)
    await db.commit()
    return {"ok": True}


@router.get("/admin/stats", response_model=StatsOut)
async def admin_stats(
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func as sqlfunc

    users_count = await db.execute(select(sqlfunc.count(User.id)))
    bookings_count = await db.execute(select(sqlfunc.count(Booking.id)))
    active_count = await db.execute(
        select(sqlfunc.count(Booking.id)).where(
            and_(
                Booking.deleted_at.is_(None),
                Booking.end_time > datetime.now(timezone.utc),
            )
        )
    )

    return StatsOut(
        total_users=users_count.scalar() or 0,
        total_bookings=bookings_count.scalar() or 0,
        active_bookings=active_count.scalar() or 0,
    )


# === PATCH /users/admin/users/{id}/room ===

class RoomAssign(BaseModel):
    room_id: uuid.UUID | None = None


@router.patch("/admin/users/{user_id}/room", response_model=UserOut)
async def admin_assign_room(
    user_id: uuid.UUID,
    body: RoomAssign,
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.room_id = body.room_id
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


class AllowedRoomsUpdate(BaseModel):
    room_ids: list[uuid.UUID] = []


@router.patch("/admin/users/{user_id}/allowed-rooms", response_model=UserOut)
async def superadmin_set_allowed_rooms(
    user_id: uuid.UUID,
    body: AllowedRoomsUpdate,
    _admin: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.allowed_rooms = [str(r) for r in body.room_ids] if body.room_ids else None
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


# === Superadmin endpoints ===

@router.patch("/admin/users/{user_id}/role", response_model=UserOut)
async def superadmin_change_role(
    user_id: uuid.UUID,
    body: RoleUpdate,
    admin: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    if body.role not in ("user", "admin", "superadmin"):
        raise HTTPException(status_code=400, detail="Invalid role")

    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = body.role
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)
