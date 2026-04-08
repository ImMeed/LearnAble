import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Tuple, Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, status
from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import CurrentUser, get_current_user

ROOM_IDLE_TIMEOUT = timedelta(minutes=5)

# Fix 6: rate limiting and message size limits
MAX_MESSAGE_BYTES = 64 * 1024        # 64 KB per message
RATE_LIMIT_WINDOW = 1.0              # seconds
RATE_LIMIT_MAX_MESSAGES = 20         # max messages per peer per window

# Required fields per message type for schema validation
_REQUIRED_FIELDS: dict[str, list[str]] = {
    "offer": ["signalData"],
    "answer": ["signalData"],
    "ice": ["signalData"],
    "media_state": ["video", "audio"],
    "attention_metrics": ["payload"],
}

logger = logging.getLogger("learnable.call")

# ── HTTP router (room creation) ────────────────────────────────────────────────
http_router = APIRouter(prefix="/calls", tags=["call"])

# room_id → {owner_id, created_at}
room_registry: Dict[str, dict] = {}

# room_id → list of (websocket, user_id)
rooms: Dict[str, List[Tuple[WebSocket, Optional[str]]]] = {}


class RoomResponse(BaseModel):
    room_id: str


async def _cleanup_stale_rooms() -> None:
    """Background task: delete rooms with 0 active peers that have been idle too long."""
    while True:
        await asyncio.sleep(60)
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
            logger.info("Cleaned up stale room", extra={"room_id": room_id})


@http_router.post("/rooms", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(current_user: CurrentUser = Depends(get_current_user)) -> RoomResponse:
    """Create a call room. Only the creator's authenticated session can open a room."""
    import uuid
    room_id = str(uuid.uuid4())
    room_registry[room_id] = {
        "owner_id": str(current_user.user_id),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("Room created", extra={"room_id": room_id, "owner": str(current_user.user_id)})
    return RoomResponse(room_id=room_id)


# ── WebSocket router ───────────────────────────────────────────────────────────
router = APIRouter(prefix="/ws/call", tags=["call"])


@router.websocket("/{room_id}")
async def call_websocket(websocket: WebSocket, room_id: str, token: str = Query(None)):
    user_id = None
    if token:
        try:
            token_data = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
            user_id = token_data.get("sub")
        except (JWTError, Exception):
            await websocket.accept()
            logger.warning("Invalid token provided", extra={"room_id": room_id})
            await websocket.close(code=4001, reason="Invalid token")
            return
    elif settings.require_call_auth:
        await websocket.accept()
        logger.warning("Auth required but no token provided", extra={"room_id": room_id})
        await websocket.close(code=4001, reason="Authentication required")
        return

    # Fix 2: room must have been explicitly created via POST /calls/rooms
    if room_id not in room_registry:
        await websocket.accept()
        logger.warning("Attempt to join unregistered room", extra={"room_id": room_id, "user_id": user_id})
        await websocket.close(code=4003, reason="Room not found")
        return

    await websocket.accept()

    if room_id not in rooms:
        rooms[room_id] = []

    if len(rooms[room_id]) >= 2:
        logger.warning("Room full, rejecting connection", extra={"room_id": room_id})
        await websocket.send_json({"type": "room_full"})
        await websocket.close()
        return

    is_initiator = len(rooms[room_id]) == 1
    rooms[room_id].append((websocket, user_id))

    logger.info("User joined room", extra={"room_id": room_id, "user_id": user_id, "occupancy": len(rooms[room_id])})

    try:
        await websocket.send_json({
            "type": "joined",
            "initiator": is_initiator,
        })

        if len(rooms[room_id]) == 2:
            first_socket, _ = rooms[room_id][0]
            await first_socket.send_json({"type": "peer_joined"})

        rate_window_start = asyncio.get_event_loop().time()
        rate_count = 0

        while True:
            data = await websocket.receive_text()

            # Fix 6a: enforce message size limit
            if len(data.encode()) > MAX_MESSAGE_BYTES:
                logger.warning("Message too large, dropping", extra={"room_id": room_id, "size": len(data)})
                continue

            # Fix 6b: rate limiting per peer
            now_time = asyncio.get_event_loop().time()
            if now_time - rate_window_start >= RATE_LIMIT_WINDOW:
                rate_window_start = now_time
                rate_count = 0
            rate_count += 1
            if rate_count > RATE_LIMIT_MAX_MESSAGES:
                logger.warning("Rate limit exceeded, dropping message", extra={"room_id": room_id, "user_id": user_id})
                continue

            try:
                message = json.loads(data)
                msg_type = message.get("type")

                if msg_type not in _REQUIRED_FIELDS:
                    continue

                # Fix 6c: schema validation — check required fields are present
                missing = [f for f in _REQUIRED_FIELDS[msg_type] if f not in message]
                if missing:
                    logger.warning(
                        "Message missing required fields, dropping",
                        extra={"room_id": room_id, "type": msg_type, "missing": missing},
                    )
                    continue

                logger.debug("Relaying signal", extra={"room_id": room_id, "type": msg_type})
                for peer_socket, _ in rooms[room_id]:
                    if peer_socket != websocket:
                        await peer_socket.send_text(data)
            except json.JSONDecodeError:
                logger.warning("Invalid JSON received", extra={"room_id": room_id})

    except WebSocketDisconnect:
        logger.info("User left room", extra={"room_id": room_id, "user_id": user_id})
        if room_id in rooms:
            rooms[room_id] = [(sock, uid) for sock, uid in rooms[room_id] if sock != websocket]

            if len(rooms[room_id]) == 1:
                remaining_peer_socket, _ = rooms[room_id][0]
                try:
                    await remaining_peer_socket.send_json({"type": "peer_left"})
                except Exception:
                    pass

            if len(rooms[room_id]) == 0:
                del rooms[room_id]
