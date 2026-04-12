import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { BrandLogo } from "../components/BrandLogo";
import { useAccessibility } from "../../features/accessibility/AccessibilityContext";

// ─── Lesson mode types (existing /study/lessons/:id) ────────────────────────

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

// ─── Course mode types (PDF /courses/:id) ────────────────────────────────────

type Subsection = { id: string; title: string; content: string };
type Section = { id: string; title: string; content: string; subsections: Subsection[] };
type Chapter = { id: string; title: string; sections: Section[] };
type CourseStructure = { chapters: Chapter[] };

type CourseDetail = {
  id: string;
  title: string;
  language: "ar" | "en";
  status: "DRAFT" | "PUBLISHED";
  source_filename: string;
  source_page_count: number;
  structure_json: CourseStructure;
};

// ─── Shared types ─────────────────────────────────────────────────────────────

type SectionNode = { id: string; title: string; content: string };

type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function parseLessonSections(body: string, title: string, sectionTitleBuilder: (index: number) => string) {
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

// ─── Icons ───────────────────────────────────────────────────────────────────

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

// ─── Course Page (lesson mode) ────────────────────────────────────────────────

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
      parseLessonSections(
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

          <CourseAIChat
            chatMessages={chatMessages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            onSend={() => void sendAi()}
            showAIChat={showAIChat}
            setShowAIChat={setShowAIChat}
            t={t}
          />
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

          <CourseActions
            onFlashcards={() => setStatus(flashcards.length ? flashcards[0].front : t("dashboards.course.noFlashcards"))}
            onHelp={() => void askForHelp()}
            onQuiz={() => navigate(`${prefix}/student/dashboard`)}
            onReadAloud={() => setIsReading((prev) => !prev)}
            onReview={() => setStatus(t("dashboards.course.reviewQueued"))}
            onVideo={() => setStatus(games.length ? games[0].objective : t("dashboards.course.noGames"))}
            helpLoading={showHelpRequest}
            t={t}
          />

          <article className="card checkpoint-block">
            <button type="button" className="course-v2-complete" onClick={() => setShowCompletionModal(true)}>
              {t("dashboards.course.markCourseComplete")}
            </button>
            <p className="status-line">{status || t("dashboards.common.idle")}</p>
          </article>
        </aside>
      </section>

      {showCompletionModal ? (
        <CompletionModal
          onCancel={() => setShowCompletionModal(false)}
          onConfirm={() => {
            setShowCompletionModal(false);
            setStatus(t("dashboards.course.completed"));
          }}
          t={t}
        />
      ) : null}
    </main>
  );
}

// ─── PDF Course Page ──────────────────────────────────────────────────────────

export function PdfCoursePageV2() {
  const { id } = useParams();
  const courseId = id ?? "";
  const { t, i18n } = useTranslation();
  const { settings } = useAccessibility();
  const navigate = useNavigate();

  const [status, setStatus] = useState("");
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [selectedNode, setSelectedNode] = useState<SectionNode | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [timeSpent, setTimeSpent] = useState(0);
  const [showAIChat, setShowAIChat] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [showHelpRequest, setShowHelpRequest] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedSectionIds, setCompletedSectionIds] = useState<Set<string>>(new Set());

  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  // Flat list of all sections for prev/next navigation
  const allSections = useMemo<SectionNode[]>(() => {
    if (!course) return [];
    return course.structure_json.chapters.flatMap((ch) =>
      ch.sections.map((s) => ({ id: s.id, title: s.title, content: s.content ?? "" })),
    );
  }, [course]);

  const currentIndex = selectedNode ? allSections.findIndex((s) => s.id === selectedNode.id) : -1;

  useEffect(() => {
    const timerId = window.setInterval(() => setTimeSpent((prev) => prev + 1), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!courseId) return;
      setStatus(t("dashboards.common.loading"));
      try {
        const response = await apiClient.get<CourseDetail>(`/courses/${courseId}`, requestConfig);
        setCourse(response.data);
        const firstChapter = response.data.structure_json.chapters[0];
        if (firstChapter) {
          setExpandedChapters(new Set([firstChapter.id]));
          const firstSection = firstChapter.sections[0];
          if (firstSection) {
            setSelectedNode({ id: firstSection.id, title: firstSection.title, content: firstSection.content ?? "" });
          }
        }
        setStatus("");
      } catch (error) {
        setStatus(errorMessage(error));
      }
    };
    void load();
  }, [courseId, requestConfig, t]);

  useEffect(() => {
    if (!isReading) return;
    const text = selectedNode?.content;
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = course?.language === "ar" ? "ar-SA" : "en-US";
    utterance.onend = () => setIsReading(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [selectedNode, course?.language, isReading]);

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  const sendAi = async () => {
    const message = chatInput.trim();
    if (!message) return;
    setChatMessages((prev) => [...prev, { role: "user", text: message }]);
    setChatInput("");
    // Use selected section content as context in the message
    const context = selectedNode ? `[Section: ${selectedNode.title}]\n` : "";
    try {
      // Reuse the general AI assist endpoint — send course context as question prefix
      const response = await apiClient.post<{ answer?: string; content?: string }>(
        `/courses/${courseId}/assist`,
        { question: message, section_context: context },
        requestConfig,
      );
      const reply = response.data.answer ?? response.data.content ?? t("dashboards.course.aiNoResponse");
      setChatMessages((prev) => [...prev, { role: "ai", text: reply }]);
    } catch {
      // Fallback: echo a placeholder so UI doesn't break
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: t("dashboards.course.aiUnavailable", { defaultValue: "AI assistant coming soon for PDF courses." }) },
      ]);
    }
  };

  const askForHelp = async () => {
    if (showHelpRequest) return;
    setShowHelpRequest(true);
    try {
      await apiClient.post(
        "/teacher/assistance/requests",
        {
          topic: selectedNode?.title ?? course?.title ?? t("dashboards.course.helpTopic"),
          message: t("dashboards.course.helpMessage", { lesson: course?.title ?? t("dashboards.course.lesson") }),
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

  const markSectionDone = () => {
    if (!selectedNode) return;
    setCompletedSectionIds((prev) => new Set([...prev, selectedNode.id]));
  };

  const goToSection = (delta: 1 | -1) => {
    const next = allSections[currentIndex + delta];
    if (next) setSelectedNode(next);
  };

  const contentDir = course?.language === "ar" ? "rtl" : "ltr";

  return (
    <main className={`page dashboard-page course-v2-page ${settings.dyslexiaMode ? "dyslexia-mode" : ""}`}>
      {/* Header */}
      <section className="card course-v2-header">
        <Link className="secondary-link" to={`${prefix}/student/courses`}>
          {t("student.courses.backToList")}
        </Link>
        <div className="student-v2-brand">
          <BrandLogo className="brand-icon" />
          <h1>{course?.title ?? t("dashboards.course.loading")}</h1>
        </div>
        <p className="muted"><TimeIcon /> {formatDuration(timeSpent)}</p>
      </section>

      {/* Progress bar */}
      {allSections.length > 0 && (
        <div className="course-v2-progress-bar">
          <div className="course-v2-progress-track">
            <div
              className="course-v2-progress-fill"
              style={{ width: `${((currentIndex + 1) / allSections.length) * 100}%` }}
            />
          </div>
          <span className="course-v2-progress-label muted">
            {currentIndex + 1} / {allSections.length}
          </span>
        </div>
      )}

      {status ? <p className="status-line">{status}</p> : null}

      <section className="course-v2-layout">
        {/* Main content */}
        <section className="course-v2-content">
          <article className="card" dir={contentDir}>
            <div className="section-title-row">
              <h2>{selectedNode?.title ?? t("dashboards.course.loading")}</h2>
              <button type="button" className="secondary" onClick={() => setIsReading((prev) => !prev)}>
                {isReading ? t("dashboards.course.stopReading") : t("dashboards.course.readAloud")}
              </button>
            </div>

            <article className="course-v2-reading-card">
              {selectedNode?.content
                ? selectedNode.content
                    .split(/\n\s*\n/g)
                    .filter(Boolean)
                    .map((paragraph, i) => <p key={i}>{paragraph}</p>)
                : <p className="muted">{t("student.courses.selectSection")}</p>}
            </article>

            <div className="inline-actions checkpoint-block">
              <button type="button" className="secondary" onClick={markSectionDone} disabled={!selectedNode}>
                {t("dashboards.course.markSectionDone")}
              </button>
              {completedSectionIds.has(selectedNode?.id ?? "") && <CheckIcon />}
            </div>

            {/* Prev / Next */}
            <div className="inline-actions checkpoint-block">
              <button
                type="button"
                className="secondary"
                disabled={currentIndex <= 0}
                onClick={() => goToSection(-1)}
              >
                ← {t("dashboards.course.prevSection", { defaultValue: "Previous" })}
              </button>
              <button
                type="button"
                disabled={currentIndex >= allSections.length - 1}
                onClick={() => goToSection(1)}
              >
                {t("dashboards.course.nextSection", { defaultValue: "Next" })} →
              </button>
            </div>
          </article>

          <CourseAIChat
            chatMessages={chatMessages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            onSend={() => void sendAi()}
            showAIChat={showAIChat}
            setShowAIChat={setShowAIChat}
            t={t}
          />
        </section>

        {/* Sidebar */}
        <aside className="course-v2-sidebar">
          {/* Chapter/Section navigator */}
          <article className="card">
            <h3>{t("dashboards.course.sections")}</h3>
            <nav className="stack-list">
              {course?.structure_json.chapters.map((chapter, chapterIndex) => {
                const isOpen = expandedChapters.has(chapter.id);
                return (
                  <div key={chapter.id}>
                    <button
                      type="button"
                      className={`course-v2-section-link course-v2-chapter-btn ${isOpen ? "active" : ""}`}
                      onClick={() => toggleChapter(chapter.id)}
                    >
                      <span>{chapterIndex + 1}. {chapter.title}</span>
                      <span>{isOpen ? "▾" : "▸"}</span>
                    </button>
                    {isOpen && chapter.sections.map((section) => (
                      <button
                        type="button"
                        key={section.id}
                        className={`course-v2-section-link course-v2-section-indent ${selectedNode?.id === section.id ? "active" : ""}`}
                        onClick={() => setSelectedNode({ id: section.id, title: section.title, content: section.content ?? "" })}
                      >
                        <span>{section.title}</span>
                        {completedSectionIds.has(section.id) ? <CheckIcon /> : null}
                      </button>
                    ))}
                  </div>
                );
              })}
            </nav>
          </article>

          <CourseActions
            onFlashcards={() => setStatus(t("dashboards.course.noFlashcards"))}
            onHelp={() => void askForHelp()}
            onQuiz={() => navigate(`${prefix}/student/dashboard`)}
            onReadAloud={() => setIsReading((prev) => !prev)}
            onReview={() => setStatus(t("dashboards.course.reviewQueued"))}
            onVideo={() => setStatus(t("dashboards.course.noGames"))}
            helpLoading={showHelpRequest}
            t={t}
          />

          <article className="card checkpoint-block">
            <button type="button" className="course-v2-complete" onClick={() => setShowCompletionModal(true)}>
              {t("dashboards.course.markCourseComplete")}
            </button>
            <p className="status-line">{status || t("dashboards.common.idle")}</p>
          </article>
        </aside>
      </section>

      {showCompletionModal ? (
        <CompletionModal
          onCancel={() => setShowCompletionModal(false)}
          onConfirm={() => {
            setShowCompletionModal(false);
            setStatus(t("dashboards.course.completed"));
          }}
          t={t}
        />
      ) : null}
    </main>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

type TFunction = (key: string, options?: Record<string, unknown>) => string;

function CourseAIChat({
  chatMessages,
  chatInput,
  setChatInput,
  onSend,
  showAIChat,
  setShowAIChat,
  t,
}: {
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  onSend: () => void;
  showAIChat: boolean;
  setShowAIChat: (v: boolean) => void;
  t: TFunction;
}) {
  if (!showAIChat) {
    return (
      <button type="button" className="secondary checkpoint-block" onClick={() => setShowAIChat(true)}>
        {t("dashboards.course.reopenAi")}
      </button>
    );
  }

  return (
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
          onKeyDown={(e) => { if (e.key === "Enter" && chatInput.trim()) onSend(); }}
          placeholder={t("dashboards.course.chatPlaceholder")}
        />
        <button type="button" onClick={onSend} disabled={!chatInput.trim()}>
          {t("dashboards.studentV2.send")}
        </button>
      </div>
    </article>
  );
}

function CourseActions({
  onFlashcards,
  onHelp,
  onQuiz,
  onReadAloud,
  onReview,
  onVideo,
  helpLoading,
  t,
}: {
  onFlashcards: () => void;
  onHelp: () => void;
  onQuiz: () => void;
  onReadAloud: () => void;
  onReview: () => void;
  onVideo: () => void;
  helpLoading: boolean;
  t: TFunction;
}) {
  return (
    <article className="card checkpoint-block">
      <h3>{t("dashboards.course.actions")}</h3>
      <div className="course-v2-actions-grid">
        <button type="button" onClick={onFlashcards}>
          {t("dashboards.course.openFlashcards")}
        </button>
        <button type="button" className="danger" onClick={onHelp} disabled={helpLoading}>
          {helpLoading ? t("dashboards.course.sendingRequest") : t("dashboards.course.needHelp")}
        </button>
        <button type="button" className="accent" onClick={onQuiz}>
          {t("dashboards.course.startQuiz")}
        </button>
        <button type="button" className="secondary" onClick={onReadAloud}>
          {t("dashboards.course.readAloud")}
        </button>
      </div>
      <div className="inline-actions checkpoint-block">
        <button type="button" className="secondary" onClick={onReview}>
          {t("dashboards.course.reviewLesson")}
        </button>
        <button type="button" className="secondary" onClick={onVideo}>
          {t("dashboards.course.videoTutorial")}
        </button>
      </div>
    </article>
  );
}

function CompletionModal({
  onCancel,
  onConfirm,
  t,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  t: TFunction;
}) {
  return (
    <div className="course-v2-modal-backdrop" role="presentation" onClick={onCancel}>
      <article className="card course-v2-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p className="course-v2-modal-icon"><CheckIcon /></p>
        <h3>{t("dashboards.course.completeTitle")}</h3>
        <p>{t("dashboards.course.completeDescription")}</p>
        <div className="inline-actions checkpoint-block">
          <button type="button" className="secondary" onClick={onCancel}>
            {t("dashboards.course.cancel")}
          </button>
          <button type="button" onClick={onConfirm}>
            {t("dashboards.course.confirmComplete")}
          </button>
        </div>
      </article>
    </div>
  );
}
