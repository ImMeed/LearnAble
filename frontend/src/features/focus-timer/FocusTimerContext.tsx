import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

export type TimerStatus = "idle" | "running" | "paused" | "completed" | "cancelled";

export type TimerPosition = {
  x: number;
  y: number;
};

export type FocusTimerState = {
  status: TimerStatus;
  durationSeconds: number;
  startTimestamp: number | null;
  elapsed: number;
  position: TimerPosition;
  isMinimized: boolean;
};

type FocusTimerContextValue = {
  state: FocusTimerState;
  remainingSeconds: number;
  progressPercent: number;
  isActive: boolean;
  hasEverStarted: boolean;
  defaultDurationOptions: number[];
  setDuration: (seconds: number) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  cancel: () => void;
  setMinimized: (value: boolean) => void;
  setPosition: (position: TimerPosition) => void;
  markDragged: () => void;
};

const STORAGE_KEY = "learnable_focus_timer_state";
const TICK_MS = 250;
const DEFAULT_DURATION = 25 * 60;
const DEFAULT_DURATIONS = [15 * 60, 25 * 60, 45 * 60];
const WIDGET_WIDTH = 360;
const WIDGET_HEIGHT = 420;
const MINI_WIDTH = 170;
const MINI_HEIGHT = 52;
const EDGE_GAP = 20;

const FocusTimerContext = createContext<FocusTimerContextValue | undefined>(undefined);

function normalizeDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_DURATION;
  return Math.max(60, Math.min(3 * 60 * 60, Math.floor(seconds)));
}

function getDefaultPositionForDirection(isRtl: boolean): TimerPosition {
  const width = typeof window !== "undefined" ? window.innerWidth : 1366;
  const height = typeof window !== "undefined" ? window.innerHeight : 768;
  const x = isRtl ? EDGE_GAP : width - WIDGET_WIDTH - EDGE_GAP;
  const y = height - WIDGET_HEIGHT - EDGE_GAP;
  return { x, y };
}

function clampPosition(position: TimerPosition, isMinimized: boolean): TimerPosition {
  if (typeof window === "undefined") {
    return position;
  }

  const width = isMinimized ? MINI_WIDTH : WIDGET_WIDTH;
  const height = isMinimized ? MINI_HEIGHT : WIDGET_HEIGHT;
  const maxX = Math.max(EDGE_GAP, window.innerWidth - width - EDGE_GAP);
  const maxY = Math.max(EDGE_GAP, window.innerHeight - height - EDGE_GAP);

  return {
    x: Math.min(maxX, Math.max(EDGE_GAP, Math.round(position.x))),
    y: Math.min(maxY, Math.max(EDGE_GAP, Math.round(position.y))),
  };
}

function computeElapsed(state: FocusTimerState, nowMs = Date.now()): number {
  if (state.status !== "running" || !state.startTimestamp) {
    return state.elapsed;
  }

  const runningFor = Math.floor((nowMs - state.startTimestamp) / 1000);
  return Math.max(0, state.elapsed + runningFor);
}

function computeRemaining(state: FocusTimerState, nowMs = Date.now()): number {
  const elapsed = computeElapsed(state, nowMs);
  return Math.max(0, state.durationSeconds - elapsed);
}

function readInitialState(isRtl: boolean): FocusTimerState {
  const fallback = {
    status: "idle" as TimerStatus,
    durationSeconds: DEFAULT_DURATION,
    startTimestamp: null,
    elapsed: 0,
    position: getDefaultPositionForDirection(isRtl),
    isMinimized: false,
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FocusTimerState>;
    const hasDragged = typeof parsed.position?.x === "number" && typeof parsed.position?.y === "number";
    const position = hasDragged ? parsed.position as TimerPosition : fallback.position;

    const state: FocusTimerState = {
      status:
        parsed.status === "running" ||
        parsed.status === "paused" ||
        parsed.status === "completed" ||
        parsed.status === "cancelled" ||
        parsed.status === "idle"
          ? parsed.status
          : "idle",
      durationSeconds: normalizeDuration(parsed.durationSeconds ?? DEFAULT_DURATION),
      startTimestamp: typeof parsed.startTimestamp === "number" ? parsed.startTimestamp : null,
      elapsed: Math.max(0, Math.floor(Number(parsed.elapsed ?? 0))),
      position: clampPosition(position, Boolean(parsed.isMinimized)),
      isMinimized: Boolean(parsed.isMinimized),
    };

    const remaining = computeRemaining(state);
    if (remaining <= 0 && (state.status === "running" || state.status === "paused")) {
      return {
        ...state,
        status: "completed",
        startTimestamp: null,
        elapsed: state.durationSeconds,
      };
    }

    return state;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return fallback;
  }
}

function hasStoredCustomPosition(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return false;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FocusTimerState>;
    return typeof parsed.position?.x === "number" && typeof parsed.position?.y === "number";
  } catch {
    return false;
  }
}

function playCompletionSound() {
  if (typeof window === "undefined") return;

  const contextClass =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!contextClass) return;

  try {
    const context = new contextClass();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(520, context.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0.001, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.1, context.currentTime + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.34);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.36);

    window.setTimeout(() => {
      void context.close();
    }, 450);
  } catch {
    // Ignore browser restrictions for autoplay contexts.
  }
}

export function FocusTimerProvider({ children, isRtl }: { children: ReactNode; isRtl: boolean }) {
  const [state, setState] = useState<FocusTimerState>(() => readInitialState(isRtl));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const hasUserDraggedRef = useRef(hasStoredCustomPosition());
  const completedTonePlayedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!hasUserDraggedRef.current) {
      setState((prev) => ({
        ...prev,
        position: clampPosition(getDefaultPositionForDirection(isRtl), prev.isMinimized),
      }));
    }
  }, [isRtl]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const payload: FocusTimerState = {
      ...state,
      position: clampPosition(state.position, state.isMinimized),
    };

    if (payload.status === "idle" || payload.status === "cancelled" || payload.status === "completed") {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [state]);

  useEffect(() => {
    if (state.status !== "running") return;

    const id = window.setInterval(() => {
      const currentNowMs = Date.now();
      setNowMs(currentNowMs);
      setState((prev) => {
        const remaining = computeRemaining(prev, currentNowMs);
        if (remaining > 0) return prev;
        return {
          ...prev,
          status: "completed",
          startTimestamp: null,
          elapsed: prev.durationSeconds,
          isMinimized: false,
        };
      });
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [state.status]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const currentNowMs = Date.now();
      setNowMs(currentNowMs);

      setState((prev) => {
        if (prev.status !== "running" || !prev.startTimestamp) return prev;
        const reconciledElapsed = computeElapsed(prev, currentNowMs);
        const remaining = Math.max(0, prev.durationSeconds - reconciledElapsed);
        if (remaining <= 0) {
          return {
            ...prev,
            status: "completed",
            startTimestamp: null,
            elapsed: prev.durationSeconds,
            isMinimized: false,
          };
        }

        return {
          ...prev,
          elapsed: reconciledElapsed,
          startTimestamp: currentNowMs,
        };
      });
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setState((prev) => ({
        ...prev,
        position: clampPosition(prev.position, prev.isMinimized),
      }));
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (state.status === "completed" && !completedTonePlayedRef.current) {
      completedTonePlayedRef.current = true;
      playCompletionSound();
    }

    if (state.status !== "completed") {
      completedTonePlayedRef.current = false;
    }
  }, [state.status]);

  const remainingSeconds = computeRemaining(state, nowMs);
  const progressPercent = Math.max(0, Math.min(100, ((state.durationSeconds - remainingSeconds) / state.durationSeconds) * 100));
  const isActive = state.status === "running" || state.status === "paused" || state.status === "completed";
  const hasEverStarted = state.status !== "idle" && state.status !== "cancelled";

  const value = useMemo<FocusTimerContextValue>(
    () => ({
      state,
      remainingSeconds,
      progressPercent,
      isActive,
      hasEverStarted,
      defaultDurationOptions: DEFAULT_DURATIONS,
      setDuration: (seconds: number) => {
        const durationSeconds = normalizeDuration(seconds);
        setState((prev) => ({
          ...prev,
          durationSeconds,
          elapsed: 0,
          startTimestamp: null,
          status: "idle",
        }));
      },
      start: () => {
        setState((prev) => {
          if (prev.status === "running") return prev;
          return {
            ...prev,
            status: "running",
            startTimestamp: Date.now(),
          };
        });
      },
      pause: () => {
        setState((prev) => {
          if (prev.status !== "running") return prev;
          return {
            ...prev,
            status: "paused",
            elapsed: computeElapsed(prev),
            startTimestamp: null,
          };
        });
      },
      reset: () => {
        setState((prev) => ({
          ...prev,
          status: "idle",
          elapsed: 0,
          startTimestamp: null,
          isMinimized: false,
        }));
      },
      cancel: () => {
        setState((prev) => ({
          ...prev,
          status: "cancelled",
          elapsed: 0,
          startTimestamp: null,
          isMinimized: false,
        }));
      },
      setMinimized: (value: boolean) => {
        setState((prev) => ({
          ...prev,
          isMinimized: value,
          position: clampPosition(prev.position, value),
        }));
      },
      setPosition: (position: TimerPosition) => {
        setState((prev) => ({
          ...prev,
          position: clampPosition(position, prev.isMinimized),
        }));
      },
      markDragged: () => {
        hasUserDraggedRef.current = true;
      },
    }),
    [state, remainingSeconds, progressPercent, isActive, hasEverStarted],
  );

  return <FocusTimerContext.Provider value={value}>{children}</FocusTimerContext.Provider>;
}

export function useFocusTimerState() {
  const context = useContext(FocusTimerContext);
  if (!context) {
    throw new Error("useFocusTimerState must be used inside FocusTimerProvider");
  }
  return context;
}
