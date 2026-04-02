import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Booking, Room, User

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


@router.post("/", response_model=RoomOut, status_code=201)
async def create_room(
    body: RoomCreate,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = Room(**body.model_dump())
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return room
