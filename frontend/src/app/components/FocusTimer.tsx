import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAccessibility } from "../../features/accessibility/AccessibilityContext";
import { ProgressBar } from "./ProgressBar";

type TimerMode = "work" | "short_break" | "long_break";

type FocusTimerProps = {
  defaultDuration?: number;
};

function formatDuration(totalSeconds: number): string {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function playTimerSound() {
  if (typeof window === "undefined") {
    return;
  }

  const contextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!contextClass) {
    return;
  }

  try {
    const context = new contextClass();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.18);

    gainNode.gain.setValueAtTime(0.001, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);

    window.setTimeout(() => {
      void context.close();
    }, 300);
  } catch {
    // Ignore sound playback failures in restricted environments.
  }
}

export function FocusTimer({ defaultDuration = 25 }: FocusTimerProps) {
  const { t } = useTranslation();
  const { settings } = useAccessibility();

  const modeLabels: Record<TimerMode, string> = {
    work: t("timer.mode.work"),
    short_break: t("timer.mode.shortBreak"),
    long_break: t("timer.mode.longBreak"),
  };

  const modeDurations = useMemo(
    () => ({
      work: Math.max(1, settings.workDuration || defaultDuration) * 60,
      short_break: Math.max(1, settings.breakDuration) * 60,
      long_break: Math.max(1, settings.longBreakDuration) * 60,
    }),
    [defaultDuration, settings.breakDuration, settings.longBreakDuration, settings.workDuration],
  );

  const [mode, setMode] = useState<TimerMode>("work");
  const [running, setRunning] = useState(false);
  const [completedWorkSessions, setCompletedWorkSessions] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(modeDurations.work);

  useEffect(() => {
    setSecondsLeft(modeDurations[mode]);
  }, [mode, modeDurations]);

  useEffect(() => {
    if (!running) {
      return;
    }

    const id = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (secondsLeft > 0) {
      return;
    }

    if (settings.soundAlerts) {
      playTimerSound();
    }

    setRunning(false);

    if (mode === "work") {
      const nextCount = completedWorkSessions + 1;
      const nextMode: TimerMode = nextCount % 4 === 0 ? "long_break" : "short_break";

      setCompletedWorkSessions(nextCount);
      setMode(nextMode);
      setSecondsLeft(modeDurations[nextMode]);
      setRunning(settings.autoStartNextSession);
      return;
    }

    setMode("work");
    setSecondsLeft(modeDurations.work);
    setRunning(settings.autoStartNextSession);
  }, [
    completedWorkSessions,
    mode,
    modeDurations,
    secondsLeft,
    settings.autoStartNextSession,
    settings.soundAlerts,
  ]);

  const totalForCurrentMode = modeDurations[mode];
  const elapsed = totalForCurrentMode - secondsLeft;

  return (
    <section className="card focus-timer-card" role="timer" aria-live="polite">
      <div className="timer-header-row">
        <h3>{t("timer.title")}</h3>
        <span className="muted">{modeLabels[mode]}</span>
      </div>

      <p className="timer-label">{formatDuration(secondsLeft)}</p>
      <ProgressBar
        current={elapsed}
        max={totalForCurrentMode}
        label={t("timer.sessionProgress")}
        color="accent"
      />

      <div className="timer-mode-tabs">
        <button type="button" className={mode === "work" ? "active" : ""} onClick={() => setMode("work")}>
          {t("timer.mode.work")}
        </button>
        <button
          type="button"
          className={mode === "short_break" ? "active" : ""}
          onClick={() => setMode("short_break")}
        >
          {t("timer.mode.shortBreak")}
        </button>
        <button
          type="button"
          className={mode === "long_break" ? "active" : ""}
          onClick={() => setMode("long_break")}
        >
          {t("timer.mode.longBreak")}
        </button>
      </div>

      <div className="timer-actions">
        <button type="button" onClick={() => setRunning((prev) => !prev)}>
          {running ? t("timer.actions.pause") : t("timer.actions.start")}
        </button>
        <button type="button" className="secondary" onClick={() => setSecondsLeft(modeDurations[mode])}>
          {t("timer.actions.reset")}
        </button>
      </div>
    </section>
  );
}
