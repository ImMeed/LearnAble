import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { actionClass, cx, inputClass, surfaceClass } from "../components/uiStyles";
import { DashboardShell, errorMessage, localePrefix, localeRequestConfig } from "./roleDashboardShared";

type LessonDetail = {
  id: string;
  title: string;
  body: string;
  difficulty: string;
};

type FlashcardItem = {
  front: string;
  back: string;
};

type ReadingGameItem = {
  id: string;
  name: string;
  objective: string;
  words: string[];
};

type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

function formatDuration(seconds: number): string {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function parseSections(body: string, title: string, sectionTitleBuilder: (index: number) => string) {
  const chunks = body
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    return [{ id: "section-1", title, content: body }];
  }

  return chunks.map((content, index) => ({
    id: `section-${index + 1}`,
    title: sectionTitleBuilder(index + 1),
    content,
  }));
}

function TimeIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CoursePageV2() {
  const { id } = useParams();
  const lessonId = id ?? "";
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [status, setStatus] = useState("");
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [games, setGames] = useState<ReadingGameItem[]>([]);
  const [timeSpent, setTimeSpent] = useState(0);
  const [showAIChat, setShowAIChat] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [currentSection, setCurrentSection] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [showHelpRequest, setShowHelpRequest] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedSections, setCompletedSections] = useState<number[]>([]);

  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const sections = useMemo(
    () =>
      parseSections(
        lesson?.body ?? "",
        lesson?.title ?? t("dashboards.course.section"),
        (index) => t("dashboards.course.sectionTitle", { title: lesson?.title ?? t("dashboards.course.section"), index }),
      ),
    [lesson, t],
  );

  useEffect(() => {
    const timerId = window.setInterval(() => setTimeSpent((prev) => prev + 1), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const loadCourse = async () => {
      if (!lessonId) return;
      setStatus(t("dashboards.common.loading"));
      try {
        const [lessonRes, flashcardRes, gamesRes] = await Promise.all([
          apiClient.get<LessonDetail>(`/study/lessons/${lessonId}`, requestConfig),
          apiClient.get<{ items: FlashcardItem[] }>(`/study/lessons/${lessonId}/flashcards`, requestConfig),
          apiClient.get<{ items: ReadingGameItem[] }>(`/study/lessons/${lessonId}/games`, requestConfig),
        ]);

        setLesson(lessonRes.data);
        setFlashcards(flashcardRes.data.items || []);
        setGames(gamesRes.data.items || []);
        setStatus(t("dashboards.course.loaded"));
      } catch (error) {
        setStatus(errorMessage(error));
      }
    };

    void loadCourse();
  }, [lessonId, requestConfig, t]);

  useEffect(() => {
    if (!isReading) return;
    const text = sections[currentSection]?.content;
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = i18n.resolvedLanguage === "en" ? "en-US" : "ar-SA";
    utterance.onend = () => setIsReading(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    return () => window.speechSynthesis.cancel();
  }, [currentSection, i18n.resolvedLanguage, isReading, sections]);

  const sendAi = async () => {
    const message = chatInput.trim();
    if (!message || !lessonId) return;

    setChatMessages((prev) => [...prev, { role: "user", text: message }]);
    setChatInput("");

    try {
      const response = await apiClient.post<{ content: string }>(
        `/study/lessons/${lessonId}/assist`,
        { mode: "qa", question: message },
        requestConfig,
      );
      setChatMessages((prev) => [...prev, { role: "ai", text: response.data.content }]);
    } catch (error) {
      setChatMessages((prev) => [...prev, { role: "ai", text: errorMessage(error) }]);
    }
  };

  const askForHelp = async () => {
    if (!lessonId || showHelpRequest) return;
    setShowHelpRequest(true);
    try {
      await apiClient.post(
        "/teacher/assistance/requests",
        {
          lesson_id: lessonId,
          topic: t("dashboards.course.helpTopic"),
          message: t("dashboards.course.helpMessage", { lesson: lesson?.title ?? t("dashboards.course.lesson") }),
        },
        requestConfig,
      );
      setStatus(t("dashboards.course.helpSent"));
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setShowHelpRequest(false);
    }
  };

  const markCurrentSectionDone = () => {
    setCompletedSections((prev) => (prev.includes(currentSection) ? prev : [...prev, currentSection]));
  };

  const openQuiz = () => {
    navigate(`${prefix}/student/dashboard`);
  };

  const current = sections[currentSection];

  return (
    <DashboardShell title={t("dashboards.course.title")} subtitle={t("dashboards.course.subtitle")}>
      <section className={cx(surfaceClass, "course-v2-header px-5 py-4 sm:px-6")}>
        <Link className={actionClass("soft")} to={`${prefix}/student/dashboard`}>
          {t("dashboards.course.backToDashboard")}
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {lesson?.difficulty ?? t("dashboards.course.lesson")}
          </p>
          <h2 className="mt-2 text-[clamp(1.4rem,2vw,2rem)] font-semibold tracking-[-0.03em] text-foreground">
            {lesson?.title ?? t("dashboards.course.loading")}
          </h2>
        </div>
        <p className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-muted-foreground">
          <TimeIcon /> {formatDuration(timeSpent)}
        </p>
      </section>

      <section className="course-v2-layout">
        <section className="course-v2-content">
          <article className={cx(surfaceClass, "p-5 sm:p-6")}>
            <div className="section-title-row">
              <h2 className="text-[clamp(1.35rem,2vw,1.9rem)] font-semibold tracking-[-0.03em] text-foreground">
                {lesson?.title ?? t("dashboards.course.loading")}
              </h2>
              <button type="button" className={actionClass("soft")} onClick={() => setIsReading((prev) => !prev)}>
                {isReading ? t("dashboards.course.stopReading") : t("dashboards.course.readAloud")}
              </button>
            </div>
            <p className="muted">{lesson?.difficulty}</p>
            <article className="course-v2-reading-card">
              <h3>{current?.title}</h3>
              <p>{current?.content}</p>
            </article>
            <div className="inline-actions checkpoint-block">
              <button type="button" className={actionClass("soft")} onClick={markCurrentSectionDone}>
                {t("dashboards.course.markSectionDone")}
              </button>
            </div>
          </article>

          {showAIChat ? (
            <article className={cx(surfaceClass, "checkpoint-block p-5 sm:p-6")}>
              <div className="section-title-row">
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{t("dashboards.course.aiChat")}</h3>
                <button type="button" className={actionClass("soft")} onClick={() => setShowAIChat(false)}>
                  {t("common.close")}
                </button>
              </div>
              <div className="stack-list">
                {chatMessages.map((message, index) => (
                  <article
                    key={`${message.role}-${index}`}
                    className={message.role === "user" ? "student-v2-chat-bubble user" : "student-v2-chat-bubble ai"}
                  >
                    {message.text}
                  </article>
                ))}
              </div>
              <div className="inline-actions checkpoint-block">
                <input
                  className={inputClass}
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder={t("dashboards.course.chatPlaceholder")}
                />
                <button type="button" className={actionClass()} onClick={() => void sendAi()} disabled={!chatInput.trim()}>
                  {t("dashboards.studentV2.send")}
                </button>
              </div>
            </article>
          ) : (
            <button type="button" className={cx(actionClass("soft"), "checkpoint-block")} onClick={() => setShowAIChat(true)}>
              {t("dashboards.course.reopenAi")}
            </button>
          )}
        </section>

        <aside className="course-v2-sidebar">
          <article className={cx(surfaceClass, "p-5 sm:p-6")}>
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{t("dashboards.course.sections")}</h3>
            <div className="stack-list">
              {sections.map((section, index) => (
                <button
                  type="button"
                  key={section.id}
                  className={`course-v2-section-link ${index === currentSection ? "active" : ""}`}
                  onClick={() => setCurrentSection(index)}
                >
                  <span>{section.title}</span>
                  {completedSections.includes(index) ? <CheckIcon /> : null}
                </button>
              ))}
            </div>
          </article>

          <article className={cx(surfaceClass, "checkpoint-block p-5 sm:p-6")}>
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{t("dashboards.course.actions")}</h3>
            <div className="course-v2-actions-grid">
              <button type="button" className={actionClass()} onClick={() => setStatus(flashcards.length ? flashcards[0].front : t("dashboards.course.noFlashcards"))}>
                {t("dashboards.course.openFlashcards")}
              </button>
              <button type="button" className="danger" onClick={() => void askForHelp()} disabled={showHelpRequest}>
                {showHelpRequest ? t("dashboards.course.sendingRequest") : t("dashboards.course.needHelp")}
              </button>
              <button type="button" className="accent" onClick={openQuiz}>
                {t("dashboards.course.startQuiz")}
              </button>
              <button type="button" className="secondary" onClick={() => setIsReading((prev) => !prev)}>
                {t("dashboards.course.readAloud")}
              </button>
            </div>
            <div className="inline-actions checkpoint-block">
              <button type="button" className={actionClass("soft")} onClick={() => setStatus(t("dashboards.course.reviewQueued"))}>
                {t("dashboards.course.reviewLesson")}
              </button>
              <button type="button" className={actionClass("soft")} onClick={() => setStatus(games.length ? games[0].objective : t("dashboards.course.noGames"))}>
                {t("dashboards.course.videoTutorial")}
              </button>
            </div>
          </article>

          <article className={cx(surfaceClass, "checkpoint-block p-5 sm:p-6")}>
            <button type="button" className="course-v2-complete" onClick={() => setShowCompletionModal(true)}>
              {t("dashboards.course.markCourseComplete")}
            </button>
            <p className="status-line">{status || t("dashboards.common.idle")}</p>
          </article>
        </aside>
      </section>

      {showCompletionModal ? (
        <div className="course-v2-modal-backdrop" role="presentation" onClick={() => setShowCompletionModal(false)}>
          <article
            className={cx(surfaceClass, "course-v2-modal p-5 sm:p-6")}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="course-v2-modal-icon"><CheckIcon /></p>
            <h3>{t("dashboards.course.completeTitle")}</h3>
            <p>{t("dashboards.course.completeDescription")}</p>
            <div className="inline-actions checkpoint-block">
              <button type="button" className={actionClass("soft")} onClick={() => setShowCompletionModal(false)}>
                {t("dashboards.course.cancel")}
              </button>
              <button
                type="button"
                className={actionClass()}
                onClick={() => {
                  setShowCompletionModal(false);
                  setStatus(t("dashboards.course.completed"));
                }}
              >
                {t("dashboards.course.confirmComplete")}
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </DashboardShell>
  );
}
