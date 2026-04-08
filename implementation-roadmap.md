# Implementation Roadmap — Sustained Attention Score
### LearnAble Platform · MVP Feature

---

## Phasing Strategy

The project is divided into **6 phases**, each delivering a testable, working increment. Phases are sequential — each builds on the previous. Estimated total duration: **6–8 weeks** for a single frontend developer, or **4–5 weeks** with two developers splitting student-side and teacher-side work.

---

## Phase 0 — Project Setup & Role Picker
**Goal:** Establish the foundation. A user can join a room and select their role before the call begins.

**Duration:** 3–4 days

### Tasks

| # | Task | Details | Acceptance Criteria |
|---|------|---------|---------------------|
| 0.1 | Install dependencies | `@mediapipe/face_mesh`, `@mediapipe/camera_utils`, `recharts` | All packages resolve, app builds cleanly |
| 0.2 | Define shared types | Create `types/attention.ts` with `AttentionMetrics`, `AttentionDataPoint`, `FocusLabel`, `UserRole` | Types importable from both student and teacher modules |
| 0.3 | Build `RolePickerScreen.tsx` | Full-screen modal with two buttons: "I'm a Teacher" / "I'm a Student". Clean, child-friendly design | Renders after room join, before call UI |
| 0.4 | Wire role into app state | Store role in React local state (`useState<'teacher' \| 'student' \| null>`) | Role persists for the tab session, gates downstream logic |
| 0.5 | Conditional rendering gates | Teacher role → show attention UI placeholders. Student role → enable camera processing path | Selecting Teacher shows "Waiting for student data…" placeholder. Selecting Student shows normal video with no overlay |
| 0.6 | Handle edge cases | Both users pick Teacher → teacher sees waiting state. Both pick Student → no overlay shown | No crashes or undefined behavior in any role combination |

### Deliverable
A user opens `/call/:roomId`, picks a role, and enters the call. No attention features yet — just the routing skeleton.

---

## Phase 1 — Frame Capture & MediaPipe Initialization
**Goal:** MediaPipe Face Mesh runs in the student's browser and detects a face from the live camera feed.

**Duration:** 4–5 days

### Tasks

| # | Task | Details | Acceptance Criteria |
|---|------|---------|---------------------|
| 1.1 | Create `useAttentionProcessor` hook | Manages the entire MediaPipe lifecycle: init, frame loop, teardown | Hook mounts/unmounts cleanly without memory leaks |
| 1.2 | Offscreen canvas setup | Create a hidden 320×240 canvas. Draw the current video frame onto it every 4 seconds via `setInterval` | Canvas is never appended to the DOM. Interval is cleared on unmount |
| 1.3 | Initialize MediaPipe Face Mesh | Load FaceMesh with `refineLandmarks: true`, `maxNumFaces: 1`, confidence thresholds at 0.5 | Model loads from CDN, `onResults` callback fires |
| 1.4 | Feed frames to MediaPipe | On each interval tick, send the offscreen canvas to `faceMesh.send()` | `onResults` callback receives landmark data every ~4s |
| 1.5 | Console logging for verification | Log `results.multiFaceLandmarks` to the console with face detected/not detected flag | Developer can verify landmarks in DevTools |
| 1.6 | Performance baseline | Measure CPU usage during MediaPipe processing on a mid-range device (e.g., Chromebook, iPad) | Processing per frame completes in < 200ms, no visible frame drops on the video call |
| 1.7 | Teardown on call end | Destroy FaceMesh instance, clear interval, release canvas when the call ends or component unmounts | No lingering timers or WASM instances after navigation |

### Deliverable
On the student's device, MediaPipe silently processes camera frames every 4 seconds and logs landmark arrays to the console. No UI changes. Teacher sees nothing new.

---

## Phase 2 — Feature Extraction & Score Calculation
**Goal:** Transform raw landmarks into meaningful signals and produce a 0–100 attention score.

**Duration:** 5–6 days

### Tasks

| # | Task | Details | Acceptance Criteria |
|---|------|---------|---------------------|
| 2.1 | `extractFeatures(landmarks)` | Compute all raw signals from the 478-landmark array | Returns a typed `RawFeatures` object |
| 2.2 | Face presence detection | `true` if MediaPipe returns ≥ 1 face result, `false` otherwise | Correctly toggles when face enters/leaves frame |
| 2.3 | Head yaw calculation | Use landmarks 1 (nose tip), 234 (left ear), 454 (right ear) to estimate horizontal rotation | Yaw value changes sign when turning left vs right. `\|yaw\| > 25°` flags as looking away |
| 2.4 | Head pitch calculation | Use landmarks 1 (nose tip), 152 (chin), 10 (forehead) to estimate vertical tilt | Pitch goes negative when looking down. `pitch < -20°` flags as looking down |
| 2.5 | Eye openness ratio | Compute `vertical_eye_distance / horizontal_eye_width` for both eyes (landmarks 159/145 left, 386/374 right), average them | Ratio near 0.3 when eyes open, near 0.0 when closed |
| 2.6 | Blink detection state machine | Track open→closed→open transitions. A blink is `eye_openness < 0.10` held for < 400ms | Accurately counts blinks, computes blinks-per-minute over a rolling 60s window |
| 2.7 | Iris deviation | Compute `\|iris_center_x - eye_center_x\| / eye_width` using iris landmarks (468/473) and eye corners (33/133, 263/362) | Value near 0.0 when looking ahead, > 0.35 when gazing far left/right |
| 2.8 | `computeAttentionScore(features)` | Apply the weighted formula: face presence (0.35) + head orientation (0.35) + eye openness (0.20) + iris deviation (0.10) | Returns a raw score between 0 and 100 |
| 2.9 | Exponential moving average | `score(t) = 0.7 * score(t-1) + 0.3 * raw_score(t)` | Score transitions smoothly, no sudden jumps between frames |
| 2.10 | Focus label mapping | `≥ 70 → high`, `40–69 → moderate`, `< 40 → low` | Label always matches the score range |
| 2.11 | Unit tests | Test score formula with mock landmark data covering: face visible + centered, face turned away, eyes closed, face absent | All edge cases produce expected scores (5+ test cases minimum) |

### Deliverable
The student's browser now computes and logs a smoothed attention score (0–100) with a focus label every 4 seconds. Still console-only — no network transmission yet.

---

## Phase 3 — WebSocket Integration
**Goal:** Attention metrics flow in real time from the student's browser to the teacher's browser over the existing WebSocket.

**Duration:** 3–4 days

### Tasks

| # | Task | Details | Acceptance Criteria |
|---|------|---------|---------------------|
| 3.1 | Define message schema | `{ type: "attention_metrics", payload: { score, label, distraction, signals, timestamp } }` | Schema documented and typed in `types/attention.ts` |
| 3.2 | Student-side: emit metrics | After each score computation, send the metrics payload via the existing WebSocket connection | Message appears in the WebSocket frame log (DevTools → Network → WS) |
| 3.3 | Teacher-side: `useAttentionReceiver` hook | Listen for `type === "attention_metrics"` on the WebSocket. Parse payload, update React state | Hook returns `{ currentScore, currentLabel, isDistracted, timeline }` |
| 3.4 | Timeline buffer | Append each received data point to an in-memory array (`AttentionDataPoint[]`). Cap at 900 entries (1 hour at 4s intervals) | Array grows over time, oldest entries are dropped if cap is exceeded |
| 3.5 | Distraction detection | Flag `distraction: true` when score < 40 for 2 consecutive intervals (8 seconds) | Distraction flag is `true` only after 2+ consecutive low readings, resets when score recovers |
| 3.6 | End-to-end verification | Open two browser tabs in the same room. Student generates metrics, teacher receives them | Teacher's console shows live metrics updating every ~4s. Latency < 500ms |
| 3.7 | Graceful handling | If no metrics arrive for 15+ seconds, teacher UI shows "No data" state. Handle WebSocket disconnect/reconnect | UI never shows stale data as if it were current |

### Deliverable
Two browsers in a call — the student's MediaPipe output streams live to the teacher's browser over WebSocket. Teacher can inspect the metrics in state/console. No visual UI yet.

---

## Phase 4 — Teacher UI: Attention Overlay
**Goal:** The teacher sees a live attention indicator overlaid on the student's video tile.

**Duration:** 4–5 days

### Tasks

| # | Task | Details | Acceptance Criteria |
|---|------|---------|---------------------|
| 4.1 | `AttentionOverlay.tsx` | Semi-transparent bar at the bottom of the student video tile. Shows: color dot, label text, percentage | Overlay is visible but doesn't block the student's face |
| 4.2 | Color indicator | Green circle for `high`, yellow for `moderate`, red for `low` | Color updates smoothly every 4 seconds |
| 4.3 | Score display | Show the current smoothed score as a percentage (e.g., "82%") | Number updates in sync with the color and label |
| 4.4 | Smooth transitions | CSS transitions on color and width changes (300ms ease) | No hard visual jumps when score changes |
| 4.5 | "Waiting for data" state | Before first metric arrives, show a muted "Waiting for student data…" message in the overlay area | Teacher isn't confused by an empty/broken-looking overlay |
| 4.6 | Distraction alert popup | Toast notification in top-right corner: "⚠️ Student appears distracted" | Appears after 2 consecutive low-focus intervals. Auto-dismisses after 6 seconds |
| 4.7 | Alert cooldown | After an alert fires, suppress the next alert for 30 seconds | Alerts never spam the teacher during a sustained low-focus period |
| 4.8 | Dismiss on click | Teacher can click "Dismiss" to close the alert early | Click handler removes the popup immediately |
| 4.9 | Responsive layout | Overlay works on desktop (large video tile) and tablet (smaller tile) | Tested at 1024px and 768px viewport widths |
| 4.10 | Clear state on call end | All attention state (score, timeline, alerts) is wiped when the call ends | Navigating away and returning shows a clean slate |

### Deliverable
The teacher sees a live, color-coded attention overlay on the student's video feed during the call. Distraction alerts appear when focus drops. The core user experience is functional end-to-end.

---

## Phase 5 — Teacher UI: Live Timeline Panel
**Goal:** The teacher can view a scrollable attention graph showing focus trends over the session.

**Duration:** 3–4 days

### Tasks

| # | Task | Details | Acceptance Criteria |
|---|------|---------|---------------------|
| 5.1 | "Details" toggle button | Small button on the overlay that switches the view from overlay mode to the full timeline panel | Button is unobtrusive, clearly labeled |
| 5.2 | `AttentionPanel.tsx` | Full panel replacing the video tile area (or as a side panel) with the timeline graph | Panel renders with a "← Back" button to return to the video overlay |
| 5.3 | Recharts line chart | X-axis: elapsed time (formatted as mm:ss). Y-axis: 0–100% score. Line plotted from the timeline array | Chart updates live as new data points arrive |
| 5.4 | Color-coded line segments | Line color changes based on score zone — green above 70, yellow 40–69, red below 40 | Visual zones are immediately obvious |
| 5.5 | Distraction markers | Small red dot markers on the timeline where distraction events were flagged | Markers align with the correct timestamps |
| 5.6 | Legend | Show legend below chart: "● High Focus · ● Moderate · ● Low" | Legend matches the colors used in the chart |
| 5.7 | Auto-scroll | Chart viewport follows the latest data. If the session exceeds 10 minutes, earlier data scrolls off but remains accessible | Teacher can scroll back to see earlier data |
| 5.8 | Empty state | Before enough data exists (< 3 points), show "Collecting data…" placeholder | No broken/empty chart flickers on screen |

### Deliverable
The teacher can toggle between the compact overlay and a detailed live timeline graph. Both views update in real time. All MVP user stories are satisfied.

---

## Phase 6 — Polish, Testing & Edge Cases
**Goal:** Harden the feature for real-world use. Handle failures gracefully. Ensure privacy compliance.

**Duration:** 4–5 days

### Tasks

| # | Task | Details | Acceptance Criteria |
|---|------|---------|---------------------|
| 6.1 | Student consent indicator | Show a small, non-intrusive icon on the student's screen indicating attention tracking is active (e.g., a small eye icon) | Student (and any adult nearby) can see that tracking is on |
| 6.2 | Camera permission denied | If student denies camera access, skip MediaPipe entirely. Teacher sees "No attention data available" | No errors thrown, graceful degradation |
| 6.3 | MediaPipe load failure | If the CDN is unreachable or WASM fails to load, catch the error and disable the feature silently | Teacher sees "Attention tracking unavailable" instead of a broken overlay |
| 6.4 | Low-end device handling | If frame processing takes > 500ms, automatically increase sampling interval to 6–8 seconds | Feature still works on slower devices, just updates less frequently |
| 6.5 | Tab visibility handling | Pause MediaPipe processing when the student's browser tab is hidden (`visibilitychange` event). Resume when visible | No wasted CPU when tab is backgrounded. Teacher sees "Student tab inactive" |
| 6.6 | Multiple students (future-proofing) | Ensure the data model supports a `peerId` field so metrics from multiple students could be distinguished | Type definitions include `peerId`. Current UI assumes 1 student but doesn't break if a second appears |
| 6.7 | Accessibility | Overlay uses sufficient color contrast. Alert text is screen-reader accessible (`role="alert"`) | Passes WCAG AA contrast. Screen reader announces distraction alerts |
| 6.8 | Integration testing | End-to-end test: two browsers, full flow from role selection → metrics → overlay → timeline → call end | All phases work together without regressions |
| 6.9 | Performance audit | Profile memory and CPU over a 30-minute simulated session | No memory leaks. CPU usage stays under 15% on a mid-range laptop |
| 6.10 | Documentation | Write a brief developer README covering: how to enable/disable the feature, tuning weights, known limitations | README exists in the feature's directory |

### Deliverable
A production-ready MVP feature that handles real-world conditions: device variability, network issues, permission denials, and accessibility requirements.

---

## Summary Timeline

```
Week 1        Week 2        Week 3        Week 4        Week 5        Week 6
──────────────────────────────────────────────────────────────────────────────
Phase 0       Phase 1       Phase 2       Phase 3       Phase 4       Phase 5
Setup &       Frame         Feature       WebSocket     Teacher       Timeline
Role Picker   Capture &     Extraction    Integration   Overlay UI    Panel
              MediaPipe     & Scoring
                                                                  ───────────
                                                                  Phase 6
                                                                  Polish &
                                                                  Testing
```

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| MediaPipe WASM too heavy for student tablets | Feature unusable on target devices | Medium | Phase 1 includes perf baseline. Phase 6 adds adaptive sampling. Fallback: disable gracefully |
| Head pose estimation inaccurate for young children (smaller faces, more movement) | False low-focus readings | Medium | Tune thresholds in Phase 2 with real child testers. Widen yaw/pitch tolerance if needed |
| Both users pick the wrong role | No metrics flow | Low | Acceptable for MVP per PRD. Post-MVP: add a simple PIN or link-based role assignment |
| WebSocket message size impacts call quality | Video/audio degradation | Low | Metrics payload is ~200 bytes every 4s — negligible vs video bitrate |
| Glasses/lighting cause poor iris tracking | Iris deviation signal unreliable | High | Iris is weighted at only 0.10. If consistently poor, reduce to 0.05 or remove |

---

## Definition of Done (per phase)

- All tasks in the phase table are complete
- Code reviewed and merged to the feature branch
- No console errors or warnings in Chrome and Safari
- Works on desktop Chrome and tablet Safari (primary targets)
- Previous phases still function correctly (no regressions)

---

## Post-MVP Roadmap (Future Phases)

| Phase | Feature | Dependency |
|-------|---------|------------|
| 7 | Session summary stored to database | Auth + DB infrastructure |
| 8 | Teacher dashboard with per-student history | Phase 7 |
| 9 | Parent session report (PDF export) | Phase 7 |
| 10 | Student self-regulation indicator (subtle pulsing dot) | UX research with children |
| 11 | Improved head pose via PnP 3D estimation | R&D spike |
| 12 | Adaptive sampling rate based on focus stability | Phase 6.4 baseline data |
| 13 | Psychologist longitudinal trend access | Phase 7 + role-based auth |
