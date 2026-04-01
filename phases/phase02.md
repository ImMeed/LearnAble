# Phase 02 — Local Media, UI Layout & Call State Machine

## Context & Gap Analysis

After Phase 01, the signaling backbone and room routing are in place. The current `VideoCall.tsx` has **inline, unstyled video elements** and no proper state management. This phase delivers:

| Area | Current State | PRD Target |
|---|---|---|
| Local media hook | Inline `getUserMedia` in component | Dedicated `useWebRTC.ts` hook |
| UI layout | Side-by-side `<video>` tags, no styling | Full-screen remote + PiP self-view + controls bar |
| Call controls component | None | `CallControls.tsx` — mute/cam/end buttons |
| Video tile component | None | `VideoTile.tsx` — reusable `<video>` wrapper with placeholder |
| State machine | Boolean flags (`callAccepted`, `receivingCall`) | Explicit `CallState` enum with 6 states |
| Error handling | `console.error` only | User-facing error states (camera denied, WS fail) |
| CSS | None for call page | Dedicated `CallPage.css` with fullscreen layout |

> **This phase delivers Roadmap Phase 2 (Local Media & UI Shell) completely.**

---

## Task 1 — Create `VideoTile.tsx` component

### File: `frontend/src/components/VideoTile.tsx`

```typescript
// Props interface:
// {
//   stream: MediaStream | null;
//   muted: boolean;
//   label?: string;           // e.g. "You", "Remote"
//   variant: "main" | "pip";  // main = full-screen remote, pip = small self-view
//   isCamOff?: boolean;       // show avatar placeholder when true
// }

// Implementation requirements:
// 1. Render a <video> element wrapped in a container div
// 2. Use useRef for the video element
// 3. useEffect: when stream changes, set video.srcObject = stream
//    - If stream is null, set srcObject to null
// 4. video props: autoPlay, playsInline, muted={muted}
// 5. When stream is null OR isCamOff is true:
//    - Show a dark placeholder div with a user icon (use SVG or emoji 👤)
//    - Show label text centered
// 6. Styling via CSS classes:
//    - "video-tile" base class
//    - "video-tile--main" for full-screen variant
//    - "video-tile--pip" for picture-in-picture variant

// Best practices:
// - Use useEffect cleanup to remove srcObject reference
// - Set video.srcObject in effect, not as JSX attribute
// - Include object-fit: cover for natural video appearance
```

---

## Task 2 — Create `CallControls.tsx` component

### File: `frontend/src/components/CallControls.tsx`

```typescript
// Props interface:
// {
//   isMuted: boolean;
//   isCamOff: boolean;
//   onToggleMute: () => void;
//   onToggleCam: () => void;
//   onEndCall: () => void;
//   disabled?: boolean;  // disable controls before connected
// }

// Implementation requirements:
// 1. Render three circular icon buttons in a horizontal bar:
//    a. Mute/Unmute — icon changes based on isMuted
//       - Muted: 🔇 or mic-off SVG, red background
//       - Unmuted: 🎤 or mic-on SVG, default background
//    b. Camera On/Off — icon changes based on isCamOff
//       - Off: 📷 with slash or cam-off SVG, red background
//       - On: 📷 or cam-on SVG, default background
//    c. End Call — always red/destructive color
//       - Icon: ✕ or phone-off SVG
// 2. Each button:
//    - 56px circular shape
//    - Hover scale effect (transform: scale(1.1))
//    - Transition on background/transform
//    - aria-label for accessibility
// 3. Disabled state: reduce opacity, prevent clicks
// 4. Use CSS classes, not inline styles

// Best practices:
// - Use <button> elements (not divs) for accessibility
// - Include aria-label with descriptive text (e.g., "Toggle microphone")
// - Use CSS transitions for smooth state changes
```

---

## Task 3 — Create `useWebRTC.ts` hook (media-only for this phase)

### File: `frontend/src/hooks/useWebRTC.ts`

```typescript
// This phase: media access ONLY. WebRTC peer connection is Phase 03.

// Interface:
// Input: none
// Output: {
//   localStream: MediaStream | null;
//   mediaError: string | null;
//   isMuted: boolean;
//   isCamOff: boolean;
//   toggleMute: () => void;
//   toggleCamera: () => void;
//   stopAllTracks: () => void;
// }

// Implementation requirements:
// 1. On mount:
//    - Call navigator.mediaDevices.getUserMedia({ video: true, audio: true })
//    - Store result in localStream state
//    - On error:
//      a. NotAllowedError / PermissionDeniedError → set mediaError = "CAMERA_DENIED"
//      b. NotFoundError → set mediaError = "NO_DEVICE"
//      c. Other → set mediaError = "MEDIA_ERROR"
// 2. toggleMute():
//    - localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled)
//    - Flip isMuted state
//    - Guard: no-op if localStream is null
// 3. toggleCamera():
//    - localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled)
//    - Flip isCamOff state
//    - Guard: no-op if localStream is null
// 4. stopAllTracks():
//    - localStream.getTracks().forEach(t => t.stop())
//    - Set localStream to null
// 5. Cleanup on unmount:
//    - Stop all tracks (release hardware)

// Best practices:
// - Use useRef to avoid stale stream references in cleanup
// - getUserMedia should run once, not on every re-render
// - Use useCallback for toggle functions
// - Track.enabled = false disables without renegotiation (good for mute/cam)
// - Track.stop() releases hardware (only on end call / unmount)
```

---

## Task 4 — Build `CallPage.tsx` with full layout and state machine

### File: `frontend/src/pages/CallPage.tsx`

Rewrite the shell from Phase 01 into the full layout.

```typescript
// Implementation requirements:
// 1. URL handling (from Phase 01):
//    - Read roomId from useParams()
//    - If missing → generate UUID, redirect

// 2. Hook integration:
//    - const { localStream, mediaError, isMuted, isCamOff, toggleMute, toggleCamera, stopAllTracks } = useWebRTC()
//    - const { sendMessage, lastMessage, isConnected, isInitiator, connectionError } = useSignaling(roomId)

// 3. State machine — manage callState: CallState
//    Transitions:
//    - Initial: "idle"
//    - localStream acquired → "waiting"
//    - mediaError set → "error"
//    - connectionError === "room_full" → "room_full"
//    - lastMessage.type === "peer_joined" || "offer" → "connected" (Phase 03 will refine)
//    - lastMessage.type === "peer_left" → "peer_left"

// 4. Layout rendering based on callState:
//
//    "idle":
//      - Full-screen dark background
//      - Centered spinner/loader animation
//      - Text: "Getting your camera ready…"
//
//    "waiting":
//      - Remote VideoTile (variant="main") with null stream → dark placeholder
//      - Local VideoTile (variant="pip") with localStream → live camera
//      - Text overlay: "Waiting for someone to join…"
//      - Room link display with copy button (navigator.clipboard.writeText)
//      - CallControls (disabled except End Call)
//
//    "connected":
//      - Remote VideoTile (variant="main") with remoteStream (null for now, wired in Phase 03)
//      - Local VideoTile (variant="pip") with localStream
//      - CallControls (fully active)
//
//    "room_full":
//      - Centered error card
//      - Heading: "This call is already in progress"
//      - Text: "The maximum number of participants has been reached."
//      - "Return Home" button → navigate("/")
//
//    "peer_left":
//      - Centered info card
//      - Heading: "The other participant has left the call"
//      - "Return Home" button → navigate("/")
//
//    "error":
//      - Centered error card
//      - Dynamic message based on mediaError:
//        - "CAMERA_DENIED" → "Camera access was denied. Please enable camera permissions in your browser settings."
//        - "NO_DEVICE" → "No camera or microphone found."
//        - Other → "Something went wrong. Please try again."
//      - "Return Home" button

// 5. End call handler:
//    - Call stopAllTracks()
//    - Navigate to "/"
```

---

## Task 5 — Create `CallPage.css` stylesheet

### File: `frontend/src/pages/CallPage.css`

```css
/* Design specifications from the PRD: */

/* Root container */
.call-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0a0a0a;
  color: #ffffff;
  font-family: 'Inter', 'Noto Kufi Arabic', sans-serif;
}

/* ── Video tiles ── */

.video-tile { position: relative; overflow: hidden; background: #111; }
.video-tile video { width: 100%; height: 100%; object-fit: cover; display: block; }

.video-tile--main {
  width: 100%; height: 100vh;
}

.video-tile--pip {
  position: fixed;
  bottom: 100px; right: 20px;
  width: 200px; height: 150px;
  border-radius: 12px;
  border: 2px solid rgba(255,255,255,0.2);
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  z-index: 5;
  /* Optional: drag handle cursor, resize on hover */
}

/* Placeholder shown when stream is null or cam is off */
.video-tile__placeholder {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: #1a1a2e;
  color: rgba(255,255,255,0.5);
  font-size: 1rem;
}
.video-tile__placeholder-icon { font-size: 3rem; margin-bottom: 0.5rem; }

/* ── Controls bar ── */

.call-controls {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  display: flex; justify-content: center; align-items: center;
  gap: 16px;
  padding: 20px;
  z-index: 10;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
}

.call-controls__btn {
  width: 56px; height: 56px;
  border-radius: 50%;
  border: none;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.3rem;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.2s ease;
  background: rgba(255,255,255,0.15);
  color: #fff;
  backdrop-filter: blur(8px);
}
.call-controls__btn:hover { transform: scale(1.1); background: rgba(255,255,255,0.25); }
.call-controls__btn--active { background: rgba(255,255,255,0.15); }
.call-controls__btn--danger { background: #e74c3c; }
.call-controls__btn--danger:hover { background: #c0392b; transform: scale(1.1); }
.call-controls__btn--muted { background: #e74c3c; }
.call-controls__btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

/* ── Overlay states (waiting, error, room_full, peer_left) ── */

.call-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  z-index: 8;
  text-align: center;
  padding: 2rem;
}

.call-overlay__card {
  background: rgba(20, 20, 40, 0.85);
  backdrop-filter: blur(16px);
  border-radius: 20px;
  padding: 2rem 3rem;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

.call-overlay__title {
  font-size: 1.4rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.call-overlay__text {
  font-size: 0.95rem;
  color: rgba(255,255,255,0.7);
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.call-overlay__btn {
  padding: 0.65rem 1.5rem;
  border-radius: 10px;
  border: none;
  background: #00867b;
  color: #fff;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}
.call-overlay__btn:hover { background: #006e65; transform: translateY(-1px); }

/* ── Waiting state extras ── */

.call-waiting__link-box {
  margin-top: 1rem;
  background: rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 0.6rem 1rem;
  display: flex; align-items: center; gap: 0.5rem;
  font-family: monospace;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.6);
  word-break: break-all;
}
.call-waiting__copy-btn {
  background: rgba(255,255,255,0.15);
  border: none; border-radius: 6px;
  color: #fff; padding: 0.3rem 0.6rem;
  cursor: pointer; white-space: nowrap;
  font-size: 0.8rem;
}
.call-waiting__copy-btn:hover { background: rgba(255,255,255,0.25); }

/* ── Spinner (idle state) ── */

@keyframes spin { to { transform: rotate(360deg); } }
.call-spinner {
  width: 48px; height: 48px;
  border: 3px solid rgba(255,255,255,0.15);
  border-top-color: #00867b;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

/* ── Pulse dot for "waiting" indicator ── */

@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
.call-pulse-dot {
  width: 10px; height: 10px;
  background: #00867b;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
  display: inline-block;
  margin-right: 0.5rem;
}
```

> Import this CSS in `CallPage.tsx`: `import './CallPage.css';`

---

## Task 6 — Delete the old `VideoCall.tsx`

### File: `frontend/src/pages/VideoCall.tsx`
- **Delete** this file entirely

### File: `frontend/src/app/router.tsx`
- **Remove** the import: `import VideoCall from "../pages/VideoCall";`
- **Remove** the routes: `/ar/videocall`, `/en/videocall`, `/videocall`
- **Ensure** the new `/call/:roomId` and `/call` routes are present (from Phase 01)

---

## Verification Checklist

After completing this phase, verify each item:

- [ ] **Camera prompt** appears when navigating to `/call/<any-id>`
- [ ] **Local video** renders in the PiP tile (bottom-right, small, rounded)
- [ ] **Denying camera** shows the error state with browser-specific guidance
- [ ] **"Waiting for someone to join…"** text + pulse dot shows when alone in room
- [ ] **Room link** is displayed with a working copy button
- [ ] **Controls bar** is visible at the bottom — mute/cam buttons toggle state visually
- [ ] **Mute toggle** disables the local audio track (verify in DevTools → `stream.getAudioTracks()[0].enabled`)
- [ ] **Camera toggle** disables the local video track (local PiP shows placeholder)
- [ ] **End Call** stops tracks, navigates to home
- [ ] **`room_full`** WebSocket message renders the error card with Return Home button
- [ ] **Old `/videocall` routes** are gone, old `VideoCall.tsx` deleted
- [ ] **No inline styles** remain — all styling via `CallPage.css`
- [ ] **`npm run build`** succeeds without errors

---

## Files Summary

| Action | File |
|---|---|
| **CREATE** | `frontend/src/components/VideoTile.tsx` |
| **CREATE** | `frontend/src/components/CallControls.tsx` |
| **CREATE** | `frontend/src/hooks/useWebRTC.ts` (media only) |
| **CREATE** | `frontend/src/pages/CallPage.css` |
| **MODIFY** | `frontend/src/pages/CallPage.tsx` (full layout + state machine) |
| **DELETE** | `frontend/src/pages/VideoCall.tsx` |
| **MODIFY** | `frontend/src/app/router.tsx` (remove old videocall routes) |
