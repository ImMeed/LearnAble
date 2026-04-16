import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { useAccessibility } from "../../features/accessibility/AccessibilityContext";
import { actionClass, cx, inputClass, surfaceClass } from "../components/uiStyles";
import {
  DashboardShell,
  errorMessage,
  localePrefix,
  localeRequestConfig,
} from "./roleDashboardShared";

// ── Types ─────────────────────────────────────────────────────────────────────

type Subsection   = { id: string; title: string; content: string };
type Section      = { id: string; title: string; content: string; subsections: Subsection[] };
type Chapter      = { id: string; title: string; sections: Section[] };
type CourseDetail = {
  id: string; title: string; language: string;
  structure_json: { page_count: number; chapters: Chapter[] } | null;
};
type FlatNode     = { id: string; title: string; content: string };
type ChatMessage  = { role: "user" | "ai"; text: string };
type Flashcard    = { front: string; back: string };
type QuizQuestion = { question: string; options: string[]; correct: string; explanation: string };
type QuizAttempt  = { id: string; score: number; total: number; attempted_at: string };

// ── Icons — identical to CoursePage ──────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TimeIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function formatDuration(seconds: number): string {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StudentCoursePage() {
  const { courseId } = useParams();
  const { t, i18n } = useTranslation();
  const { settings: a11y } = useAccessibility();

  // Course data
  const [course, setCourse]                   = useState<CourseDetail | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [completedIds, setCompletedIds]       = useState<Set<string>>(new Set());
  const [status, setStatus]                   = useState("");
  const [isReading, setIsReading]             = useState(false);
  const [timeSpent, setTimeSpent]             = useState(0);

  // AI chat — always visible in content column, same as CoursePage
  const [showAIChat, setShowAIChat]     = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const chatLoading                     = useRef(false);
  const [chatLoadingState, setChatLoadingState] = useState(false);

  // Modals
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showHistory, setShowHistory]                 = useState(false);
  const [quizHistory, setQuizHistory]                 = useState<QuizAttempt[]>([]);

  // Flashcard modal state (matches spec)
  const [flashcardModal, setFlashcardModal] = useState<{
    open: boolean; cards: Flashcard[]; current: number; flipped: boolean; loading: boolean;
  }>({ open: false, cards: [], current: 0, flipped: false, loading: false });

  // Quiz modal state (matches spec)
  const [quizModal, setQuizModal] = useState<{
    open: boolean; questions: QuizQuestion[]; current: number;
    answers: Record<number, string>; showResult: boolean; loading: boolean;
  }>({ open: false, questions: [], current: 0, answers: {}, showResult: false, loading: false });

  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const prefix        = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const locale        = i18n.resolvedLanguage === "en" ? "en" : "ar";

  // ── Timer — same as CoursePage ────────────────────────────────────────────
  useEffect(() => {
    const id = window.setInterval(() => setTimeSpent(s => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // ── Load course + progress ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!courseId) return;
      setLoading(true);
      setStatus(t("dashboards.common.loading"));
      try {
        // Load course first — this is mandatory
        const courseRes = await apiClient.get<CourseDetail>(`/courses/${courseId}`, requestConfig);
        setCourse(courseRes.data);

        // Load progress separately — failure here should not block the course from showing
        let completedSectionIds: string[] = [];
        let lastSectionId: string | null = null;
        try {
          const progressRes = await apiClient.get<{ completed_section_ids: string[]; last_section_id: string | null }>(
            `/courses/${courseId}/progress`, requestConfig
          );
          completedSectionIds = progressRes.data.completed_section_ids;
          lastSectionId = progressRes.data.last_section_id;
        } catch {
          // progress load failing is non-fatal — continue with empty state
        }

        setCompletedIds(new Set(completedSectionIds));
        const chapters = courseRes.data.structure_json?.chapters ?? [];
        setActiveSectionId(lastSectionId ?? chapters[0]?.sections[0]?.id ?? null);
        setStatus("");
      } catch (err) {
        setStatus(errorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [courseId, requestConfig, t]);

  // ── Persist last-visited section ─────────────────────────────────────────
  useEffect(() => {
    if (!activeSectionId || !courseId) return;
    void apiClient.patch(
      `/courses/${courseId}/progress/last-section`,
      { section_id: activeSectionId },
      requestConfig
    ).catch(() => {});
  }, [activeSectionId]);

  // ── TTS — same pattern as CoursePage ─────────────────────────────────────
  useEffect(() => {
    if (!isReading) return;
    const text = activeNode?.content;
    if (!text || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = course?.language === "ar" ? "ar-SA" : "en-US";
    utterance.rate = a11y.ttsRate;
    utterance.onend = () => setIsReading(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [isReading, activeSectionId]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const flatSections: FlatNode[] = useMemo(
    () => course?.structure_json?.chapters.flatMap(ch =>
      ch.sections.flatMap(s => [s, ...s.subsections])
    ) ?? [],
    [course]
  );

  const activeNode = flatSections.find(s => s.id === activeSectionId) ?? null;
  const activeIdx  = flatSections.findIndex(s => s.id === activeSectionId);

  // Chapter context for color-coded hero + sidebar
  const activeChapter = course?.structure_json?.chapters.find(ch =>
    ch.sections.some(s => s.id === activeSectionId || s.subsections.some(sub => sub.id === activeSectionId))
  ) ?? null;
  const activeChapterIndex = (course?.structure_json?.chapters ?? []).indexOf(activeChapter!);
  const chColorClass = `ch-color-${Math.max(0, activeChapterIndex) % 6}`;

  // Real progress derived from completedIds
  const totalSections   = flatSections.length;
  const completedCount  = completedIds.size;
  const progressPercent = totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const onToggleDone = async () => {
    if (!activeSectionId || !courseId) return;
    const done = completedIds.has(activeSectionId);
    setCompletedIds(prev => {
      const n = new Set(prev);
      done ? n.delete(activeSectionId) : n.add(activeSectionId);
      return n;
    });
    try {
      if (done) await apiClient.delete(`/courses/${courseId}/progress/sections/${activeSectionId}`, requestConfig);
      else       await apiClient.post(`/courses/${courseId}/progress/sections/${activeSectionId}`, {}, requestConfig);
    } catch {
      setCompletedIds(prev => {
        const n = new Set(prev);
        done ? n.add(activeSectionId) : n.delete(activeSectionId);
        return n;
      });
    }
  };

  const sendAi = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading.current || !activeSectionId) return;
    setChatMessages(prev => [...prev, { role: "user", text: msg }]);
    setChatInput("");
    chatLoading.current = true;
    setChatLoadingState(true);
    try {
      const res = await apiClient.post<{ answer: string }>(
        `/courses/${courseId}/assist`,
        { section_id: activeSectionId, question: msg },
        requestConfig
      );
      setChatMessages(prev => [...prev, { role: "ai", text: res.data.answer }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: "ai", text: errorMessage(err) }]);
    } finally {
      chatLoading.current = false;
      setChatLoadingState(false);
    }
  };

  const openFlashcards = async () => {
    setFlashcardModal(m => ({ ...m, loading: true }));
    try {
      const res = await apiClient.post<Flashcard[]>(`/courses/${courseId}/flashcards`, { locale }, requestConfig);
      setFlashcardModal({ open: true, cards: res.data, current: 0, flipped: false, loading: false });
    } catch (err) {
      setStatus(errorMessage(err));
      setFlashcardModal(m => ({ ...m, loading: false }));
    }
  };

  const openQuiz = async () => {
    setQuizModal(m => ({ ...m, loading: true }));
    try {
      const res = await apiClient.post<QuizQuestion[]>(`/courses/${courseId}/quiz`, { locale }, requestConfig);
      setQuizModal({ open: true, questions: res.data, current: 0, answers: {}, showResult: false, loading: false });
    } catch (err) {
      setStatus(errorMessage(err));
      setQuizModal(m => ({ ...m, loading: false }));
    }
  };

  const loadQuizHistory = async () => {
    try {
      const res = await apiClient.get<QuizAttempt[]>(`/courses/${courseId}/quiz-attempts`, requestConfig);
      setQuizHistory(res.data);
      setShowHistory(true);
    } catch (err) { setStatus(errorMessage(err)); }
  };

  const submitQuizAnswer = (opt: string) => {
    const { current, answers, questions } = quizModal;
    if (answers[current] !== undefined) return;
    const newAnswers = { ...answers, [current]: opt };
    const isLast = current === questions.length - 1;
    setQuizModal(m => ({ ...m, answers: newAnswers }));
    if (isLast) {
      const score = questions.filter((q, i) => newAnswers[i] === q.correct).length;
      void apiClient.post(`/courses/${courseId}/quiz-attempts`, { score, total: questions.length }, requestConfig).catch(() => {});
    }
  };

  const quizScore = quizModal.questions.filter((q, i) => quizModal.answers[i] === q.correct).length;
  const quizPct   = Math.round((quizScore / Math.max(1, quizModal.questions.length)) * 100);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading && !course) return (
    <DashboardShell title={t("dashboards.course.title")} subtitle={t("dashboards.course.subtitle")}>
      <p className="status-line">{t("dashboards.common.loading")}</p>
    </DashboardShell>
  );

  // ── Render — mirrors CoursePage structure exactly ─────────────────────────
  return (
    <DashboardShell title={t("dashboards.course.title")} subtitle={t("dashboards.course.subtitle")}>

      {/* Header — identical to CoursePage */}
      <section className={cx(surfaceClass, "course-v2-header px-5 py-4 sm:px-6")}>
        <Link className={actionClass("soft")} to={`${prefix}/student/dashboard`}>
          {t("dashboards.course.backToDashboard")}
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {course?.title ?? t("dashboards.course.lesson")}
          </p>
          <h2 className="mt-2 text-[clamp(1.4rem,2vw,2rem)] font-semibold tracking-[-0.03em] text-foreground">
            {course?.title ?? t("dashboards.course.loading")}
          </h2>
        </div>
        <p className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-muted-foreground">
          <TimeIcon /> {formatDuration(timeSpent)}
        </p>
      </section>

      {/* Body layout — identical class names as CoursePage */}
      <section className="course-v2-layout">

        {/* Left: content + AI chat */}
        <section className="course-v2-content">

          {/* Reading card — dyslexia/ADHD optimised */}
          <article className={cx(surfaceClass, "p-5 sm:p-6")}>

            {/* Course-level progress bar */}
            <div className="course-reader-progress-bar">
              <div className="course-reader-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", marginBottom: "1.25rem" }}>
              {completedCount} / {totalSections} {t("dashboards.course.sectionsComplete", { defaultValue: "sections complete" })} — {progressPercent}%
            </p>

            {/* Chapter-colour hero banner */}
            <div className={`course-reader-hero ${chColorClass}`}>
              <p className="course-reader-chapter-badge">{activeChapter?.title ?? ""}</p>
              <h2 className="course-reader-section-title">
                {activeNode?.title ?? t("dashboards.course.loading")}
              </h2>
              {completedIds.has(activeSectionId ?? "") && (
                <span className="course-reader-complete-stamp">✓ {t("pdfCourse.done", { defaultValue: "Done" })}</span>
              )}
            </div>

            {/* Content split into readable chunks */}
            <div>
              {(activeNode?.content ?? "").split(/\n\n+/).filter(Boolean).map((chunk, i) => (
                <p key={i} className="course-reader-chunk">{chunk}</p>
              ))}
            </div>

            {/* Read aloud + mark done */}
            <div className="inline-actions checkpoint-block">
              <button type="button" className={actionClass("soft")} onClick={() => setIsReading(r => !r)}>
                {isReading ? t("dashboards.course.stopReading") : t("dashboards.course.readAloud")}
              </button>
              <button type="button" className={actionClass("soft")} onClick={onToggleDone}>
                {completedIds.has(activeSectionId ?? "")
                  ? t("pdfCourse.markIncomplete")
                  : t("dashboards.course.markSectionDone")}
              </button>
            </div>

            {/* Prev / Next navigation */}
            <div className="inline-actions checkpoint-block" style={{ justifyContent: "space-between" }}>
              <button
                type="button"
                className={actionClass("soft")}
                disabled={activeIdx <= 0}
                onClick={() => setActiveSectionId(flatSections[activeIdx - 1].id)}
              >
                {t("onboarding.back")}
              </button>
              <button
                type="button"
                className={actionClass("soft")}
                disabled={activeIdx >= flatSections.length - 1}
                onClick={() => setActiveSectionId(flatSections[activeIdx + 1].id)}
              >
                {t("common.continue")}
              </button>
            </div>
          </article>

          {/* AI chat — same as CoursePage (always shown, collapsible) */}
          {showAIChat ? (
            <article className={cx(surfaceClass, "checkpoint-block p-5 sm:p-6")}>
              <div className="section-title-row">
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                  {t("dashboards.course.aiChat")}
                </h3>
                <button type="button" className={actionClass("soft")} onClick={() => setShowAIChat(false)}>
                  {t("common.close")}
                </button>
              </div>
              <div className="stack-list">
                {chatMessages.map((m, i) => (
                  <article
                    key={`${m.role}-${i}`}
                    className={m.role === "user" ? "student-v2-chat-bubble user" : "student-v2-chat-bubble ai"}
                  >
                    {m.text}
                  </article>
                ))}
                {chatLoadingState && (
                  <article className="student-v2-chat-bubble ai">
                    {t("dashboards.common.loading")}
                  </article>
                )}
              </div>
              <div className="inline-actions checkpoint-block">
                <input
                  className={inputClass}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && void sendAi()}
                  placeholder={t("dashboards.course.chatPlaceholder")}
                />
                <button
                  type="button"
                  className={actionClass()}
                  onClick={() => void sendAi()}
                  disabled={!chatInput.trim()}
                >
                  {t("dashboards.studentV2.send")}
                </button>
              </div>
            </article>
          ) : (
            <button
              type="button"
              className={cx(actionClass("soft"), "checkpoint-block")}
              onClick={() => setShowAIChat(true)}
            >
              {t("dashboards.course.reopenAi")}
            </button>
          )}
        </section>

        {/* Right: sidebar — identical to CoursePage */}
        <aside className="course-v2-sidebar">

          {/* Sections list */}
          <article className={cx(surfaceClass, "p-5 sm:p-6")}>
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
              {t("dashboards.course.sections")}
            </h3>
            <div className="stack-list">
              {course?.structure_json?.chapters.map((ch, chIdx) => (
                <div key={ch.id}>
                  <p className={`course-sidebar-chapter ch-color-${chIdx % 6}`} style={{ background: `var(--chapter-color)` }}>
                    {ch.title}
                  </p>
                  {ch.sections.map(sec => (
                    <div key={sec.id}>
                      <button
                        type="button"
                        className={`course-v2-section-link ${activeSectionId === sec.id ? "active" : ""}`}
                        onClick={() => setActiveSectionId(sec.id)}
                      >
                        <span>{sec.title}</span>
                        {completedIds.has(sec.id) ? <CheckIcon /> : null}
                      </button>
                      {sec.subsections.map(sub => (
                        <button
                          key={sub.id}
                          type="button"
                          className={`course-v2-section-link ${activeSectionId === sub.id ? "active" : ""}`}
                          style={{ paddingInlineStart: "1.5rem" }}
                          onClick={() => setActiveSectionId(sub.id)}
                        >
                          <span>{sub.title}</span>
                          {completedIds.has(sub.id) ? <CheckIcon /> : null}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </article>

          {/* Actions — same grid as CoursePage */}
          <article className={cx(surfaceClass, "checkpoint-block p-5 sm:p-6")}>
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
              {t("dashboards.course.actions")}
            </h3>
            <div className="course-v2-actions-grid">
              <button
                type="button"
                className={actionClass()}
                disabled={flashcardModal.loading}
                onClick={() => void openFlashcards()}
              >
                {flashcardModal.loading ? t("pdfCourse.generating") : t("dashboards.course.openFlashcards")}
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => void loadQuizHistory()}
              >
                {t("pdfCourse.quizHistory")}
              </button>
              <button
                type="button"
                className="accent"
                disabled={quizModal.loading}
                onClick={() => void openQuiz()}
              >
                {quizModal.loading ? t("pdfCourse.generating") : t("dashboards.course.startQuiz")}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setIsReading(r => !r)}
              >
                {t("dashboards.course.readAloud")}
              </button>
            </div>
            <div className="inline-actions checkpoint-block">
              <button type="button" className={actionClass("soft")} onClick={() => setStatus(t("dashboards.course.reviewQueued"))}>
                {t("dashboards.course.reviewLesson")}
              </button>
              <button type="button" className={actionClass("soft")} onClick={() => setShowAIChat(true)}>
                {t("pdfCourse.askTutor")}
              </button>
            </div>
          </article>

          {/* Complete + status — same as CoursePage */}
          <article className={cx(surfaceClass, "checkpoint-block p-5 sm:p-6")}>
            <button type="button" className="course-v2-complete" onClick={() => setShowCompletionModal(true)}>
              {t("dashboards.course.markCourseComplete")}
            </button>
            <p className="status-line">{status || t("dashboards.common.idle")}</p>
          </article>

        </aside>
      </section>

      {/* ── Completion modal — identical to CoursePage ── */}
      {showCompletionModal && (
        <div className="course-v2-modal-backdrop" role="presentation" onClick={() => setShowCompletionModal(false)}>
          <article
            className={cx(surfaceClass, "course-v2-modal p-5 sm:p-6")}
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
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
                onClick={async () => {
                  setShowCompletionModal(false);
                  const unmarked = flatSections.filter(s => !completedIds.has(s.id));
                  for (const sec of unmarked) {
                    await apiClient.post(
                      `/courses/${courseId}/progress/sections/${sec.id}`, {}, requestConfig
                    ).catch(() => {});
                  }
                  setCompletedIds(new Set(flatSections.map(s => s.id)));
                  setStatus(t("dashboards.course.completed"));
                }}
              >
                {t("dashboards.course.confirmComplete")}
              </button>
            </div>
          </article>
        </div>
      )}

      {/* ── Flashcard modal ── */}
      {flashcardModal.open && (
        <div className="course-v2-modal-backdrop" role="presentation" onClick={() => setFlashcardModal(m => ({ ...m, open: false }))}>
          <article
            className={cx(surfaceClass, "course-v2-modal p-5 sm:p-6")}
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="section-title-row">
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                {t("pdfCourse.flashcardCounter", {
                  current: flashcardModal.current + 1,
                  total: flashcardModal.cards.length,
                  title: course?.title ?? "",
                })}
              </p>
              <button type="button" className={actionClass("soft")} onClick={() => setFlashcardModal(m => ({ ...m, open: false }))}>
                {t("common.close")}
              </button>
            </div>

            {/* Flip card */}
            <div
              className="scp-card-scene"
              onClick={() => setFlashcardModal(m => ({ ...m, flipped: !m.flipped }))}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === "Enter" && setFlashcardModal(m => ({ ...m, flipped: !m.flipped }))}
            >
              <div className={`scp-card ${flashcardModal.flipped ? "scp-card--flipped" : ""}`}>
                <div className="scp-card-face scp-card-front">
                  <span className="scp-card-label">QUESTION</span>
                  <p className="scp-card-text">{flashcardModal.cards[flashcardModal.current]?.front}</p>
                  <span className="scp-card-hint">{t("pdfCourse.flashcardsFlip")}</span>
                </div>
                <div className="scp-card-face scp-card-back">
                  <span className="scp-card-label">ANSWER</span>
                  <p className="scp-card-text">{flashcardModal.cards[flashcardModal.current]?.back}</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="inline-actions checkpoint-block" style={{ justifyContent: "space-between" }}>
              <button
                type="button"
                className={actionClass("soft")}
                disabled={flashcardModal.current === 0}
                onClick={() => setFlashcardModal(m => ({ ...m, current: m.current - 1, flipped: false }))}
              >
                {t("pdfCourse.flashcardsPrev")}
              </button>
              <span className="muted">{flashcardModal.current + 1} / {flashcardModal.cards.length}</span>
              <button
                type="button"
                className={actionClass("soft")}
                disabled={flashcardModal.current === flashcardModal.cards.length - 1}
                onClick={() => setFlashcardModal(m => ({ ...m, current: m.current + 1, flipped: false }))}
              >
                {t("pdfCourse.flashcardsNext")}
              </button>
            </div>
          </article>
        </div>
      )}

      {/* ── Quiz modal ── */}
      {quizModal.open && (
        <div className="course-v2-modal-backdrop" role="presentation" onClick={() => setQuizModal(m => ({ ...m, open: false }))}>
          <article
            className={cx(surfaceClass, "course-v2-modal p-5 sm:p-6")}
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: 580 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="section-title-row">
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                {quizModal.showResult
                  ? t("pdfCourse.quizResultTitle")
                  : t("pdfCourse.quizCounter", { current: quizModal.current + 1, total: quizModal.questions.length })}
              </p>
              <button type="button" className={actionClass("soft")} onClick={() => setQuizModal(m => ({ ...m, open: false }))}>
                {t("common.close")}
              </button>
            </div>

            {quizModal.showResult ? (
              /* Result screen */
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "1rem 0", textAlign: "center" }}>
                <p style={{ fontSize: "3.5rem", fontWeight: 800, lineHeight: 1, color: "var(--foreground)" }}>
                  {quizScore} / {quizModal.questions.length}
                </p>
                <p className="muted">{t("pdfCourse.quizResult", { score: quizScore, total: quizModal.questions.length })}</p>
                <div style={{ width: "100%", height: 10, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 999,
                    width: `${quizPct}%`,
                    background: quizPct >= 70 ? "#22c55e" : "#f59e0b",
                    transition: "width 0.6s ease",
                  }} />
                </div>
                <p className="muted" style={{ fontSize: "0.8rem" }}>{quizPct}%</p>
                <button type="button" className={actionClass()} onClick={() => setQuizModal(m => ({ ...m, open: false }))}>
                  {t("pdfCourse.quizClose")}
                </button>
              </div>
            ) : (
              /* Question screen */
              <div className="stack-list">
                <p style={{ fontWeight: 700, fontSize: "1rem", color: "var(--foreground)", lineHeight: 1.5 }}>
                  {quizModal.questions[quizModal.current]?.question}
                </p>
                <div className="stack-list">
                  {quizModal.questions[quizModal.current]?.options.map((opt, i) => {
                    const answered  = quizModal.answers[quizModal.current] !== undefined;
                    const chosen    = quizModal.answers[quizModal.current] === opt;
                    const isCorrect = quizModal.questions[quizModal.current].correct === opt;
                    const letter    = ["A", "B", "C", "D"][i] ?? String(i + 1);

                    let extraStyle: React.CSSProperties = {};
                    if (answered) {
                      if (isCorrect)   extraStyle = { borderColor: "#22c55e", background: "#f0fdf4" };
                      else if (chosen) extraStyle = { borderColor: "#ef4444", background: "#fef2f2" };
                    }

                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={answered}
                        className={`course-v2-section-link ${!answered && chosen ? "active" : ""}`}
                        style={{ gap: "0.75rem", border: "2px solid var(--border)", borderRadius: "0.75rem", padding: "0.75rem 1rem", ...extraStyle }}
                        onClick={() => submitQuizAnswer(opt)}
                      >
                        <span style={{
                          flexShrink: 0, width: 26, height: 26, borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.72rem", fontWeight: 800,
                          background: answered && isCorrect ? "#22c55e" : answered && chosen ? "#ef4444" : "var(--muted)",
                          color: (answered && (isCorrect || chosen)) ? "#fff" : "var(--foreground)",
                        }}>
                          {letter}
                        </span>
                        <span style={{ flex: 1, textAlign: "start" }}>{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {quizModal.answers[quizModal.current] !== undefined && (
                  <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: "0.6rem", padding: "0.75rem 1rem", lineHeight: 1.6 }}>
                    {quizModal.questions[quizModal.current].explanation}
                  </p>
                )}

                <div className="inline-actions checkpoint-block" style={{ justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className={actionClass()}
                    disabled={quizModal.answers[quizModal.current] === undefined}
                    onClick={() => {
                      const next = quizModal.current + 1;
                      if (next >= quizModal.questions.length) {
                        setQuizModal(m => ({ ...m, showResult: true }));
                      } else {
                        setQuizModal(m => ({ ...m, current: next }));
                      }
                    }}
                  >
                    {quizModal.current === quizModal.questions.length - 1
                      ? t("pdfCourse.quizFinish")
                      : t("pdfCourse.quizNext")}
                  </button>
                </div>
              </div>
            )}
          </article>
        </div>
      )}

      {/* ── Quiz history modal ── */}
      {showHistory && (
        <div className="course-v2-modal-backdrop" role="presentation" onClick={() => setShowHistory(false)}>
          <article
            className={cx(surfaceClass, "course-v2-modal p-5 sm:p-6")}
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
          >
            <div className="section-title-row">
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                {t("pdfCourse.quizHistoryTitle")}
              </h3>
              <button type="button" className={actionClass("soft")} onClick={() => setShowHistory(false)}>
                {t("common.close")}
              </button>
            </div>
            <div className="stack-list">
              {quizHistory.length === 0 ? (
                <p className="muted">{t("pdfCourse.quizHistoryEmpty")}</p>
              ) : quizHistory.map(a => (
                <div key={a.id} className="course-v2-section-link" style={{ cursor: "default" }}>
                  <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{a.score}/{a.total}</span>
                  <span className="muted" style={{ fontSize: "0.75rem" }}>
                    {new Date(a.attempted_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </div>
      )}

      {/* ── Card flip CSS ── */}
      <style>{`
        .scp-card-scene {
          perspective: 1000px;
          height: 200px;
          cursor: pointer;
          user-select: none;
        }
        .scp-card {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transition: transform 0.5s ease;
        }
        .scp-card--flipped { transform: rotateY(180deg); }
        .scp-card-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          border-radius: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1.25rem;
          text-align: center;
        }
        .scp-card-front {
          background: color-mix(in srgb, var(--primary) 8%, var(--card));
          border: 2px solid color-mix(in srgb, var(--primary) 20%, transparent);
        }
        .scp-card-back {
          background: var(--card);
          border: 2px solid var(--border);
          transform: rotateY(180deg);
        }
        .scp-card-label {
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          color: var(--muted-foreground);
          text-transform: uppercase;
        }
        .scp-card-text {
          font-size: 1rem;
          font-weight: 600;
          color: var(--foreground);
          line-height: 1.5;
          margin: 0;
        }
        .scp-card-hint {
          font-size: 0.68rem;
          color: var(--muted-foreground);
          margin-top: auto;
        }
      `}</style>

    </DashboardShell>
  );
}
