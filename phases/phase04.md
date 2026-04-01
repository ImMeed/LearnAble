# Phase 04 — Production Polish: i18n, Auth Integration, TURN, Mobile & Quality of Life

## Context & Gap Analysis

Phases 01–03 deliver a **fully working 1-on-1 video call** on a local network. This phase bridges the gap between "works on localhost" and "production-ready feature integrated into the LearnAble platform."

| Area | State after Phase 03 | Production Target |
|---|---|---|
| Localisation (i18n) | All call UI strings are hardcoded English | AR/EN translations via `react-i18next`, respects app locale |
| Auth integration | Anyone with the URL can join | Only authenticated users can create/join calls |
| TURN server | STUN only — fails on strict NAT / mobile 4G | TURN fallback for reliable connectivity everywhere |
| Mobile responsive | Fixed `200px` PiP, 56px buttons | Touch-friendly, responsive layout for mobile viewports |
| Connection quality | No feedback | Visual indicator (good / fair / poor) based on ICE stats |
| Reconnection | None — any blip is fatal | Auto-reconnect on transient WS/ICE failures |
| Accessibility (a11y) | Minimal | Keyboard nav, screen reader labels, focus management |
| Backend logging | `print()` statements | Structured logging for debugging production calls |

---

## Task 1 — Internationalise all call page strings

### File: `frontend/src/app/i18n.ts` (or locale resource files)

Add the following translation keys to **both** AR and EN resource bundles:

```typescript
// EN translations to add:
{
  "call": {
    "gettingCamera": "Getting your camera ready…",
    "waitingForPeer": "Waiting for someone to join…",
    "connected": "Connected",
    "roomFull": "This call is already in progress",
    "roomFullDesc": "The maximum number of participants has been reached.",
    "peerLeft": "The other participant has left the call",
    "returnHome": "Return Home",
    "cameraDenied": "Camera access was denied. Please enable camera permissions in your browser settings.",
    "noDevice": "No camera or microphone found on this device.",
    "genericError": "Something went wrong. Please try again.",
    "connectionLost": "Connection to the call server was lost.",
    "copyLink": "Copy Link",
    "linkCopied": "Copied!",
    "shareLink": "Share this link to invite someone:",
    "mute": "Mute",
    "unmute": "Unmute",
    "cameraOn": "Turn camera on",
    "cameraOff": "Turn camera off",
    "endCall": "End call",
    "reconnecting": "Reconnecting…",
    "connectionQuality": {
      "good": "Connection: Good",
      "fair": "Connection: Fair",
      "poor": "Connection: Poor"
    }
  }
}
```

```typescript
// AR translations to add:
{
  "call": {
    "gettingCamera": "…جاري تجهيز الكاميرا",
    "waitingForPeer": "…في انتظار انضمام شخص آخر",
    "connected": "متصل",
    "roomFull": "هذه المكالمة قيد التقدم بالفعل",
    "roomFullDesc": ".تم الوصول إلى الحد الأقصى لعدد المشاركين",
    "peerLeft": "غادر المشارك الآخر المكالمة",
    "returnHome": "العودة للرئيسية",
    "cameraDenied": ".تم رفض الوصول إلى الكاميرا. يرجى تفعيل أذونات الكاميرا في إعدادات المتصفح",
    "noDevice": ".لم يتم العثور على كاميرا أو ميكروفون",
    "genericError": ".حدث خطأ ما. يرجى المحاولة مرة أخرى",
    "connectionLost": ".فُقد الاتصال بخادم المكالمة",
    "copyLink": "نسخ الرابط",
    "linkCopied": "!تم النسخ",
    "shareLink": ":شارك هذا الرابط لدعوة شخص",
    "mute": "كتم الصوت",
    "unmute": "إلغاء كتم الصوت",
    "cameraOn": "تشغيل الكاميرا",
    "cameraOff": "إيقاف الكاميرا",
    "endCall": "إنهاء المكالمة",
    "reconnecting": "…جاري إعادة الاتصال",
    "connectionQuality": {
      "good": "الاتصال: جيد",
      "fair": "الاتصال: متوسط",
      "poor": "الاتصال: ضعيف"
    }
  }
}
```

### File: `frontend/src/pages/CallPage.tsx`

Replace all hardcoded strings with `t("call.xxx")` calls:

```typescript
// Import and use:
import { useTranslation } from "react-i18next";

// Inside component:
const { t } = useTranslation();

// Example replacements:
// "Getting your camera ready…"    →  t("call.gettingCamera")
// "Waiting for someone to join…"  →  t("call.waitingForPeer")
// "Return Home"                   →  t("call.returnHome")
// etc.
```

### File: `frontend/src/components/CallControls.tsx`

Replace aria-labels with translated strings:

```typescript
// aria-label="Toggle microphone"  →  aria-label={t(isMuted ? "call.unmute" : "call.mute")}
// aria-label="Toggle camera"      →  aria-label={t(isCamOff ? "call.cameraOn" : "call.cameraOff")}
// aria-label="End call"           →  aria-label={t("call.endCall")}
```

### RTL layout consideration:

```css
/* In CallPage.css — PiP tile flips to bottom-LEFT in RTL */
[dir="rtl"] .video-tile--pip {
  right: auto;
  left: 20px;
}
```

---

## Task 2 — Authenticate call access

### Backend: `backend/app/modules/call/router.py`

Add optional token validation to the WebSocket endpoint. Since WebSocket handshakes don't support standard `Authorization` headers easily, use a **query parameter** approach:

```python
# Updated endpoint signature:
# @router.websocket("/ws/call/{room_id}")
# async def call_websocket(websocket: WebSocket, room_id: str, token: str = Query(None)):

# Implementation:
# 1. If token is provided:
#    - Validate using the existing security.decode_access_token() function
#    - If invalid → await websocket.close(code=4001, reason="Invalid token")
#    - If valid → proceed (optionally store user info with the socket)
# 2. If token is None:
#    - For MVP: allow anonymous access (so testing is easy)
#    - Add a config flag: REQUIRE_CALL_AUTH = os.getenv("REQUIRE_CALL_AUTH", "false")
#    - If "true" and no token → close with 4001
#
# Best practice: import from existing auth module:
from app.core.security import decode_access_token

# Store user identity alongside the socket for logging:
# rooms: dict[str, list[tuple[WebSocket, Optional[str]]]]  # (socket, user_id)
```

### Frontend: `frontend/src/hooks/useSignaling.ts`

Pass the auth token when connecting:

```typescript
// Updated WebSocket URL construction:
const session = getSession();  // from state/auth.ts
const tokenParam = session?.accessToken ? `?token=${session.accessToken}` : "";
const wsUrl = `ws://${window.location.hostname}:8000/ws/call/${roomId}${tokenParam}`;
const ws = new WebSocket(wsUrl);

// Handle auth rejection:
ws.onclose = (event) => {
  if (event.code === 4001) {
    setConnectionError("AUTH_REQUIRED");
  }
  // ... existing close handling
};
```

### Frontend: `frontend/src/pages/CallPage.tsx`

Add the `AUTH_REQUIRED` error state:

```typescript
// In the error state renderer:
if (connectionError === "AUTH_REQUIRED") {
  // Show: "You must be signed in to join a call."
  // Button: "Sign In" → navigate("/login") or equivalent
}
```

Add the translation keys:

```typescript
// EN: "call.authRequired": "You must be signed in to join a call."
// AR: "call.authRequired": ".يجب تسجيل الدخول للانضمام إلى المكالمة"
// EN: "call.signIn": "Sign In"
// AR: "call.signIn": "تسجيل الدخول"
```

---

## Task 3 — Add TURN server configuration

### File: `frontend/src/hooks/useWebRTC.ts`

Replace the hardcoded STUN-only ICE config with an environment-driven config that includes TURN:

```typescript
// ICE server configuration:
//
// 1. Read from environment variable (set in .env):
//    VITE_ICE_SERVERS — JSON string of ICE server configs
//
// 2. Fallback to default STUN-only if not set
//
// Implementation:

const getIceServers = (): RTCIceServer[] => {
  const envServers = import.meta.env.VITE_ICE_SERVERS;
  if (envServers) {
    try {
      return JSON.parse(envServers);
    } catch {
      console.warn("Invalid VITE_ICE_SERVERS, falling back to defaults");
    }
  }
  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
};

// Use in SimplePeer constructor:
const peer = new SimplePeer({
  initiator: isInitiator === true,
  stream: localStream,
  trickle: true,
  config: {
    iceServers: getIceServers(),
  },
});
```

### File: `frontend/.env.example`

Add documentation for the TURN server config:

```env
VITE_API_BASE_URL=http://localhost:8000

# ICE servers for WebRTC (JSON array). Include TURN for production.
# Example with free TURN (replace with your own for production):
# VITE_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:your-turn-server:3478","username":"user","credential":"pass"}]
```

> **Note for the implementing agent:** For production, the team should deploy a TURN server using [coturn](https://github.com/coturn/coturn) or use a managed service like Twilio Network Traversal or Cloudflare TURN. This config makes it a simple env var swap — no code change needed.

---

## Task 4 — Mobile responsive layout

### File: `frontend/src/pages/CallPage.css`

Add responsive breakpoints and touch-friendly sizing:

```css
/* ══════════════════════════════════════════════════
   Mobile responsive — screens < 768px
   ══════════════════════════════════════════════════ */

@media (max-width: 768px) {
  /* PiP tile: smaller and repositioned */
  .video-tile--pip {
    width: 120px;
    height: 90px;
    bottom: 90px;
    right: 12px;
    border-radius: 8px;
  }

  [dir="rtl"] .video-tile--pip {
    right: auto;
    left: 12px;
  }

  /* Controls bar: larger touch targets */
  .call-controls {
    gap: 12px;
    padding: 16px 12px;
  }

  .call-controls__btn {
    width: 52px;
    height: 52px;
    font-size: 1.2rem;
  }

  /* Overlay cards: full-width on small screens */
  .call-overlay__card {
    margin: 0 16px;
    padding: 1.5rem;
    max-width: none;
    width: calc(100% - 32px);
  }

  .call-overlay__title {
    font-size: 1.2rem;
  }

  /* Room link box: stack vertically */
  .call-waiting__link-box {
    flex-direction: column;
    text-align: center;
    gap: 0.5rem;
  }
}

/* ══════════════════════════════════════════════════
   Very small screens < 480px
   ══════════════════════════════════════════════════ */

@media (max-width: 480px) {
  .video-tile--pip {
    width: 100px;
    height: 75px;
    bottom: 85px;
    right: 8px;
  }

  [dir="rtl"] .video-tile--pip {
    right: auto;
    left: 8px;
  }

  .call-controls__btn {
    width: 48px;
    height: 48px;
    font-size: 1.1rem;
  }

  .call-controls {
    gap: 10px;
    padding: 12px 8px;
  }
}

/* ══════════════════════════════════════════════════
   Landscape on mobile (short viewport)
   ══════════════════════════════════════════════════ */

@media (max-height: 500px) and (orientation: landscape) {
  .video-tile--pip {
    width: 140px;
    height: 105px;
    bottom: 70px;
    right: 12px;
  }

  .call-controls {
    padding: 10px;
  }

  .call-controls__btn {
    width: 44px;
    height: 44px;
    font-size: 1rem;
  }
}

/* ══════════════════════════════════════════════════
   Touch feedback for mobile
   ══════════════════════════════════════════════════ */

@media (hover: none) and (pointer: coarse) {
  .call-controls__btn:active {
    transform: scale(0.92);
    transition: transform 0.1s ease;
  }

  /* Remove hover effects on touch devices (they stick) */
  .call-controls__btn:hover {
    transform: none;
    background: rgba(255, 255, 255, 0.15);
  }
  .call-controls__btn--danger:hover {
    background: #e74c3c;
    transform: none;
  }
}
```

### File: `frontend/src/pages/CallPage.tsx`

Add viewport meta tag enforcement (if not already in `index.html`):

```typescript
// In a useEffect, ensure the viewport meta tag exists:
useEffect(() => {
  let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "viewport";
    document.head.appendChild(meta);
  }
  meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";

  // Restore default on unmount (don't lock zoom on other pages)
  return () => {
    if (meta) meta.content = "width=device-width, initial-scale=1.0";
  };
}, []);
```

---

## Task 5 — Connection quality indicator

### File: `frontend/src/hooks/useConnectionQuality.ts` (NEW)

Create a hook that polls WebRTC stats to determine connection quality:

```typescript
// Interface:
// Input:  peerRef: React.RefObject<SimplePeer.Instance | null>
// Output: quality: "good" | "fair" | "poor" | null

// Implementation:
//
// 1. Set up an interval (every 2 seconds) when peer exists
// 2. Access the underlying RTCPeerConnection:
//      const pc = (peerRef.current as any)._pc as RTCPeerConnection;
//      (simple-peer exposes _pc as the raw RTCPeerConnection)
//
// 3. Call pc.getStats() to get RTCStatsReport
//
// 4. Find the active candidate-pair (type === "candidate-pair", state === "succeeded"):
//      - Extract: currentRoundTripTime (seconds)
//      - Extract: availableOutgoingBitrate (bps) — if available
//
// 5. Find inbound-rtp stats (type === "inbound-rtp", kind === "video"):
//      - Track packetsLost and packetsReceived across intervals
//      - Compute packet loss rate: lostDelta / (receivedDelta + lostDelta)
//
// 6. Classify quality:
//      "good":  RTT < 150ms  AND  packetLoss < 2%
//      "fair":  RTT < 400ms  AND  packetLoss < 5%
//      "poor":  everything else
//
// 7. Cleanup: clear interval on unmount or when peer is destroyed

// Best practices:
// - Guard against _pc being undefined (simple-peer may not expose it immediately)
// - Use useRef to store previous stats for delta computation
// - Don't poll if peerConnected is false
// - Return null when no data is available yet
```

### File: `frontend/src/components/ConnectionBadge.tsx` (NEW)

```typescript
// Props: { quality: "good" | "fair" | "poor" | null }
//
// Render a small pill/badge in the top-left of the call page:
//   "good" → green dot + text
//   "fair" → yellow dot + text
//   "poor" → red dot + animated pulse
//   null   → hidden
//
// Use translated labels: t("call.connectionQuality.good") etc.
```

### CSS additions to `CallPage.css`:

```css
.connection-badge {
  position: fixed;
  top: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.8);
  z-index: 6;
  transition: opacity 0.3s ease;
}

[dir="rtl"] .connection-badge {
  left: auto;
  right: 16px;
}

.connection-badge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.connection-badge__dot--good { background: #2ecc71; }
.connection-badge__dot--fair { background: #f39c12; }
.connection-badge__dot--poor {
  background: #e74c3c;
  animation: pulse 1s ease-in-out infinite;
}
```

### Wire into `CallPage.tsx`:

```typescript
// Only show when callState === "connected":
{callState === "connected" && <ConnectionBadge quality={connectionQuality} />}
```

---

## Task 6 — WebSocket auto-reconnect

### File: `frontend/src/hooks/useSignaling.ts`

Add automatic reconnection logic for transient WebSocket failures:

```typescript
// Reconnection strategy:
//
// 1. On unexpected ws.onclose (code !== 1000, code !== 1001):
//    - Set a "reconnecting" flag to true
//    - Attempt to reconnect with exponential backoff:
//      delays: [1s, 2s, 4s, 8s, 16s] → then give up
//    - Each attempt: create a new WebSocket to the same URL
//    - On successful reconnect: send "join" implicitly (server handles on connect)
//      Reset reconnect counter, set reconnecting = false
//    - After max attempts: set connectionError = "CONNECTION_LOST"
//
// 2. Expose new state:
//    isReconnecting: boolean
//
// 3. During reconnection:
//    - CallPage shows a subtle "Reconnecting…" banner (not a full error state)
//    - Peer connection may survive brief WS outages (ICE keeps the media flowing)

// Implementation skeleton:

const MAX_RECONNECT_ATTEMPTS = 5;
const reconnectAttemptRef = useRef(0);
const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const connect = useCallback(() => {
  const ws = new WebSocket(wsUrl);
  wsRef.current = ws;

  ws.onopen = () => {
    reconnectAttemptRef.current = 0;
    setIsReconnecting(false);
    setIsConnected(true);
  };

  ws.onclose = (event) => {
    setIsConnected(false);
    if (event.code !== 1000 && event.code !== 1001 && !intentionalCloseRef.current) {
      attemptReconnect();
    }
  };

  // ... existing onmessage, onerror
}, [wsUrl]);

const attemptReconnect = useCallback(() => {
  if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
    setConnectionError("CONNECTION_LOST");
    setIsReconnecting(false);
    return;
  }

  setIsReconnecting(true);
  const delay = Math.pow(2, reconnectAttemptRef.current) * 1000;
  reconnectAttemptRef.current += 1;

  reconnectTimeoutRef.current = setTimeout(() => {
    connect();
  }, delay);
}, [connect]);

// Cleanup:
// Clear reconnectTimeoutRef on unmount
// Set intentionalCloseRef = true before calling ws.close() in cleanup
```

### File: `frontend/src/pages/CallPage.tsx`

Show reconnection state:

```typescript
// Above the controls bar, show a thin banner when reconnecting:
{isReconnecting && (
  <div className="call-reconnecting-banner">
    <div className="call-spinner call-spinner--small" />
    <span>{t("call.reconnecting")}</span>
  </div>
)}
```

### CSS addition:

```css
.call-reconnecting-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  background: rgba(243, 156, 18, 0.9);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 500;
  z-index: 15;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}

.call-spinner--small {
  width: 16px;
  height: 16px;
  border-width: 2px;
}
```

---

## Task 7 — Accessibility (a11y) improvements

### File: `frontend/src/pages/CallPage.tsx`

```typescript
// 1. Focus management:
//    - When callState changes to "room_full", "peer_left", or "error",
//      auto-focus the primary action button ("Return Home") using useRef + .focus()
//    - This ensures keyboard & screen-reader users land on the actionable element

// 2. Live region for status changes:
//    <div role="status" aria-live="polite" className="sr-only">
//      {callState === "waiting" && t("call.waitingForPeer")}
//      {callState === "connected" && t("call.connected")}
//      {callState === "peer_left" && t("call.peerLeft")}
//    </div>

// 3. Keyboard shortcut hints (optional):
//    - M key → toggle mute
//    - V key → toggle camera
//    - Escape → end call (with confirmation)
//    useEffect(() => {
//      const handleKeyDown = (e: KeyboardEvent) => {
//        if (e.target instanceof HTMLInputElement) return; // don't capture in inputs
//        if (e.key === "m" || e.key === "M") toggleMute();
//        if (e.key === "v" || e.key === "V") toggleCamera();
//      };
//      window.addEventListener("keydown", handleKeyDown);
//      return () => window.removeEventListener("keydown", handleKeyDown);
//    }, [toggleMute, toggleCamera]);
```

### CSS — Screen reader only utility:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## Task 8 — Backend structured logging

### File: `backend/app/modules/call/router.py`

Replace all `print()` statements with structured logging:

```python
import logging

logger = logging.getLogger("learnable.call")

# Examples:
# On join:
logger.info("User joined room", extra={"room_id": room_id, "occupancy": len(rooms[room_id])})

# On relay:
logger.debug("Relaying signal", extra={"room_id": room_id, "type": msg_type})

# On disconnect:
logger.info("User left room", extra={"room_id": room_id, "remaining": len(rooms.get(room_id, []))})

# On room_full:
logger.warning("Room full, rejecting connection", extra={"room_id": room_id})
```

### File: `backend/app/main.py`

Ensure logging is configured in `create_app()`:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
```

---

## Verification Checklist — Full Production Readiness

| # | Test | Expected |
|---|---|---|
| 1 | Switch app to Arabic | All call page text renders in Arabic, PiP tile moves to left |
| 2 | Switch app to English | All call page text renders in English, PiP on right |
| 3 | Join call without auth token (dev mode) | Works normally (REQUIRE_CALL_AUTH=false) |
| 4 | Join call with invalid token (auth enforced) | WS closes with 4001, "Sign In" button shown |
| 5 | Open call page on mobile (Chrome DevTools device mode) | Layout adapts: smaller PiP, larger touch targets, no overflow |
| 6 | Rotate phone to landscape | Layout adjusts, controls remain accessible |
| 7 | TURN server configured in `.env` | Call works across different networks (test with mobile hotspot) |
| 8 | Kill backend for 3 seconds, restart | "Reconnecting…" banner appears, auto-reconnects, call resumes |
| 9 | Kill backend for 30+ seconds | After 5 attempts, shows "Connection lost" error |
| 10 | Connection quality badge | Shows green/yellow/red based on network conditions |
| 11 | Press M key during call | Toggles mute |
| 12 | Press V key during call | Toggles camera |
| 13 | Tab through controls with keyboard | All buttons focusable, aria-labels read by screen reader |
| 14 | Check backend logs during a call | Structured log lines with room_id, occupancy, signal types |
| 15 | `npm run build` | No errors, no warnings |
| 16 | `pip install -r requirements.txt` | Clean install |

---

## Files Summary

| Action | File |
|---|---|
| **MODIFY** | `frontend/src/app/i18n.ts` (or locale resource files) — add `call.*` translations |
| **MODIFY** | `frontend/src/pages/CallPage.tsx` — i18n, auth error state, quality badge, a11y, reconnect banner, keyboard shortcuts, viewport meta |
| **MODIFY** | `frontend/src/pages/CallPage.css` — mobile responsive, RTL, reconnect banner, connection badge, sr-only |
| **MODIFY** | `frontend/src/components/CallControls.tsx` — translated aria-labels |
| **MODIFY** | `frontend/src/hooks/useSignaling.ts` — auth token, auto-reconnect, isReconnecting |
| **MODIFY** | `frontend/src/hooks/useWebRTC.ts` — env-driven ICE servers with TURN support |
| **CREATE** | `frontend/src/hooks/useConnectionQuality.ts` — RTCStats polling hook |
| **CREATE** | `frontend/src/components/ConnectionBadge.tsx` — quality indicator pill |
| **MODIFY** | `frontend/.env.example` — document TURN server config |
| **MODIFY** | `backend/app/modules/call/router.py` — auth check, structured logging |
| **MODIFY** | `backend/app/main.py` — logging config |
