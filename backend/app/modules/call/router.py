import json
import logging
from typing import Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws/call", tags=["call"])

rooms: Dict[str, List[WebSocket]] = {}

@router.websocket("/{room_id}")
async def call_websocket(websocket: WebSocket, room_id: str):
    await websocket.accept()

    if room_id not in rooms:
        rooms[room_id] = []

    if len(rooms[room_id]) >= 2:
        await websocket.send_json({"type": "room_full"})
        await websocket.close()
        return

    is_initiator = len(rooms[room_id]) == 0
    rooms[room_id].append(websocket)

    try:
        await websocket.send_json({
            "type": "joined",
            "initiator": is_initiator
        })

        if len(rooms[room_id]) == 2:
            first_socket = rooms[room_id][0]
            await first_socket.send_json({"type": "peer_joined"})

        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get("type")

                if msg_type in ["offer", "answer", "ice"]:
                    for peer in rooms[room_id]:
                        if peer != websocket:
                            await peer.send_text(data)
            except json.JSONDecodeError:
                logger.warning("Invalid JSON received")

    except WebSocketDisconnect:
        if room_id in rooms and websocket in rooms[room_id]:
            rooms[room_id].remove(websocket)

            if len(rooms[room_id]) == 1:
                remaining_peer = rooms[room_id][0]
                try:
                    await remaining_peer.send_json({"type": "peer_left"})
                except Exception:
                    pass

            if len(rooms[room_id]) == 0:
                del rooms[room_id]
