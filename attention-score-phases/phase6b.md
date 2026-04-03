# Phase 6b — Testing
## Sustained Attention Score · LearnAble

**Goal:** Verify the full attention feature is correct, robust, and performant through unit tests, integration tests, and a manual end-to-end test protocol. Ensure no regressions in existing call functionality.

**Depends on:** Phase 6a (all polish tasks complete).

**Testing framework:** Vitest (already configured in the project via Vite). For component rendering tests, use `@testing-library/react`. For the E2E test, use two browser windows manually (no automated browser testing in MVP scope).

---

## Setup: Install Testing Dependencies

If not already installed:

```bash
npm install --save-dev @testing-library/react @testing-library/user-event jsdom
```

Add to `vite.config.ts` if not already present:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
```

Create `frontend/src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

---

## Test File Locations

All test files live alongside the code they test, inside `__tests__/` subdirectories:

```
frontend/src/features/attention/
  lib/
    __tests__/
      computeAttentionScore.test.ts    ← already created in Phase 2
      extractFeatures.test.ts          ← new in this phase
      blinkDetector.test.ts            ← new in this phase
  hooks/
    __tests__/
      useAttentionReceiver.test.ts     ← new in this phase
  components/
    __tests__/
      AttentionOverlay.test.tsx        ← new in this phase
      DistractionAlert.test.tsx        ← new in this phase
```

---

## T1 — Unit Tests: `extractFeatures.ts`

### File: `frontend/src/features/attention/lib/__tests__/extractFeatures.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { extractFeatures, noFaceFeatures } from '../extractFeatures';
import { NormalizedLandmark } from '@mediapipe/face_mesh';

// Build a minimal 478-landmark array with all landmarks at a neutral position (face looking straight)
function makeNeutralLandmarks(): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));

  // Set specific landmarks to simulate a forward-facing, eyes-open face
  // Nose tip at center
  lm[1] = { x: 0.5, y: 0.5, z: 0 };
  // Left ear (left of nose)
  lm[234] = { x: 0.2, y: 0.5, z: 0 };
  // Right ear (right of nose)
  lm[454] = { x: 0.8, y: 0.5, z: 0 };
  // Forehead (above nose)
  lm[10] = { x: 0.5, y: 0.25, z: 0 };
  // Chin (below nose)
  lm[152] = { x: 0.5, y: 0.75, z: 0 };

  // Left eye: open
  lm[159] = { x: 0.35, y: 0.42, z: 0 }; // upper lid
  lm[145] = { x: 0.35, y: 0.47, z: 0 }; // lower lid
  lm[33]  = { x: 0.28, y: 0.44, z: 0 }; // outer corner
  lm[133] = { x: 0.42, y: 0.44, z: 0 }; // inner corner

  // Right eye: open
  lm[386] = { x: 0.65, y: 0.42, z: 0 }; // upper lid
  lm[374] = { x: 0.65, y: 0.47, z: 0 }; // lower lid
  lm[263] = { x: 0.72, y: 0.44, z: 0 }; // outer corner
  lm[362] = { x: 0.58, y: 0.44, z: 0 }; // inner corner

  // Iris centered
  lm[468] = { x: 0.35, y: 0.44, z: 0 }; // left iris center
  lm[473] = { x: 0.65, y: 0.44, z: 0 }; // right iris center

  return lm;
}

describe('extractFeatures', () => {
  it('returns facePresent: true (caller is responsible for setting this)', () => {
    const lm = makeNeutralLandmarks();
    const features = extractFeatures(lm);
    expect(features.facePresent).toBe(true);
  });

  it('returns near-zero yaw for a straight-ahead face', () => {
    const lm = makeNeutralLandmarks();
    const features = extractFeatures(lm);
    expect(Math.abs(features.headYaw)).toBeLessThan(5);
  });

  it('returns non-zero yaw when face turns right (right ear further from nose)', () => {
    const lm = makeNeutralLandmarks();
    // Simulate turning right: move right ear further right
    lm[454] = { x: 0.9, y: 0.5, z: 0 };
    const features = extractFeatures(lm);
    expect(features.headYaw).toBeGreaterThan(0); // positive = turned right
  });

  it('returns near-zero pitch for a straight-ahead face', () => {
    const lm = makeNeutralLandmarks();
    const features = extractFeatures(lm);
    expect(Math.abs(features.headPitch)).toBeLessThan(10);
  });

  it('returns negative pitch when looking down (chin closer to nose)', () => {
    const lm = makeNeutralLandmarks();
    // Simulate looking down: move chin up (closer to nose)
    lm[152] = { x: 0.5, y: 0.60, z: 0 };
    const features = extractFeatures(lm);
    expect(features.headPitch).toBeLessThan(0);
  });

  it('returns positive eyeOpennessRatio for open eyes', () => {
    const lm = makeNeutralLandmarks();
    const features = extractFeatures(lm);
    expect(features.eyeOpennessRatio).toBeGreaterThan(0.05);
  });

  it('returns near-zero eyeOpennessRatio for closed eyes', () => {
    const lm = makeNeutralLandmarks();
    // Collapse lids together
    lm[159] = { ...lm[145] }; // upper lid = lower lid
    lm[386] = { ...lm[374] };
    const features = extractFeatures(lm);
    expect(features.eyeOpennessRatio).toBeLessThan(0.02);
  });

  it('returns near-zero irisDeviation for centered iris', () => {
    const lm = makeNeutralLandmarks();
    const features = extractFeatures(lm);
    expect(features.irisDeviation).toBeLessThan(0.1);
  });
});

describe('noFaceFeatures', () => {
  it('returns facePresent: false', () => {
    expect(noFaceFeatures().facePresent).toBe(false);
  });

  it('returns zero for all numeric fields', () => {
    const f = noFaceFeatures();
    expect(f.headYaw).toBe(0);
    expect(f.headPitch).toBe(0);
    expect(f.eyeOpennessRatio).toBe(0);
    expect(f.irisDeviation).toBe(0);
  });
});
```

---

## T2 — Unit Tests: `blinkDetector.ts`

### File: `frontend/src/features/attention/lib/__tests__/blinkDetector.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlinkDetector } from '../blinkDetector';

describe('BlinkDetector', () => {
  let detector: BlinkDetector;

  beforeEach(() => {
    detector = new BlinkDetector();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false on first open-eye reading', () => {
    const blinked = detector.update(0.30);
    expect(blinked).toBe(false);
  });

  it('detects a valid blink: open → close → open within 400ms', () => {
    detector.update(0.30);      // open
    detector.update(0.05);      // closed (< 0.10)
    vi.advanceTimersByTime(150);
    const blinked = detector.update(0.30); // open again
    expect(blinked).toBe(true);
  });

  it('does not count a blink if closure lasts longer than 400ms', () => {
    detector.update(0.30);      // open
    detector.update(0.05);      // closed
    vi.advanceTimersByTime(500); // too long — eyes held closed
    const blinked = detector.update(0.30); // re-open
    expect(blinked).toBe(false);
  });

  it('getBlinksPerMinute returns 0 initially', () => {
    expect(detector.getBlinksPerMinute()).toBe(0);
  });

  it('getBlinksPerMinute counts blinks in the last 60 seconds', () => {
    // Simulate 3 blinks
    for (let i = 0; i < 3; i++) {
      detector.update(0.30);
      detector.update(0.05);
      vi.advanceTimersByTime(150);
      detector.update(0.30);
      vi.advanceTimersByTime(1000);
    }
    expect(detector.getBlinksPerMinute()).toBe(3);
  });

  it('reset clears blink history and state', () => {
    detector.update(0.30);
    detector.update(0.05);
    vi.advanceTimersByTime(100);
    detector.update(0.30); // one blink counted
    detector.reset();
    expect(detector.getBlinksPerMinute()).toBe(0);
  });
});
```

---

## T3 — Unit Tests: `computeAttentionScore.ts`

These were defined in Phase 2. Verify they still pass after Phase 6a changes with `npx vitest run`.

---

## T4 — Hook Tests: `useAttentionReceiver`

### File: `frontend/src/features/attention/hooks/__tests__/useAttentionReceiver.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAttentionReceiver } from '../useAttentionReceiver';
import { AttentionMetrics } from '../../types/attention';

const makeMetrics = (score: number, label: 'high' | 'moderate' | 'low'): AttentionMetrics => ({
  score,
  label,
  distraction: false,
  signals: {
    face_present: true,
    head_yaw: 0,
    head_pitch: 0,
    eye_openness: 0.30,
    blink_rate: 15,
    iris_deviation: 0.10,
  },
  timestamp: 0,
});

describe('useAttentionReceiver', () => {
  it('starts with hasData: false', () => {
    const { result } = renderHook(() =>
      useAttentionReceiver({ incomingMetrics: null, enabled: true })
    );
    expect(result.current.hasData).toBe(false);
  });

  it('sets hasData: true after first metric', () => {
    const { result, rerender } = renderHook(
      ({ metrics }) =>
        useAttentionReceiver({ incomingMetrics: metrics, enabled: true }),
      { initialProps: { metrics: null as AttentionMetrics | null } }
    );

    act(() => {
      rerender({ metrics: makeMetrics(80, 'high') });
    });

    expect(result.current.hasData).toBe(true);
    expect(result.current.currentScore).toBe(80);
    expect(result.current.currentLabel).toBe('high');
  });

  it('detects distraction after 2 consecutive low readings', () => {
    const { result, rerender } = renderHook(
      ({ metrics }) =>
        useAttentionReceiver({ incomingMetrics: metrics, enabled: true }),
      { initialProps: { metrics: null as AttentionMetrics | null } }
    );

    // First low reading — not yet distracted
    act(() => {
      rerender({ metrics: makeMetrics(30, 'low') });
    });
    expect(result.current.isDistracted).toBe(false);

    // Second low reading — now distracted
    act(() => {
      rerender({ metrics: { ...makeMetrics(25, 'low'), timestamp: 4 } });
    });
    expect(result.current.isDistracted).toBe(true);
  });

  it('clears distraction after score recovers', () => {
    const { result, rerender } = renderHook(
      ({ metrics }) =>
        useAttentionReceiver({ incomingMetrics: metrics, enabled: true }),
      { initialProps: { metrics: null as AttentionMetrics | null } }
    );

    // Two low readings → distracted
    act(() => rerender({ metrics: makeMetrics(30, 'low') }));
    act(() => rerender({ metrics: { ...makeMetrics(25, 'low'), timestamp: 4 } }));
    expect(result.current.isDistracted).toBe(true);

    // Recovery
    act(() => rerender({ metrics: { ...makeMetrics(75, 'high'), timestamp: 8 } }));
    expect(result.current.isDistracted).toBe(false);
  });

  it('appends data points to timeline', () => {
    const { result, rerender } = renderHook(
      ({ metrics }) =>
        useAttentionReceiver({ incomingMetrics: metrics, enabled: true }),
      { initialProps: { metrics: null as AttentionMetrics | null } }
    );

    act(() => rerender({ metrics: makeMetrics(80, 'high') }));
    act(() => rerender({ metrics: { ...makeMetrics(60, 'moderate'), timestamp: 4 } }));

    expect(result.current.timeline).toHaveLength(2);
    expect(result.current.timeline[0].score).toBe(80);
    expect(result.current.timeline[1].score).toBe(60);
  });

  it('resets all state when enabled becomes false', () => {
    const { result, rerender } = renderHook(
      ({ enabled, metrics }) =>
        useAttentionReceiver({ incomingMetrics: metrics, enabled }),
      { initialProps: { enabled: true, metrics: makeMetrics(80, 'high') } }
    );

    act(() => rerender({ enabled: false, metrics: makeMetrics(80, 'high') }));

    expect(result.current.hasData).toBe(false);
    expect(result.current.timeline).toHaveLength(0);
    expect(result.current.currentScore).toBe(0);
  });
});
```

---

## T5 — Component Tests: `AttentionOverlay`

### File: `frontend/src/features/attention/components/__tests__/AttentionOverlay.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttentionOverlay from '../AttentionOverlay';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('AttentionOverlay', () => {
  const defaultProps = {
    score: 82,
    label: 'high' as const,
    hasData: true,
    isStale: false,
    unavailable: false,
    onDetailsClick: vi.fn(),
  };

  it('renders waiting state when hasData is false', () => {
    render(<AttentionOverlay {...defaultProps} hasData={false} />);
    expect(screen.getByText('attention.overlay.waitingData')).toBeInTheDocument();
  });

  it('renders stale state when isStale is true', () => {
    render(<AttentionOverlay {...defaultProps} isStale={true} />);
    expect(screen.getByText('attention.overlay.noData')).toBeInTheDocument();
  });

  it('renders unavailable state when unavailable is true', () => {
    render(<AttentionOverlay {...defaultProps} unavailable={true} />);
    expect(screen.getByText('attention.overlay.unavailable')).toBeInTheDocument();
  });

  it('renders score and label when data is available', () => {
    render(<AttentionOverlay {...defaultProps} />);
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('attention.overlay.highFocus')).toBeInTheDocument();
  });

  it('calls onDetailsClick when details button is clicked', async () => {
    const onDetailsClick = vi.fn();
    render(<AttentionOverlay {...defaultProps} onDetailsClick={onDetailsClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onDetailsClick).toHaveBeenCalledOnce();
  });
});
```

---

## T6 — Component Tests: `DistractionAlert`

### File: `frontend/src/features/attention/components/__tests__/DistractionAlert.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DistractionAlert from '../DistractionAlert';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('DistractionAlert', () => {
  it('renders nothing when isDistracted is false', () => {
    const { container } = render(<DistractionAlert isDistracted={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the alert when isDistracted becomes true', () => {
    const { rerender } = render(<DistractionAlert isDistracted={false} />);
    rerender(<DistractionAlert isDistracted={true} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('attention.alert.title')).toBeInTheDocument();
  });

  it('dismisses on Dismiss button click', async () => {
    const { rerender } = render(<DistractionAlert isDistracted={false} />);
    rerender(<DistractionAlert isDistracted={true} />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has role=alert and aria-live=assertive', () => {
    const { rerender } = render(<DistractionAlert isDistracted={false} />);
    rerender(<DistractionAlert isDistracted={true} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
  });

  it('does not re-show alert within the cooldown period', () => {
    const { rerender } = render(<DistractionAlert isDistracted={false} />);
    // First trigger
    rerender(<DistractionAlert isDistracted={true} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // Dismiss
    rerender(<DistractionAlert isDistracted={false} />);
    // Re-trigger immediately (still in cooldown)
    rerender(<DistractionAlert isDistracted={true} />);
    // Alert count should still be 1 (same element, not duplicated)
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});
```

---

## T7 — Manual End-to-End Test Protocol

This test must be performed manually in two browser windows.

### Setup

1. Start the dev server: `npm run dev` in `frontend/`
2. Start the backend WebSocket server
3. Open two browser windows (not tabs — separate windows to simulate two users)
4. Navigate both to the same `/call/:roomId` URL

### Test Steps

| # | Action | Expected |
|---|--------|----------|
| E1 | Window A: pick "Student". Window B: pick "Teacher" | Both enter the call. Webcam active in both. |
| E2 | Wait 5–8 seconds | Teacher (B) sees overlay with score and label. No errors. |
| E3 | Student (A): cover the camera with your hand | Teacher (B) overlay score drops toward 0. Label changes to "Low Focus" (red). |
| E4 | Student (A): cover camera for 10+ seconds | Teacher (B) sees the distraction alert popup in the top-right corner. |
| E5 | Teacher (B): click "Dismiss" on the alert | Alert disappears immediately. |
| E6 | Student (A): uncover camera | Teacher (B) score recovers gradually. Label returns to green. |
| E7 | Teacher (B): click "≡" Details button on overlay | `AttentionPanel` fills the video tile. Back button is visible. |
| E8 | Watch panel for 30+ seconds | Line chart grows from left to right. Color segments visible. |
| E9 | Student (A): turn head to the side | Score drops in the chart. Line color shifts to yellow or red. |
| E10 | Teacher (B): click "← Back" | Overlay returns. Score is still updating. |
| E11 | Window A: switch tab to another URL (hide tab) | Teacher (B) overlay shows stale state within 15 seconds. |
| E12 | Window A: return to the call tab | Teacher (B) overlay resumes with live data within ~4 seconds. |
| E13 | Student (A): end call | Teacher (B) sees normal post-call state (peer left message). Attention state cleared. |
| E14 | Both users: pick same role (both pick "Teacher") | Neither sees an error. Teacher sees "Waiting for student data…" overlay. No crash. |
| E15 | Student (A): check console | `[AttentionProcessor]` logs present. No unhandled errors. |
| E16 | Verify DevTools → Network → WS | `attention_metrics` frames visible every ~4s, ~200 bytes each. |

### Regression Check

Verify these existing features still work after all phases:
- [ ] WebRTC video/audio works normally (no degradation)
- [ ] Mute/camera toggle still works
- [ ] Reconnection still works (disconnect and reconnect network)
- [ ] Room full message still works (open a third tab)
- [ ] i18n language switching still works (switch to Arabic mid-call)

---

## T8 — Performance Audit

Simulate a 30-minute session:

1. Join as Student. Run the call with MediaPipe active for 30 minutes.
2. Monitor in Chrome DevTools → Performance tab:
   - CPU usage should stay below **15%** average on a mid-range laptop
   - Heap memory should not grow unboundedly (check Memory tab for leaks)
3. Monitor the timeline array: after 30 minutes at 4s intervals = 450 entries. After 60 minutes = 900 entries (the cap). Verify the cap is enforced (no array beyond 900).

---

## Run All Tests

```bash
cd frontend
npx vitest run
```

Expected output: all unit and hook tests pass. Zero failures.

---

## Acceptance Criteria

- [ ] All Vitest unit tests pass (`npx vitest run` exits with code 0)
- [ ] All component tests pass
- [ ] Manual E2E protocol: all 16 steps pass without errors
- [ ] Regression check: all existing call features unaffected
- [ ] Performance: CPU < 15% over 30-minute session, no memory leak

---

## Files Created in This Phase

| Action | File |
|--------|------|
| CREATE | `frontend/src/features/attention/lib/__tests__/extractFeatures.test.ts` |
| CREATE | `frontend/src/features/attention/lib/__tests__/blinkDetector.test.ts` |
| CREATE | `frontend/src/features/attention/hooks/__tests__/useAttentionReceiver.test.ts` |
| CREATE | `frontend/src/features/attention/components/__tests__/AttentionOverlay.test.tsx` |
| CREATE | `frontend/src/features/attention/components/__tests__/DistractionAlert.test.tsx` |
| CREATE | `frontend/src/test-setup.ts` (if not already present) |
| MODIFY | `vite.config.ts` — add `test` configuration block (if not already present) |
