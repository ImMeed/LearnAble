import json
import logging
import os
from typing import Dict, List, Tuple, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt
from app.core.config import settings

logger = logging.getLogger("learnable.call")

router = APIRouter(prefix="/ws/call", tags=["call"])

REQUIRE_CALL_AUTH = os.getenv("REQUIRE_CALL_AUTH", "false").lower() == "true"

rooms: Dict[str, List[Tuple[WebSocket, Optional[str]]]] = {}

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
    elif REQUIRE_CALL_AUTH:
        await websocket.accept()
        logger.warning("Auth required but no token provided", extra={"room_id": room_id})
        await websocket.close(code=4001, reason="Authentication required")
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
            "initiator": is_initiator
        })

        if len(rooms[room_id]) == 2:
            first_socket, _ = rooms[room_id][0]
            await first_socket.send_json({"type": "peer_joined"})

        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get("type")

                if msg_type in ["offer", "answer", "ice", "media_state", "attention_metrics"]:
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
