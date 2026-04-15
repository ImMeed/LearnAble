import { Timer } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useFocusTimerState } from "./FocusTimerContext";

type FocusTimerMiniProps = {
  onExpand: () => void;
};

function formatDuration(totalSeconds: number): string {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function FocusTimerMini({ onExpand }: FocusTimerMiniProps) {
  const { t } = useTranslation();
  const { remainingSeconds } = useFocusTimerState();

  return (
    <button
      type="button"
      className="focus-floating-mini"
      onClick={onExpand}
      aria-label={t("timer.widget.expand")}
      title={t("timer.widget.minimizedTooltip", { remaining: formatDuration(remainingSeconds) })}
    >
      <Timer size={15} aria-hidden="true" />
      <span>{formatDuration(remainingSeconds)}</span>
    </button>
  );
}
