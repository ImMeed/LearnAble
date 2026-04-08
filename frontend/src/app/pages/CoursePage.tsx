import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { BrandLogo } from "../components/BrandLogo";
import { useAccessibility } from "../../features/accessibility/AccessibilityContext";

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

function localeRequestConfig(resolvedLanguage: string | undefined) {
  return {
    headers: {
      "x-lang": resolvedLanguage === "en" ? "en" : "ar",
    },
  };
}

function localePrefix(resolvedLanguage: string | undefined): string {
  return resolvedLanguage === "en" ? "/en" : "/ar";
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    const payload = response?.data;
    if (typeof payload === "object" && payload && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      return typeof detail === "string" ? detail : String(detail);
    }
  }
  return String(error);
}

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
  const { settings } = useAccessibility();
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
    <main className={`page dashboard-page course-v2-page ${settings.dyslexiaMode ? "dyslexia-mode" : ""}`}>
      <section className="card course-v2-header">
        <Link className="secondary-link" to={`${prefix}/student/dashboard`}>
          {t("dashboards.course.backToDashboard")}
        </Link>
        <div className="student-v2-brand">
          <BrandLogo className="brand-icon" />
          <h1>{t("appTitle")}</h1>
        </div>
        <p className="muted"><TimeIcon /> {formatDuration(timeSpent)}</p>
      </section>

      <section className="course-v2-layout">
        <section className="course-v2-content">
          <article className="card">
            <div className="section-title-row">
              <h2>{lesson?.title ?? t("dashboards.course.loading")}</h2>
              <button type="button" className="secondary" onClick={() => setIsReading((prev) => !prev)}>
                {isReading ? t("dashboards.course.stopReading") : t("dashboards.course.readAloud")}
              </button>
            </div>
            <p className="muted">{lesson?.difficulty}</p>
            <article className="course-v2-reading-card">
              <h3>{current?.title}</h3>
              <p>{current?.content}</p>
            </article>
            <div className="inline-actions checkpoint-block">
              <button type="button" className="secondary" onClick={markCurrentSectionDone}>
                {t("dashboards.course.markSectionDone")}
              </button>
            </div>
          </article>

          {showAIChat ? (
            <article className="card checkpoint-block">
              <div className="section-title-row">
                <h3>{t("dashboards.course.aiChat")}</h3>
                <button type="button" className="secondary" onClick={() => setShowAIChat(false)}>
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
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder={t("dashboards.course.chatPlaceholder")}
                />
                <button type="button" onClick={() => void sendAi()} disabled={!chatInput.trim()}>
                  {t("dashboards.studentV2.send")}
                </button>
              </div>
            </article>
          ) : (
            <button type="button" className="secondary checkpoint-block" onClick={() => setShowAIChat(true)}>
              {t("dashboards.course.reopenAi")}
            </button>
          )}
        </section>

        <aside className="course-v2-sidebar">
          <article className="card">
            <h3>{t("dashboards.course.sections")}</h3>
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

          <article className="card checkpoint-block">
            <h3>{t("dashboards.course.actions")}</h3>
            <div className="course-v2-actions-grid">
              <button type="button" onClick={() => setStatus(flashcards.length ? flashcards[0].front : t("dashboards.course.noFlashcards"))}>
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
              <button type="button" className="secondary" onClick={() => setStatus(t("dashboards.course.reviewQueued"))}>
                {t("dashboards.course.reviewLesson")}
              </button>
              <button type="button" className="secondary" onClick={() => setStatus(games.length ? games[0].objective : t("dashboards.course.noGames"))}>
                {t("dashboards.course.videoTutorial")}
              </button>
            </div>
          </article>

          <article className="card checkpoint-block">
            <button type="button" className="course-v2-complete" onClick={() => setShowCompletionModal(true)}>
              {t("dashboards.course.markCourseComplete")}
            </button>
            <p className="status-line">{status || t("dashboards.common.idle")}</p>
          </article>
        </aside>
      </section>

      {showCompletionModal ? (
        <div className="course-v2-modal-backdrop" role="presentation" onClick={() => setShowCompletionModal(false)}>
          <article className="card course-v2-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <p className="course-v2-modal-icon"><CheckIcon /></p>
            <h3>{t("dashboards.course.completeTitle")}</h3>
            <p>{t("dashboards.course.completeDescription")}</p>
            <div className="inline-actions checkpoint-block">
              <button type="button" className="secondary" onClick={() => setShowCompletionModal(false)}>
                {t("dashboards.course.cancel")}
              </button>
              <button
                type="button"
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
    </main>
  );
}
