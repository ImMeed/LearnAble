import { Minus, Pause, Play, RotateCcw, Square, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useFocusTimerState } from "./FocusTimerContext";

type FocusTimerCardProps = {
  compact?: boolean;
  onRequestMinimize?: () => void;
  onRequestCancel?: () => void;
};

function formatDuration(totalSeconds: number): string {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function modeLabel(status: ReturnType<typeof useFocusTimerState>["state"]["status"], t: (key: string) => string) {
  if (status === "completed") return t("timer.widget.modeCompleted");
  if (status === "paused") return t("timer.widget.modePaused");
  return t("timer.widget.modeFocus");
}

function durationPillLabel(seconds: number) {
  return `${Math.round(seconds / 60)}m`;
}

export function FocusTimerCard({ compact = false, onRequestMinimize, onRequestCancel }: FocusTimerCardProps) {
  const { t } = useTranslation();
  const {
    state,
    remainingSeconds,
    progressPercent,
    defaultDurationOptions,
    start,
    pause,
    reset,
    setDuration,
  } = useFocusTimerState();

  const isRunning = state.status === "running";
  const isPaused = state.status === "paused";
  const canStart = state.status === "idle" || state.status === "paused" || state.status === "cancelled";

  const radius = compact ? 102 : 122;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progressPercent / 100) * circumference;

  return (
    <section className={compact ? "focus-pomodoro-card focus-pomodoro-card--compact" : "focus-pomodoro-card"} role="timer" aria-live="polite">
      <div className="focus-pomodoro-head">
        <h3>{t("timer.widget.title")}</h3>
        {onRequestMinimize || onRequestCancel ? (
          <div className="focus-pomodoro-head-actions">
            {onRequestMinimize ? (
              <button
                type="button"
                className="focus-pomodoro-head-btn"
                onClick={onRequestMinimize}
                aria-label={t("timer.widget.minimize")}
                title={t("timer.widget.minimize")}
              >
                <Minus size={16} aria-hidden="true" />
              </button>
            ) : null}

            {onRequestCancel ? (
              <button
                type="button"
                className="focus-pomodoro-head-btn focus-pomodoro-head-btn--stop"
                onClick={onRequestCancel}
                aria-label={t("timer.widget.cancel")}
                title={t("timer.widget.cancel")}
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="focus-pomodoro-ring-wrap">
        <svg className="focus-pomodoro-ring" viewBox="0 0 300 300" aria-hidden="true">
          <circle className="focus-pomodoro-ring-track" cx="150" cy="150" r={radius} />
          <circle
            className="focus-pomodoro-ring-progress"
            cx="150"
            cy="150"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="focus-pomodoro-time-wrap">
          <strong className="focus-pomodoro-time">{formatDuration(remainingSeconds)}</strong>
          <span>{modeLabel(state.status, t)}</span>
        </div>
      </div>

      <div className="focus-pomodoro-actions">
        <button
          type="button"
          className="focus-pomodoro-primary"
          onClick={isRunning ? pause : start}
          disabled={!canStart && !isRunning}
        >
          {isRunning ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          <span>{isRunning ? t("timer.actions.pause") : t("timer.actions.start")}</span>
        </button>

        <button
          type="button"
          className="focus-pomodoro-reset"
          onClick={reset}
          aria-label={t("timer.actions.reset")}
          title={t("timer.actions.reset")}
        >
          <RotateCcw size={19} aria-hidden="true" />
        </button>
      </div>

      <div className="focus-pomodoro-quick">
        <p>{t("timer.widget.quickDuration")}</p>
        <div className="focus-pomodoro-quick-row">
          {defaultDurationOptions.map((seconds) => (
            <button
              key={seconds}
              type="button"
              className={state.durationSeconds === seconds
                ? "focus-pomodoro-pill is-active"
                : "focus-pomodoro-pill"}
              onClick={() => setDuration(seconds)}
            >
              {durationPillLabel(seconds)}
            </button>
          ))}
        </div>
      </div>

      {state.status === "completed" ? (
        <div className="focus-pomodoro-complete-row">
          <Square size={15} aria-hidden="true" />
          <span>{t("timer.widget.completed")}</span>
        </div>
      ) : null}
    </section>
  );
}
