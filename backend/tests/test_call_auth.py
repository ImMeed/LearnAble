"""Tests for Fix 1 + Fix 2: call auth and per-room authorization."""
import os
import pytest
from fastapi.testclient import TestClient
from jose import jwt

os.environ.setdefault("JWT_SECRET_KEY", "learnable-tests-jwt-secret-key-2026-min32chars")
os.environ.setdefault("REQUIRE_CALL_AUTH", "true")

from app.main import app
from app.core.config import settings
from app.modules.call.router import room_registry


def _make_token(user_id: str = "00000000-0000-0000-0000-000000000001") -> str:
    return jwt.encode(
        {"sub": user_id, "role": "ROLE_TEACHER", "email": "test@example.com"},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


# ── Fix 1: auth enforcement ────────────────────────────────────────────────────

def test_require_call_auth_is_enabled():
    assert settings.require_call_auth is True


def test_ws_rejects_no_token():
    """WS without token → closed with 4001."""
    client = TestClient(app)
    with client.websocket_connect("/ws/call/some-room-id") as ws:
        with pytest.raises(Exception):
            ws.receive_json()


def test_ws_rejects_invalid_token():
    """WS with a bad token → closed with 4001."""
    client = TestClient(app)
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/call/some-room-id?token=bad.token.here") as ws:
            ws.receive_json()


# ── Fix 2: per-room authorization ─────────────────────────────────────────────

def test_create_room_requires_auth():
    """POST /calls/rooms without Bearer token → 401."""
    client = TestClient(app)
    res = client.post("/calls/rooms")
    assert res.status_code == 401


def test_create_room_returns_room_id():
    """POST /calls/rooms with valid token → 201 + room_id."""
    token = _make_token()
    client = TestClient(app)
    res = client.post("/calls/rooms", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    data = res.json()
    assert "room_id" in data
    assert len(data["room_id"]) == 36  # UUID format


def test_ws_rejects_unregistered_room():
    """WS join attempt on a room not created via API → closed with 4003."""
    token = _make_token()
    client = TestClient(app)
    with client.websocket_connect(f"/ws/call/totally-fake-room-id?token={token}") as ws:
        with pytest.raises(Exception):
            ws.receive_json()


def test_ws_accepts_registered_room():
    """WS join on a registered room with valid token → 'joined' message."""
    token = _make_token()
    client = TestClient(app)
    # Create the room first
    res = client.post("/calls/rooms", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    room_id = res.json()["room_id"]
    # Now connect via WS
    with client.websocket_connect(f"/ws/call/{room_id}?token={token}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "joined"
        assert "initiator" in msg


def test_room_registry_populated():
    """room_registry is updated when a room is created."""
    token = _make_token()
    client = TestClient(app)
    res = client.post("/calls/rooms", headers={"Authorization": f"Bearer {token}"})
    room_id = res.json()["room_id"]
    assert room_id in room_registry
