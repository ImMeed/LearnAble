# Phase 6b — Testing
## Sustained Attention Score · LearnAble

**Goal:** Verify the full attention feature is correct, robust, and performant through unit tests, integration tests, and a manual end-to-end test protocol. Ensure no regressions in existing call functionality.

**Depends on:** Phase 6a (all polish tasks complete).

**Testing framework:** Vitest (already configured). For component rendering tests, use `@testing-library/react`. For E2E, use two browser windows manually.

> **Architecture note:** `AttentionOverlay.tsx`, `DistractionAlert.tsx`, and `AttentionPanel.tsx` were replaced by the unified `AttentionWidget.tsx`. Component tests reflect this — there are no tests for the old components.

---

## Setup: Current State

Vitest and jsdom are **already installed and configured** — no setup needed. The current `vite.config.ts` already contains:

```typescript
test: {
  environment: 'jsdom',
}
```

`vitest` and `jsdom` are already in `package.json` devDependencies.

**Install the missing testing libraries:**

```bash
npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Create `frontend/src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

Add `setupFiles` to the `test` block in `vite.config.ts`:

```typescript
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/test-setup.ts',
},
```

---

## Test File Locations

```
frontend/src/features/attention/
  lib/
    __tests__/
      computeAttentionScore.test.ts   ← ALREADY EXISTS & PASSING (12/12)
      extractFeatures.test.ts         ← new in this phase
      blinkDetector.test.ts           ← new in this phase
  hooks/
    __tests__/
      useAttentionReceiver.test.ts    ← new in this phase
  components/
    __tests__/
      AttentionWidget.test.tsx        ← new in this phase (replaces old Overlay + Alert tests)
```

---

## T1 — Unit Tests: `extractFeatures.ts`

### File: `frontend/src/features/attention/lib/__tests__/extractFeatures.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { extractFeatures, noFaceFeatures } from '../extractFeatures';
import { NormalizedLandmark } from '@mediapipe/face_mesh';

// Build a minimal 478-landmark array at a neutral forward-facing position
function makeNeutralLandmarks(): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));

  lm[1]   = { x: 0.5,  y: 0.5,  z: 0 }; // nose tip
  lm[234] = { x: 0.2,  y: 0.5,  z: 0 }; // left ear
  lm[454] = { x: 0.8,  y: 0.5,  z: 0 }; // right ear
  lm[10]  = { x: 0.5,  y: 0.25, z: 0 }; // forehead
  lm[152] = { x: 0.5,  y: 0.75, z: 0 }; // chin

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
  it('returns facePresent: true', () => {
    expect(extractFeatures(makeNeutralLandmarks()).facePresent).toBe(true);
  });

  it('returns near-zero yaw for a straight-ahead face', () => {
    expect(Math.abs(extractFeatures(makeNeutralLandmarks()).headYaw)).toBeLessThan(5);
  });

  it('returns positive yaw when face turns right', () => {
    const lm = makeNeutralLandmarks();
    lm[454] = { x: 0.9, y: 0.5, z: 0 }; // right ear further right
    expect(extractFeatures(lm).headYaw).toBeGreaterThan(0);
  });

  it('returns near-zero pitch for a straight-ahead face', () => {
    expect(Math.abs(extractFeatures(makeNeutralLandmarks()).headPitch)).toBeLessThan(10);
  });

  it('returns negative pitch when looking down', () => {
    const lm = makeNeutralLandmarks();
    lm[152] = { x: 0.5, y: 0.60, z: 0 }; // chin closer to nose
    expect(extractFeatures(lm).headPitch).toBeLessThan(0);
  });

  it('returns positive eyeOpennessRatio for open eyes', () => {
    expect(extractFeatures(makeNeutralLandmarks()).eyeOpennessRatio).toBeGreaterThan(0.05);
  });

  it('returns near-zero eyeOpennessRatio for closed eyes', () => {
    const lm = makeNeutralLandmarks();
    lm[159] = { ...lm[145] }; // collapse upper lid onto lower
    lm[386] = { ...lm[374] };
    expect(extractFeatures(lm).eyeOpennessRatio).toBeLessThan(0.02);
  });

  it('returns near-zero irisDeviation for centered iris', () => {
    expect(extractFeatures(makeNeutralLandmarks()).irisDeviation).toBeLessThan(0.1);
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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    expect(detector.update(0.30)).toBe(false);
  });

  it('detects a valid blink: open → close → open within 400ms', () => {
    detector.update(0.30);            // open
    detector.update(0.05);            // closed
    vi.advanceTimersByTime(150);
    expect(detector.update(0.30)).toBe(true); // re-open = blink counted
  });

  it('does not count a blink if closure lasts longer than 400ms', () => {
    detector.update(0.30);
    detector.update(0.05);
    vi.advanceTimersByTime(500);      // held too long
    expect(detector.update(0.30)).toBe(false);
  });

  it('getBlinksPerMinute returns 0 initially', () => {
    expect(detector.getBlinksPerMinute()).toBe(0);
  });

  it('getBlinksPerMinute counts blinks in the last 60 seconds', () => {
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
    detector.update(0.30);
    detector.reset();
    expect(detector.getBlinksPerMinute()).toBe(0);
  });
});
```

---

## T3 — Unit Tests: `computeAttentionScore.ts`

**Already passing — 12/12 tests green.** Run `npx vitest run` after Phase 6a changes to confirm no regressions.

---

## T4 — Hook Tests: `useAttentionReceiver`

### File: `frontend/src/features/attention/hooks/__tests__/useAttentionReceiver.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
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

    act(() => { rerender({ metrics: makeMetrics(80, 'high') }); });

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

    act(() => { rerender({ metrics: makeMetrics(30, 'low') }); });
    expect(result.current.isDistracted).toBe(false); // only 1 low reading

    act(() => { rerender({ metrics: { ...makeMetrics(25, 'low'), timestamp: 4 } }); });
    expect(result.current.isDistracted).toBe(true);  // 2nd consecutive low
  });

  it('clears distraction after score recovers', () => {
    const { result, rerender } = renderHook(
      ({ metrics }) =>
        useAttentionReceiver({ incomingMetrics: metrics, enabled: true }),
      { initialProps: { metrics: null as AttentionMetrics | null } }
    );

    act(() => { rerender({ metrics: makeMetrics(30, 'low') }); });
    act(() => { rerender({ metrics: { ...makeMetrics(25, 'low'), timestamp: 4 } }); });
    expect(result.current.isDistracted).toBe(true);

    act(() => { rerender({ metrics: { ...makeMetrics(75, 'high'), timestamp: 8 } }); });
    expect(result.current.isDistracted).toBe(false);
  });

  it('appends data points to timeline', () => {
    const { result, rerender } = renderHook(
      ({ metrics }) =>
        useAttentionReceiver({ incomingMetrics: metrics, enabled: true }),
      { initialProps: { metrics: null as AttentionMetrics | null } }
    );

    act(() => { rerender({ metrics: makeMetrics(80, 'high') }); });
    act(() => { rerender({ metrics: { ...makeMetrics(60, 'moderate'), timestamp: 4 } }); });

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

    act(() => { rerender({ enabled: false, metrics: makeMetrics(80, 'high') }); });

    expect(result.current.hasData).toBe(false);
    expect(result.current.timeline).toHaveLength(0);
    expect(result.current.currentScore).toBe(0);
  });
});
```

---

## T5 — Component Tests: `AttentionWidget`

### File: `frontend/src/features/attention/components/__tests__/AttentionWidget.test.tsx`

**Mock Recharts** — it doesn't render correctly in jsdom. Add a mock at the top of the file:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttentionWidget from '../AttentionWidget';

// Recharts uses ResizeObserver and SVG APIs not available in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart:   ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line:        () => null,
  XAxis:       () => null,
  YAxis:       () => null,
  CartesianGrid: () => null,
  ReferenceDot:  () => null,
  Tooltip:       () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  currentScore: 82,
  currentLabel: 'high' as const,
  hasData: true,
  isStale: false,
  isDistracted: false,
  timeline: [],
  active: true,
};

describe('AttentionWidget', () => {
  it('renders nothing when active is false', () => {
    const { container } = render(<AttentionWidget {...defaultProps} active={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the score and label when data is available', () => {
    render(<AttentionWidget {...defaultProps} />);
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('attention.overlay.highFocus')).toBeInTheDocument();
  });

  it('renders "—" when hasData is false', () => {
    render(<AttentionWidget {...defaultProps} hasData={false} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('attention.overlay.waitingData')).toBeInTheDocument();
  });

  it('renders stale label when isStale is true', () => {
    render(<AttentionWidget {...defaultProps} isStale={true} />);
    expect(screen.getByText('attention.overlay.noData')).toBeInTheDocument();
  });

  it('renders unavailable label when unavailable is true', () => {
    render(<AttentionWidget {...defaultProps} unavailable={true} />);
    expect(screen.getByText('attention.overlay.unavailable')).toBeInTheDocument();
  });

  it('does not render the distraction row when isDistracted is false', () => {
    render(<AttentionWidget {...defaultProps} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders distraction row with role=alert when isDistracted is true', () => {
    render(<AttentionWidget {...defaultProps} isDistracted={true} />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByText('attention.alert.title')).toBeInTheDocument();
  });

  it('distraction row disappears when isDistracted becomes false', () => {
    const { rerender } = render(<AttentionWidget {...defaultProps} isDistracted={true} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<AttentionWidget {...defaultProps} isDistracted={false} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('expand button switches to expanded mode showing chart area', async () => {
    render(<AttentionWidget {...defaultProps} />);
    const expandBtn = screen.getByLabelText('attention.overlay.details');
    await userEvent.click(expandBtn);
    // Collapse button should now be visible instead of expand
    expect(screen.getByLabelText('attention.panel.back')).toBeInTheDocument();
    expect(screen.queryByLabelText('attention.overlay.details')).not.toBeInTheDocument();
  });

  it('collapse button returns to compact mode', async () => {
    render(<AttentionWidget {...defaultProps} />);
    await userEvent.click(screen.getByLabelText('attention.overlay.details'));
    await userEvent.click(screen.getByLabelText('attention.panel.back'));
    expect(screen.getByLabelText('attention.overlay.details')).toBeInTheDocument();
  });

  it('minimize button switches to pill mode', async () => {
    render(<AttentionWidget {...defaultProps} />);
    const minimizeBtn = screen.getByLabelText('attention.widget.minimize');
    await userEvent.click(minimizeBtn);
    // In pill mode, the expand/minimize buttons are gone, score is still visible
    expect(screen.queryByLabelText('attention.overlay.details')).not.toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument(); // pill still shows score
  });

  it('clicking the minimized pill restores compact mode', async () => {
    render(<AttentionWidget {...defaultProps} />);
    await userEvent.click(screen.getByLabelText('attention.widget.minimize'));
    // Pill is now a role=button
    const pill = screen.getByRole('button', { name: /attention.widget.restore/i });
    await userEvent.click(pill);
    expect(screen.getByLabelText('attention.overlay.details')).toBeInTheDocument();
  });
});
```

---

## T7 — Manual End-to-End Test Protocol

### Setup

1. Start dev server: `npm run dev` in `frontend/`
2. Start the backend WebSocket server
3. Open **two separate browser windows** (not tabs) to the same `/call/:roomId` URL

### Test Steps

| # | Action | Expected |
|---|--------|----------|
| E1 | Window A: pick "Student". Window B: pick "Teacher" | Both enter the call. Webcam active in both. |
| E2 | Wait 5–8 seconds | Teacher (B) sees `AttentionWidget` in bottom-right corner. Score and label visible. Widget has colored left border. |
| E3 | Student (A): cover the camera | Teacher (B) widget: border turns red, score drops, label changes to "Low Focus" |
| E4 | Student (A): keep camera covered for 10+ seconds | Teacher (B) widget: red distraction banner row appears inside the card with `⚠️` icon |
| E5 | Student (A): uncover camera | Teacher (B): distraction banner disappears automatically. Score recovers gradually. Border turns green. |
| E6 | Teacher (B): click `⤢` expand button | Widget expands downward, chart area appears. Collapse button `⤡` is visible. |
| E7 | Watch expanded widget for 30+ seconds | Line chart grows right-to-left. Color segments visible (green/amber/red). |
| E8 | Student (A): turn head to the side | Score drops in chart. Line color shifts to yellow or red. |
| E9 | Teacher (B): click `⤡` collapse button | Widget returns to compact mode. Score still updating. |
| E10 | Teacher (B): click `—` minimize button | Widget collapses to a small pill showing dot + score only. |
| E11 | Teacher (B): click the pill | Widget restores to compact mode. |
| E12 | Teacher (B): drag the widget header | Widget follows cursor. On release, snaps to nearest corner. |
| E13 | Window A: switch to another tab (hide it) | Teacher (B) widget: border turns gray, score shows `—`, stale label appears within 15s. |
| E14 | Window A: return to the call tab | Teacher (B) widget: resumes live data within ~4s. |
| E15 | Student (A): end call | Teacher (B): post-call state shown. Widget disappears (active=false). |
| E16 | Both users pick "Teacher" | No errors. Widget shows `attention.overlay.waitingData`. No crash. |
| E17 | Student (A): verify console | `[AttentionProcessor]` logs every ~4s. No unhandled errors. |
| E18 | DevTools → Network → WS | `attention_metrics` frames every ~4s, ~200 bytes each. |

### Regression Check

- [ ] WebRTC video/audio works normally (no degradation)
- [ ] Mute/camera toggle works
- [ ] Reconnection works (disconnect and reconnect network)
- [ ] Room full message works (open a third tab)
- [ ] i18n language switching works mid-call (switch to Arabic)

---

## T8 — Performance Audit

Simulate a 30-minute session:

1. Join as Student. Run call with MediaPipe active for 30 minutes.
2. Chrome DevTools → Performance tab:
   - CPU usage stays below **15%** average on a mid-range laptop
   - Heap memory does not grow unboundedly (Memory tab)
3. `attentionState.timeline` array: after 30 min = 450 entries; after 60 min = 900 entries (cap). Verify array never exceeds 900.

---

## Run All Tests

```bash
cd frontend
npx vitest run
```

Expected: all unit, hook, and component tests pass. Zero failures.

---

## Acceptance Criteria

- [ ] `npx vitest run` exits with code 0 — all tests pass
- [ ] Manual E2E: all 18 steps pass without errors
- [ ] Regression check: all existing call features unaffected
- [ ] Performance: CPU < 15% over 30-minute session, no memory leak

---

## Files Created in This Phase

| Action | File |
|--------|------|
| CREATE | `frontend/src/features/attention/lib/__tests__/extractFeatures.test.ts` |
| CREATE | `frontend/src/features/attention/lib/__tests__/blinkDetector.test.ts` |
| CREATE | `frontend/src/features/attention/hooks/__tests__/useAttentionReceiver.test.ts` |
| CREATE | `frontend/src/features/attention/components/__tests__/AttentionWidget.test.tsx` |
| CREATE | `frontend/src/test-setup.ts` |
| MODIFY | `vite.config.ts` — add `globals: true` and `setupFiles` to the existing `test` block |
