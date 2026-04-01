import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Room, User

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
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Room))
    return result.scalars().all()


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
