import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { actionClass, cx, surfaceClass } from "../components/uiStyles";
import { DashboardShell, errorMessage, localePrefix, localeRequestConfig } from "./roleDashboardShared";

const ACTIVE_SESSION_KEY = "learnable_reading_lab_active_session";

type ReadingLabActivity = {
  key: string;
  title: string;
  description: string;
  interaction_type: string;
  estimated_minutes: number;
};

type ReadingLabSummary = {
  student_user_id: string;
  support_status: string;
  support_active: boolean;
  prominence: "HIGHLY_PROMINENT" | "PROMINENT" | "FEATURED" | "OPTIONAL";
  focus_targets: string[];
  notes: Array<{ source: string; label: string; note: string }>;
  progress: {
    completed_sessions: number;
    total_rounds_completed: number;
    average_accuracy: number;
  };
  activities: ReadingLabActivity[];
};

type ReadingLabRound = {
  index: number;
  prompt: string;
  instructions: string;
  interaction_type: "SINGLE_CHOICE" | "ORDERED_TILES";
  options?: Array<{ key: string; text: string }>;
  tiles?: string[];
  audio_text?: string | null;
};

type ReadingLabAnswer = {
  round_index: number;
  is_correct: boolean;
  selected_option_key?: string | null;
  ordered_tiles?: string[] | null;
};

type ReadingLabSession = {
  session_id: string;
  activity_key: string;
  activity_title: string;
  interaction_type: "SINGLE_CHOICE" | "ORDERED_TILES";
  current_round_index: number;
  total_rounds: number;
  completed_all_rounds: boolean;
  rounds: ReadingLabRound[];
  answers: ReadingLabAnswer[];
};

type ReadingLabCompletion = {
  session_id: string;
  correct_answers: number;
  total_rounds: number;
  accuracy: number;
  earned_points: number;
  earned_xp: number;
};

function prominenceLabelKey(prominence: ReadingLabSummary["prominence"]) {
  if (prominence === "HIGHLY_PROMINENT") return "readingLab.highlyProminent";
  if (prominence === "PROMINENT") return "readingLab.recommended";
  if (prominence === "FEATURED") return "readingLab.featured";
  return "readingLab.optional";
}

function buildRemainingTiles(baseTiles: string[] = [], selectedTiles: string[] = []) {
  const safeBaseTiles = Array.isArray(baseTiles) ? baseTiles : [];
  const safeSelectedTiles = Array.isArray(selectedTiles) ? selectedTiles : [];
  const counts = new Map<string, number>();
  for (const tile of safeSelectedTiles) {
    counts.set(tile, (counts.get(tile) ?? 0) + 1);
  }

  const remaining: string[] = [];
  for (const tile of safeBaseTiles) {
    const used = counts.get(tile) ?? 0;
    if (used > 0) {
      counts.set(tile, used - 1);
      continue;
    }
    remaining.push(tile);
  }
  return remaining;
}

export function ReadingLabPageV2() {
  const { t, i18n } = useTranslation();
  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState<ReadingLabSummary | null>(null);
  const [activeSession, setActiveSession] = useState<ReadingLabSession | null>(null);
  const [selectedOptionKey, setSelectedOptionKey] = useState("");
  const [orderedTiles, setOrderedTiles] = useState<string[]>([]);
  const [pendingAnswer, setPendingAnswer] = useState<{ round_index: number; selected_option_key?: string; ordered_tiles?: string[] } | null>(null);
  const [completion, setCompletion] = useState<ReadingLabCompletion | null>(null);
  const [busy, setBusy] = useState(false);

  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const currentRound = activeSession && !activeSession.completed_all_rounds
    ? activeSession.rounds[activeSession.current_round_index]
    : null;

  const loadSummary = async () => {
    try {
      const response = await apiClient.get<ReadingLabSummary>("/reading-lab/summary/me", requestConfig);
      setSummary(response.data);
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  const loadSession = async (sessionId: string) => {
    const response = await apiClient.get<ReadingLabSession>(`/reading-lab/sessions/${sessionId}`, requestConfig);
    setActiveSession(response.data);
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    setSelectedOptionKey("");
    setOrderedTiles([]);
  };

  useEffect(() => {
    const restore = async () => {
      setStatus(t("dashboards.common.loading"));
      await loadSummary();
      const storedSessionId = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (!storedSessionId) {
        setStatus("");
        return;
      }

      try {
        await loadSession(storedSessionId);
      } catch {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      } finally {
        setStatus("");
      }
    };

    void restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage]);

  useEffect(() => {
    if (!currentRound || currentRound.interaction_type !== "ORDERED_TILES") {
      setOrderedTiles([]);
    }
  }, [currentRound?.index, currentRound?.interaction_type]);

  const startActivity = async (activityKey: string) => {
    setBusy(true);
    setCompletion(null);
    try {
      const response = await apiClient.post<ReadingLabSession>(
        "/reading-lab/sessions/start",
        { activity_key: activityKey },
        requestConfig,
      );
      setActiveSession(response.data);
      localStorage.setItem(ACTIVE_SESSION_KEY, response.data.session_id);
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async (retryPayload?: { round_index: number; selected_option_key?: string; ordered_tiles?: string[] }) => {
    if (!activeSession || !currentRound) return;

    const payload = retryPayload ?? (
      currentRound.interaction_type === "SINGLE_CHOICE"
        ? { round_index: currentRound.index, selected_option_key: selectedOptionKey }
        : { round_index: currentRound.index, ordered_tiles: orderedTiles }
    );

    setBusy(true);
    try {
      await apiClient.post(`/reading-lab/sessions/${activeSession.session_id}/answer`, payload, {
        ...requestConfig,
        timeout: 10000,
      });
      setPendingAnswer(null);
      await loadSession(activeSession.session_id);
      setStatus("");
    } catch (error) {
      setPendingAnswer(payload);
      setStatus(t("readingLab.networkError"));
    } finally {
      setBusy(false);
    }
  };

  const completeSession = async () => {
    if (!activeSession) return;
    setBusy(true);
    try {
      const response = await apiClient.post<ReadingLabCompletion>(
        `/reading-lab/sessions/${activeSession.session_id}/complete`,
        {},
        requestConfig,
      );
      setCompletion(response.data);
      setActiveSession(null);
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      await loadSummary();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const speakRound = () => {
    if (!speechSupported || !currentRound?.audio_text) return;
    const utterance = new SpeechSynthesisUtterance(currentRound.audio_text);
    utterance.lang = i18n.resolvedLanguage === "en" ? "en-US" : "ar-SA";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const remainingTiles = buildRemainingTiles(currentRound?.tiles, orderedTiles);
  const orderedTilesReady = currentRound?.interaction_type === "ORDERED_TILES"
    ? orderedTiles.length > 0 && orderedTiles.length === (currentRound.tiles?.length ?? 0)
    : false;

  return (
    <DashboardShell title={t("readingLab.title")}>
      <section className={cx(surfaceClass, "kid-attention-panel kid-stagger-item p-5 sm:p-6")}>
        <div className="section-title-row">
          <div>
            <p className="muted">{summary ? t(prominenceLabelKey(summary.prominence)) : null}</p>
            <h2 className="text-[clamp(1.35rem,2vw,1.9rem)] font-semibold tracking-[-0.03em] text-foreground">
              {t(
                summary?.support_status === "ACTIVE"
                  ? "readingLab.supportActive"
                  : summary?.support_status === "PAUSED"
                    ? "readingLab.supportPaused"
                    : "readingLab.supportInactive",
              )}
            </h2>
          </div>
          <Link className={actionClass("soft")} to={`${prefix}/student/dashboard`}>
            {t("dashboards.course.backToDashboard")}
          </Link>
        </div>

        <div className="stack-list">
          <div className="inline-actions">
            {(summary?.focus_targets ?? []).map((target) => (
              <span className="status-chip kid-focus-chip" key={target}>{target}</span>
            ))}
          </div>
          <div className="metrics-grid">
            <article className="card metric-pill kid-metric-pill">
              <p>{t("readingLab.completedSessions")}</p>
              <strong>{summary?.progress.completed_sessions ?? 0}</strong>
            </article>
            <article className="card metric-pill kid-metric-pill">
              <p>{t("readingLab.averageAccuracy")}</p>
              <strong>{summary?.progress.average_accuracy ?? 0}%</strong>
            </article>
            <article className="card metric-pill kid-metric-pill">
              <p>{t("readingLab.totalRounds")}</p>
              <strong>{summary?.progress.total_rounds_completed ?? 0}</strong>
            </article>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{t("readingLab.notes")}</h3>
            {summary?.notes.length ? (
              <div className="stack-list">
                {summary.notes.map((note, index) => (
                  <article className="notification-item" key={`${note.source}-${index}`}>
                    <strong>{note.label}</strong>
                    <p>{note.note}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">{t("readingLab.notesEmpty")}</p>
            )}
          </div>
        </div>
      </section>

      {!activeSession ? (
        <section className={cx(surfaceClass, "kid-stagger-item p-5 sm:p-6")}>
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{t("readingLab.activities")}</h3>
          <div className="lesson-grid kid-activity-stagger checkpoint-block">
            {(summary?.activities ?? []).map((activity) => (
              <article className="lesson-card kid-activity-card" key={activity.key}>
                <div className="request-head-row">
                  <div>
                    <strong>{activity.title}</strong>
                    <p className="muted">{activity.description}</p>
                  </div>
                  <span className="status-chip">{activity.estimated_minutes}m</span>
                </div>
                <button type="button" className={actionClass()} onClick={() => void startActivity(activity.key)} disabled={busy}>
                  {t("readingLab.startActivity")}
                </button>
              </article>
            ))}
            {summary && summary.activities.length === 0 ? <p className="muted">{t("readingLab.noActivities")}</p> : null}
          </div>
        </section>
      ) : null}

      {activeSession ? (
        <section className="course-v2-layout kid-stagger-item">
          <section className="course-v2-content">
            <article className={cx(surfaceClass, "p-5 sm:p-6")}>
              <div className="section-title-row">
                <div>
                  <p className="muted">{activeSession.activity_title}</p>
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                    {t("readingLab.roundCounter", { current: activeSession.current_round_index + 1, total: activeSession.total_rounds })}
                  </h3>
                </div>
                <div className="inline-actions">
                  <button type="button" className={actionClass("soft")} onClick={speakRound} disabled={!speechSupported || !currentRound?.audio_text}>
                    {t("readingLab.playAudio")}
                  </button>
                </div>
              </div>

              {!speechSupported ? <p className="muted">{t("readingLab.audioUnavailable")}</p> : null}

              {currentRound ? (
                <div className="stack-list checkpoint-block">
                  <article className="course-v2-reading-card kid-round-card">
                    <h4>{currentRound.prompt}</h4>
                    <p>{currentRound.instructions}</p>
                  </article>

                  {currentRound.interaction_type === "SINGLE_CHOICE" ? (
                    <div className="stack-list">
                      {currentRound.options?.map((option) => (
                        <button
                          type="button"
                          key={option.key}
                          className={cx(selectedOptionKey === option.key ? actionClass() : actionClass("soft"), "kid-choice-btn")}
                          onClick={() => setSelectedOptionKey(option.key)}
                        >
                          {option.text}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="stack-list">
                      <div>
                        <p className="muted">{t("readingLab.arrangeTiles")}</p>
                        <div className="inline-actions">
                          {orderedTiles.map((tile, index) => (
                            <button
                              type="button"
                              key={`${tile}-${index}`}
                              className={cx(actionClass(), "kid-tile-btn")}
                              onClick={() => setOrderedTiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                            >
                              {tile}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="inline-actions">
                        {remainingTiles.map((tile, index) => (
                          <button
                            type="button"
                            key={`${tile}-${index}`}
                            className={cx(actionClass("soft"), "kid-tile-btn")}
                            onClick={() => setOrderedTiles((prev) => [...prev, tile])}
                          >
                            {tile}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="inline-actions">
                    <button
                      type="button"
                      className={actionClass()}
                      onClick={() => void submitAnswer()}
                      disabled={busy || (currentRound.interaction_type === "SINGLE_CHOICE" ? !selectedOptionKey : !orderedTilesReady)}
                    >
                      {t("common.continue")}
                    </button>
                    {pendingAnswer ? (
                      <button type="button" className={actionClass("soft")} onClick={() => void submitAnswer(pendingAnswer)} disabled={busy}>
                        {t("readingLab.retryAnswer")}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="stack-list checkpoint-block">
                  <p className="muted">{t("readingLab.completionTitle")}</p>
                  <button type="button" className={actionClass()} onClick={() => void completeSession()} disabled={busy}>
                    {t("readingLab.completeSession")}
                  </button>
                </div>
              )}
            </article>
          </section>

          <aside className="course-v2-sidebar">
            <article className={cx(surfaceClass, "p-5 sm:p-6")}>
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{t("readingLab.progress")}</h3>
              <div className="stack-list">
                {activeSession.answers.map((answer) => (
                  <article className="notification-item" key={answer.round_index}>
                    <strong>{t("dashboards.course.section")} {answer.round_index + 1}</strong>
                    <p>{answer.is_correct ? t("readingLab.answerCorrect") : t("readingLab.answerRetry")}</p>
                  </article>
                ))}
              </div>
            </article>
          </aside>
        </section>
      ) : null}

      {completion ? (
        <section className={cx(surfaceClass, "kid-stagger-item p-5 sm:p-6")}>
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{t("readingLab.completionTitle")}</h3>
          <p>{t("readingLab.completionSummary", { correct: completion.correct_answers, total: completion.total_rounds })}</p>
          <div className="inline-actions checkpoint-block">
            <span className="status-chip">{t("readingLab.pointsEarned", { points: completion.earned_points })}</span>
            <span className="status-chip">{t("readingLab.xpEarned", { xp: completion.earned_xp })}</span>
          </div>
        </section>
      ) : null}

      {status ? <p className="status-line">{status}</p> : null}
    </DashboardShell>
  );
}
