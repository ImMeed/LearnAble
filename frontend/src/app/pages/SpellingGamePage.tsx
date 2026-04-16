import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eraser, RotateCcw, Volume2, VolumeX } from "lucide-react";

import { apiClient } from "../../api/client";
import { useAccessibility } from "../../features/accessibility/AccessibilityContext";
import { actionClass, cx, surfaceClass } from "../components/uiStyles";
import { DashboardShell, errorMessage, localePrefix, localeRequestConfig } from "./roleDashboardShared";

type SpellingSessionResponse = {
  session_id: string;
  activity_key: string;
  activity_title: string;
  difficulty: string;
  audio_text: string;
  word_length: number;
  hint_first_letter: string | null;
  status: string;
  attempt_count: number;
  mistakes_count: number;
  replay_count: number;
  typed_playback_count: number;
  started_at: string;
  completed_at: string | null;
};

type SpellingHintResponse = {
  session_id: string;
  first_letter: string;
  hint_used: boolean;
};

type SpellingAnswerResponse = {
  session_id: string;
  accepted: boolean;
  is_exact_match: boolean;
  is_near_match: boolean;
  solved: boolean;
  attempt_count: number;
  mistakes_count: number;
  feedback: string;
};

type SpellingCompletionResponse = {
  session_id: string;
  solved: boolean;
  is_near_match: boolean;
  hint_used: boolean;
  attempt_count: number;
  mistakes_count: number;
  replay_count: number;
  typed_playback_count: number;
  earned_points: number;
  earned_xp: number;
  wallet_balance: number;
  progression: {
    total_xp: number;
    current_level: number;
    next_level_xp: number;
    leveled_up: boolean;
    new_badges: string[];
  };
  completed_at: string;
};

type KeyboardLocale = "en" | "ar";

const EN_LAYOUT: string[][] = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

const AR_LAYOUT: string[][] = [
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج"],
  ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك"],
  ["ئ", "ء", "ؤ", "ر", "ى", "ة", "و", "ز", "ظ"],
];

function clampTypedValue(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return value.slice(0, limit);
}

export function SpellingGamePageV2() {
  const { t, i18n } = useTranslation();
  const { settings } = useAccessibility();

  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [status, setStatus] = useState("");
  const [sessionState, setSessionState] = useState<SpellingSessionResponse | null>(null);
  const [typedWord, setTypedWord] = useState("");
  const [feedback, setFeedback] = useState("");
  const [hintLetter, setHintLetter] = useState<string | null>(null);
  const [completion, setCompletion] = useState<SpellingCompletionResponse | null>(null);
  const [replayCount, setReplayCount] = useState(0);
  const [typedPlaybackCount, setTypedPlaybackCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [requestingHint, setRequestingHint] = useState(false);
  const [keyboardLocale, setKeyboardLocale] = useState<KeyboardLocale>(locale);

  const speechSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined";

  const keyboardRows = keyboardLocale === "en" ? EN_LAYOUT : AR_LAYOUT;
  const contentSpeechLang = locale === "en" ? "en-US" : "ar-SA";
  const keyboardSpeechLang = keyboardLocale === "en" ? "en-US" : "ar-SA";

  const speakText = useCallback(
    (text: string, preferredLang: string) => {
      if (!speechSupported || !text.trim()) return;

      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices?.() ?? [];
      const normalizedLang = preferredLang.toLowerCase();
      const matchedVoice = voices.find((voice) => {
        const voiceLang = voice.lang.toLowerCase();
        return voiceLang === normalizedLang || voiceLang.startsWith(`${normalizedLang.split("-")[0]}-`);
      });

      if (matchedVoice) {
        utterance.voice = matchedVoice;
        utterance.lang = matchedVoice.lang;
      } else if (normalizedLang.startsWith("ar")) {
        // Some browsers miss regional Arabic voices; generic "ar" is a safer fallback.
        utterance.lang = "ar";
      } else {
        utterance.lang = preferredLang;
      }

      utterance.rate = 0.92;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    [speechSupported],
  );

  const startSession = useCallback(async () => {
    setStatus(t("dashboards.spellingGame.loading"));
    setFeedback("");
    setCompletion(null);
    setTypedWord("");
    setHintLetter(null);

    try {
      const response = await apiClient.post<SpellingSessionResponse>("/spelling/sessions/start", {}, requestConfig);
      setSessionState(response.data);
      setReplayCount(response.data.replay_count || 0);
      setTypedPlaybackCount(response.data.typed_playback_count || 0);
      setStatus(t("dashboards.spellingGame.loaded"));
    } catch (error) {
      setStatus(errorMessage(error));
    }
  }, [requestConfig, t]);

  useEffect(() => {
    void startSession();
  }, [startSession]);

  useEffect(() => {
    setKeyboardLocale(locale);
  }, [locale]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!sessionState || completion) return;

      if (event.key === "Backspace") {
        event.preventDefault();
        setTypedWord((prev) => prev.slice(0, -1));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void submitAnswer();
        return;
      }

      if (event.key.length === 1) {
        setTypedWord((prev) => clampTypedValue(`${prev}${event.key}`, sessionState.word_length));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [completion, sessionState]);

  const onHearWord = () => {
    if (!sessionState) return;
    speakText(sessionState.audio_text, contentSpeechLang);
    setReplayCount((prev) => prev + 1);
  };

  const onHearTyped = () => {
    if (!typedWord.trim()) return;
    speakText(typedWord, keyboardSpeechLang);
    setTypedPlaybackCount((prev) => prev + 1);
  };

  const onKeyTap = (key: string) => {
    if (!sessionState || completion) return;
    setTypedWord((prev) => clampTypedValue(`${prev}${key}`, sessionState.word_length));

    if (!settings.focusMode) {
      speakText(key, keyboardSpeechLang);
    }
  };

  const onBackspace = () => {
    setTypedWord((prev) => prev.slice(0, -1));
  };

  const onClear = () => {
    setTypedWord("");
  };

  const requestHint = async () => {
    if (!sessionState || completion) return;
    setRequestingHint(true);
    try {
      const response = await apiClient.post<SpellingHintResponse>(
        `/spelling/sessions/${sessionState.session_id}/hint`,
        {},
        requestConfig,
      );
      setHintLetter(response.data.first_letter);
      setFeedback(t("dashboards.spellingGame.feedbackHint"));
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setRequestingHint(false);
    }
  };

  async function submitAnswer() {
    if (!sessionState || completion || !typedWord.trim()) {
      if (!typedWord.trim()) {
        setFeedback(t("dashboards.spellingGame.feedbackEmpty"));
      }
      return;
    }

    setSubmitting(true);
    try {
      const answerResponse = await apiClient.post<SpellingAnswerResponse>(
        `/spelling/sessions/${sessionState.session_id}/answer`,
        { answer: typedWord },
        requestConfig,
      );

      setSessionState((prev) =>
        prev
          ? {
              ...prev,
              attempt_count: answerResponse.data.attempt_count,
              mistakes_count: answerResponse.data.mistakes_count,
            }
          : prev,
      );
      setFeedback(answerResponse.data.feedback);

      if (!answerResponse.data.accepted) {
        return;
      }

      const completionResponse = await apiClient.post<SpellingCompletionResponse>(
        `/spelling/sessions/${sessionState.session_id}/complete`,
        {
          replay_count: replayCount,
          typed_playback_count: typedPlaybackCount,
        },
        requestConfig,
      );
      setCompletion(completionResponse.data);
      setStatus(t("dashboards.spellingGame.completed"));
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const isLocked = !sessionState || Boolean(completion);

  return (
    <DashboardShell title={t("dashboards.spellingGame.title")}>
      <section className={cx(surfaceClass, "spelling-game-layout p-5 sm:p-6")}> 
        <header className="spelling-game-head">
          <div>
            <h2>{t("dashboards.spellingGame.title")}</h2>
            <p className="muted">{t("dashboards.spellingGame.subtitle")}</p>
          </div>
          <div className="spelling-game-head-actions">
            <Link className={actionClass("soft")} to={`${prefix}/games`}>
              {t("dashboards.spellingGame.backToGames")}
            </Link>
            <button type="button" className={actionClass("soft")} onClick={() => void startSession()}>
              <RotateCcw className="ui-prefix-icon" /> {t("dashboards.spellingGame.newWord")}
            </button>
          </div>
        </header>

        <p className="status-line">{status || t("dashboards.common.idle")}</p>
        {feedback ? <p className="status-line">{feedback}</p> : null}

        {sessionState ? (
          <>
            <section className="spelling-slot-row" aria-label={t("dashboards.spellingGame.wordSlotsAria")}>
              {Array.from({ length: sessionState.word_length }).map((_, index) => {
                const typedChar = typedWord[index] ?? "";
                const hintChar = index === 0 && hintLetter && !typedChar ? hintLetter : "";
                return (
                  <span key={index} className="spelling-slot" dir={keyboardLocale === "ar" ? "rtl" : "ltr"}>
                    {typedChar ? (
                      typedChar
                    ) : hintChar ? (
                      <span className="spelling-slot-hint">{hintChar}</span>
                    ) : (
                      "_"
                    )}
                  </span>
                );
              })}
            </section>

            <section className="spelling-controls">
              <button type="button" className={actionClass("secondary")} onClick={onHearWord}>
                <Volume2 className="ui-prefix-icon" /> {t("dashboards.spellingGame.hearWord")}
              </button>
              <button
                type="button"
                className={actionClass("secondary")}
                onClick={onHearTyped}
                disabled={!typedWord.trim()}
              >
                <VolumeX className="ui-prefix-icon" /> {t("dashboards.spellingGame.hearTyped")}
              </button>
              <button
                type="button"
                className={actionClass("secondary")}
                onClick={() => void requestHint()}
                disabled={requestingHint || isLocked}
              >
                {requestingHint ? t("login.pleaseWait") : t("dashboards.spellingGame.firstLetterHint")}
              </button>
            </section>

            <section className="spelling-keyboard-block">
              <div className="spelling-keyboard-toggle">
                <span>{t("dashboards.spellingGame.keyboardLabel")}</span>
                <div className="spelling-keyboard-toggle-actions">
                  <button
                    type="button"
                    className={cx("spelling-toggle-btn", keyboardLocale === "en" && "is-active")}
                    onClick={() => setKeyboardLocale("en")}
                  >
                    {t("dashboards.spellingGame.keyboardEnglish")}
                  </button>
                  <button
                    type="button"
                    className={cx("spelling-toggle-btn", keyboardLocale === "ar" && "is-active")}
                    onClick={() => setKeyboardLocale("ar")}
                  >
                    {t("dashboards.spellingGame.keyboardArabic")}
                  </button>
                </div>
              </div>

              <div className="spelling-keyboard-rows" dir={keyboardLocale === "ar" ? "rtl" : "ltr"}>
                {keyboardRows.map((row, rowIndex) => (
                  <div className="spelling-keyboard-row" key={rowIndex}>
                    {row.map((key) => (
                      <button
                        type="button"
                        key={key}
                        className="spelling-key"
                        onClick={() => onKeyTap(key)}
                        disabled={isLocked}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              <div className="spelling-keyboard-actions">
                <button type="button" className={cx(actionClass("soft"), "spelling-action-btn")} onClick={onBackspace} disabled={isLocked}>
                  {t("dashboards.spellingGame.backspace")}
                </button>
                <button type="button" className={cx(actionClass("soft"), "spelling-action-btn")} onClick={onClear} disabled={isLocked}>
                  <Eraser className="ui-prefix-icon" /> {t("dashboards.spellingGame.clear")}
                </button>
                <button
                  type="button"
                  className={cx(actionClass(), "spelling-action-btn")}
                  onClick={() => void submitAnswer()}
                  disabled={submitting || isLocked}
                >
                  {submitting ? t("login.pleaseWait") : t("dashboards.spellingGame.submit")}
                </button>
              </div>
            </section>

            <p className="muted">{t("dashboards.spellingGame.timerOff")}</p>

            {completion ? (
              <article className="spelling-result-card">
                <h3>{completion.solved ? t("dashboards.spellingGame.resultSolved") : t("dashboards.spellingGame.resultTryAgain")}</h3>
                <p>
                  {t("dashboards.spellingGame.resultRewards", {
                    points: completion.earned_points,
                    xp: completion.earned_xp,
                    wallet: completion.wallet_balance,
                  })}
                </p>
                <p>
                  {t("dashboards.spellingGame.resultProgression", {
                    level: completion.progression.current_level,
                    totalXp: completion.progression.total_xp,
                  })}
                </p>
                {completion.progression.new_badges.length > 0 ? (
                  <p>{t("dashboards.spellingGame.resultBadges", { badges: completion.progression.new_badges.join(", ") })}</p>
                ) : null}
              </article>
            ) : null}
          </>
        ) : null}
      </section>
    </DashboardShell>
  );
}
