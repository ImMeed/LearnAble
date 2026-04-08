# Phase 6a — Polish & Edge Cases
## Sustained Attention Score · LearnAble

**Goal:** Harden the feature for real-world conditions. Handle all failure states gracefully, add the student consent indicator, optimize for low-end devices, and ensure accessibility compliance. No new user-facing features — only reliability, resilience, and quality.

**Depends on:** Phases 0–5 fully working end-to-end.

> **Architecture note:** `AttentionOverlay.tsx`, `DistractionAlert.tsx`, and `AttentionPanel.tsx` from the original phase designs were replaced by a single unified component: `AttentionWidget.tsx` (+ `useDraggableSnap.ts`). All references in this phase target the widget instead.

**Produces:** Modifications to existing files only — no net-new components (except the consent indicator, which is a small addition to the student's PiP tile).

---

## 6a.1 — Student Consent Indicator

**Requirement:** A non-intrusive icon on the student's screen indicating attention tracking is active. The student (and any adult in the room) must be able to see that tracking is on.

### Where to render it

In `CallPage.tsx`, inside the `callState === "connected"` block, render a consent badge on the student's PiP tile when `role === 'student'`.

### What to add to `VideoTile.tsx`

`VideoTile.tsx` already has a `children` prop added in Phase 4. Add one more optional prop to carry the consent label:

```typescript
interface VideoTileProps {
  // ... existing props (stream, muted, label, variant, isCamOff, remoteMuted, children) ...
  consentBadgeLabel?: string;  // pass already-translated string from parent
}
```

Inside the `VideoTile` return JSX, before `{children}`, add:

```tsx
{consentBadgeLabel && (
  <div className="video-tile__consent-badge" title={consentBadgeLabel}>
    👁
  </div>
)}
```

### CSS to add to `CallPage.css`

Verify `.video-tile` already has `position: relative` (required so the badge positions correctly). If missing, add it. Then add the badge style:

```css
.video-tile__consent-badge {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  cursor: default;
  z-index: 5;
}
```

### In `CallPage.tsx`, update the student's PiP tile render:

```tsx
<VideoTile
  stream={localStream}
  muted={true}
  label={t("call.you")}
  variant="pip"
  isCamOff={isCamOff}
  consentBadgeLabel={role === 'student' ? t('attention.consent.tracking') : undefined}
/>
```

---

## 6a.2 — Camera Permission Denied

**Scenario:** The student grants camera access for WebRTC but then the MediaPipe hidden video fails, OR the student's camera feed is blocked entirely.

**Existing handling:** `CallPage.tsx` already has `callState === "error"` with `mediaError === "CAMERA_DENIED"`. The MediaPipe processor already checks `enabled: role === 'student' && !!localStream` — if `localStream` is null, the processor never starts.

**What to add in `useAttentionProcessor.ts`:**

Catch the case where `video.play()` rejects due to NotAllowedError:

```typescript
video.play().catch((err: Error) => {
  if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
    console.warn('[AttentionProcessor] Camera access unavailable — processor disabled');
    // The teacher will see the "—" / waiting state via isStale in AttentionWidget.
  } else {
    console.warn('[AttentionProcessor] Hidden video play() failed:', err);
  }
});
```

No UI changes needed — `AttentionWidget` already handles `hasData: false` and `isStale: true` states by showing `—` in the score row and the `t('attention.overlay.noData')` label. These states are driven by `useAttentionReceiver` which sets `isStale: true` after 15s of silence.

---

## 6a.3 — MediaPipe Load Failure

**Scenario:** The CDN is unreachable, the WASM file fails to download, or `faceMesh.initialize()` throws.

**What to add to `useAttentionProcessor.ts`:**

Add a new ref and return it:

```typescript
const loadFailedRef = useRef(false);
```

In the `faceMesh.initialize()` `.catch()` block (already present from Phase 1), set the flag:

```typescript
.catch((err) => {
  console.error('[AttentionProcessor] FaceMesh initialization failed:', err);
  loadFailedRef.current = true;
  // Do NOT start the interval — processor is disabled gracefully.
});
```

Update the hook's return type to expose the flag:

```typescript
interface UseAttentionProcessorReturn {
  latestScore: React.RefObject<AttentionScore | null>;
  blinkDetector: React.RefObject<BlinkDetector>;
  loadFailed: React.RefObject<boolean>;
}

// In the return statement:
return { latestScore: latestScoreRef, blinkDetector: blinkDetectorRef, loadFailed: loadFailedRef };
```

**What to add to `AttentionWidget.tsx`:**

Add an `unavailable` prop to the widget's props interface:

```typescript
interface AttentionWidgetProps {
  // ... existing props ...
  unavailable?: boolean;
}
```

In the widget's score row render, check `unavailable` first — before checking `hasData`/`isStale`:

```tsx
const labelText = unavailable
  ? t('attention.overlay.unavailable')
  : hasData && !isStale
    ? { high: t('attention.overlay.highFocus'), moderate: t('attention.overlay.moderateFocus'), low: t('attention.overlay.lowFocus') }[currentLabel]
    : isStale
      ? t('attention.overlay.noData')
      : t('attention.overlay.waitingData');
```

Also pass `unavailable` to the border color logic so the border stays gray when unavailable:

```typescript
const borderColor = unavailable
  ? '#4b5563'
  : isDistracted
    ? '#ef4444'
    : (hasData && !isStale ? BORDER_COLOR[currentLabel] : '#4b5563');
```

**In `CallPage.tsx`:**

Read `loadFailed` from the processor return value and pass it to the widget:

```typescript
const { latestScore, blinkDetector, loadFailed } = useAttentionProcessor({ ... });
```

```tsx
<AttentionWidget
  ...
  unavailable={loadFailed.current}
/>
```

---

## 6a.4 — Low-End Device: Adaptive Sampling Rate

**Scenario:** MediaPipe frame processing takes > 500ms on slow devices (older tablets).

**Implementation in `useAttentionProcessor.ts`:**

Replace the hardcoded `FRAME_INTERVAL_MS` constant with two constants and measure processing time inside `captureAndSend`:

```typescript
const FRAME_INTERVAL_NORMAL_MS = 4000;
const FRAME_INTERVAL_SLOW_MS = 7000;
const SLOW_THRESHOLD_MS = 500;
```

Modify `captureAndSend` to measure elapsed time and switch intervals if slow:

```typescript
const captureAndSend = useCallback(() => {
  const video = hiddenVideoRef.current;
  const canvas = canvasRef.current;
  const ctx = canvasCtxRef.current;
  const faceMesh = faceMeshRef.current;

  if (!video || !canvas || !ctx || !faceMesh) return;
  if (video.readyState < 2) return;

  const start = performance.now();
  ctx.drawImage(video, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  faceMesh.send({ image: canvas })
    .then(() => {
      const elapsed = performance.now() - start;
      if (elapsed > SLOW_THRESHOLD_MS && intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(captureAndSend, FRAME_INTERVAL_SLOW_MS);
        console.warn('[AttentionProcessor] Slow processing detected — reduced to 7s interval');
      }
    })
    .catch((err) => {
      console.error('[AttentionProcessor] faceMesh.send error:', err);
    });
}, []);
```

Note: once switched to the slow interval, it stays there for the rest of the session. This is acceptable for MVP.

---

## 6a.5 — Tab Visibility Handling

**Requirement:** Pause MediaPipe processing when the student's browser tab is hidden. Resume when visible. Teacher sees the stale state in `AttentionWidget` (border turns gray, score shows `—`) while the tab is hidden.

**Implementation in `useAttentionProcessor.ts`:**

Add a visibility change listener **inside the setup `useEffect`**, after the interval is started:

```typescript
const handleVisibilityChange = () => {
  if (!isMountedRef.current) return;

  if (document.hidden) {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    console.log('[AttentionProcessor] Tab hidden — paused');
  } else {
    if (intervalRef.current === null && faceMeshRef.current) {
      intervalRef.current = setInterval(captureAndSend, FRAME_INTERVAL_NORMAL_MS);
      console.log('[AttentionProcessor] Tab visible — resumed');
    }
  }
};

document.addEventListener('visibilitychange', handleVisibilityChange);
```

Add cleanup in the `return () => { ... }` teardown block:

```typescript
document.removeEventListener('visibilitychange', handleVisibilityChange);
```

> Important: define `handleVisibilityChange` inside the `useEffect` (not as a `useCallback` outside) so it closes over the current refs without needing to be in the dependency array.

---

## 6a.6 — Multiple Students: `peerId` Field (Forward-Compatibility)

**Status:** `peerId?: string` was already added to `AttentionMetrics` in Phase 0 (task 0.6). Verify it is present in `attention.ts`.

**What to do in `useAttentionProcessor.ts`:** Populate `peerId` in the emitted payload:

```typescript
const payload = {
  peerId: 'student-1',  // placeholder — real peer ID added when multi-user is supported
  score: score.smoothed,
  // ... rest of payload unchanged
};
```

No UI changes. The field is ignored by current receiver logic but present for forward compatibility.

---

## 6a.7 — Accessibility

### Widget color contrast

`AttentionWidget` uses these color combinations — all pass WCAG AA:
- Large score number (`#22c55e` / `#f59e0b` / `#ef4444`) on `#16162a` background — contrast ratios 6.5:1 / 3.1:1 / 4.5:1
- Note: amber `#f59e0b` on `#16162a` is borderline at 3.1:1 for the small label text. For the large score number (32px bold) this qualifies as Large Text under WCAG AA (threshold 3:1). No change needed.
- Label text `rgba(255,255,255,0.65)` on `#16162a` — contrast ≈ 8:1 ✅

### Distraction banner — screen reader

The distraction row in `AttentionWidget.tsx` already has `role="alert"`, `aria-live="assertive"`, and `aria-atomic="true"`:

```tsx
<div className="aw__distraction-row" role="alert" aria-live="assertive" aria-atomic="true">
```

Verify these attributes are present. The distraction state clears automatically when the score recovers — there is no dismiss button, so no focus management is needed.

### Expand/collapse button accessible names

The `⤢` and `⤡` icon buttons in `AttentionWidget` already have `aria-label` props. Verify:

```tsx
<button aria-label={t('attention.overlay.details')} ...>⤢</button>
<button aria-label={t('attention.panel.back')} ...>⤡</button>
<button aria-label="Minimize attention widget" ...>—</button>
```

Add the minimize label to `i18n.ts` in both `en` and `ar` if not already present:

```typescript
// en
attention: {
  widget: {
    minimize: "Minimize",
    restore: "Restore attention monitor",
  }
}

// ar
attention: {
  widget: {
    minimize: "تصغير",
    restore: "استعادة مراقب الانتباه",
  }
}
```

Replace the hardcoded `"Minimize attention widget"` string in `AttentionWidget.tsx` with `t('attention.widget.minimize')` and the minimized pill's `aria-label` with `t('attention.widget.restore')`.

### Drag handle — keyboard fallback

The drag handle currently only responds to mouse events. For keyboard-only users, the widget's snap corners can still be reached via tab and the expand/minimize buttons are fully keyboard accessible. Add `tabIndex={-1}` to the drag handle to exclude it from tab order (it has no keyboard equivalent):

```tsx
<div className="aw__header" onMouseDown={onDragHandleMouseDown} tabIndex={-1}>
```

---

## Acceptance Criteria

- [ ] Student's PiP tile shows a small eye icon (👁) when `role === 'student'` and the call is connected
- [ ] Hovering the eye icon shows `t('attention.consent.tracking')` as a tooltip
- [ ] Camera denied: processor does not start; `AttentionWidget` shows `—` / waiting state gracefully
- [ ] MediaPipe CDN failure: `AttentionWidget` shows `t('attention.overlay.unavailable')`, no unhandled errors in console, widget border stays gray
- [ ] Slow device: if frame processing > 500ms, interval increases to 7s (verify with `console.warn`)
- [ ] Hiding the student's tab: `[AttentionProcessor] Tab hidden — paused` appears in console. `AttentionWidget` transitions to stale state within 15s (border gray, score `—`)
- [ ] Restoring the student's tab: `[AttentionProcessor] Tab visible — resumed` appears. Widget resumes live data within ~4s
- [ ] `AttentionMetrics` payload includes `peerId: "student-1"`
- [ ] Distraction row in `AttentionWidget` has `role="alert"`, `aria-live="assertive"`, `aria-atomic="true"`
- [ ] All icon buttons have meaningful `aria-label` text (verify with screen reader or accessibility inspector)
- [ ] Drag handle has `tabIndex={-1}` so it is excluded from keyboard tab order
- [ ] `npm run build` clean — no TypeScript errors

---

## Files Modified in This Phase

| Action | File |
|--------|------|
| MODIFY | `frontend/src/components/VideoTile.tsx` — add `consentBadgeLabel` prop |
| MODIFY | `frontend/src/pages/CallPage.css` — add `.video-tile__consent-badge`, verify `.video-tile { position: relative }` |
| MODIFY | `frontend/src/features/attention/hooks/useAttentionProcessor.ts` — camera error handling, `loadFailed` ref, adaptive interval, tab visibility |
| MODIFY | `frontend/src/features/attention/components/AttentionWidget.tsx` — add `unavailable` prop, i18n keys for minimize/restore |
| MODIFY | `frontend/src/app/i18n.ts` — add `attention.widget.minimize` and `attention.widget.restore` in `en` and `ar` |
| MODIFY | `frontend/src/pages/CallPage.tsx` — pass `loadFailed` and `consentBadgeLabel` |
