# Phase 03 — WebRTC Peer Connection, Remote Streams & Edge-Case Hardening

## Context & Gap Analysis

After Phases 01–02 the app has: native WebSocket signaling, room-based routing, local media capture, a polished call UI, and a state machine. What remains is the **core WebRTC data path** — the actual peer-to-peer video/audio exchange — plus every edge case the PRD requires.

| Area | State after Phase 02 | PRD Target |
|---|---|---|
| Peer connection | Not started | `simple-peer` integration with offer/answer/ICE via signaling |
| Remote stream | `null` placeholder | Live remote video + audio rendered in main tile |
| Initiator logic | Server sends `initiator` flag — unused | First joiner waits; second triggers offer |
| Trickle ICE | Old code used `trickle: false` | Must use `trickle: true` for faster connection |
| Mute / Cam toggle | Track enable/disable in `useWebRTC` | Already works locally; verify remote peer sees the change |
| End Call flow | Stops local tracks + navigates | Must also `peer.destroy()` + `ws.close()` |
| Peer left | State exists but nothing triggers it | `peer_left` WS message → UI card + cleanup |
| Unexpected disconnect | Not handled | WS error/close + `simple-peer` error → error UI |
| Cleanup on unmount | Partial | Destroy peer + stop tracks + close WS in one effect cleanup |
| Backend initiator ack | Server sends `initiator` field | Must also send `peer_joined` to first socket when second joins |

> **This phase delivers Roadmap Phases 3 + 4 completely and satisfies all PRD acceptance criteria.**

---

## Task 1 — Backend: Refine signaling for initiator & peer_joined

### File: `backend/app/modules/call/router.py`

Verify the following behaviours exist (they should from Phase 01 — fix if missing):

```python
# On second user joining a room:
# 1. Send to the SECOND socket:  {"type": "joined", "initiator": true}
# 2. Send to the FIRST socket:   {"type": "peer_joined"}
#
# On first user joining:
# 1. Send to the FIRST socket:   {"type": "joined", "initiator": false}
#
# These two signals are critical:
#   - "initiator": true/false  → tells simple-peer who creates the offer
#   - "peer_joined"            → tells the first user that a peer arrived
#                                 (so the non-initiator side can prepare)
```

**Relay refinement** — ensure ICE candidate messages relay the full payload:

```python
# When relaying "ice" type messages, the full JSON object must be forwarded.
# simple-peer sends: {"type": "candidate", "candidate": {...}}
# but our signaling wraps it:  {"type": "ice", "candidate": {...}}
#
# Best practice: relay the ENTIRE received JSON to the other peer.
# Do NOT cherry-pick fields — forward verbatim so simple-peer can parse it.
# For "offer" and "answer" types, simple-peer sends its own signal data
# structure that includes type + sdp. Forward the whole object.
```

No new files — only verify and patch `router.py` if the above is not correct.

---

## Task 2 — Complete `useSignaling.ts` for signal relay

### File: `frontend/src/hooks/useSignaling.ts`

Extend the hook from Phase 01 with outgoing signal support and fine-grained incoming message handling.

```typescript
// Updated interface:
// Input:  roomId: string
// Output: {
//   sendMessage: (msg: object) => void;
//   isConnected: boolean;
//   isInitiator: boolean | null;
//   peerJoined: boolean;          // NEW — true when "peer_joined" received
//   peerLeft: boolean;            // NEW — true when "peer_left" received
//   roomFull: boolean;            // NEW — true when "room_full" received
//   incomingSignal: object | null; // NEW — last offer/answer/ice signal received
//   connectionError: string | null;
// }

// Implementation updates:
//
// 1. Add state: peerJoined (boolean, default false)
// 2. Add state: peerLeft (boolean, default false)
// 3. Add state: roomFull (boolean, default false)
// 4. Add state: incomingSignal (any, default null)
//
// 5. In the onmessage handler, dispatch by type:
//    switch (msg.type) {
//      case "joined":
//        setIsInitiator(msg.initiator);
//        setIsConnected(true);
//        break;
//      case "peer_joined":
//        setPeerJoined(true);
//        break;
//      case "peer_left":
//        setPeerLeft(true);
//        break;
//      case "room_full":
//        setRoomFull(true);
//        break;
//      case "offer":
//      case "answer":
//      case "ice":
//        // Pass the entire message to the consumer
//        setIncomingSignal(msg);
//        break;
//    }
//
// 6. sendMessage(msg):
//    - JSON.stringify(msg) and ws.send()
//    - Guard: if ws is not open, log warning and return
//
// 7. Cleanup: on unmount, close the WebSocket

// Best practices:
// - incomingSignal must update on EVERY new signal (not dedup).
//   Use a counter or object identity trick to ensure useEffect consumers
//   always re-fire. Simplest: wrap in { data: msg, id: counter++ }
// - Expose a resetPeerLeft() if needed, or let CallPage manage resets.
```

---

## Task 3 — Complete `useWebRTC.ts` with simple-peer integration

### File: `frontend/src/hooks/useWebRTC.ts`

Extend the media-only hook from Phase 02 into the full WebRTC lifecycle.

```typescript
// Updated interface:
// Input: {
//   localStream: MediaStream | null;    // from the media part of this hook
//   isInitiator: boolean | null;        // from useSignaling
//   peerJoined: boolean;                // from useSignaling
//   incomingSignal: { data: any, id: number } | null;  // from useSignaling
//   sendMessage: (msg: object) => void; // from useSignaling
// }
// Output (add to existing): {
//   ...existing (localStream, mediaError, isMuted, isCamOff, toggleMute, toggleCamera, stopAllTracks)
//   remoteStream: MediaStream | null;   // NEW
//   peerConnected: boolean;             // NEW — true when peer.on("connect") fires
//   peerError: string | null;           // NEW
//   destroyPeer: () => void;            // NEW — clean teardown
// }

// ═══════════════════════════════════════════════════════════════
//  ARCHITECTURE DECISION: Single hook vs. two hooks
// ═══════════════════════════════════════════════════════════════
//  The PRD suggests useWebRTC handles both media and peer connection.
//  Keep them in ONE hook for simplicity, but separate the logic
//  into two internal sections:
//    Section A: getUserMedia (already done in Phase 02)
//    Section B: simple-peer lifecycle (this task)
// ═══════════════════════════════════════════════════════════════

// ── Section B: Peer connection lifecycle ──

// STEP 1: Create peer when conditions are met
//
// useEffect — trigger: localStream + (isInitiator === true) OR (peerJoined === true for non-initiator)
//
// Condition to create the peer:
//   IF localStream is available
//   AND peer does not already exist
//   AND one of:
//     a. isInitiator === true  (this user is the second joiner — create offer)
//     b. peerJoined === true AND isInitiator === false  (this user was first, peer just arrived)
//
// Create:
//   const peer = new SimplePeer({
//     initiator: isInitiator === true,
//     stream: localStream,
//     trickle: true,      // ← IMPORTANT: must be true for fast ICE
//     config: {
//       iceServers: [
//         { urls: "stun:stun.l.google.com:19302" },
//         { urls: "stun:stun1.l.google.com:19302" },
//       ],
//     },
//   });
//
// Store peer in useRef (not useState — avoids stale closures).

// STEP 2: Wire peer events
//
//   peer.on("signal", (signalData) => {
//     // signalData is the SDP or ICE candidate from simple-peer
//     // Determine the type and send via signaling:
//     if (signalData.type === "offer") {
//       sendMessage({ type: "offer", signalData });
//     } else if (signalData.type === "answer") {
//       sendMessage({ type: "answer", signalData });
//     } else if (signalData.candidate) {
//       sendMessage({ type: "ice", signalData });
//     }
//   });
//
//   peer.on("stream", (remoteStream: MediaStream) => {
//     setRemoteStream(remoteStream);
//   });
//
//   peer.on("connect", () => {
//     setPeerConnected(true);
//   });
//
//   peer.on("close", () => {
//     setRemoteStream(null);
//     setPeerConnected(false);
//   });
//
//   peer.on("error", (err: Error) => {
//     console.error("simple-peer error:", err);
//     setPeerError(err.message);
//   });

// STEP 3: Feed incoming signals to the peer
//
// useEffect — trigger: incomingSignal changes
//
//   if (incomingSignal && peerRef.current) {
//     const msg = incomingSignal.data;
//     // simple-peer expects the raw signal data:
//     //   For "offer"/"answer": msg.signalData  (contains { type, sdp })
//     //   For "ice": msg.signalData  (contains { candidate })
//     try {
//       peerRef.current.signal(msg.signalData);
//     } catch (err) {
//       console.error("Error feeding signal to peer:", err);
//     }
//   }
//
// EDGE CASE: If the peer is not yet created when an incoming signal arrives
//   (race condition — the offer arrives before the non-initiator creates the peer),
//   queue the signal and replay it once the peer is created.
//   Use a signalQueueRef = useRef<any[]>([]).
//   After creating the peer, drain the queue:
//     signalQueueRef.current.forEach(s => peer.signal(s));
//     signalQueueRef.current = [];

// STEP 4: destroyPeer()
//
//   const destroyPeer = useCallback(() => {
//     if (peerRef.current) {
//       peerRef.current.destroy();
//       peerRef.current = null;
//     }
//     setRemoteStream(null);
//     setPeerConnected(false);
//   }, []);

// STEP 5: Cleanup on unmount
//
//   useEffect cleanup:
//     destroyPeer();
//     stopAllTracks();

// Best practices:
// - NEVER store the Peer instance in useState — use useRef
// - trickle: true is essential for production-grade connection speed
// - Always include at least 2 STUN servers for NAT traversal
// - The signal queue handles the race condition where offer arrives
//   before the non-initiator peer is created
// - Log all peer events at debug level for troubleshooting
// - addStream is deprecated in simple-peer v9.11+; passing stream
//   in the constructor options is the correct approach
```

---

## Task 4 — Wire everything together in `CallPage.tsx`

### File: `frontend/src/pages/CallPage.tsx`

Update the page to integrate the completed hooks and deliver the full call experience.

```typescript
// Updated integration:
//
// 1. Hook usage:
//    const {
//      localStream, mediaError, isMuted, isCamOff,
//      toggleMute, toggleCamera, stopAllTracks,
//      remoteStream, peerConnected, peerError, destroyPeer,
//    } = useWebRTC({
//      localStream,        // pass through (or restructure hook to be self-contained)
//      isInitiator,
//      peerJoined,
//      incomingSignal,
//      sendMessage,
//    });
//
//    const {
//      sendMessage, isConnected, isInitiator,
//      peerJoined, peerLeft, roomFull, incomingSignal,
//      connectionError,
//    } = useSignaling(roomId!);
//
//    NOTE: There is a circular dependency between the two hooks
//    (useWebRTC needs sendMessage from useSignaling, useSignaling
//    output feeds useWebRTC). Resolve this by:
//
//    OPTION A (recommended): Make useWebRTC accept the signaling
//    outputs as parameters. The hooks are composed in CallPage:
//
//      const signaling = useSignaling(roomId!);
//      const webrtc = useWebRTC({
//        isInitiator: signaling.isInitiator,
//        peerJoined: signaling.peerJoined,
//        incomingSignal: signaling.incomingSignal,
//        sendMessage: signaling.sendMessage,
//      });
//
//    OPTION B: Merge into a single useCall(roomId) hook. Simpler
//    but less modular. Use if Option A becomes unwieldy.

// 2. State machine updates (refine from Phase 02):
//
//    useEffect to compute callState:
//
//    if (roomFull)                      → "room_full"
//    else if (mediaError)               → "error"
//    else if (peerLeft)                 → "peer_left"
//    else if (peerError)                → "error"
//    else if (peerConnected)            → "connected"
//    else if (localStream && isConnected) → "waiting"
//    else                               → "idle"
//
//    Priority order matters: room_full and error are terminal states
//    that override everything else.

// 3. Render updates:
//
//    "connected" state:
//      - Remote VideoTile (variant="main"):
//          stream = remoteStream   ← NOW has the live remote stream
//          muted = false           ← remote audio should be audible
//      - Local VideoTile (variant="pip"):
//          stream = localStream
//          muted = true
//          isCamOff = isCamOff
//      - CallControls: fully active, all handlers wired
//
//    "peer_left" state:
//      - Call destroyPeer() when entering this state
//      - Show overlay card:
//          "The other participant has left the call."
//          [Return Home] button → stopAllTracks() + navigate("/")

// 4. End Call handler (complete version):
//
//    const handleEndCall = useCallback(() => {
//      destroyPeer();
//      stopAllTracks();
//      navigate("/");
//    }, [destroyPeer, stopAllTracks, navigate]);

// 5. Copy room link:
//
//    In "waiting" state, display the full URL and provide a copy button:
//      const roomUrl = window.location.href;
//      const handleCopy = () => navigator.clipboard.writeText(roomUrl);
```

---

## Task 5 — Handle all edge cases

### File: `frontend/src/pages/CallPage.tsx` + `frontend/src/hooks/useWebRTC.ts`

Implement each edge case from the PRD:

```
┌──────────────────────────────────┬──────────────────────────────────────────────────────┐
│ Scenario                         │ Required Behaviour                                   │
├──────────────────────────────────┼──────────────────────────────────────────────────────┤
│ 1. Tab close (no End Call click) │ Browser closes WS → server sends peer_left to other  │
│                                  │ → Other user sees "participant left" card             │
│                                  │ Verify: useEffect cleanup must close WS               │
├──────────────────────────────────┼──────────────────────────────────────────────────────┤
│ 2. Backend server crash mid-call │ WS onclose fires → set connectionError               │
│                                  │ Show: "Connection to server lost. Please try again."  │
│                                  │ Destroy peer, stop tracks                             │
├──────────────────────────────────┼──────────────────────────────────────────────────────┤
│ 3. Camera denied after connect   │ mediaError set → callState = "error"                 │
│                                  │ Show browser-specific guidance text                   │
├──────────────────────────────────┼──────────────────────────────────────────────────────┤
│ 4. simple-peer error event       │ peer.on("error") → setPeerError(err.message)          │
│                                  │ callState = "error", show generic error card           │
├──────────────────────────────────┼──────────────────────────────────────────────────────┤
│ 5. Third user joins full room    │ Server sends room_full → roomFull = true              │
│                                  │ callState = "room_full", show error card               │
│                                  │ No peer or media resources allocated                   │
├──────────────────────────────────┼──────────────────────────────────────────────────────┤
│ 6. User navigates away (SPA)     │ useEffect cleanup in CallPage:                        │
│                                  │   destroyPeer() + stopAllTracks() + ws.close()        │
│                                  │ Verify: camera light turns off                        │
├──────────────────────────────────┼──────────────────────────────────────────────────────┤
│ 7. Browser beforeunload          │ Add window.addEventListener("beforeunload", cleanup)  │
│                                  │ Ensures tracks stop even on hard refresh               │
└──────────────────────────────────┴──────────────────────────────────────────────────────┘
```

### Implementation for beforeunload:

```typescript
// In CallPage.tsx:
useEffect(() => {
  const handleBeforeUnload = () => {
    destroyPeer();
    stopAllTracks();
  };
  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [destroyPeer, stopAllTracks]);
```

### Implementation for WS unexpected close:

```typescript
// In useSignaling.ts — ws.onclose handler:
ws.onclose = (event) => {
  setIsConnected(false);
  // Code 1000 = normal close (we called ws.close()), 1001 = page navigating away
  if (event.code !== 1000 && event.code !== 1001) {
    setConnectionError("CONNECTION_LOST");
  }
};

ws.onerror = () => {
  setConnectionError("CONNECTION_ERROR");
};
```

---

## Task 6 — Final cleanup & resource leak audit

### Checklist — apply to ALL hooks and CallPage:

```
Resource leak audit:
─────────────────────────────────────────────────────────────
✓ MediaStream tracks:
    - stopAllTracks() called in: endCall, peer_left handler, unmount cleanup, beforeunload
    - After stopAllTracks(), localStream state set to null

✓ simple-peer instance:
    - peer.destroy() called in: endCall, peer_left handler, unmount cleanup, beforeunload
    - After destroy, peerRef.current set to null

✓ WebSocket:
    - ws.close() called in: endCall, unmount cleanup
    - After close, wsRef.current set to null

✓ Event listeners:
    - beforeunload listener removed in useEffect cleanup

✓ Video elements:
    - srcObject set to null when stream changes to null (in VideoTile useEffect)

✓ State resets:
    - remoteStream, peerConnected, peerError reset on destroyPeer()
    - No stale state survives navigation to "/" and back to "/call/..."
```

---

## Verification Checklist — Full E2E (All PRD Acceptance Criteria)

Run these tests in order after this phase is complete. Use two browser tabs or two browser windows on the same machine (LAN).

| # | Test | Steps | Expected |
|---|---|---|---|
| 1 | Solo join | Open `/call/<id>` | See own camera, "Waiting for someone to join…", room link with copy button |
| 2 | Peer join | Open same URL in tab 2 | Both tabs transition to `connected`; both see each other's video within ~3s |
| 3 | Audio check | Speak in tab 1 | Audio audible in tab 2 (and vice versa) |
| 4 | Room full | Open same URL in tab 3 | Tab 3 sees "This call is already in progress" error card, Return Home button |
| 5 | Mute | Click mute in tab 1 | Button turns red; tab 2 hears silence; unmute restores audio |
| 6 | Camera off | Click cam-off in tab 1 | Tab 1 PiP shows placeholder; tab 2 sees black/frozen frame; re-enable restores |
| 7 | End Call | Click End in tab 1 | Tab 1 → navigates to home, camera light off; tab 2 sees "participant left" card |
| 8 | Tab close | Close tab 1 (no End click) | Tab 2 sees "The other participant has left the call" within ~2s |
| 9 | Camera denied | Deny camera permission | Error state: "Camera access was denied…" guidance text + Return Home |
| 10 | Server crash | Kill backend mid-call | Both tabs show error/disconnection state within ~5s |
| 11 | Navigate away | Click browser back button during call | Camera light turns off, no console errors, peer cleaned up |
| 12 | DevTools WS | Open Network → WS tab | See offer → answer → ICE candidate messages in correct sequence |

---

## Files Summary

| Action | File |
|---|---|
| **VERIFY/PATCH** | `backend/app/modules/call/router.py` (initiator + peer_joined + full relay) |
| **MODIFY** | `frontend/src/hooks/useSignaling.ts` (peerJoined, peerLeft, roomFull, incomingSignal, error handling) |
| **MODIFY** | `frontend/src/hooks/useWebRTC.ts` (simple-peer lifecycle, remoteStream, signal queue, destroyPeer) |
| **MODIFY** | `frontend/src/pages/CallPage.tsx` (wire remoteStream, complete state machine, edge cases, beforeunload) |
| **NO CHANGE** | `frontend/src/components/VideoTile.tsx` (already complete from Phase 02) |
| **NO CHANGE** | `frontend/src/components/CallControls.tsx` (already complete from Phase 02) |
| **NO CHANGE** | `frontend/src/pages/CallPage.css` (already complete from Phase 02) |
