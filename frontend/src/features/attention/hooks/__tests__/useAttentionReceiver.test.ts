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
