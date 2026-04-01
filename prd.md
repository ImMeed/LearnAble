# PRD: 1-on-1 Video Call Feature

## Overview

Add a dedicated video call page to the existing app that enables two users to join a real-time, peer-to-peer video call via a shared room link. No third-party paid services — built on open web standards (WebRTC) with a lightweight signaling layer on the FastAPI backend.

---

## Tech Stack Alignment

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | FastAPI (Python) |
| Database | PostgreSQL |
| Real-time signaling | WebSockets (via FastAPI) |
| Media transport | WebRTC (browser-native, no extra cost) |
| WebRTC abstraction | `simple-peer` (npm) |

---

## Libraries to Install

### Frontend (npm)

```bash
npm install simple-peer
npm install uuid
npm install @types/simple-peer -D
```

- **`simple-peer`** — thin WebRTC wrapper that handles offer/answer/ICE negotiation
- **`uuid`** — generate unique room IDs on the client

### Backend (pip)

```bash
pip install websockets
```

FastAPI already supports WebSockets natively via `starlette` — no extra package needed beyond ensuring `websockets` is installed as the underlying transport.

---

## New Page

**Route:** `/call/:roomId`

**File to create:** `src/pages/CallPage.tsx`

Add the route to your router:

```tsx
<Route path="/call/:roomId" element={<CallPage />} />
```

---

## Functional Requirements

### FR-1: Room Creation
- Any user can navigate to `/call` (no roomId) and be redirected to `/call/<uuid>` automatically.
- The generated roomId is the shareable link identifier.

### FR-2: Room Joining
- A second user opens the same `/call/:roomId` URL to join.
- Maximum occupancy: **2 participants**. If a third user tries to join, show an error message: *"This call is already in progress."*

### FR-3: Local Video Preview
- On page load, request camera + microphone permissions (`getUserMedia`).
- Show the local video stream in a small self-view tile (muted to avoid echo).

### FR-4: Peer-to-Peer Connection
- Once both participants are in the room, establish a WebRTC connection via `simple-peer`.
- Display the remote participant's video stream full-screen (or in the main tile).

### FR-5: Call Controls
Three controls, always visible at the bottom of the screen:
1. **Mute / Unmute** — toggle local audio track
2. **Camera On / Off** — toggle local video track
3. **End Call** — close the peer connection, stop media tracks, redirect to `/` (home)

### FR-6: Disconnection Handling
- If the remote peer leaves or closes the tab, show a message: *"The other participant has left the call."*
- Offer a **"Return Home"** button.

---

## Backend Requirements

### WebSocket Signaling Server

**Endpoint:** `ws://<host>/ws/call/{roomId}`

The signaling server is a **relay only** — it does not process media. It passes WebRTC signaling messages (offer, answer, ICE candidates) between the two peers in the same room.

#### Signaling Message Types

```json
{ "type": "join",      "roomId": "string" }
{ "type": "offer",     "sdp": "..."       }
{ "type": "answer",    "sdp": "..."       }
{ "type": "ice",       "candidate": "..."  }
{ "type": "peer_left"                     }
{ "type": "room_full"                     }
```

#### Server Logic

1. Maintain an in-memory dict: `rooms: dict[str, list[WebSocket]]`
2. On `join`: add the socket to the room. If room already has 2 sockets, send `room_full` and close.
3. On any other message type: forward the raw message to the **other** socket in the room.
4. On disconnect: remove socket from room, send `peer_left` to the remaining socket.

> **Note:** Room state is in-memory only — no PostgreSQL interaction needed for the MVP.

---

## Page Layout

```
┌─────────────────────────────────────┐
│                                     │
│        Remote Video (main)          │
│                                     │
│                      ┌──────────┐   │
│                      │Local View│   │
│                      └──────────┘   │
│                                     │
│   [ 🎤 Mute ]  [ 📷 Cam ]  [ ✕ End ]│
└─────────────────────────────────────┘
```

- Remote video: full-width, dark background fallback when no stream yet
- Local self-view: fixed small tile, bottom-right corner, picture-in-picture style
- Controls bar: centered at the bottom, always on top (`z-index`)

---

## States to Handle in the UI

| State | What to Show |
|---|---|
| `idle` | "Waiting for camera permissions…" spinner |
| `waiting` | Local video visible, "Waiting for the other person to join…" |
| `connected` | Both streams visible, controls active |
| `room_full` | Error message, return home button |
| `peer_left` | "The other participant has left." + return home |
| `error` | Generic error (camera denied, etc.) + guidance text |

---

## Out of Scope (MVP)

- Screen sharing
- Recording
- Chat during call
- Authentication / call access control
- TURN server setup (calls will work on same network or simple NAT; a TURN server can be added later for production reliability)

---

## Suggested File Structure

```
src/
  pages/
    CallPage.tsx          ← new page (all call logic lives here)
  hooks/
    useWebRTC.ts          ← custom hook: peer connection + stream management
    useSignaling.ts       ← custom hook: WebSocket signaling
  components/
    VideoTile.tsx         ← reusable <video> wrapper
    CallControls.tsx      ← mute / cam / end buttons

backend/
  routers/
    call.py               ← WebSocket endpoint + room management
  main.py                 ← register the call router
```

---

## Acceptance Criteria

- [ ] User A opens `/call/<roomId>` and sees their own camera feed.
- [ ] User B opens the same URL; both see each other's video within ~3 seconds on a local network.
- [ ] Mute toggles audio; camera toggle turns video on/off for the remote peer.
- [ ] Clicking "End Call" stops all tracks and redirects both users.
- [ ] A third user attempting to join sees the "room full" error.
- [ ] If one peer closes the tab, the other sees the "participant left" message.