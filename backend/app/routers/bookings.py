import time
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_admin_user, get_current_user
from app.database import get_db
from app.models import Booking, User

router = APIRouter(prefix="/bookings", tags=["bookings"])


# === Pydantic schemas ===

class BookingCreate(BaseModel):
    room_id: uuid.UUID
    title: str
    description: str = ""
    start_time: datetime
    end_time: datetime
    guests: list[str] = []
    recurrence: str = "none"
    recurrence_until: date | None = None
    recurrence_days: list[int] | None = None


class BookingUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    guests: list[str] | None = None


class BookingOut(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime
    guests: list | None
    recurrence: str
    recurrence_group_id: int | None
    reminder_sent: bool
    created_at: datetime

    class Config:
        from_attributes = True


# === Helpers ===

async def _check_conflict(db: AsyncSession, room_id: uuid.UUID, start: datetime, end: datetime, exclude_id: uuid.UUID | None = None):
    query = select(Booking).where(
        and_(
            Booking.room_id == room_id,
            Booking.deleted_at.is_(None),
            Booking.start_time < end,
            Booking.end_time > start,
        )
    )
    if exclude_id:
        query = query.where(Booking.id != exclude_id)
    result = await db.execute(query)
    if result.scalars().first():
        raise HTTPException(status_code=409, detail="Time slot already booked")


def _generate_ical(bookings: list[Booking], cal_name: str = "CorpMeet") -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CorpMeet//EN",
        f"X-WR-CALNAME:{cal_name}",
        "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    ]
    for b in bookings:
        uid = str(b.id)
        dtstart = b.start_time.strftime("%Y%m%dT%H%M%SZ")
        dtend = b.end_time.strftime("%Y%m%dT%H%M%SZ")
        created = b.created_at.strftime("%Y%m%dT%H%M%SZ")
        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}@corpmeet",
            f"DTSTART:{dtstart}",
            f"DTEND:{dtend}",
            f"SUMMARY:{b.title}",
            f"DESCRIPTION:{b.description or ''}",
            f"CREATED:{created}",
            "END:VEVENT",
        ])
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


# === GET /bookings/ ===

@router.get("/", response_model=list[BookingOut])
async def list_bookings(
    date_from: date = Query(...),
    date_to: date | None = None,
    room_id: uuid.UUID | None = None,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if date_to is None:
        date_to = date_from
    dt_from = datetime(date_from.year, date_from.month, date_from.day, tzinfo=timezone.utc)
    dt_to = datetime(date_to.year, date_to.month, date_to.day, tzinfo=timezone.utc) + timedelta(days=1)

    query = select(Booking).where(
        and_(
            Booking.deleted_at.is_(None),
            Booking.start_time < dt_to,
            Booking.end_time > dt_from,
        )
    )
    if room_id:
        query = query.where(Booking.room_id == room_id)
    query = query.order_by(Booking.start_time)

    result = await db.execute(query)
    return result.scalars().all()


# === POST /bookings/ ===

@router.post("/", response_model=list[BookingOut], status_code=201)
async def create_booking(
    body: BookingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.recurrence == "none":
        await _check_conflict(db, body.room_id, body.start_time, body.end_time)
        booking = Booking(
            room_id=body.room_id,
            user_id=user.id,
            title=body.title,
            description=body.description or None,
            start_time=body.start_time,
            end_time=body.end_time,
            guests=body.guests,
        )
        db.add(booking)
        await db.commit()
        await db.refresh(booking)
        return [booking]

    # Recurrence: generate series
    if not body.recurrence_until:
        raise HTTPException(status_code=400, detail="recurrence_until is required for recurring bookings")

    group_id = int(time.time() * 1000)
    duration = body.end_time - body.start_time
    current_date = body.start_time.date()
    end_date = body.recurrence_until
    created = []

    while current_date <= end_date:
        should_create = False
        if body.recurrence == "daily":
            should_create = True
        elif body.recurrence == "weekly":
            should_create = current_date.weekday() == body.start_time.date().weekday()
        elif body.recurrence == "custom" and body.recurrence_days:
            should_create = current_date.weekday() in body.recurrence_days

        if should_create:
            start = datetime(current_date.year, current_date.month, current_date.day,
                             body.start_time.hour, body.start_time.minute, tzinfo=timezone.utc)
            end = start + duration

            # Check conflict but skip on conflict (don't block the whole series)
            conflict = await db.execute(
                select(Booking).where(
                    and_(
                        Booking.room_id == body.room_id,
                        Booking.deleted_at.is_(None),
                        Booking.start_time < end,
                        Booking.end_time > start,
                    )
                )
            )
            if not conflict.scalars().first():
                booking = Booking(
                    room_id=body.room_id,
                    user_id=user.id,
                    title=body.title,
                    description=body.description or None,
                    start_time=start,
                    end_time=end,
                    guests=body.guests,
                    recurrence=body.recurrence,
                    recurrence_until=body.recurrence_until,
                    recurrence_group_id=group_id,
                    recurrence_days=body.recurrence_days,
                )
                db.add(booking)
                created.append(booking)

        current_date += timedelta(days=1)

    if not created:
        raise HTTPException(status_code=409, detail="All time slots in series are already booked")

    await db.commit()
    for b in created:
        await db.refresh(b)
    return created


# === PATCH /bookings/{id} ===

@router.patch("/{booking_id}", response_model=BookingOut)
async def update_booking(
    booking_id: uuid.UUID,
    body: BookingUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking).where(and_(Booking.id == booking_id, Booking.deleted_at.is_(None)))
    )
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.user_id != user.id and user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed")

    # Track time changes for bot notifications
    new_start = body.start_time or booking.start_time
    new_end = body.end_time or booking.end_time

    if body.start_time or body.end_time:
        booking.prev_start_time = booking.start_time
        booking.prev_end_time = booking.end_time
        await _check_conflict(db, booking.room_id, new_start, new_end, exclude_id=booking.id)

    if body.title is not None:
        booking.title = body.title
    if body.description is not None:
        booking.description = body.description
    if body.start_time is not None:
        booking.start_time = body.start_time
    if body.end_time is not None:
        booking.end_time = body.end_time
    if body.guests is not None:
        booking.guests = body.guests

    await db.commit()
    await db.refresh(booking)
    return booking


# === DELETE /bookings/{id} ===

@router.delete("/{booking_id}", status_code=200)
async def delete_booking(
    booking_id: uuid.UUID,
    delete_series: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking).where(and_(Booking.id == booking_id, Booking.deleted_at.is_(None)))
    )
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.user_id != user.id and user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not allowed")

    now = datetime.now(timezone.utc)

    if delete_series and booking.recurrence_group_id:
        series = await db.execute(
            select(Booking).where(
                and_(
                    Booking.recurrence_group_id == booking.recurrence_group_id,
                    Booking.deleted_at.is_(None),
                )
            )
        )
        for b in series.scalars().all():
            b.deleted_at = now
    else:
        booking.deleted_at = now

    await db.commit()
    return {"ok": True}


# === GET /bookings/active ===

@router.get("/active", response_model=list[BookingOut])
async def active_bookings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Booking).where(
            and_(
                Booking.user_id == user.id,
                Booking.deleted_at.is_(None),
                Booking.start_time <= now + timedelta(days=30),
                Booking.end_time >= now,
            )
        ).order_by(Booking.start_time)
    )
    return result.scalars().all()


# === GET /bookings/export ===

@router.get("/export")
async def export_bookings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking).where(
            and_(Booking.user_id == user.id, Booking.deleted_at.is_(None))
        ).order_by(Booking.start_time)
    )
    bookings = result.scalars().all()
    ical = _generate_ical(bookings, f"CorpMeet - {user.first_name}")
    return Response(content=ical, media_type="text/calendar",
                    headers={"Content-Disposition": "attachment; filename=corpmeet.ics"})


# === GET /bookings/feed/{feed_token} ===

@router.get("/feed/{feed_token}")
async def booking_feed(feed_token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.feed_token == feed_token))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Invalid feed token")

    bookings_result = await db.execute(
        select(Booking).where(
            and_(Booking.user_id == user.id, Booking.deleted_at.is_(None))
        ).order_by(Booking.start_time)
    )
    bookings = bookings_result.scalars().all()
    ical = _generate_ical(bookings, f"CorpMeet - {user.first_name}")
    return Response(content=ical, media_type="text/calendar")


# === GET /bookings/admin/all ===

@router.get("/admin/all", response_model=list[BookingOut])
async def admin_all_bookings(
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking).where(Booking.deleted_at.is_(None))
        .order_by(Booking.created_at.desc()).limit(200)
    )
    return result.scalars().all()
