import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, get_superadmin_user, hash_password
from app.database import get_db
from app.models import Booking, Room, TabletAccount, User

router = APIRouter(prefix="/rooms", tags=["rooms"])


class RoomCreate(BaseModel):
    name: str
    floor: int
    capacity: int


class RoomOut(BaseModel):
    id: uuid.UUID
    name: str
    floor: int
    capacity: int

    class Config:
        from_attributes = True


class RoomWithTabletOut(BaseModel):
    id: uuid.UUID
    name: str
    floor: int
    capacity: int
    tablet_username: str
    tablet_password: str

    class Config:
        from_attributes = True


class RoomAdminOut(BaseModel):
    id: uuid.UUID
    name: str
    floor: int
    capacity: int
    tablet_username: str | None = None

    class Config:
        from_attributes = True


@router.get("/", response_model=list[RoomOut])
async def list_rooms(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Room))
    all_rooms = result.scalars().all()
    if user.role in ("admin", "user") and user.allowed_rooms:
        allowed_ids = {str(r) for r in user.allowed_rooms}
        return [r for r in all_rooms if str(r.id) in allowed_ids]
    return all_rooms


@router.get("/status")
async def rooms_status(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    rooms_result = await db.execute(select(Room).order_by(Room.floor, Room.name))
    rooms = rooms_result.scalars().all()

    result = []
    for room in rooms:
        curr_r = await db.execute(
            select(Booking).where(and_(
                Booking.room_id == room.id,
                Booking.deleted_at.is_(None),
                Booking.start_time <= now,
                Booking.end_time > now,
            )).limit(1)
        )
        current = curr_r.scalars().first()

        next_r = await db.execute(
            select(Booking).where(and_(
                Booking.room_id == room.id,
                Booking.deleted_at.is_(None),
                Booking.start_time > now,
            )).order_by(Booking.start_time).limit(1)
        )
        next_b = next_r.scalars().first()

        organizer = None
        if current:
            user_r = await db.execute(select(User).where(User.id == current.user_id))
            u = user_r.scalars().first()
            if u:
                organizer = f"{u.first_name} {u.last_name or ''}".strip()

        result.append({
            "id": str(room.id),
            "name": room.name,
            "floor": room.floor,
            "capacity": room.capacity,
            "current_booking": {
                "title": current.title,
                "start_time": current.start_time.isoformat(),
                "end_time": current.end_time.isoformat(),
                "organizer": organizer,
            } if current else None,
            "next_booking": {
                "title": next_b.title,
                "start_time": next_b.start_time.isoformat(),
                "end_time": next_b.end_time.isoformat(),
            } if next_b else None,
        })
    return result


@router.get("/admin/list", response_model=list[RoomAdminOut])
async def admin_list_rooms(
    _admin: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    rooms = (await db.execute(select(Room).order_by(Room.floor, Room.name))).scalars().all()
    result = []
    for room in rooms:
        tablet = (await db.execute(
            select(TabletAccount).where(TabletAccount.room_id == room.id)
        )).scalars().first()
        result.append(RoomAdminOut(
            id=room.id, name=room.name, floor=room.floor, capacity=room.capacity,
            tablet_username=tablet.username if tablet else None,
        ))
    return result


@router.post("/", response_model=RoomWithTabletOut, status_code=201)
async def create_room(
    body: RoomCreate,
    _admin: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    room = Room(**body.model_dump())
    db.add(room)
    await db.flush()

    password = secrets.token_urlsafe(12)
    username = f"tablet-{room.name.lower().replace(' ', '-').replace('(', '').replace(')', '')}"

    # Уникальность username
    existing = (await db.execute(
        select(TabletAccount).where(TabletAccount.username == username)
    )).scalars().first()
    if existing:
        username = f"{username}-{secrets.token_hex(3)}"

    account = TabletAccount(
        username=username,
        password_hash=hash_password(password),
        room_id=room.id,
    )
    db.add(account)
    await db.commit()
    await db.refresh(room)

    return RoomWithTabletOut(
        id=room.id, name=room.name, floor=room.floor, capacity=room.capacity,
        tablet_username=username, tablet_password=password,
    )


@router.delete("/{room_id}", status_code=200)
async def delete_room(
    room_id: uuid.UUID,
    _admin: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    room = (await db.execute(select(Room).where(Room.id == room_id))).scalars().first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Удалить TabletAccount
    tablet = (await db.execute(
        select(TabletAccount).where(TabletAccount.room_id == room_id)
    )).scalars().first()
    if tablet:
        await db.delete(tablet)

    # Soft-delete бронирований
    now = datetime.now(timezone.utc)
    bookings = (await db.execute(
        select(Booking).where(Booking.room_id == room_id, Booking.deleted_at.is_(None))
    )).scalars().all()
    for b in bookings:
        b.deleted_at = now

    await db.delete(room)
    await db.commit()
    return {"ok": True}
