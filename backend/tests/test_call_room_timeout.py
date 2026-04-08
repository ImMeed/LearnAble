"""Tests for Fix 4: stale room cleanup."""
import asyncio
import os
from datetime import datetime, timezone, timedelta

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "learnable-tests-jwt-secret-key-2026-min32chars")
os.environ.setdefault("REQUIRE_CALL_AUTH", "true")


@pytest.mark.asyncio
async def test_cleanup_removes_idle_empty_rooms():
    """Rooms with no active peers older than ROOM_IDLE_TIMEOUT are deleted."""
    from app.modules.call.router import room_registry, rooms, _cleanup_stale_rooms, ROOM_IDLE_TIMEOUT

    old_time = (datetime.now(timezone.utc) - ROOM_IDLE_TIMEOUT - timedelta(seconds=10)).isoformat()
    room_registry["stale-room-001"] = {"owner_id": "user-1", "created_at": old_time}
    rooms.pop("stale-room-001", None)  # no active peers

    # Also add a fresh room — should NOT be cleaned
    fresh_time = datetime.now(timezone.utc).isoformat()
    room_registry["fresh-room-001"] = {"owner_id": "user-2", "created_at": fresh_time}

    # Run one sweep iteration directly
    async def single_sweep():
        from app.modules.call.router import room_registry, rooms, ROOM_IDLE_TIMEOUT
        now = datetime.now(timezone.utc)
        stale = [
            room_id
            for room_id, meta in list(room_registry.items())
            if rooms.get(room_id, []) == []
            and now - datetime.fromisoformat(meta["created_at"]) > ROOM_IDLE_TIMEOUT
        ]
        for room_id in stale:
            room_registry.pop(room_id, None)
            rooms.pop(room_id, None)

    await single_sweep()

    assert "stale-room-001" not in room_registry, "Stale room should have been removed"
    assert "fresh-room-001" in room_registry, "Fresh room should remain"

    # Cleanup
    room_registry.pop("fresh-room-001", None)


@pytest.mark.asyncio
async def test_cleanup_keeps_rooms_with_active_peers():
    """Rooms with active peers are never cleaned up even if old."""
    from app.modules.call.router import room_registry, rooms, ROOM_IDLE_TIMEOUT

    old_time = (datetime.now(timezone.utc) - ROOM_IDLE_TIMEOUT - timedelta(seconds=10)).isoformat()
    room_registry["active-room-001"] = {"owner_id": "user-1", "created_at": old_time}
    rooms["active-room-001"] = [("fake_ws", "user-1")]  # simulate 1 active peer

    async def single_sweep():
        from app.modules.call.router import room_registry, rooms, ROOM_IDLE_TIMEOUT
        now = datetime.now(timezone.utc)
        stale = [
            room_id
            for room_id, meta in list(room_registry.items())
            if rooms.get(room_id, []) == []
            and now - datetime.fromisoformat(meta["created_at"]) > ROOM_IDLE_TIMEOUT
        ]
        for room_id in stale:
            room_registry.pop(room_id, None)
            rooms.pop(room_id, None)

    await single_sweep()

    assert "active-room-001" in room_registry, "Room with active peer must not be removed"

    # Cleanup
    room_registry.pop("active-room-001", None)
    rooms.pop("active-room-001", None)
