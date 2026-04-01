import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Booking, User

router = APIRouter(prefix="/bookings", tags=["bookings"])


class BookingCreate(BaseModel):
    room_id: uuid.UUID
    title: str
    start_time: datetime
    end_time: datetime


class BookingOut(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    user_id: uuid.UUID
    title: str
    start_time: datetime
    end_time: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=list[BookingOut])
async def list_bookings(
    room_id: uuid.UUID | None = None,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Booking)
    if room_id:
        query = query.where(Booking.room_id == room_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=BookingOut, status_code=201)
async def create_booking(
    body: BookingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check for time conflicts
    conflict = await db.execute(
        select(Booking).where(
            and_(
                Booking.room_id == body.room_id,
                Booking.start_time < body.end_time,
                Booking.end_time > body.start_time,
            )
        )
    )
    if conflict.scalars().first():
        raise HTTPException(status_code=409, detail="Time slot already booked")

    booking = Booking(
        room_id=body.room_id,
        user_id=user.id,
        title=body.title,
        start_time=body.start_time,
        end_time=body.end_time,
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return booking
