import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Booking, User

router = APIRouter(prefix="/slots", tags=["slots"])

SLOT_MINUTES = 30
DAY_START_HOUR = 9
DAY_END_HOUR = 20


class SlotOut(BaseModel):
    start: str
    end: str
    available: bool


@router.get("/", response_model=list[SlotOut])
async def list_slots(
    date_param: date = Query(..., alias="date"),
    room_id: uuid.UUID | None = None,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dt_start = datetime(date_param.year, date_param.month, date_param.day,
                        DAY_START_HOUR, 0, tzinfo=timezone.utc)
    dt_end = datetime(date_param.year, date_param.month, date_param.day,
                      DAY_END_HOUR, 0, tzinfo=timezone.utc)

    # Fetch all bookings for the day
    query = select(Booking).where(
        and_(
            Booking.deleted_at.is_(None),
            Booking.start_time < dt_end,
            Booking.end_time > dt_start,
        )
    )
    if room_id:
        query = query.where(Booking.room_id == room_id)

    result = await db.execute(query)
    bookings = result.scalars().all()

    # Generate slots
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
