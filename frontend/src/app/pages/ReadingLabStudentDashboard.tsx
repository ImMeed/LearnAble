import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { fetchMyReadingSupport, fetchReadingLabGames } from "../../api/readingSupportApi";
import { ProgressBar } from "../components/ProgressBar";
import { ReadingLabPortalShell } from "../../features/readingLab/ReadingLabPortalShell";
import { getReadingLabCopy } from "../../features/readingLab/copy";
import { getReadingLabPortalCopy } from "../../features/readingLab/portalCopy";
import type { ReadingLabGame, ReadingSupportMe } from "../../features/readingLab/types";

function localePrefix(resolvedLanguage: string | undefined): string {
  return resolvedLanguage === "en" ? "/en" : "/ar";
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const payload = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof payload === "object" && payload && "message" in payload) {
      return String((payload as { message?: unknown }).message);
    }
  }
  return String(error);
}

export function ReadingLabStudentDashboardPage() {
  const { i18n } = useTranslation();
  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const portalCopy = useMemo(() => getReadingLabPortalCopy(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const readingCopy = useMemo(() => getReadingLabCopy(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [support, setSupport] = useState<ReadingSupportMe | null>(null);
  const [games, setGames] = useState<ReadingLabGame[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const load = async () => {
      setStatus(readingCopy.loading);
      try {
        const supportRes = await fetchMyReadingSupport(i18n.resolvedLanguage);
        setSupport(supportRes);
        if (supportRes.is_support_active) {
          setGames(await fetchReadingLabGames(i18n.resolvedLanguage));
        } else {
          setGames([]);
        }
        setStatus(readingCopy.refreshHint);
      } catch (error) {
        setStatus(errorMessage(error));
      }
    };

    void load();
  }, [i18n.resolvedLanguage, readingCopy.loading, readingCopy.refreshHint]);

  const focusLetters = support?.support_profile?.focus_letters ?? [];
  const focusWords = support?.support_profile?.focus_words ?? [];
  const focusNumbers = support?.support_profile?.focus_numbers ?? [];

  return (
    <ReadingLabPortalShell
      title={portalCopy.student.title}
      subtitle={portalCopy.student.subtitle}
      variant="student"
      actions={
        <Link className="secondary-link" to={`${prefix}/reading-lab/student/lab`}>
          {portalCopy.student.openGames}
        </Link>
      }
    >
      {!support ? (
        <section className="card">
          <p className="status-line">{status || readingCopy.loading}</p>
        </section>
      ) : null}

      {support && !support.is_support_active ? (
        <section className="reading-portal-student-grid">
          <article className="card kid-hero-card">
            <p className="reading-portal-kicker">{portalCopy.student.activePath}</p>
            <h2>{portalCopy.student.lockedTitle}</h2>
            <p>{portalCopy.student.lockedBody}</p>
            <article className="reading-portal-note checkpoint-block">
              <strong>{readingCopy.kidIdTitle}</strong>
              <p>{support.student_user_id}</p>
              <p className="muted">{readingCopy.kidIdHint}</p>
            </article>
            <p className="status-line">{status}</p>
          </article>
        </section>
      ) : null}

      {support && support.is_support_active ? (
        <section className="reading-portal-student-grid">
          <article className="card kid-hero-card">
            <p className="reading-portal-kicker">{portalCopy.student.activePath}</p>
            <h2>{portalCopy.student.introTitle}</h2>
            <p>{portalCopy.student.introBody}</p>
            <div className="kid-hero-actions">
              <Link className="public-button" to={`${prefix}/reading-lab/student/lab`}>
                {portalCopy.student.quickStart}
              </Link>
              <span className="reading-support-badge">{support.student_label}</span>
            </div>
            <article className="reading-portal-note checkpoint-block">
              <strong>{readingCopy.kidIdTitle}</strong>
              <p>{support.student_user_id}</p>
            </article>
          </article>

          <article className="card kid-focus-card">
            <h3>{portalCopy.student.focusTitle}</h3>
            <div className="reading-lab-focus-chip-row">
              {focusLetters.length === 0 && focusWords.length === 0 && focusNumbers.length === 0 ? <p className="muted">{readingCopy.focusEmpty}</p> : null}
              {focusLetters.map((item) => (
                <span className="reading-lab-focus-chip" key={`kid-letter-${item}`}>
                  {item}
                </span>
              ))}
              {focusWords.map((item) => (
                <span className="reading-lab-focus-chip" key={`kid-word-${item}`}>
                  {item}
                </span>
              ))}
              {focusNumbers.map((item) => (
                <span className="reading-lab-focus-chip" key={`kid-number-${item}`}>
                  {item}
                </span>
              ))}
            </div>
            <p className="muted checkpoint-block">{support.support_profile?.notes}</p>
          </article>

          <article className="card kid-progress-card">
            <h3>{portalCopy.student.progressTitle}</h3>
            <div className="metrics-grid">
              <article className="card metric-pill">
                <p>{portalCopy.student.sessions}</p>
                <strong>{support.progress.completed_sessions}</strong>
              </article>
              <article className="card metric-pill">
                <p>{portalCopy.student.accuracy}</p>
                <strong>{support.progress.average_accuracy}%</strong>
              </article>
              <article className="card metric-pill">
                <p>{portalCopy.student.xp}</p>
                <strong>{support.progress.total_xp_earned}</strong>
              </article>
            </div>
          </article>

          <article className="card kid-games-card">
            <div className="section-title-row">
              <h2>{portalCopy.student.gameShelf}</h2>
              <Link className="secondary-link" to={`${prefix}/reading-lab/student/lab`}>
                {portalCopy.student.openGames}
              </Link>
            </div>
            <div className="reading-lab-game-grid">
              {games.map((game) => {
                const progress = support.progress.by_game.find((item) => item.game_key === game.key);
                return (
                  <article className="reading-lab-game-card kid-game-card" key={game.key}>
                    <div className="reading-lab-game-card-head">
                      <div>
                        <h3>{game.title}</h3>
                        <p className="muted">{game.description}</p>
                      </div>
                      <span className="reading-support-soft-badge">{game.supports_audio ? "Audio" : "Visual"}</span>
                    </div>
                    <ProgressBar current={progress?.average_accuracy ?? 0} max={100} />
                    <p className="muted">
                      {progress?.play_count ?? 0} {readingCopy.sessionsLabel}
                    </p>
                  </article>
                );
              })}
            </div>
            <p className="status-line">{status}</p>
          </article>
        </section>
      ) : null}
    </ReadingLabPortalShell>
  );
}
