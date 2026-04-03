type ProgressBarColor = "primary" | "secondary" | "accent";

type ProgressBarProps = {
  current: number;
  max: number;
  label?: string;
  color?: ProgressBarColor;
  showPercentage?: boolean;
};

const COLOR_MAP: Record<ProgressBarColor, string> = {
  primary: "var(--primary)",
  secondary: "var(--secondary)",
  accent: "var(--accent)",
};

function clampPercent(current: number, max: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) {
    return 0;
  }

  const percent = (current / max) * 100;
  return Math.min(100, Math.max(0, percent));
}

export function ProgressBar({
  current,
  max,
  label,
  color = "primary",
  showPercentage = true,
}: ProgressBarProps) {
  const percent = clampPercent(current, max);

  return (
    <div className="progress-bar">
      {label ? (
        <div className="progress-bar-header">
          <span>{label}</span>
          {showPercentage ? <span>{Math.round(percent)}%</span> : null}
        </div>
      ) : showPercentage ? (
        <div className="progress-bar-header progress-bar-header-right">
          <span>{Math.round(percent)}%</span>
        </div>
      ) : null}
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max > 0 ? max : 100}
        aria-valuenow={max > 0 ? Math.min(max, Math.max(0, current)) : 0}
        aria-label={label ?? "Progress"}
      >
        <span
          className="progress-fill"
          style={{ width: `${percent}%`, background: COLOR_MAP[color] }}
        />
      </div>
    </div>
  );
}
