"""Seed script for creating tablet accounts.

Usage:
    python -m app.seed --tablet-username tablet-room1 --tablet-password secret --room-id <uuid>
"""

import argparse
import asyncio
import uuid

from sqlalchemy import select

from app.auth import hash_password
from app.database import async_session, engine
from app.models import Base, Room, TabletAccount


async def create_tablet_account(username: str, password: str, room_id: uuid.UUID) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Check room exists
        result = await db.execute(select(Room).where(Room.id == room_id))
        room = result.scalars().first()
        if not room:
            print(f"Error: Room {room_id} not found")
            return

        # Check if account already exists
        result = await db.execute(select(TabletAccount).where(TabletAccount.username == username))
        if result.scalars().first():
            print(f"Error: Account '{username}' already exists")
            return

        account = TabletAccount(
            username=username,
            password_hash=hash_password(password),
            room_id=room_id,
        )
        db.add(account)
        await db.commit()
        print(f"Created tablet account '{username}' for room '{room.name}'")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed tablet accounts")
    parser.add_argument("--tablet-username", required=True)
    parser.add_argument("--tablet-password", required=True)
    parser.add_argument("--room-id", required=True, type=uuid.UUID)
    args = parser.parse_args()

    asyncio.run(create_tablet_account(args.tablet_username, args.tablet_password, args.room_id))


if __name__ == "__main__":
    main()
