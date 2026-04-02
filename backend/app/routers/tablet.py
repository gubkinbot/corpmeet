import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_tablet
from app.database import get_db
from app.models import Booking, Room, TabletAccount

router = APIRouter(prefix="/tablet", tags=["tablet"])

SLOT_MINUTES = 30
DAY_START_HOUR = 9
DAY_END_HOUR = 20


class RoomOut(BaseModel):
    id: uuid.UUID
    name: str
    floor: int
    capacity: int

    class Config:
        from_attributes = True


class BookingOut(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime
    guests: list | None

    class Config:
        from_attributes = True


class SlotOut(BaseModel):
    start: str
    end: str
    available: bool


# === GET /tablet/room ===

@router.get("/room", response_model=RoomOut)
async def tablet_room(
    account: TabletAccount = Depends(get_current_tablet),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Room).where(Room.id == account.room_id))
    room = result.scalars().first()
    return RoomOut.model_validate(room)


# === GET /tablet/bookings ===

@router.get("/bookings", response_model=list[BookingOut])
async def tablet_bookings(
    date_param: date = Query(..., alias="date"),
    account: TabletAccount = Depends(get_current_tablet),
    db: AsyncSession = Depends(get_db),
):
    dt_from = datetime(date_param.year, date_param.month, date_param.day, tzinfo=timezone.utc)
    dt_to = dt_from + timedelta(days=1)

    result = await db.execute(
        select(Booking).where(
            and_(
                Booking.room_id == account.room_id,
                Booking.deleted_at.is_(None),
                Booking.start_time < dt_to,
                Booking.end_time > dt_from,
            )
        ).order_by(Booking.start_time)
    )
    return result.scalars().all()


# === GET /tablet/bookings/current ===

@router.get("/bookings/current", response_model=BookingOut | None)
async def tablet_current_booking(
    account: TabletAccount = Depends(get_current_tablet),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Booking).where(
            and_(
                Booking.room_id == account.room_id,
                Booking.deleted_at.is_(None),
                Booking.start_time <= now,
                Booking.end_time > now,
            )
        ).limit(1)
    )
    booking = result.scalars().first()
    return BookingOut.model_validate(booking) if booking else None


# === GET /tablet/bookings/next ===

@router.get("/bookings/next", response_model=BookingOut | None)
async def tablet_next_booking(
    account: TabletAccount = Depends(get_current_tablet),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Booking).where(
            and_(
                Booking.room_id == account.room_id,
                Booking.deleted_at.is_(None),
                Booking.start_time > now,
            )
        ).order_by(Booking.start_time).limit(1)
    )
    booking = result.scalars().first()
    return BookingOut.model_validate(booking) if booking else None


# === GET /tablet/slots ===

@router.get("/slots", response_model=list[SlotOut])
async def tablet_slots(
    date_param: date = Query(..., alias="date"),
    account: TabletAccount = Depends(get_current_tablet),
    db: AsyncSession = Depends(get_db),
):
    dt_start = datetime(date_param.year, date_param.month, date_param.day,
                        DAY_START_HOUR, 0, tzinfo=timezone.utc)
    dt_end = datetime(date_param.year, date_param.month, date_param.day,
                      DAY_END_HOUR, 0, tzinfo=timezone.utc)

    result = await db.execute(
        select(Booking).where(
            and_(
                Booking.room_id == account.room_id,
                Booking.deleted_at.is_(None),
                Booking.start_time < dt_end,
                Booking.end_time > dt_start,
            )
        )
    )
    bookings = result.scalars().all()

    slots = []
    current = dt_start
    while current < dt_end:
        slot_end = current + timedelta(minutes=SLOT_MINUTES)
        available = not any(
            b.start_time < slot_end and b.end_time > current
            for b in bookings
        )
        slots.append(SlotOut(
            start=current.strftime("%H:%M"),
            end=slot_end.strftime("%H:%M"),
            available=available,
        ))
        current = slot_end

    return slots
