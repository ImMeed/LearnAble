# PRD: Sustained Attention Score (Behavioral Engagement Index)
### LearnAble Platform — MVP Feature

**Version:** 1.1  
**Status:** Ready for Development  
**Scope:** MVP — Real-time only, no persistence, no auth dependency, role selected client-side  

---

## Table of Contents

1. [Overview](#1-overview)
2. [User Stories](#2-user-stories)
3. [System Architecture](#3-system-architecture)
4. [Detailed Technical Design](#4-detailed-technical-design)
5. [Data Flow](#5-data-flow)
6. [Backend Design](#6-backend-design)
7. [UI/UX Requirements](#7-uiux-requirements)
8. [Privacy & Ethics](#8-privacy--ethics)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Future Improvements](#10-future-improvements)

---

## 1. Overview

### Problem Definition

Students with ADHD and dyslexia struggle to maintain sustained visual attention during online learning sessions. Teachers conducting 1-on-1 video calls currently have no objective signal to know whether a student aged 6–15 is cognitively engaged or has drifted — they rely entirely on subjective observation while simultaneously teaching.

This leads to missed distraction windows, inconsistent session quality, and no actionable feedback loop for the teacher in the moment.

### Why This Feature Matters for ADHD/Dyslexia

- **ADHD** is characterised by difficulty sustaining attention, impulse-driven gaze shifts, and high fidget/movement rates. Head movement frequency and gaze instability are observable proxies for these behaviours.
- **Dyslexia** often co-occurs with visual attention deficits. Students may appear to look at the screen while their visual attention has shifted internally. Eye openness and blink rate changes signal cognitive fatigue during reading-heavy tasks.
- A lightweight, real-time indicator gives teachers a low-intrusion tool to adapt pacing, re-engage the student, or note patterns — without stopping the lesson.

### What This Feature Does NOT Do

- ❌ No emotion detection (no anxiety, stress, or mood inference)
- ❌ No raw video recording or storage
- ❌ No clinical diagnosis or psychological assessment
- ❌ No data persisted after the call ends (MVP scope)

---

## 2. User Stories

### Teacher

> *"As a teacher, I want to see a live attention indicator overlaid on the student's video tile so that I can immediately notice when the student has lost focus and re-engage them without interrupting the lesson flow."*

> *"As a teacher, I want a color-coded status (green / yellow / red) with a percentage score so that I can understand attention quality at a glance without reading detailed data."*

> *"As a teacher, I want a subtle popup alert when the student has been distracted for too long so that I don't have to constantly watch the indicator — I can focus on teaching."*

> *"As a teacher, I want to scroll to a second panel during the call that shows a live attention timeline graph so that I can see whether attention is improving or declining over the session."*

### Parent *(future scope — no UI in MVP)*

> *"As a parent, I want to eventually receive a session summary so that I understand how my child engaged during the lesson."*

### Psychologist *(future scope — no UI in MVP)*

> *"As a psychologist, I want access to longitudinal attention trend data so that I can correlate session engagement with clinical observations."*

---

## 3. System Architecture

### High-Level Overview

```
┌─────────────────────────────────┐        ┌──────────────────────────────────┐
│         STUDENT BROWSER         │        │         TEACHER BROWSER          │
│                                 │        │                                  │
│  Camera → MediaPipe Face Mesh   │        │  Receives WebRTC video stream    │
│  (every 3–5 seconds)            │        │                                  │
│                                 │        │  Receives metrics JSON via        │
│  Computes:                      │──WS──▶ │  existing WebSocket              │
│  - face_presence                │        │                                  │
│  - head_pose (yaw/pitch)        │        │  Renders:                        │
│  - gaze_direction               │        │  - Overlay on student video tile │
│  - eye_openness                 │        │  - Color indicator + % score     │
│  - blink_rate                   │        │  - Live timeline graph (panel 2) │
│  - attention_score              │        │  - Distraction popup alert       │
│                                 │        │                                  │
│  Sends: { metrics JSON }        │        │  No processing — display only    │
└─────────────────────────────────┘        └──────────────────────────────────┘
                                                         │
                                               No backend calls (MVP)
                                               All state is in-memory
                                               Gone when call ends
```

### Role Resolution (No Auth)

Since there is no authentication system, roles are selected manually before the call starts via a **Role Picker screen**. This is the only mechanism distinguishing a teacher from a student in MVP.

**Flow:**
```
User opens /call/:roomId
        │
        ▼
┌───────────────────────┐
│   Who are you?        │
│                       │
│  [ 🧑‍🏫 Teacher ]       │
│  [ 🧒  Student ]       │
└───────────────────────┘
        │
        ▼
Role stored in React local state (never sent to backend)
        │
   ┌────┴────┐
Teacher    Student
   │           │
Renders     Runs
attention   MediaPipe
UI only     + sends metrics
```

**Rules:**
- Role is free to pick — no PIN, no validation (dev MVP scope)
- Role is scoped to the browser tab only — lost on refresh
- If two users both pick "Teacher", neither runs MediaPipe — no metrics flow (acceptable for MVP)
- If two users both pick "Student", both run MediaPipe but neither sees the UI — acceptable edge case for MVP

**New component:** `RolePickerScreen.tsx` — shown before the call starts, after room is joined.

---

### Component Responsibilities

| Component | Responsibility |
|---|---|
| `RolePickerScreen.tsx` | Shown before call UI — user selects Teacher or Student, sets role in local state |
| `StudentAttentionProcessor.ts` | Runs MediaPipe, extracts signals, computes score, emits via WebSocket |
| `useAttentionProcessor` hook | Manages frame sampling loop, MediaPipe lifecycle |
| `useAttentionReceiver` hook | Teacher side — receives and buffers incoming metrics |
| `AttentionOverlay.tsx` | Renders the indicator overlay on the student video tile |
| `AttentionPanel.tsx` | Advanced panel 2 — live timeline graph |
| Existing WebSocket | Carries metrics JSON messages alongside existing signaling |

---

## 4. Detailed Technical Design

### 4.1 Frame Capture

**Where:** Student's browser only. No frames leave the device.

**How:**

```typescript
// Draw current video frame onto an offscreen canvas
const canvas = document.createElement('canvas');
canvas.width = 320;   // downsample for performance
canvas.height = 240;
const ctx = canvas.getContext('2d')!;

// Called every 3–5 seconds via setInterval
function captureFrame(videoElement: HTMLVideoElement) {
  ctx.drawImage(videoElement, 0, 0, 320, 240);
  return canvas; // pass to MediaPipe
}
```

**Why 320×240:** MediaPipe Face Mesh works well at low resolution. Higher resolution wastes CPU with no accuracy benefit for this use case.

**Sampling rate:** Every **4 seconds** (balanced between 3 and 5 — smooth enough for a live indicator, light enough for a 6-year-old's tablet).

---

### 4.2 Computer Vision Processing — MediaPipe Face Mesh

**Library:** `@mediapipe/face_mesh` + `@mediapipe/camera_utils`

```bash
npm install @mediapipe/face_mesh @mediapipe/camera_utils
```

**Model used:** `FaceMesh` with **iris refinement enabled** (`refineLandmarks: true`)  
This gives 478 landmarks (468 face + 10 iris landmarks per eye).

**Initialisation (run once on call start):**

```typescript
import { FaceMesh } from '@mediapipe/face_mesh';

const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,   // enables iris tracking
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

faceMesh.onResults(handleResults);
```

**Key landmark indices used:**

| Signal | Landmarks |
|---|---|
| Face presence | Any result returned (boolean) |
| Head yaw (left/right turn) | Nose tip (1), left ear (234), right ear (454) |
| Head pitch (up/down tilt) | Nose tip (1), chin (152), forehead (10) |
| Eye openness (left) | Upper lid (159), lower lid (145) |
| Eye openness (right) | Upper lid (386), lower lid (374) |
| Iris position (left) | Iris center (468), eye corners (133, 33) |
| Iris position (right) | Iris center (473), eye corners (362, 263) |

---

### 4.3 Feature Extraction

All features are computed per frame, then smoothed over a rolling window.

#### `face_presence` — Boolean

```
face_presence = true if FaceMesh returns at least 1 result, else false
```

#### `head_yaw` — Degrees, left/right rotation

Estimated from the horizontal asymmetry between nose tip and ear landmarks.  
Threshold: `|yaw| > 25°` = looking away horizontally.

#### `head_pitch` — Degrees, up/down tilt

Estimated from vertical ratio of nose-to-chin vs nose-to-forehead distance.  
Threshold: `pitch < -20°` = looking down (at desk/phone).

#### `eye_openness_ratio` — Float 0.0–1.0

```
eye_openness = vertical_eye_distance / horizontal_eye_width
```

Averaged across both eyes. Values below **0.15** indicate closed or nearly-closed eyes.

#### `blink_rate` — Blinks per minute

Track transitions: `eye_openness < 0.10` for < 400ms = one blink.  
Normal rate: 12–20 bpm. Rate > 30 bpm = fatigue signal.

#### `iris_deviation` — Float 0.0–1.0

```
iris_deviation = |iris_center_x - eye_center_x| / eye_width
```

0.0 = looking straight ahead. > 0.35 = gaze shifted significantly left or right.  
Only used as a **supporting signal**, not primary — degrades with glasses and poor lighting.

---

### 4.4 Attention Score Calculation

A **weighted rule-based formula** — no ML model needed for MVP.

#### Per-frame raw attention score:

```
raw_score = (
  w1 * face_presence_score      +   # 0 or 1
  w2 * head_orientation_score   +   # 1 if within threshold, 0 if outside
  w3 * eye_openness_score       +   # normalised 0–1
  w4 * iris_direction_score         # 1 if centered, 0 if deviated
)
```

#### Weights (tunable):

| Signal | Weight | Rationale |
|---|---|---|
| `face_presence` | **0.35** | Highest — face must be visible |
| `head_orientation` | **0.35** | Strong proxy for visual attention in kids |
| `eye_openness` | **0.20** | Fatigue / drowsiness signal |
| `iris_deviation` | **0.10** | Supporting signal only — less reliable |

**Total weights sum to 1.0.**

#### Sub-score definitions:

```
face_presence_score     = 1.0 if face detected, else 0.0

head_orientation_score  = 1.0 if |yaw| ≤ 25° AND pitch ≥ -20°
                        = 0.5 if one threshold exceeded
                        = 0.0 if both exceeded

eye_openness_score      = clamp(eye_openness_ratio / 0.30, 0, 1)
                          (normalises to 1.0 at fully open)

iris_direction_score    = 1.0 if iris_deviation ≤ 0.25
                        = 0.5 if iris_deviation ≤ 0.40
                        = 0.0 if iris_deviation > 0.40
```

#### Final displayed score (smoothed):

```
attention_score(t) = 0.7 * attention_score(t-1) + 0.3 * raw_score(t)
```

This exponential moving average prevents the score from jumping around every frame.

#### Focus Label:

```
score ≥ 70%  →  🟢 High Focus
score 40–69% →  🟡 Moderate Focus
score < 40%  →  🔴 Low Focus
```

---

### 4.5 Temporal Aggregation (Live Timeline)

Every 4 seconds, a new data point is appended to an in-memory array:

```typescript
type AttentionDataPoint = {
  timestamp: number;       // seconds since call start
  score: number;           // 0–100
  label: 'high' | 'moderate' | 'low';
  distraction: boolean;    // true if alert was triggered this interval
};

const timeline: AttentionDataPoint[] = [];
```

This array powers the live graph in Panel 2. Maximum 900 points (1 hour session at 4s intervals). Array is cleared when the call ends.

---

## 5. Data Flow

```
Student Camera
     │
     ▼ (every 4 seconds)
Offscreen Canvas (320×240)
     │
     ▼
MediaPipe Face Mesh
     │
     ▼
Feature Extraction
  ├─ face_presence
  ├─ head_yaw / head_pitch
  ├─ eye_openness_ratio
  ├─ blink_rate
  └─ iris_deviation
     │
     ▼
Attention Score Formula
  └─ raw_score → smoothed score (0–100)
     │
     ▼
Distraction Check
  └─ if score < 40 for 2+ consecutive intervals → flag distraction
     │
     ▼
WebSocket Message (existing channel)
  └─ { type: "attention_metrics", score, label, distraction, timestamp }
     │
     ▼  (teacher's browser receives)
Teacher UI State (in-memory only)
  ├─ Current score → Overlay indicator
  ├─ Label → Color (green/yellow/red)
  ├─ Distraction flag → Popup alert
  └─ Timeline array → Live graph (Panel 2)
     │
     ▼
Call Ends → All state cleared, nothing persisted
```

---

## 6. Backend Design

### MVP Scope: No backend involvement

All attention processing and display is handled entirely client-side. The existing WebSocket connection carries the metrics messages between student and teacher browsers — no new backend endpoints are required for MVP.

### WebSocket Message Format

The student browser sends this message type through the existing WebSocket channel:

```json
{
  "type": "attention_metrics",
  "payload": {
    "score": 78,
    "label": "high",
    "distraction": false,
    "signals": {
      "face_present": true,
      "head_yaw": 8.2,
      "head_pitch": -5.1,
      "eye_openness": 0.31,
      "blink_rate": 16,
      "iris_deviation": 0.18
    },
    "timestamp": 142
  }
}
```

The teacher browser filters for `type === "attention_metrics"` and updates local React state. All other message types (WebRTC signaling etc.) are unaffected.

### Future Backend (when DB is added)

When the database is implemented, add these endpoints:

```
POST /api/sessions/{session_id}/attention
  Body: { student_id, teacher_id, duration_seconds, avg_score, timeline[] }
  → Store aggregated session summary

GET /api/sessions/{session_id}/attention
  → Retrieve attention summary for a session

GET /api/students/{student_id}/attention/history
  → Longitudinal attention trend for a student
```

Schema (PostgreSQL, for future reference):

```sql
CREATE TABLE attention_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL,
  student_id      UUID NOT NULL,
  teacher_id      UUID NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL,
  duration_sec    INTEGER NOT NULL,
  avg_score       FLOAT NOT NULL,
  high_focus_pct  FLOAT,
  mod_focus_pct   FLOAT,
  low_focus_pct   FLOAT,
  distraction_count INTEGER,
  timeline        JSONB,          -- array of AttentionDataPoint
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. UI/UX Requirements

### Panel 1 — Attention Overlay (on student video tile)

Displayed as a minimal overlay at the bottom of the student's video tile, always visible during the call.

```
┌────────────────────────────────────┐
│                                    │
│        [Student Video Feed]        │
│                                    │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  🟢  High Focus     82%      │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

- **Color dot:** Green / Yellow / Red based on label
- **Label text:** "High Focus" / "Moderate Focus" / "Low Focus"
- **Percentage:** Current smoothed score
- **Background:** Semi-transparent dark bar (does not block the video)
- **Update frequency:** Every 4 seconds (smooth transition, not a hard jump)

---

### Distraction Alert

Triggered when: `score < 40` for **2 consecutive intervals** (8 seconds of low focus).  
Dismissed automatically after 6 seconds, or on teacher click.

```
┌─────────────────────────────────────┐
│  ⚠️  Student appears distracted     │
│      Focus dropped below threshold  │
│                              [Dismiss] │
└─────────────────────────────────────┘
```

- Position: Top-right corner of the call view
- Style: Subtle dark popup, non-blocking
- No sound — color change + text only
- Does not repeat for the same distraction event (cooldown: 30 seconds)

---

### Panel 2 — Live Attention Timeline (scrollable / switchable)

Teacher can tap/click a "Details" button on the overlay to switch to Panel 2.

```
┌──────────────────────────────────────────────────┐
│  Attention Timeline                    [← Back]  │
│                                                  │
│  100% ┤                                          │
│       │   ▁▂▃▄▅▆▅▄▃▄▅▆▇▆▅▄▃▂▃▄▅▆▅▆▇▆▅           │
│   50% ┤                                          │
│       │                                          │
│    0% ┤──────────────────────────────────────    │
│       0s        5min       10min       15min     │
│                                                  │
│  ● High Focus   ● Moderate   ● Low               │
└──────────────────────────────────────────────────┘
```

- X-axis: Time elapsed since call start
- Y-axis: Attention score 0–100%
- Line color changes based on score zone (green/yellow/red)
- Distraction events shown as small red markers on the line
- Rendered using **Recharts** (already common in React projects, lightweight)

```bash
npm install recharts
```

---

## 8. Privacy & Ethics

### No Video Storage

- Raw video frames are captured onto an offscreen canvas in the student's browser and immediately discarded after MediaPipe processes them.
- No frame, image, or video clip is ever transmitted or stored.
- The WebSocket only carries computed numeric metrics.

### Local Processing

- All computer vision runs exclusively in the student's browser.
- MediaPipe runs as a WASM module — no data sent to any MediaPipe/Google server.
- The teacher's browser receives numbers only, never video beyond the standard WebRTC stream.

### Child Safety Considerations (ages 6–15)

- No biometric data is stored in MVP scope.
- No emotion, mood, or psychological state is inferred.
- Score labels ("High/Moderate/Low Focus") describe observable behaviour only, not the child's character or capability.
- Teachers must be informed that the score is a **behavioural proxy**, not a clinical measurement.
- A visible indicator should be shown to the student that their attention is being tracked (consent transparency).
- When DB is added: data must be stored under the student's parent/guardian consent model, not the student's own consent (under-13 COPPA / GDPR-K rules apply).

### Ethical Use Guidelines (for onboarding teachers)

- The score is a **teaching aid**, not a performance grade.
- Do not share raw scores with students directly.
- Distraction events reflect environment and session context, not intelligence or effort.

---

## 9. Implementation Roadmap

### Phase 0 — Role Picker Screen
**Goal:** Differentiate teacher and student before the call begins, with no auth.

- [ ] Create `RolePickerScreen.tsx` — two buttons: "I'm a Teacher" / "I'm a Student"
- [ ] Store selected role in React local state (`'teacher' | 'student'`)
- [ ] Show role picker after room is joined, before call UI renders
- [ ] Gate MediaPipe initialisation behind `role === 'student'`
- [ ] Gate attention overlay UI behind `role === 'teacher'`
- [ ] Handle edge cases: both pick Teacher → teacher sees "Waiting for student data…" · both pick Student → MediaPipe runs on both, no UI shown (silent, acceptable for MVP)

---

### Phase 1 — Frame Capture + MediaPipe Setup
**Goal:** Get MediaPipe running in the student's browser during a call.

- [ ] Install `@mediapipe/face_mesh`
- [ ] Create `useAttentionProcessor` hook
- [ ] Implement offscreen canvas frame capture (every 4s via `setInterval`)
- [ ] Initialise FaceMesh with iris refinement enabled
- [ ] Log raw landmark output to console (verification step)
- [ ] Confirm face detection works on a test video stream

---

### Phase 2 — Feature Extraction + Score Calculation
**Goal:** Produce a reliable attention score from landmarks.

- [ ] Implement `extractFeatures(landmarks)` function
  - face_presence, head_yaw, head_pitch, eye_openness, iris_deviation
- [ ] Implement blink detection (state machine: open → closed → open)
- [ ] Implement `computeAttentionScore(features)` with weighted formula
- [ ] Apply exponential moving average smoothing
- [ ] Map score to label (High / Moderate / Low Focus)
- [ ] Unit test the score formula with mock landmark data

---

### Phase 3 — WebSocket Integration
**Goal:** Send metrics from student to teacher in real time.

- [ ] Add `attention_metrics` message type to existing WebSocket handler
- [ ] Student side: emit metrics payload every 4 seconds
- [ ] Teacher side: create `useAttentionReceiver` hook to receive and buffer metrics
- [ ] Implement distraction detection logic (2 consecutive low intervals)
- [ ] Test end-to-end: metrics flow from student browser to teacher browser

---

### Phase 4 — Teacher UI
**Goal:** Render attention data on the teacher's call screen.

- [ ] Build `AttentionOverlay.tsx` — semi-transparent bar on student video tile
- [ ] Implement color indicator + score + label display
- [ ] Build distraction alert popup (auto-dismiss after 6s, 30s cooldown)
- [ ] Install Recharts
- [ ] Build `AttentionPanel.tsx` — live timeline graph (Panel 2)
- [ ] Wire "Details" toggle button between overlay and panel
- [ ] Clear all attention state on call end

---

## 10. Future Improvements

### Real-Time Feedback for Student *(post-MVP)*
A subtle, non-distracting cue on the **student's** screen (e.g. a small pulsing dot) that encourages self-regulation without calling attention from the teacher.

### Improved Head Pose via 3D Estimation *(post-MVP)*
Replace the landmark-ratio-based yaw/pitch approximation with a proper PnP (Perspective-n-Point) solve using MediaPipe's 3D landmark coordinates. More accurate, especially for children who move a lot.

### Session History Dashboard *(when DB is added)*
After auth and DB are implemented, add a teacher dashboard showing per-student attention trends across sessions, with a simple sparkline per student.

### Adaptive Sampling Rate *(optimisation)*
Reduce sampling to every 6–8 seconds if the student has shown consistently high focus for 5+ minutes, reducing CPU load further. Increase back to 4 seconds on any distraction signal.

### Parent & Psychologist Report *(post-MVP)*
PDF export of session attention timeline, average score, and distraction count — shareable with parents or clinical staff with teacher approval.

### TURN Server + Reliability *(infrastructure)*
For production deployment, add a TURN server (e.g. Cloudflare TURN or Twilio's free tier) to ensure WebRTC connections work across strict school/corporate firewalls.

---

*This PRD is scoped for MVP development. All backend persistence sections are forward-looking and should be implemented once auth and database layers are in place.*
