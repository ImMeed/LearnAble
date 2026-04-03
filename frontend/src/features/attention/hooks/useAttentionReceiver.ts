// frontend/src/features/attention/hooks/useAttentionReceiver.ts

import { useEffect, useRef, useState, useCallback } from 'react';
import { AttentionMetrics, AttentionDataPoint, FocusLabel } from '../types/attention';

const MAX_TIMELINE_POINTS = 900;       // 1 hour at 4s intervals
const DISTRACTION_CONSECUTIVE = 2;    // how many consecutive low readings = distraction
const NO_DATA_TIMEOUT_MS = 15_000;    // show "no data" after 15s silence

interface UseAttentionReceiverOptions {
  incomingMetrics: AttentionMetrics | null; // from useSignaling
  enabled: boolean;                         // true when role === 'teacher'
}

export interface AttentionReceiverState {
  currentScore: number;
  currentLabel: FocusLabel;
  isDistracted: boolean;        // true for the current distraction event
  timeline: AttentionDataPoint[];
  hasData: boolean;             // false until first metric arrives
  isStale: boolean;             // true if no data in last 15s
}

export function useAttentionReceiver({
  incomingMetrics,
  enabled,
}: UseAttentionReceiverOptions): AttentionReceiverState {
  const [currentScore, setCurrentScore] = useState(0);
  const [currentLabel, setCurrentLabel] = useState<FocusLabel>('low');
  const [isDistracted, setIsDistracted] = useState(false);
  const [timeline, setTimeline] = useState<AttentionDataPoint[]>([]);
  const [hasData, setHasData] = useState(false);
  const [isStale, setIsStale] = useState(false);

  const consecutiveLowRef = useRef(0);
  const lastReceivedAtRef = useRef<number | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset stale timer on every new metric
  const resetStaleTimer = useCallback(() => {
    if (staleTimerRef.current !== null) {
      clearTimeout(staleTimerRef.current);
    }
    setIsStale(false);
    staleTimerRef.current = setTimeout(() => {
      setIsStale(true);
    }, NO_DATA_TIMEOUT_MS);
  }, []);

  // Process each incoming metric
  useEffect(() => {
    if (!enabled || !incomingMetrics) return;

    const { score, label, timestamp, signals } = incomingMetrics;

    lastReceivedAtRef.current = Date.now();
    resetStaleTimer();

    if (!hasData) setHasData(true);

    // Update current display values
    setCurrentScore(score);
    setCurrentLabel(label);

    // Distraction detection: 2+ consecutive "low" readings
    if (label === 'low') {
      consecutiveLowRef.current += 1;
    } else {
      consecutiveLowRef.current = 0;
      setIsDistracted(false); // score recovered — clear distraction flag
    }

    const distraction = consecutiveLowRef.current >= DISTRACTION_CONSECUTIVE;
    setIsDistracted(distraction);

    console.log('[AttentionReceiver] incomingAttentionMetrics:', { score, label, distraction });

    // Append to timeline
    const point: AttentionDataPoint = {
      timestamp,
      score,
      label,
      distraction,
    };

    setTimeline((prev) => {
      const next = [...prev, point];
      // Cap at max points (drop oldest)
      if (next.length > MAX_TIMELINE_POINTS) {
        return next.slice(next.length - MAX_TIMELINE_POINTS);
      }
      return next;
    });
  }, [incomingMetrics, enabled, hasData, resetStaleTimer]);

  // Cleanup stale timer on unmount
  useEffect(() => {
    return () => {
      if (staleTimerRef.current !== null) {
        clearTimeout(staleTimerRef.current);
      }
    };
  }, []);

  // Reset all state when disabled (call ended)
  useEffect(() => {
    if (!enabled) {
      setCurrentScore(0);
      setCurrentLabel('low');
      setIsDistracted(false);
      setTimeline([]);
      setHasData(false);
      setIsStale(false);
      consecutiveLowRef.current = 0;
      lastReceivedAtRef.current = null;
      if (staleTimerRef.current !== null) {
        clearTimeout(staleTimerRef.current);
      }
    }
  }, [enabled]);

  return {
    currentScore,
    currentLabel,
    isDistracted,
    timeline,
    hasData,
    isStale,
  };
}
