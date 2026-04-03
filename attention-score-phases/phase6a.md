# Phase 6a — Polish & Edge Cases
## Sustained Attention Score · LearnAble

**Goal:** Harden the feature for real-world conditions. Handle all failure states gracefully, add the student consent indicator, optimize for low-end devices, and ensure accessibility compliance. No new user-facing features — only reliability, resilience, and quality.

**Depends on:** Phases 0–5 fully working end-to-end.

**Produces:** Modifications to existing files only — no net-new components (except the consent indicator, which is a small addition to the student's call view).

---

## 6a.1 — Student Consent Indicator

**Requirement:** A non-intrusive icon on the student's screen indicating attention tracking is active. The student (and any adult in the room) must be able to see that tracking is on.

### Where to render it

In `CallPage.tsx`, inside the `callState === "connected"` block, render a consent badge **on the student's PiP tile** (their own local video tile) when `role === 'student'`.

### What to add to `VideoTile.tsx`

Add an optional `consentBadge` boolean prop:

```typescript
interface VideoTileProps {
  // ... existing props ...
  showConsentBadge?: boolean;  // ← add this
}
```

Inside the `VideoTile` return JSX, before `{children}`, add:

```tsx
{showConsentBadge && (
  <div className="video-tile__consent-badge" title={t('attention.consent.tracking')}>
    👁
  </div>
)}
```

> Note: `VideoTile` currently does not import `useTranslation`. To keep it simple, pass the translated string as a prop instead:

Alternative (simpler — avoid adding i18n import to VideoTile):

```typescript
interface VideoTileProps {
  consentBadgeLabel?: string;  // pass already-translated string from parent
}
```

```tsx
{consentBadgeLabel && (
  <div className="video-tile__consent-badge" title={consentBadgeLabel}>
    👁
  </div>
)}
```

### CSS to add to `CallPage.css` (or create `VideoTile.css`):

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

**What to add:**

In `useAttentionProcessor.ts`, catch the case where `video.play()` rejects due to NotAllowedError:

```typescript
video.play().catch((err: Error) => {
  if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
    console.warn('[AttentionProcessor] Camera access unavailable — processor disabled');
    // Nothing to do: enabled check already guards against null localStream.
    // The teacher will see the "No attention data available" state via isStale.
  } else {
    console.warn('[AttentionProcessor] Hidden video play() failed:', err);
  }
});
```

No UI changes needed — the teacher already sees `t('attention.overlay.noData')` via the `isStale` fallback in `AttentionOverlay`.

---

## 6a.3 — MediaPipe Load Failure

**Scenario:** The CDN is unreachable, the WASM file fails to download, or `faceMesh.initialize()` throws.

**What to add to `useAttentionProcessor.ts`:**

Add a new state ref and return it:

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

Update the hook's return type to expose this:

```typescript
interface UseAttentionProcessorReturn {
  latestScore: React.RefObject<AttentionScore | null>;
  blinkDetector: React.RefObject<BlinkDetector>;
  loadFailed: React.RefObject<boolean>;   // ← add this
}

// In the return statement:
return { latestScore: latestScoreRef, blinkDetector: blinkDetectorRef, loadFailed: loadFailedRef };
```

**In `CallPage.tsx`:**

Read `loadFailed` from the processor and pass it to the overlay:

```typescript
const { latestScore, blinkDetector, loadFailed } = useAttentionProcessor({ ... });
```

Update `AttentionOverlay.tsx` to accept an optional `unavailable` prop:

```typescript
interface AttentionOverlayProps {
  // ... existing props ...
  unavailable?: boolean;
}
```

In the overlay's render logic, check `unavailable` first:

```tsx
if (unavailable) {
  return (
    <div className="attention-overlay attention-overlay--waiting">
      <span className="attention-overlay__waiting-text">
        {t('attention.overlay.unavailable')}
      </span>
    </div>
  );
}
```

Pass it from `CallPage`:

```tsx
<AttentionOverlay
  ...
  unavailable={loadFailed.current}
/>
```

---

## 6a.4 — Low-End Device: Adaptive Sampling Rate

**Scenario:** MediaPipe frame processing takes > 500ms on slow devices (older tablets).

**Implementation in `useAttentionProcessor.ts`:**

Measure the time each `captureAndSend` call takes, and dynamically increase the interval if processing is consistently slow.

```typescript
const FRAME_INTERVAL_NORMAL_MS = 4000;
const FRAME_INTERVAL_SLOW_MS = 7000;
const SLOW_THRESHOLD_MS = 500;

// Track processing time
const lastFrameStartRef = useRef<number | null>(null);
```

Modify `captureAndSend`:

```typescript
const captureAndSend = useCallback(() => {
  const video = hiddenVideoRef.current;
  const canvas = canvasRef.current;
  const ctx = canvasCtxRef.current;
  const faceMesh = faceMeshRef.current;

  if (!video || !canvas || !ctx || !faceMesh) return;
  if (video.readyState < 2) return;

  const start = performance.now();
  lastFrameStartRef.current = start;

  ctx.drawImage(video, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  faceMesh.send({ image: canvas })
    .then(() => {
      const elapsed = performance.now() - start;
      if (elapsed > SLOW_THRESHOLD_MS && intervalRef.current !== null) {
        // Slow device — increase the interval to reduce CPU pressure
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

Note: once switched to the slow interval, it stays there for the rest of the session. Reset to normal is not implemented in MVP (acceptable per PRD).

---

## 6a.5 — Tab Visibility Handling

**Requirement:** Pause MediaPipe processing when the student's browser tab is hidden. Resume when visible. Teacher sees `t('attention.overlay.noData')` (via `isStale`) while the tab is hidden.

**Implementation in `useAttentionProcessor.ts`:**

Add inside the setup `useEffect`, after the interval is started:

```typescript
const handleVisibilityChange = () => {
  if (!isMountedRef.current) return;

  if (document.hidden) {
    // Pause the interval
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    console.log('[AttentionProcessor] Tab hidden — paused');
  } else {
    // Resume the interval
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

> Important placement note: `handleVisibilityChange` must be defined inside the `useEffect` (not outside) so it has access to the current refs via closure. Alternatively define it as a `useCallback` outside and include it in the `useEffect` dependency array.

---

## 6a.6 — Multiple Students: `peerId` Field (Forward-Compatibility)

**Requirement:** The data model should support a `peerId` so that metrics from multiple students can be distinguished in future phases.

**Status:** `peerId?: string` was already added to `AttentionMetrics` in Phase 0 (task 0.6). Verify it is present.

**What to do:** In `useAttentionProcessor.ts`, populate `peerId` in the emitted payload. For MVP, there is no real peer ID — use a static placeholder:

```typescript
const payload = {
  peerId: 'student-1',  // placeholder — real peer ID added when multi-user is supported
  score: score.smoothed,
  // ... rest of payload unchanged
};
```

No UI changes needed. The field is ignored by current receiver logic but present for forward compatibility.

---

## 6a.7 — Accessibility

### Overlay color contrast

The `AttentionOverlay` uses these foreground/background combinations:
- White text (`#ffffff`) on dark semi-transparent background (`rgba(0,0,0,0.65)`) — contrast ratio ≈ 15:1 ✅ passes WCAG AA
- Muted text (`rgba(255,255,255,0.5)`) on same background — contrast ratio ≈ 7.5:1 ✅ passes WCAG AA

No changes needed for the overlay text.

### Distraction alert — screen reader

The `DistractionAlert` already has `role="alert"` and `aria-live="assertive"` (added in Phase 4). Verify these are present.

Additionally, add `aria-atomic="true"` to ensure the full alert message is announced when it appears:

```tsx
<div className="distraction-alert" role="alert" aria-live="assertive" aria-atomic="true">
```

### Details button accessible name

The `[≡]` button in `AttentionOverlay` already has `aria-label={t('attention.overlay.details')}`. Verify this is present. The visual `≡` character alone is not readable — the aria-label provides the accessible name.

### Focus management on alert dismiss

After clicking "Dismiss" on the distraction alert, focus should return to the call controls rather than being lost. Update `DistractionAlert.tsx`:

```tsx
const dismissBtnRef = useRef<HTMLButtonElement>(null);

// On dismiss click, move focus to the main call area
const dismiss = () => {
  setVisible(false);
  // Return focus to document body (call controls will be accessible via tab)
  document.body.focus();
  if (autoDismissTimerRef.current !== null) {
    clearTimeout(autoDismissTimerRef.current);
    autoDismissTimerRef.current = null;
  }
};
```

---

## Acceptance Criteria

- [ ] Student's PiP tile shows a small eye icon (👁) when `role === 'student'` and the call is connected
- [ ] Hovering the eye icon shows `t('attention.consent.tracking')` as a tooltip
- [ ] Camera denied: processor does not start, teacher sees `t('attention.overlay.noData')` gracefully
- [ ] MediaPipe CDN failure: teacher sees `t('attention.overlay.unavailable')`, no unhandled errors in console
- [ ] Slow device: if frame processing > 500ms, interval increases to 7s (verify with console.warn)
- [ ] Hiding the student's tab: `[AttentionProcessor] Tab hidden — paused` logs. Teacher sees stale data indicator within 15s.
- [ ] Restoring the student's tab: `[AttentionProcessor] Tab visible — resumed` logs. Metrics resume.
- [ ] `AttentionMetrics` payload includes `peerId: "student-1"`
- [ ] Distraction alert has `role="alert"`, `aria-live="assertive"`, `aria-atomic="true"`
- [ ] All existing overlay/alert text passes WCAG AA contrast (verify with browser accessibility checker)
- [ ] `npm run build` clean

---

## Files Modified in This Phase

| Action | File |
|--------|------|
| MODIFY | `frontend/src/components/VideoTile.tsx` — add `consentBadgeLabel` prop |
| MODIFY | `frontend/src/pages/CallPage.css` — add `.video-tile__consent-badge` styles |
| MODIFY | `frontend/src/features/attention/hooks/useAttentionProcessor.ts` — camera error handling, MediaPipe failure flag, adaptive interval, tab visibility |
| MODIFY | `frontend/src/features/attention/components/AttentionOverlay.tsx` — add `unavailable` prop |
| MODIFY | `frontend/src/features/attention/components/DistractionAlert.tsx` — add `aria-atomic`, focus management |
| MODIFY | `frontend/src/pages/CallPage.tsx` — pass `loadFailed` to overlay, pass `consentBadgeLabel` to PiP tile |
