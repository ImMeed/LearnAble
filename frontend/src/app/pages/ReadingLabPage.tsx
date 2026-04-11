import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { AccessibilityToolbar } from "../components/AccessibilityToolbar";
import { BrandLogo } from "../components/BrandLogo";
import { ProgressBar } from "../components/ProgressBar";
import {
  completeReadingLabSession,
  fetchMyReadingSupport,
  fetchReadingLabGames,
  startReadingLabSession,
  submitReadingLabAnswer,
} from "../../api/readingSupportApi";
import { getReadingLabCopy } from "../../features/readingLab/copy";
import type {
  ReadingLabAnswerResult,
  ReadingLabCompleteResult,
  ReadingLabGame,
  ReadingLabRound,
  ReadingLabSessionStart,
  ReadingSupportMe,
} from "../../features/readingLab/types";
import { localePrefix } from "./roleDashboardShared";

type Tile = {
  id: string;
  label: string;
};

type DragState = {
  tileId: string;
  source: "pool" | "built";
} | null;

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const payload = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof payload === "object" && payload && "message" in payload) {
      return String((payload as { message?: unknown }).message);
    }
  }
  return String(error);
}

function makeTiles(round: ReadingLabRound): Tile[] {
  return round.items.map((label, index) => ({
    id: `${round.index}-${index}-${label}`,
    label,
  }));
}

export function ReadingLabPage() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const copy = useMemo(() => getReadingLabCopy(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [status, setStatus] = useState("");
  const [support, setSupport] = useState<ReadingSupportMe | null>(null);
  const [games, setGames] = useState<ReadingLabGame[]>([]);
  const [sessionData, setSessionData] = useState<ReadingLabSessionStart | null>(null);
  const [feedback, setFeedback] = useState<ReadingLabAnswerResult | null>(null);
  const [summary, setSummary] = useState<ReadingLabCompleteResult | null>(null);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [choiceAnswer, setChoiceAnswer] = useState<string | null>(null);
  const [poolTiles, setPoolTiles] = useState<Tile[]>([]);
  const [builtTiles, setBuiltTiles] = useState<Tile[]>([]);
  const [dragState, setDragState] = useState<DragState>(null);
  const [busyGameKey, setBusyGameKey] = useState<string | null>(null);

  const currentRound = sessionData?.rounds[currentRoundIndex] ?? null;
  const focusLetters = support?.support_profile?.focus_letters ?? [];
  const focusWords = support?.support_profile?.focus_words ?? [];
  const focusNumbers = support?.support_profile?.focus_numbers ?? [];

  const resetRoundState = (round: ReadingLabRound | null) => {
    setFeedback(null);
    setChoiceAnswer(null);
    if (!round || round.interaction !== "ordered_tiles") {
      setPoolTiles([]);
      setBuiltTiles([]);
      return;
    }
    setPoolTiles(makeTiles(round));
    setBuiltTiles([]);
  };

  const loadSupport = async () => {
    setStatus(copy.loading);
    try {
      const supportRes = await fetchMyReadingSupport(i18n.resolvedLanguage);
      setSupport(supportRes);
      if (supportRes.is_support_active) {
        const gameItems = await fetchReadingLabGames(i18n.resolvedLanguage);
        setGames(gameItems);
      } else {
        setGames([]);
      }
      setStatus(copy.refreshHint);
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  useEffect(() => {
    void loadSupport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage]);

  useEffect(() => {
    resetRoundState(currentRound);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoundIndex, sessionData]);

  const speak = (text: string | null | undefined) => {
    if (!text) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setStatus(copy.audioUnsupported);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale === "en" ? "en-US" : "ar-SA";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const startGame = async (gameKey: string) => {
    setBusyGameKey(gameKey);
    setSummary(null);
    setStatus(copy.preparingSession);
    try {
      const nextSession = await startReadingLabSession(gameKey, i18n.resolvedLanguage);
      setSessionData(nextSession);
      setCurrentRoundIndex(0);
      setStatus(`${copy.sessionTitle}: ${nextSession.game.title}`);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusyGameKey(null);
    }
  };

  const moveTile = (tileId: string, source: "pool" | "built", target: "pool" | "built") => {
    if (source === target) return;
    const sourceItems = source === "pool" ? poolTiles : builtTiles;
    const targetItems = target === "pool" ? poolTiles : builtTiles;
    const tile = sourceItems.find((item) => item.id === tileId);
    if (!tile) return;

    const nextSource = sourceItems.filter((item) => item.id !== tileId);
    const nextTarget = [...targetItems, tile];

    if (source === "pool") {
      setPoolTiles(nextSource);
      setBuiltTiles(nextTarget);
    } else {
      setBuiltTiles(nextSource);
      setPoolTiles(nextTarget);
    }
  };

  const submitAnswer = async () => {
    if (!sessionData || !currentRound) return;
    const answer =
      currentRound.interaction === "single_choice"
        ? choiceAnswer
        : builtTiles.map((item) => item.label);

    if (!answer || (Array.isArray(answer) && answer.length !== currentRound.items.length)) {
      return;
    }

    try {
      const result = await submitReadingLabAnswer(
        sessionData.session_id,
        { round_index: currentRound.index, answer },
        i18n.resolvedLanguage,
      );
      setFeedback(result);
      setStatus(result.is_correct ? copy.correct : copy.needsPractice);
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  const advanceSession = async () => {
    if (!sessionData || !feedback) return;
    const isLastRound = currentRoundIndex >= sessionData.rounds.length - 1;

    if (!isLastRound) {
      setCurrentRoundIndex((prev) => prev + 1);
      return;
    }

    try {
      const completed = await completeReadingLabSession(sessionData.session_id, i18n.resolvedLanguage);
      setSummary(completed);
      setSessionData(null);
      await loadSupport();
      setStatus(copy.sessionSummary);
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  return (
    <main className="page dashboard-page reading-lab-page">
      <section className="card reading-lab-header">
        <div className="student-v2-brand">
          <BrandLogo className="brand-icon" />
          <div>
            <h1>{copy.title}</h1>
            <p className="muted">{copy.subtitle}</p>
          </div>
        </div>
        <div className="dashboard-header-actions">
          <Link className="secondary-link" to={`${prefix}/reading-lab/student/dashboard`}>
            {copy.backToDashboard}
          </Link>
          <AccessibilityToolbar />
        </div>
      </section>

      {!support ? <section className="card"><p className="status-line">{status || copy.loading}</p></section> : null}

      {support && !support.is_support_active ? (
        <section className="card reading-lab-locked">
          <h2>{copy.lockedTitle}</h2>
          <p>{copy.lockedBody}</p>
          <p className="status-line">{status || copy.loading}</p>
        </section>
      ) : null}

      {support && support.is_support_active ? (
        <>
          <section className="reading-lab-top-grid">
            <article className="card reading-lab-stats-card">
              <div className="reading-lab-hero">
                <div>
                  <div className="section-title-row">
                    <h2>{copy.statsTitle}</h2>
                    <span className="status-chip">{support.student_label}</span>
                  </div>
                  <p className="muted">{copy.generatedForYou}</p>
                </div>
                <span className="reading-support-badge">{copy.personalizedTrackTitle}</span>
              </div>
              <div className="metrics-grid">
                <article className="card metric-pill">
                  <p>{copy.completedSessions}</p>
                  <strong>{support.progress.completed_sessions}</strong>
                </article>
                <article className="card metric-pill">
                  <p>{copy.averageAccuracy}</p>
                  <strong>{support.progress.average_accuracy}%</strong>
                </article>
                <article className="card metric-pill">
                  <p>{copy.totalXp}</p>
                  <strong>{support.progress.total_xp_earned}</strong>
                </article>
                <article className="card metric-pill">
                  <p>{copy.totalPoints}</p>
                  <strong>{support.progress.total_points_earned}</strong>
                </article>
              </div>
              <div className="reading-lab-focus-grid">
                <article className="reading-lab-focus-card">
                  <h3>{copy.focusLettersLabel}</h3>
                  <div className="reading-lab-focus-chip-row">
                    {focusLetters.length === 0 ? <p className="muted">{copy.focusEmpty}</p> : null}
                    {focusLetters.map((item) => (
                      <span className="reading-lab-focus-chip" key={`focus-letter-${item}`}>
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
                <article className="reading-lab-focus-card">
                  <h3>{copy.focusWordsLabel}</h3>
                  <div className="reading-lab-focus-chip-row">
                    {focusWords.length === 0 ? <p className="muted">{copy.focusEmpty}</p> : null}
                    {focusWords.map((item) => (
                      <span className="reading-lab-focus-chip" key={`focus-word-${item}`}>
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
                <article className="reading-lab-focus-card">
                  <h3>{copy.focusNumbersLabel}</h3>
                  <div className="reading-lab-focus-chip-row">
                    {focusNumbers.length === 0 ? <p className="muted">{copy.focusEmpty}</p> : null}
                    {focusNumbers.map((item) => (
                      <span className="reading-lab-focus-chip" key={`focus-number-${item}`}>
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
              </div>
              <div className="reading-lab-notes-box checkpoint-block">
                <h3>{copy.supportNotes}</h3>
                <p>{support.support_profile?.notes || copy.refreshHint}</p>
              </div>
            </article>

            <article className="card reading-lab-summary-card">
              <h3>{copy.bestGames}</h3>
              <div className="stack-list">
                {support.progress.by_game.map((item) => (
                  <article className="notification-item" key={item.game_key}>
                    <strong>{item.title}</strong>
                    <p>{item.play_count} {copy.sessionsLabel}</p>
                    <ProgressBar current={item.average_accuracy} max={100} />
                  </article>
                ))}
              </div>
            </article>
          </section>

          <section className="reading-lab-main-grid">
            <article className="card reading-lab-game-grid-card">
              <div className="section-title-row">
                <h2>{copy.gameShelfTitle}</h2>
                <p className="muted">{copy.gameShelfHint}</p>
              </div>
              <div className="reading-lab-game-grid">
                {games.map((game) => (
                  <article className="reading-lab-game-card" key={game.key}>
                    <div className="reading-lab-game-card-head">
                      <div>
                        <h3>{game.title}</h3>
                        <p className="muted">{game.description}</p>
                      </div>
                      <span className="status-chip">{game.reward_xp} XP</span>
                    </div>
                    <p className="muted">
                      +{game.reward_points} pts • {game.interaction === "ordered_tiles" ? copy.arrangeAnswer : copy.selectAnswer}
                    </p>
                    <div className="reading-lab-game-card-meta">
                      <span className="reading-support-soft-badge">{copy.personalizedTrackTitle}</span>
                      <span className="reading-support-soft-badge">{game.supports_audio ? "Audio" : "Visual"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void startGame(game.key)}
                      disabled={busyGameKey === game.key}
                    >
                      {busyGameKey === game.key ? "..." : copy.startGame}
                    </button>
                  </article>
                ))}
              </div>
            </article>

            <aside className="reading-lab-session-column">
              {sessionData && currentRound ? (
                <article className="card reading-lab-session-card">
                  <div className="request-head-row">
                    <div>
                      <h3>{sessionData.game.title}</h3>
                      <p className="muted">
                        {copy.roundLabel} {currentRoundIndex + 1} / {sessionData.rounds.length}
                      </p>
                    </div>
                    <span className="status-chip">
                      {sessionData.content_source === "ai" ? copy.aiGeneratedBadge : copy.fallbackGeneratedBadge}
                    </span>
                  </div>

                  <div className="reading-lab-session-meta">
                    <span className="reading-support-soft-badge">{sessionData.game.supports_audio ? "Audio" : "Visual"}</span>
                    {sessionData.focus_letters.map((item) => (
                      <span className="reading-lab-focus-chip" key={`session-letter-${item}`}>
                        {item}
                      </span>
                    ))}
                    {sessionData.focus_words.map((item) => (
                      <span className="reading-lab-focus-chip" key={`session-word-${item}`}>
                        {item}
                      </span>
                    ))}
                    {sessionData.focus_numbers.map((item) => (
                      <span className="reading-lab-focus-chip" key={`session-number-${item}`}>
                        {item}
                      </span>
                    ))}
                    {sessionData.focus_letters.length === 0 && sessionData.focus_words.length === 0 && sessionData.focus_numbers.length === 0 ? (
                      <span className="reading-support-soft-badge">{copy.focusEmpty}</span>
                    ) : null}
                  </div>

                  <h4>{currentRound.prompt}</h4>
                  {currentRound.display_text ? <p className="reading-lab-display">{currentRound.display_text}</p> : null}
                  {currentRound.audio_text ? (
                    <button type="button" className="secondary" onClick={() => speak(currentRound.audio_text)}>
                      {copy.listen}
                    </button>
                  ) : null}

                  {currentRound.interaction === "single_choice" ? (
                    <div className="reading-lab-choice-grid checkpoint-block">
                      {currentRound.items.map((item) => (
                        <button
                          type="button"
                          key={`${currentRound.index}-${item}`}
                          className={choiceAnswer === item ? "reading-lab-choice active" : "reading-lab-choice"}
                          onClick={() => setChoiceAnswer(item)}
                          disabled={feedback !== null}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="checkpoint-block">
                      <p className="muted">{copy.waitingDrop}</p>
                      <div
                        className="reading-lab-dropzone"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (dragState) moveTile(dragState.tileId, dragState.source, "built");
                          setDragState(null);
                        }}
                      >
                        <h4>{copy.answerStrip}</h4>
                        <div className="reading-lab-tile-row">
                          {builtTiles.length === 0 ? <p className="muted">{copy.waitingDrop}</p> : null}
                          {builtTiles.map((tile) => (
                            <button
                              type="button"
                              key={tile.id}
                              draggable={feedback === null}
                              className="reading-lab-tile"
                              onDragStart={() => setDragState({ tileId: tile.id, source: "built" })}
                              onClick={() => feedback === null && moveTile(tile.id, "built", "pool")}
                            >
                              {tile.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div
                        className="reading-lab-pool"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (dragState) moveTile(dragState.tileId, dragState.source, "pool");
                          setDragState(null);
                        }}
                      >
                        <h4>{copy.availableTiles}</h4>
                        <div className="reading-lab-tile-row">
                          {poolTiles.map((tile) => (
                            <button
                              type="button"
                              key={tile.id}
                              draggable={feedback === null}
                              className="reading-lab-tile secondary"
                              onDragStart={() => setDragState({ tileId: tile.id, source: "pool" })}
                              onClick={() => feedback === null && moveTile(tile.id, "pool", "built")}
                            >
                              {tile.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button type="button" className="secondary checkpoint-block" onClick={() => resetRoundState(currentRound)}>
                        {copy.resetOrder}
                      </button>
                    </div>
                  )}

                  <div className="inline-actions checkpoint-block">
                    <button
                      type="button"
                      onClick={() => void submitAnswer()}
                      disabled={
                        feedback !== null ||
                        (currentRound.interaction === "single_choice"
                          ? !choiceAnswer
                          : builtTiles.length !== currentRound.items.length)
                      }
                    >
                      {copy.submitAnswer}
                    </button>
                    {feedback ? (
                      <button type="button" className="secondary" onClick={() => void advanceSession()}>
                        {currentRoundIndex >= sessionData.rounds.length - 1 ? copy.finishSession : copy.nextRound}
                      </button>
                    ) : null}
                  </div>

                  {feedback ? (
                    <article className={`reading-lab-feedback ${feedback.is_correct ? "success" : "warning"}`}>
                      <strong>{feedback.is_correct ? copy.correct : copy.needsPractice}</strong>
                      <p>{feedback.feedback}</p>
                      <p>
                        {copy.correctAnswer}:{" "}
                        {Array.isArray(feedback.correct_answer)
                          ? feedback.correct_answer.join(" • ")
                          : feedback.correct_answer}
                      </p>
                    </article>
                  ) : null}
                </article>
              ) : (
                <article className="card reading-lab-empty-session">
                  <h3>{copy.sessionTitle}</h3>
                  <p className="muted">{copy.gameShelfHint}</p>
                  <p className="status-line">{status || copy.refreshHint}</p>
                </article>
              )}

              {summary ? (
                <article className="card reading-lab-complete-card">
                  <h3>{copy.sessionSummary}</h3>
                  <div className="metrics-grid">
                    <article className="card metric-pill">
                      <p>{copy.averageAccuracy}</p>
                      <strong>{summary.accuracy}%</strong>
                    </article>
                    <article className="card metric-pill">
                      <p>{copy.rewards}</p>
                      <strong>+{summary.points_awarded}</strong>
                    </article>
                    <article className="card metric-pill">
                      <p>XP</p>
                      <strong>+{summary.xp_awarded}</strong>
                    </article>
                    <article className="card metric-pill">
                      <p>{copy.level}</p>
                      <strong>{summary.progression.current_level}</strong>
                    </article>
                  </div>
                </article>
              ) : null}
            </aside>
          </section>
        </>
      ) : null}
    </main>
  );
}
