import { Clock3 } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { FocusTimerCard as FocusTimerCardUI, useFocusTimerState } from "../../features/focus-timer";

type FocusTimerProps = {
  defaultDuration?: number;
};

function formatDuration(totalSeconds: number): string {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function FocusTimer({ defaultDuration = 25 }: FocusTimerProps) {
  const { t } = useTranslation();
  const { state, setDuration, setMinimized, remainingSeconds, isActive } = useFocusTimerState();

  const desiredDefaultSeconds = Math.max(1, defaultDuration) * 60;

  useEffect(() => {
    if (!isActive && state.durationSeconds !== desiredDefaultSeconds && state.elapsed === 0) {
      setDuration(desiredDefaultSeconds);
    }
  }, [desiredDefaultSeconds, isActive, setDuration, state.durationSeconds, state.elapsed]);

  if (isActive) {
    return (
      <article className="card focus-timer-inline-indicator" aria-live="polite">
        <div className="focus-timer-inline-indicator-row">
          <p className="focus-timer-inline-indicator-title">
            <Clock3 size={16} aria-hidden="true" />
            <span>{t("timer.widget.runningIndicator")}</span>
          </p>
          <strong>{formatDuration(remainingSeconds)}</strong>
        </div>
        <button type="button" className="focus-timer-inline-open" onClick={() => setMinimized(false)}>
          {t("timer.widget.openFloating")}
        </button>
      </article>
    );
  }

  return <FocusTimerCardUI />;
}
