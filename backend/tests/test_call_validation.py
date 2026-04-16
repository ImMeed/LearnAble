"""Tests for Fix 6: message size limits, rate limiting, schema validation."""
import os
import pytest
from fastapi.testclient import TestClient
from jose import jwt

os.environ.setdefault("JWT_SECRET_KEY", "learnable-tests-jwt-secret-key-2026-min32chars")
os.environ.setdefault("REQUIRE_CALL_AUTH", "true")

from app.main import app
from app.core.config import settings
from app.modules.call.router import room_registry, MAX_MESSAGE_BYTES, RATE_LIMIT_MAX_MESSAGES, _REQUIRED_FIELDS


def _make_token(user_id: str = "00000000-0000-0000-0000-000000000001") -> str:
    return jwt.encode(
        {"sub": user_id, "role": "ROLE_TEACHER", "email": "test@example.com"},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def _create_room(client: TestClient, token: str) -> str:
    res = client.post("/calls/rooms", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    return res.json()["room_id"]


# ── Fix 6a: message size ───────────────────────────────────────────────────────

def test_max_message_bytes_is_reasonable():
    """MAX_MESSAGE_BYTES should be between 1KB and 1MB."""
    assert 1024 <= MAX_MESSAGE_BYTES <= 1024 * 1024


def test_required_fields_defined_for_all_signal_types():
    """All signal types must have required-field definitions."""
    for sig_type in ["offer", "answer", "ice", "media_state", "attention_metrics"]:
        assert sig_type in _REQUIRED_FIELDS
        assert isinstance(_REQUIRED_FIELDS[sig_type], list)
        assert len(_REQUIRED_FIELDS[sig_type]) > 0


# ── Fix 6b: rate limit constant ───────────────────────────────────────────────

def test_rate_limit_is_reasonable():
    """RATE_LIMIT_MAX_MESSAGES should be between 5 and 100 per second."""
    assert 5 <= RATE_LIMIT_MAX_MESSAGES <= 100


# ── Fix 6c: schema validation via WS ──────────────────────────────────────────

def test_valid_offer_is_relayed():
    """A well-formed offer message with signalData is relayed to the peer."""
    import json
    token_a = _make_token("00000000-0000-0000-0000-000000000001")
    token_b = _make_token("00000000-0000-0000-0000-000000000002")
    client = TestClient(app)
    room_id = _create_room(client, token_a)

    with client.websocket_connect(f"/ws/call/{room_id}?token={token_a}") as ws_a:
        ws_a.receive_json()  # "joined"

        with client.websocket_connect(f"/ws/call/{room_id}?token={token_b}") as ws_b:
            ws_b.receive_json()  # "joined"
            ws_a.receive_json()  # "peer_joined"

            # Send a valid offer from B to A
            ws_b.send_json({"type": "offer", "signalData": {"type": "offer", "sdp": "fake-sdp"}})
            msg = ws_a.receive_json()
            assert msg["type"] == "offer"


def test_malformed_offer_without_signal_data_is_dropped():
    """An offer missing 'signalData' must not be relayed."""
    import json
    import threading
    import time

    token_a = _make_token("00000000-0000-0000-0000-000000000003")
    token_b = _make_token("00000000-0000-0000-0000-000000000004")
    client = TestClient(app)
    room_id = _create_room(client, token_a)

    received = []

    with client.websocket_connect(f"/ws/call/{room_id}?token={token_a}") as ws_a:
        ws_a.receive_json()  # "joined"

        with client.websocket_connect(f"/ws/call/{room_id}?token={token_b}") as ws_b:
            ws_b.receive_json()  # "joined"
            ws_a.receive_json()  # "peer_joined"

            # Send malformed offer (missing signalData)
            ws_b.send_json({"type": "offer", "bad_field": "value"})

            # Send a valid media_state right after so ws_a gets something to detect ordering
            ws_b.send_json({"type": "media_state", "video": True, "audio": True})

            # ws_a should receive media_state but NOT the bad offer
            msg = ws_a.receive_json()
            assert msg["type"] == "media_state", f"Expected media_state, got {msg['type']}"


def test_unknown_message_type_is_ignored():
    """Messages with unknown type must not be relayed."""
    token_a = _make_token("00000000-0000-0000-0000-000000000005")
    token_b = _make_token("00000000-0000-0000-0000-000000000006")
    client = TestClient(app)
    room_id = _create_room(client, token_a)

    with client.websocket_connect(f"/ws/call/{room_id}?token={token_a}") as ws_a:
        ws_a.receive_json()  # "joined"

        with client.websocket_connect(f"/ws/call/{room_id}?token={token_b}") as ws_b:
            ws_b.receive_json()  # "joined"
            ws_a.receive_json()  # "peer_joined"

            ws_b.send_json({"type": "evil_command", "payload": "x" * 1000})
            ws_b.send_json({"type": "media_state", "video": True, "audio": False})

            msg = ws_a.receive_json()
            assert msg["type"] == "media_state"


def test_same_user_reconnect_replaces_old_socket_not_room_full():
    """A reconnect from the same user should replace prior socket and still allow one peer."""
    token_a = _make_token("00000000-0000-0000-0000-000000000007")
    token_b = _make_token("00000000-0000-0000-0000-000000000008")
    client = TestClient(app)
    room_id = _create_room(client, token_a)

    # First connection from user A.
    with client.websocket_connect(f"/ws/call/{room_id}?token={token_a}") as ws_a1:
        joined_a1 = ws_a1.receive_json()
        assert joined_a1["type"] == "joined"

        # Reconnect from same user A should replace ws_a1, not consume extra slot.
        with client.websocket_connect(f"/ws/call/{room_id}?token={token_a}") as ws_a2:
            joined_a2 = ws_a2.receive_json()
            assert joined_a2["type"] == "joined"

            # Different user B should still be able to join as second peer.
            with client.websocket_connect(f"/ws/call/{room_id}?token={token_b}") as ws_b:
                joined_b = ws_b.receive_json()
                assert joined_b["type"] == "joined"
