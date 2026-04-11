import { useState } from "react";

import { formatDate } from "../../../app/pages/roleDashboardShared";
import type { ReadingSupportStudentOverview } from "../types";

type FocusChipEditorProps = {
  label: string;
  placeholder: string;
  emptyLabel: string;
  values: string[];
  mode?: "symbol" | "phrase";
  onChange: (nextValues: string[]) => void;
};

type ReadingSupportManagementCardProps = {
  title: string;
  description: string;
  badgeLabel?: string;
  notesBadgeLabel?: string;
  focusBadgeLabel?: string;
  emptyLabel: string;
  notesLabel: string;
  notesPlaceholder: string;
  enableLabel: string;
  disableLabel: string;
  activeLabel: string;
  inactiveLabel: string;
  progressLabel: string;
  bestAccuracyLabel: string;
  levelLabel: string;
  averageSessionLabel: string;
  rewardsLabel: string;
  trendLabel: string;
  lastPlayedLabel: string;
  noGameHistoryLabel: string;
  sessionsLabel: string;
  accuracyLabel: string;
  studentIdLabel: string;
  focusLettersLabel: string;
  focusWordsLabel: string;
  focusNumbersLabel: string;
  focusEmptyLabel: string;
  focusLettersPlaceholder: string;
  focusWordsPlaceholder: string;
  focusNumbersPlaceholder: string;
  savePlanLabel: string;
  locale: "ar" | "en";
  items: ReadingSupportStudentOverview[];
  noteDrafts: Record<string, string>;
  letterDrafts: Record<string, string[]>;
  wordDrafts: Record<string, string[]>;
  numberDrafts: Record<string, string[]>;
  busyStudentId: string | null;
  onNoteChange: (studentId: string, value: string) => void;
  onLettersChange: (studentId: string, values: string[]) => void;
  onWordsChange: (studentId: string, values: string[]) => void;
  onNumbersChange: (studentId: string, values: string[]) => void;
  onSave: (studentId: string) => void;
  onToggle: (studentId: string, nextActive: boolean) => void;
};

function formatDuration(seconds: number, locale: "ar" | "en") {
  if (!seconds) {
    return locale === "en" ? "0 min" : "0 د";
  }
  const minutes = Math.round(seconds / 60);
  return locale === "en" ? `${minutes} min` : `${minutes} د`;
}

function tokenize(raw: string, mode: "symbol" | "phrase"): string[] {
  return raw
    .split(mode === "phrase" ? /[,\n]+/ : /[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function FocusChipEditor({ label, placeholder, emptyLabel, values, mode = "symbol", onChange }: FocusChipEditorProps) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const tokens = tokenize(draft, mode);
    if (tokens.length === 0) return;

    const next = [...values];
    for (const token of tokens) {
      if (!next.some((item) => item.toLocaleLowerCase() === token.toLocaleLowerCase())) {
        next.push(token);
      }
    }
    onChange(next);
    setDraft("");
  };

  return (
    <div className="reading-support-focus-editor">
      <label className="reading-support-chip-label">{label}</label>
      <div className="reading-support-chip-wrap">
        {values.length === 0 ? <p className="muted">{emptyLabel}</p> : null}
        {values.map((value) => (
          <button
            key={`${label}-${value}`}
            type="button"
            className="reading-support-chip"
            onClick={() => onChange(values.filter((item) => item !== value))}
            title={value}
          >
            <span>{value}</span>
            <span aria-hidden="true">x</span>
          </button>
        ))}
      </div>
      <div className="reading-support-chip-input-row">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit();
            }
          }}
          onBlur={() => {
            if (draft.trim()) commit();
          }}
          placeholder={placeholder}
        />
        <button type="button" className="secondary" onClick={commit}>
          +
        </button>
      </div>
    </div>
  );
}

export function ReadingSupportManagementCard({
  title,
  description,
  badgeLabel = "Support plan",
  notesBadgeLabel,
  focusBadgeLabel,
  emptyLabel,
  notesLabel,
  notesPlaceholder,
  enableLabel,
  disableLabel,
  activeLabel,
  inactiveLabel,
  progressLabel,
  bestAccuracyLabel,
  levelLabel,
  averageSessionLabel,
  rewardsLabel,
  trendLabel,
  lastPlayedLabel,
  noGameHistoryLabel,
  sessionsLabel,
  accuracyLabel,
  studentIdLabel,
  focusLettersLabel,
  focusWordsLabel,
  focusNumbersLabel,
  focusEmptyLabel,
  focusLettersPlaceholder,
  focusWordsPlaceholder,
  focusNumbersPlaceholder,
  savePlanLabel,
  locale,
  items,
  noteDrafts,
  letterDrafts,
  wordDrafts,
  numberDrafts,
  busyStudentId,
  onNoteChange,
  onLettersChange,
  onWordsChange,
  onNumbersChange,
  onSave,
  onToggle,
}: ReadingSupportManagementCardProps) {
  return (
    <section className="card reading-support-manage-card">
      <div className="portal-block-header reading-support-manage-head">
        <div>
          <h3>{title}</h3>
          <p className="muted">{description}</p>
        </div>
        <span className="reading-support-badge">{badgeLabel}</span>
      </div>

      {items.length === 0 ? <p className="muted checkpoint-block">{emptyLabel}</p> : null}

      <div className="stack-list">
        {items.map((item) => {
          const isActive = item.support_profile?.is_active ?? false;
          const noteValue = noteDrafts[item.student_user_id] ?? item.support_profile?.notes ?? "";
          const letterValues = letterDrafts[item.student_user_id] ?? item.support_profile?.focus_letters ?? [];
          const wordValues = wordDrafts[item.student_user_id] ?? item.support_profile?.focus_words ?? [];
          const numberValues = numberDrafts[item.student_user_id] ?? item.support_profile?.focus_numbers ?? [];
          const gameHistory = item.progress.by_game.filter((entry) => entry.play_count > 0);

          return (
            <article className="request-card reading-support-student-card" key={item.student_user_id}>
              <div className="reading-support-card-head">
                <div>
                  <strong>{item.student_label}</strong>
                  <p className="muted">
                    {studentIdLabel}: {item.student_user_id}
                  </p>
                </div>
                <span className={`status-chip ${isActive ? "status-success" : "status-accent"}`}>
                  {isActive ? activeLabel : inactiveLabel}
                </span>
              </div>

              <div className="reading-support-plan-grid">
                <section className="reading-support-plan-panel">
                  <div className="reading-support-panel-head">
                    <h4>{notesLabel}</h4>
                    <span className="reading-support-soft-badge">{notesBadgeLabel ?? badgeLabel}</span>
                  </div>
                  <label className="reading-support-note-field">
                    {notesLabel}
                    <textarea
                      rows={4}
                      value={noteValue}
                      onChange={(event) => onNoteChange(item.student_user_id, event.target.value)}
                      placeholder={notesPlaceholder}
                    />
                  </label>
                </section>

                <section className="reading-support-plan-panel">
                  <div className="reading-support-panel-head">
                    <h4>{focusLettersLabel}</h4>
                    <span className="reading-support-soft-badge">{focusBadgeLabel ?? focusNumbersLabel}</span>
                  </div>
                  <FocusChipEditor
                    label={focusLettersLabel}
                    placeholder={focusLettersPlaceholder}
                    emptyLabel={focusEmptyLabel}
                    values={letterValues}
                    onChange={(nextValues) => onLettersChange(item.student_user_id, nextValues)}
                  />
                  <FocusChipEditor
                    label={focusWordsLabel}
                    placeholder={focusWordsPlaceholder}
                    emptyLabel={focusEmptyLabel}
                    values={wordValues}
                    mode="phrase"
                    onChange={(nextValues) => onWordsChange(item.student_user_id, nextValues)}
                  />
                  <FocusChipEditor
                    label={focusNumbersLabel}
                    placeholder={focusNumbersPlaceholder}
                    emptyLabel={focusEmptyLabel}
                    values={numberValues}
                    onChange={(nextValues) => onNumbersChange(item.student_user_id, nextValues)}
                  />
                </section>
              </div>

              <div className="inline-actions reading-support-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onSave(item.student_user_id)}
                  disabled={busyStudentId === item.student_user_id}
                >
                  {busyStudentId === item.student_user_id ? "..." : savePlanLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onToggle(item.student_user_id, !isActive)}
                  disabled={busyStudentId === item.student_user_id}
                >
                  {busyStudentId === item.student_user_id ? "..." : isActive ? disableLabel : enableLabel}
                </button>
              </div>

              <section className="reading-support-progress-box">
                <h4>{progressLabel}</h4>
                <div className="metrics-grid">
                  <article className="card metric-pill">
                    <p>{sessionsLabel}</p>
                    <strong>{item.progress.completed_sessions}</strong>
                  </article>
                  <article className="card metric-pill">
                    <p>{accuracyLabel}</p>
                    <strong>{item.progress.average_accuracy}%</strong>
                  </article>
                  <article className="card metric-pill">
                    <p>{bestAccuracyLabel}</p>
                    <strong>{item.progress.best_accuracy}%</strong>
                  </article>
                  <article className="card metric-pill">
                    <p>{levelLabel}</p>
                    <strong>{item.progress.current_level}</strong>
                  </article>
                  <article className="card metric-pill">
                    <p>{averageSessionLabel}</p>
                    <strong>{formatDuration(item.progress.average_session_seconds, locale)}</strong>
                  </article>
                </div>
                <p className="muted">
                  {lastPlayedLabel}: {formatDate(item.progress.last_played_at, locale, "-")}
                </p>

                <div className="checkpoint-block">
                  <strong>{rewardsLabel}</strong>
                  {item.progress.unlocked_rewards.length === 0 ? (
                    <p className="muted">{noGameHistoryLabel}</p>
                  ) : (
                    <div className="reading-support-game-history">
                      {item.progress.unlocked_rewards.map((reward) => (
                        <span className="chip" key={`${item.student_user_id}-${reward.code}`}>
                          {reward.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="checkpoint-block">
                  <strong>{trendLabel}</strong>
                  {item.progress.performance_trend.length === 0 ? (
                    <p className="muted">{noGameHistoryLabel}</p>
                  ) : (
                    <div className="reading-support-game-history">
                      {item.progress.performance_trend.slice(0, 3).map((entry) => (
                        <span className="chip" key={`${item.student_user_id}-${entry.session_id}`}>
                          {entry.title} | {entry.accuracy}% | {formatDuration(entry.duration_seconds, locale)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {gameHistory.length === 0 ? (
                  <p className="muted">{noGameHistoryLabel}</p>
                ) : (
                  <div className="reading-support-game-history">
                    {gameHistory.map((entry) => (
                      <span className="chip" key={`${item.student_user_id}-${entry.game_key}`}>
                        {entry.title} | {entry.play_count} | {entry.average_accuracy}%
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </article>
          );
        })}
      </div>
    </section>
  );
}
