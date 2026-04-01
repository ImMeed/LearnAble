# Phase 01 — Signaling Refactor & Room-Based Architecture

## Context & Gap Analysis

The current implementation has a **basic Socket.IO signaling layer** and a **monolithic `VideoCall.tsx`** page. Comparing against the PRD and roadmap, the following foundational pieces are **missing or wrong**:

| Area | Current State | PRD Target |
|---|---|---|
| Signaling transport | Socket.IO (`python-socketio` + `socket.io-client`) | Native FastAPI WebSockets (`ws://host/ws/call/{roomId}`) |
| Room model | Manual socket-ID exchange (user pastes remote ID) | URL-based rooms (`/call/:roomId`), auto-join |
| Backend room mgmt | None — events go peer-to-peer by socket ID | Server maintains `rooms: dict[str, list[WebSocket]]` |
| Room capacity | No limit | Max 2 participants; 3rd gets `room_full` |
| Disconnect notify | Not implemented | Server sends `peer_left` to remaining peer |
| Frontend routing | `/videocall` (no roomId param) | `/call/:roomId` with UUID auto-generation |
| Frontend hooks | All logic in one component | `useSignaling.ts` + `useWebRTC.ts` (separated) |

> **This phase delivers Roadmap Phase 1 (Foundation & Signaling) completely and sets up the hook architecture for Phase 2.**

---

## Pre-requisites

```bash
# Backend — ensure websockets is installed (FastAPI WS transport)
pip install websockets

# Frontend — already has simple-peer; add uuid if missing
npm install uuid
```

> **Remove** `socket.io-client` from frontend `package.json` and `python-socketio[asyncio]` from backend `requirements.txt` at the end of this phase. They are replaced by native WebSockets.

---

## Task 1 — Backend: Create signaling WebSocket endpoint

### File: `backend/app/modules/call/__init__.py`
Create an empty `__init__.py`.

### File: `backend/app/modules/call/router.py`

Create a new FastAPI router with a WebSocket endpoint. Implementation requirements:

```python
# Key design:
# 1. Module-level dict:  rooms: dict[str, list[WebSocket]] = {}
# 2. Single endpoint:    @router.websocket("/ws/call/{room_id}")
# 3. On connect:
#      - If len(rooms[room_id]) >= 2 → send {"type": "room_full"}, close socket
#      - Else → add socket to room, send {"type": "joined", "initiator": len(rooms[room_id]) == 1}
#        (first joiner: initiator=False, second joiner: initiator=True)
#      - If room now has 2 sockets → send {"type": "peer_joined"} to the FIRST socket
# 4. Message relay loop:
#      - Read JSON messages from the socket
#      - For types "offer", "answer", "ice" → forward verbatim to the OTHER socket in the room
#      - Unknown types → ignore (don't crash)
# 5. On disconnect (WebSocketDisconnect exception):
#      - Remove socket from room
#      - If room still has 1 socket → send {"type": "peer_left"} to that socket
#      - If room is now empty → delete room key from dict
```

**Best practices:**
- Use `try/except WebSocketDisconnect` around the receive loop
- Accept the websocket before any room logic: `await websocket.accept()`
- Use `json.loads` / `json.dumps` for message serialization
- Add logging with `import logging; logger = logging.getLogger(__name__)`
- All room mutations should be safe — check existence before access

---

## Task 2 — Backend: Register the call router & remove Socket.IO

### File: `backend/app/main.py`

1. **Add** import and registration:
   ```python
   from app.modules.call.router import router as call_router
   # Inside create_app():
   app.include_router(call_router)
   ```

2. **Remove** all Socket.IO code (lines 84–115 in current file):
   - Remove `import socketio` (both occurrences)
   - Remove `sio = socketio.AsyncServer(...)` and all `@sio.event` / `@sio.on` handlers
   - Remove `asgi_app = socketio.ASGIApp(sio, other_asgi_app=app)`
   - The uvicorn entry point should now point to `app` directly, not `asgi_app`

3. **Add CORS middleware** to `create_app()` so the frontend dev server can reach the WS endpoint:
   ```python
   from fastapi.middleware.cors import CORSMiddleware

   app.add_middleware(
       CORSMiddleware,
       allow_origins=["http://localhost:3001", "http://localhost:5173"],
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

### File: `backend/requirements.txt`
- **Add** `websockets` (if not present)
- **Remove** `python-socketio[asyncio]==5.9.0`

---

## Task 3 — Frontend: Create `useSignaling` hook

### File: `frontend/src/hooks/useSignaling.ts`

Create a custom React hook that manages the WebSocket connection to the signaling server.

```typescript
// Interface:
// Input:  roomId: string
// Output: {
//   sendMessage: (msg: object) => void,
//   lastMessage: SignalingMessage | null,
//   isConnected: boolean,
//   isInitiator: boolean | null,
//   connectionError: string | null,
// }

// Implementation requirements:
// 1. On mount: open WebSocket to `ws://${window.location.hostname}:8000/ws/call/${roomId}`
// 2. On open: connection is established (server auto-joins on connect)
// 3. On message: parse JSON, update lastMessage state
//    - If type === "joined" → store initiator flag
//    - If type === "room_full" → set connectionError
//    - If type === "peer_joined" → this triggers WebRTC initiation (consumer handles)
//    - If type === "peer_left" → consumer handles
//    - If type === "offer" | "answer" | "ice" → consumer handles via lastMessage
// 4. On close/error: set isConnected=false, set connectionError if unexpected
// 5. On unmount: close WebSocket cleanly
// 6. sendMessage: JSON.stringify and ws.send()

// Best practices:
// - Use useRef for the WebSocket instance (not state) to avoid re-renders
// - Use useCallback for sendMessage
// - Use useEffect cleanup to close the socket
// - Guard against sending on a closed socket
```

### Types file: `frontend/src/hooks/types.ts`

```typescript
export type SignalingMessageType =
  | "joined"
  | "peer_joined"
  | "peer_left"
  | "room_full"
  | "offer"
  | "answer"
  | "ice";

export interface SignalingMessage {
  type: SignalingMessageType;
  initiator?: boolean;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  [key: string]: unknown;
}

export type CallState =
  | "idle"
  | "waiting"
  | "connected"
  | "room_full"
  | "peer_left"
  | "error";
```

---

## Task 4 — Frontend: Create `CallPage.tsx` shell with room routing

### File: `frontend/src/pages/CallPage.tsx`

Create a new page component (the existing `VideoCall.tsx` will be removed at the end).

```typescript
// Implementation requirements:
// 1. Read roomId from URL params: const { roomId } = useParams()
// 2. If roomId is undefined → generate uuid via uuid/v4, navigate(`/call/${newId}`, { replace: true })
// 3. If roomId exists:
//    - Call useSignaling(roomId)
//    - Render a placeholder for now:
//      - Show "Room: {roomId}"
//      - Show connection status from the hook
//      - Show "Waiting for peer..." or "Connected" based on hook state
// 4. Export as default
```

### File: `frontend/src/app/router.tsx`

Update the router:
1. **Add** new route: `{ path: "/call/:roomId", element: <CallPage /> }`
2. **Add** redirect route: `{ path: "/call", element: <CallRedirect /> }` — a tiny component that generates a UUID and navigates to `/call/{uuid}`
3. **Keep** the old `/videocall` routes for now (remove them in Phase 03 after full migration)
4. **Add** import for `CallPage`

---

## Task 5 — Frontend: Remove `socket.io-client` dependency

### File: `frontend/package.json`
- **Remove** `"socket.io-client"` from dependencies

Then run:
```bash
cd frontend && npm install
```

---

## Verification Checklist

After completing this phase, verify each item:

- [ ] **Backend starts** without errors: `uvicorn app.main:app --reload` from `backend/`
- [ ] **WebSocket connects**: Open browser DevTools console and run:
  ```javascript
  const ws = new WebSocket("ws://localhost:8000/ws/call/test-room");
  ws.onmessage = e => console.log(JSON.parse(e.data));
  ```
  → Should log `{"type": "joined", "initiator": false}`
- [ ] **Second connection** to same room → logs `{"type": "joined", "initiator": true}`, first socket gets `{"type": "peer_joined"}`
- [ ] **Third connection** → receives `{"type": "room_full"}` and socket closes
- [ ] **Close one socket** → remaining socket receives `{"type": "peer_left"}`
- [ ] **Frontend** `/call` → redirects to `/call/<uuid>`
- [ ] **Frontend** `/call/test-room` → shows room ID and connection status
- [ ] **No Socket.IO code** remains in backend or frontend
- [ ] **`npm run build`** succeeds without errors
- [ ] **`pip install -r requirements.txt`** succeeds without socketio

---

## Files Summary

| Action | File |
|---|---|
| **CREATE** | `backend/app/modules/call/__init__.py` |
| **CREATE** | `backend/app/modules/call/router.py` |
| **MODIFY** | `backend/app/main.py` (add call router, remove Socket.IO, add CORS) |
| **MODIFY** | `backend/requirements.txt` (add websockets, remove socketio) |
| **CREATE** | `frontend/src/hooks/useSignaling.ts` |
| **CREATE** | `frontend/src/hooks/types.ts` |
| **CREATE** | `frontend/src/pages/CallPage.tsx` |
| **MODIFY** | `frontend/src/app/router.tsx` (add `/call` routes) |
| **MODIFY** | `frontend/package.json` (remove socket.io-client) |
