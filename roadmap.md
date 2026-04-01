# 1-on-1 Video Call Feature — Implementation Roadmap

---

## Overview

This roadmap breaks the WebRTC video call feature into **4 sequential phases**, each independently shippable and testable. Each phase builds on the previous one, moving from infrastructure to full polish.

---

## Phase Summary

| Phase | Name | Goal | Estimated Effort |
|---|---|---|---|
| 1 | Foundation & Signaling | Backend WS server + routing skeleton | 1–2 days |
| 2 | Local Media & UI Shell | Camera/mic access + page layout | 1 day |
| 3 | Peer Connection (WebRTC) | Full two-way video call working | 2–3 days |
| 4 | Controls, States & Edge Cases | Mute, cam toggle, disconnection handling | 1–2 days |

---

## Phase 1 — Foundation & Signaling Backend

**Goal:** Get the WebSocket signaling server running and the frontend route in place. No video yet — just plumbing.

### Backend Tasks

#### 1.1 — Create the signaling router (`backend/routers/call.py`)

```python
# Responsibilities:
# - Maintain in-memory rooms dict: dict[str, list[WebSocket]]
# - Handle /ws/call/{roomId} WebSocket endpoint
# - On "join": add socket; if room full → send room_full + close
# - On any other message: relay raw JSON to the other socket in the room
# - On disconnect: remove socket, notify remaining peer with peer_left
```

Message types to handle:
- `join` → add to room or reject
- `offer`, `answer`, `ice` → relay to peer
- `peer_left` → sent by server on disconnect
- `room_full` → sent by server when room has 2 occupants

#### 1.2 — Register the router in `backend/main.py`

```python
from routers.call import router as call_router
app.include_router(call_router)
```

#### 1.3 — Install backend dependency

```bash
pip install websockets
```

### Frontend Tasks

#### 1.4 — Install frontend dependencies

```bash
npm install simple-peer uuid
npm install @types/simple-peer -D
```

#### 1.5 — Add the route to the router

```tsx
// In your router config:
<Route path="/call/:roomId" element={<CallPage />} />
```

#### 1.6 — Create `CallPage.tsx` as a shell

- If no `roomId` param → generate a UUID and redirect to `/call/<uuid>`
- Otherwise render a placeholder: `"Room: {roomId}"`

#### 1.7 — Create `useSignaling.ts` hook (skeleton)

```ts
// Responsibilities:
// - Open WebSocket to ws://<host>/ws/call/{roomId}
// - Send a "join" message on connect
// - Expose: sendMessage(msg), lastMessage, connectionStatus
// - Clean up WebSocket on unmount
```

### Acceptance Criteria — Phase 1

- [ ] `ws://localhost:8000/ws/call/test-room` accepts connections
- [ ] Two browser tabs connecting to the same room ID both receive a join acknowledgement
- [ ] A third tab receives `room_full` and the connection is closed
- [ ] Closing one tab causes the other to receive `peer_left`
- [ ] Navigating to `/call` (no ID) redirects to `/call/<uuid>`

---

## Phase 2 — Local Media & UI Shell

**Goal:** The page can access the camera/microphone and render the full UI layout — no remote stream yet.

### Frontend Tasks

#### 2.1 — Create `VideoTile.tsx` component

```tsx
// Props: stream: MediaStream | null, muted: boolean, label?: string
// Renders a <video> element and auto-plays when stream is attached
// Falls back to a dark placeholder with a label when stream is null
```

#### 2.2 — Implement local media access in `useWebRTC.ts` (skeleton)

```ts
// On mount:
//   navigator.mediaDevices.getUserMedia({ video: true, audio: true })
//   Store stream in localStream state
//   Handle PermissionDeniedError → set state to "error"
// Expose: localStream, error
```

#### 2.3 — Build the `CallPage.tsx` layout

Implement the full visual layout:

```
┌─────────────────────────────────────┐
│                                     │
│        Remote Video (main)          │  ← dark bg placeholder for now
│                                     │
│                      ┌──────────┐   │
│                      │Local View│   │  ← real camera feed
│                      └──────────┘   │
│                                     │
│   [ 🎤 Mute ]  [ 📷 Cam ]  [ ✕ End ]│
└─────────────────────────────────────┘
```

Styling rules:
- Remote video: `width: 100%; height: 100vh; object-fit: cover; background: #111`
- Local self-view: `position: fixed; bottom: 100px; right: 20px; width: 200px; border-radius: 12px`
- Controls bar: `position: fixed; bottom: 0; width: 100%; z-index: 10; display: flex; justify-content: center; gap: 16px`

#### 2.4 — Create `CallControls.tsx` component

```tsx
// Props:
//   isMuted: boolean, onToggleMute: () => void
//   isCamOff: boolean, onToggleCam: () => void
//   onEndCall: () => void
// Renders three icon buttons — wired up but not functional yet
```

#### 2.5 — Implement UI state machine in `CallPage.tsx`

States (use a `callState` enum or union type):

| State | Trigger | UI |
|---|---|---|
| `idle` | Page load | Spinner + "Waiting for camera…" |
| `waiting` | Camera granted, 1 user in room | Local video + "Waiting for someone to join…" |
| `connected` | Peer joined | Both streams visible |
| `room_full` | WS sends room_full | Error card + Return Home button |
| `peer_left` | WS sends peer_left | Info card + Return Home button |
| `error` | Camera denied / WS fail | Error card + guidance text |

### Acceptance Criteria — Phase 2

- [ ] Camera permission prompt appears on page load
- [ ] Local video feed renders in the self-view tile (muted)
- [ ] Denying camera shows the error state with helpful text
- [ ] Controls bar is always visible at the bottom
- [ ] Navigating to `/call/<id>` with no peer shows "Waiting…" message
- [ ] Receiving `room_full` from WS renders the error state

---

## Phase 3 — Peer-to-Peer WebRTC Connection

**Goal:** Two users in the same room can see and hear each other via WebRTC.

### Frontend Tasks

#### 3.1 — Complete `useSignaling.ts`

- Receive `join` acknowledgement → signal to `useWebRTC` that a peer is present
- Forward `offer`, `answer`, `ice` messages to `useWebRTC`
- Expose: `sendSignal(msg)`, `peerPresent: boolean`, `onPeerLeft: callback`

#### 3.2 — Complete `useWebRTC.ts` with `simple-peer`

Full WebRTC lifecycle:

```ts
// When peerPresent becomes true:
//   Determine initiator: first joiner = initiator (server can signal this)
//
// Create peer = new SimplePeer({ initiator, stream: localStream, trickle: true })
//
// peer.on("signal", data => sendSignal({ type: "offer" | "ice", ...data }))
// peer.on("stream", remoteStream => setRemoteStream(remoteStream))
// peer.on("connect", () => setCallState("connected"))
// peer.on("close", () => setCallState("peer_left"))
// peer.on("error", err => setCallState("error"))
//
// On incoming signaling message: peer.signal(data)
//
// Cleanup: peer.destroy() on unmount
```

#### 3.3 — Wire remote stream into `CallPage.tsx`

- Pass `remoteStream` to the main `<VideoTile>` (full-screen tile)
- Transition `callState` to `connected` when remote stream arrives

#### 3.4 — Determine initiator role via signaling

The server should communicate who joined first. Two strategies:
- **Option A (simpler):** Server sends `{ type: "joined", initiator: true/false }` on join
- **Option B:** First user to join waits; second triggers offer. Implement via `peer_joined` server event.

> Recommended: Option A — add `initiator` field to the server's join acknowledgement.

### Acceptance Criteria — Phase 3

- [ ] User A joins; User B joins → both see each other's video within ~3 seconds on LAN
- [ ] Audio is audible in both directions
- [ ] WebRTC connection uses local network (no TURN needed for LAN testing)
- [ ] Browser DevTools → Network → WS shows offer/answer/ICE exchange
- [ ] `callState` transitions correctly: `waiting` → `connected`

---

## Phase 4 — Controls, Disconnection & Edge Cases

**Goal:** All call controls work correctly, and every edge case is handled gracefully.

### Frontend Tasks

#### 4.1 — Implement Mute toggle

```ts
// In useWebRTC.ts:
const toggleMute = () => {
  localStream.getAudioTracks().forEach(track => {
    track.enabled = !track.enabled;
  });
  setIsMuted(prev => !prev);
};
```

- UI: button label/icon updates to reflect state
- Remote peer hears silence (track disabled, not removed — no renegotiation needed)

#### 4.2 — Implement Camera toggle

```ts
const toggleCamera = () => {
  localStream.getVideoTracks().forEach(track => {
    track.enabled = !track.enabled;
  });
  setIsCamOff(prev => !prev);
};
```

- UI: local self-view shows a placeholder avatar/icon when cam is off
- Remote peer sees a black/frozen frame (track disabled)

#### 4.3 — Implement End Call

```ts
const endCall = () => {
  peer.destroy();
  localStream.getTracks().forEach(track => track.stop());
  ws.close();
  navigate("/");
};
```

- Stopping tracks releases the camera hardware (green indicator light turns off)
- WebSocket close triggers `peer_left` for the remote user

#### 4.4 — Handle `peer_left` gracefully

- Show the "The other participant has left the call." message
- Stop attempting reconnection
- Offer a **Return Home** button that navigates to `/`
- Stop the remote stream on the video element

#### 4.5 — Handle unexpected disconnection

- WebSocket `onerror` / `onclose` → show a reconnection message or error state
- `simple-peer` `error` event → log + show error UI

#### 4.6 — Cleanup on unmount

```ts
useEffect(() => {
  return () => {
    peer?.destroy();
    localStream?.getTracks().forEach(t => t.stop());
    ws?.close();
  };
}, []);
```

#### 4.7 — Loading and permission UX polish

- Show spinner during `idle` state with friendly copy: *"Getting your camera ready…"*
- If permission is denied: show instructions for re-enabling (browser-specific copy)
- If WS connection fails: show *"Could not connect to the call server. Please try again."*

### Acceptance Criteria — Phase 4

- [ ] Mute button silences local audio; unmuting restores it — no renegotiation
- [ ] Camera off hides local video; remote peer sees black — no renegotiation
- [ ] "End Call" stops all tracks, closes WS, and redirects to home
- [ ] Closing the tab (without clicking End) triggers `peer_left` for the other user
- [ ] `peer_left` message and Return Home button appear correctly
- [ ] No memory leaks — all streams, peers, and sockets are cleaned up on unmount

---

## Suggested File Creation Order

Work through files in this order to avoid broken imports at each step:

```
Phase 1:
  backend/routers/call.py
  backend/main.py            (register router)
  src/pages/CallPage.tsx     (shell, just routing + roomId redirect)
  src/hooks/useSignaling.ts  (skeleton — WS open/close only)

Phase 2:
  src/components/VideoTile.tsx
  src/components/CallControls.tsx
  src/hooks/useWebRTC.ts     (getUserMedia only)
  src/pages/CallPage.tsx     (full layout + state machine)

Phase 3:
  src/hooks/useSignaling.ts  (full — relay signals in/out)
  src/hooks/useWebRTC.ts     (full — simple-peer integration)
  src/pages/CallPage.tsx     (wire remoteStream into layout)
  backend/routers/call.py    (add initiator field to join ack)

Phase 4:
  src/hooks/useWebRTC.ts     (toggleMute, toggleCamera, endCall, cleanup)
  src/components/CallControls.tsx  (wire up handlers + visual states)
  src/pages/CallPage.tsx     (peer_left UI, error UI, polish)
```

---

## Testing Checklist (End-to-End)

Run these after Phase 4 is complete:

| # | Test | Expected |
|---|---|---|
| 1 | Open `/call/<id>` alone | See own camera, "Waiting…" message |
| 2 | Open same URL in second tab | Both tabs transition to `connected` |
| 3 | Open same URL in third tab | Third tab sees "room full" error |
| 4 | Click Mute on User A | User B hears nothing; button updates |
| 5 | Click Cam Off on User A | User B sees black; User A self-view shows placeholder |
| 6 | Click End Call on User A | User A → home; User B sees "participant left" |
| 7 | Close tab on User A | User B sees "participant left" |
| 8 | Deny camera permission | Error state with guidance text |
| 9 | Kill the backend server mid-call | Both clients show error/disconnection state |

---

## Out of Scope (for future phases)

- TURN server configuration (needed for calls across strict NATs / corporate networks)
- Screen sharing (`getDisplayMedia`)
- In-call text chat
- Recording
- Authentication / room access control
- Mobile responsive layout refinements
- Multi-participant (3+ users)