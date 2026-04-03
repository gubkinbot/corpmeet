"""
Создаёт аккаунты планшетов для каждой комнаты.
Запуск: docker compose exec backend python seed_tablets.py
"""
import asyncio
import secrets

from sqlalchemy import select

from app.auth import hash_password
from app.database import async_session
from app.models import Room, TabletAccount


async def main():
    async with async_session() as db:
        rooms = (await db.execute(select(Room).order_by(Room.floor, Room.name))).scalars().all()

        if not rooms:
            print("Нет комнат в БД. Сначала создайте комнаты.")
            return

        print(f"Найдено комнат: {len(rooms)}\n")
        print(f"{'Username':<25} {'Password':<20} {'Комната'}")
        print("-" * 70)

        for room in rooms:
            existing = (await db.execute(
                select(TabletAccount).where(TabletAccount.room_id == room.id)
            )).scalars().first()

            if existing:
                print(f"{existing.username:<25} {'(уже есть)':<20} {room.name}")
                continue

            password = secrets.token_urlsafe(12)
            username = f"tablet-{room.name.lower().replace(' ', '-').replace('(', '').replace(')', '')}"

            account = TabletAccount(
                username=username,
                password_hash=hash_password(password),
                room_id=room.id,
            )
            db.add(account)
            print(f"{username:<25} {password:<20} {room.name}")

        await db.commit()
        print("\nГотово. Сохраните пароли — они больше не будут показаны.")


if __name__ == "__main__":
    asyncio.run(main())
