"""Тесты всех API эндпоинтов."""
import pytest
from tests.conftest import auth_header, BOT_SECRET


# === Health ===

@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


# === Auth ===

@pytest.mark.asyncio
async def test_auth_me(client, user):
    r = await client.get("/auth/me", headers=auth_header(user.id))
    assert r.status_code == 200
    assert r.json()["first_name"] == "Test"


@pytest.mark.asyncio
async def test_auth_me_no_token(client):
    r = await client.get("/auth/me")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_auth_tablet(client, tablet_account, room):
    r = await client.post("/auth/tablet", json={"username": "tablet-test-room", "password": "testpass123"})
    assert r.status_code == 200
    data = r.json()
    assert "token" in data
    assert data["room"]["name"] == "Test Room"


@pytest.mark.asyncio
async def test_auth_tablet_wrong_password(client, tablet_account):
    r = await client.post("/auth/tablet", json={"username": "tablet-test-room", "password": "wrong"})
    assert r.status_code == 401


# === Rooms ===

@pytest.mark.asyncio
async def test_list_rooms(client, user, room):
    r = await client.get("/rooms/", headers=auth_header(user.id))
    assert r.status_code == 200
    assert len(r.json()) >= 1


@pytest.mark.asyncio
async def test_rooms_status(client, room):
    r = await client.get("/rooms/status")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert data[0]["name"] == "Test Room"


@pytest.mark.asyncio
async def test_create_room_superadmin(client, superadmin):
    r = await client.post("/rooms/", json={"name": "New Room", "floor": 2, "capacity": 6},
                          headers=auth_header(superadmin.id))
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "New Room"
    assert "tablet_username" in data
    assert "tablet_password" in data


@pytest.mark.asyncio
async def test_create_room_forbidden_for_user(client, user):
    r = await client.post("/rooms/", json={"name": "X", "floor": 1, "capacity": 2},
                          headers=auth_header(user.id))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_admin_list_rooms(client, superadmin, room):
    r = await client.get("/rooms/admin/list", headers=auth_header(superadmin.id))
    assert r.status_code == 200
    assert len(r.json()) >= 1


@pytest.mark.asyncio
async def test_delete_room(client, superadmin, room):
    r = await client.delete(f"/rooms/{room.id}", headers=auth_header(superadmin.id))
    assert r.status_code == 200


# === Bookings ===

@pytest.mark.asyncio
async def test_list_bookings(client, user, room, booking):
    r = await client.get(f"/bookings/?date_from=2020-01-01&date_to=2030-01-01&room_id={room.id}", headers=auth_header(user.id))
    assert r.status_code == 200
    assert len(r.json()) >= 1


@pytest.mark.asyncio
async def test_create_booking(client, user, room):
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    start = (now + timedelta(days=1)).isoformat()
    end = (now + timedelta(days=1, hours=1)).isoformat()
    r = await client.post("/bookings/", json={
        "room_id": str(room.id), "title": "New Meeting",
        "start_time": start, "end_time": end,
        "description": "", "guests": [], "recurrence": "none",
    }, headers=auth_header(user.id))
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_delete_booking(client, user, booking):
    r = await client.delete(f"/bookings/{booking.id}", headers=auth_header(user.id))
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_active_bookings(client, user, booking):
    r = await client.get("/bookings/active", headers=auth_header(user.id))
    assert r.status_code == 200


# === Users ===

@pytest.mark.asyncio
async def test_users_me(client, user):
    r = await client.get("/users/me", headers=auth_header(user.id))
    assert r.status_code == 200
    assert r.json()["first_name"] == "Test"


@pytest.mark.asyncio
async def test_users_search(client, user):
    r = await client.get("/users/search?q=Test", headers=auth_header(user.id))
    assert r.status_code == 200
    assert len(r.json()) >= 1


@pytest.mark.asyncio
async def test_admin_users(client, superadmin):
    r = await client.get("/users/admin/users", headers=auth_header(superadmin.id))
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_admin_stats(client, superadmin):
    r = await client.get("/users/admin/stats", headers=auth_header(superadmin.id))
    assert r.status_code == 200
    data = r.json()
    assert "total_users" in data
    assert "total_bookings" in data


@pytest.mark.asyncio
async def test_admin_create_user(client, superadmin):
    r = await client.post("/users/admin/users", json={"first_name": "New", "last_name": "Guy"},
                          headers=auth_header(superadmin.id))
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_change_role(client, superadmin, user):
    r = await client.patch(f"/users/admin/users/{user.id}/role", json={"role": "admin"},
                           headers=auth_header(superadmin.id))
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_set_allowed_rooms(client, superadmin, user, room):
    r = await client.patch(f"/users/admin/users/{user.id}/allowed-rooms",
                           json={"room_ids": [str(room.id)]},
                           headers=auth_header(superadmin.id))
    assert r.status_code == 200


# === Internal ===

@pytest.mark.asyncio
async def test_internal_ensure_user(client):
    r = await client.post("/internal/users/ensure",
                          json={"telegram_id": 555555, "first_name": "Bot", "last_name": "User"},
                          headers={"X-Bot-Secret": BOT_SECRET})
    # bot_internal_secret is "" by default in test, header matches
    assert r.status_code == 200
    assert r.json()["first_name"] == "Bot"


@pytest.mark.asyncio
async def test_internal_user_search(client, user):
    r = await client.get("/internal/users/search?q=Test", headers={"X-Bot-Secret": BOT_SECRET})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_internal_bookings_since(client, booking):
    r = await client.get("/internal/bookings/since?updated_at=2020-01-01T00:00:00Z",
                         headers={"X-Bot-Secret": BOT_SECRET})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_internal_bookings_reminders(client):
    r = await client.get("/internal/bookings/reminders", headers={"X-Bot-Secret": BOT_SECRET})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_internal_mark_reminded(client, booking):
    r = await client.post(f"/internal/bookings/{booking.id}/mark-reminded",
                          headers={"X-Bot-Secret": BOT_SECRET})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_internal_deleted_since(client):
    r = await client.get("/internal/bookings/deleted-since?since=2020-01-01T00:00:00Z",
                         headers={"X-Bot-Secret": BOT_SECRET})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_internal_consume_session(client, user, browser_session):
    r = await client.post("/internal/auth/consume-session",
                          json={"token": "test-session-token", "telegram_id": 100001},
                          headers={"X-Bot-Secret": BOT_SECRET})
    assert r.status_code == 200


# === Tablet ===

@pytest.mark.asyncio
async def test_tablet_room(client, tablet_account, room):
    # Login first
    login = await client.post("/auth/tablet", json={"username": "tablet-test-room", "password": "testpass123"})
    token = login.json()["token"]
    r = await client.get("/tablet/room", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["name"] == "Test Room"


@pytest.mark.asyncio
async def test_tablet_bookings(client, tablet_account, room):
    login = await client.post("/auth/tablet", json={"username": "tablet-test-room", "password": "testpass123"})
    token = login.json()["token"]
    r = await client.get("/tablet/bookings?date=2026-04-03", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
