import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { AccessibilityToolbar } from "../../features/accessibility/AccessibilityToolbar";
import { FocusTimerCard } from "../../features/accessibility/FocusTimerCard";
import { clearSession, getSession } from "../../state/auth";

type LessonSummary = {
  id: string;
  title: string;
  difficulty: string;
};

type LessonDetail = {
  id: string;
  title: string;
  body: string;
  difficulty: string;
};

type QuizSummary = {
  id: string;
  title: string;
  difficulty: string;
  reward_points: number;
  reward_xp: number;
};

type QuizQuestion = {
  id: string;
  text: string;
  options: Array<{ key: string; text: string }>;
};

type QuizAttempt = {
  attempt_id: string;
  quiz: QuizSummary;
  questions: QuizQuestion[];
};

type QuizSubmitResult = {
  score: number;
  total_questions: number;
  correct_answers: number;
  earned_points: number;
  earned_xp: number;
  wallet_balance: number;
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

type AssistanceRequestItem = {
  id: string;
  topic: string;
  message: string;
  status: string;
  scheduled_at: string | null;
};

type ForumReport = {
  id: string;
  target_type: "POST" | "COMMENT";
  status: string;
  reason: string;
};

type ForumSpace = {
  id: string;
  slug: string;
  name: string;
};

type Profile = {
  id: string;
  email: string;
  role: string;
};

type TeacherDashboardMetrics = {
  assigned_requests: number;
  pending_requests: number;
  scheduled_sessions: number;
  completed_sessions: number;
  active_tutors_online: number;
};

type TeacherTab = "overview" | "attendance" | "classrooms" | "courses" | "schedule" | "messages";

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    const payload = response?.data;
    if (typeof payload === "object" && payload && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (typeof detail === "object" && detail && "message" in detail) {
        return String((detail as { message?: unknown }).message);
      }
    }
    if (typeof payload === "object" && payload && "message" in payload) {
      return String((payload as { message?: unknown }).message);
    }
  }
  return String(error);
}

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

function formatDate(value: string | null, locale: "ar" | "en") {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(locale === "en" ? "en-US" : "ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function DashboardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const session = getSession();

  const onLogout = () => {
    clearSession();
    navigate(`${localePrefix(i18n.resolvedLanguage)}/login`);
  };

  return (
    <main className="page dashboard-page portal-page">
      <section className="card dashboard-header portal-header">
        <div className="portal-brand">
          <h1>{t("appTitle")}</h1>
          <p className="muted">{subtitle}</p>
          <p className="muted">{t("dashboards.shell.activeRole", { role: session?.role ?? t("dashboards.common.none") })}</p>
        </div>
        <div className="dashboard-header-actions">
          <Link className="secondary-link" to={localePrefix(i18n.resolvedLanguage)}>
            {t("dashboards.shell.backHome")}
          </Link>
          <button type="button" className="secondary" onClick={onLogout}>
            {t("dashboards.shell.logout")}
          </button>
          <AccessibilityToolbar />
        </div>
      </section>

      <section className="portal-section-head">
        <h2>{title}</h2>
      </section>

      {children}
    </main>
  );
}

function TeacherTabs({ active, onChange }: { active: TeacherTab; onChange: (tab: TeacherTab) => void }) {
  const { t } = useTranslation();
  const tabs: TeacherTab[] = ["overview", "attendance", "classrooms", "courses", "schedule", "messages"];

  return (
    <nav className="portal-tabs" aria-label={t("dashboards.teacher.tabsLabel")}>
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={active === tab ? "active" : ""}
          onClick={() => onChange(tab)}
        >
          {t(`dashboards.tabs.${tab}`)}
        </button>
      ))}
    </nav>
  );
}

export function StudentDashboardPage() {
  const { t, i18n } = useTranslation();

  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [status, setStatus] = useState("");
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [quizAttempt, setQuizAttempt] = useState<QuizAttempt | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState("");
  const [hintQuestionId, setHintQuestionId] = useState("");

  const selectedQuiz = quizzes.find((quiz) => quiz.id === selectedQuizId) ?? null;

  const loadAll = async () => {
    setStatus(t("dashboards.common.loading"));
    try {
      const [quizRes, notificationsRes] = await Promise.all([
        apiClient.get<{ items: QuizSummary[] }>("/quizzes", requestConfig),
        apiClient.get<{ items: NotificationItem[] }>("/notifications", requestConfig),
      ]);

      const nextQuizzes = quizRes.data.items || [];
      setQuizzes(nextQuizzes);
      setSelectedQuizId((current) => current || nextQuizzes[0]?.id || "");
      setNotifications(notificationsRes.data.items || []);
      setStatus(t("dashboards.student.statusLoaded"));
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage]);

  const startQuiz = async () => {
    if (!selectedQuizId) return;
    try {
      const response = await apiClient.post<QuizAttempt>(`/quizzes/${selectedQuizId}/play/init`, {}, requestConfig);
      setQuizAttempt(response.data);
      const defaults: Record<string, string> = {};
      response.data.questions.forEach((question) => {
        defaults[question.id] = question.options[0]?.key ?? "";
      });
      setQuizAnswers(defaults);
      setHintQuestionId(response.data.questions[0]?.id ?? "");
      setQuizResult("");
      setStatus(t("dashboards.student.quizStarted", { title: response.data.quiz.title }));
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  const submitQuiz = async () => {
    if (!selectedQuizId || !quizAttempt) return;
    try {
      const payload = {
        attempt_id: quizAttempt.attempt_id,
        answers: Object.entries(quizAnswers).map(([question_id, option_key]) => ({ question_id, option_key })),
      };
      const response = await apiClient.post<QuizSubmitResult>(`/quizzes/${selectedQuizId}/play/answer`, payload, requestConfig);
      setQuizResult(
        t("dashboards.student.quizResult", {
          score: response.data.score,
          correct: response.data.correct_answers,
          total: response.data.total_questions,
          points: response.data.earned_points,
          xp: response.data.earned_xp,
          wallet: response.data.wallet_balance,
        }),
      );
      setStatus(t("dashboards.student.quizSubmitted"));
      await loadAll();
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  const requestHint = async () => {
    if (!selectedQuizId || !hintQuestionId) return;
    try {
      const response = await apiClient.post<{ hint: string; wallet_balance: number }>(
        `/quizzes/${selectedQuizId}/hint`,
        { question_id: hintQuestionId },
        requestConfig,
      );
      setQuizResult(t("dashboards.student.hintResult", { hint: response.data.hint, wallet: response.data.wallet_balance }));
      setStatus(t("dashboards.student.hintUsed"));
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  return (
    <DashboardShell title={t("dashboards.student.title")} subtitle={t("dashboards.student.subtitle")}> 
      <section className="portal-grid">
        <article className="card portal-main-card">
          <header className="portal-block-header">
            <h3>{t("dashboards.student.chooseSubject")}</h3>
            <p className="muted">{t("dashboards.student.chooseSubjectHint")}</p>
          </header>

          <div className="subject-grid">
            {quizzes.map((quiz) => (
              <button
                key={quiz.id}
                type="button"
                className={`subject-card ${selectedQuizId === quiz.id ? "active" : ""}`}
                onClick={() => setSelectedQuizId(quiz.id)}
              >
                <strong>{quiz.title}</strong>
                <span>{t("dashboards.student.subjectMeta", { difficulty: quiz.difficulty })}</span>
                <span>{t("dashboards.student.subjectRewards", { points: quiz.reward_points, xp: quiz.reward_xp })}</span>
              </button>
            ))}
          </div>

          <section className="card portal-inner-card">
            <h4>{t("dashboards.student.quizInfoTitle")}</h4>
            <ul className="clean-list">
              <li>{t("dashboards.student.quizInfo1")}</li>
              <li>{t("dashboards.student.quizInfo2")}</li>
              <li>{t("dashboards.student.quizInfo3")}</li>
              <li>{t("dashboards.student.quizInfo4")}</li>
            </ul>
            <div className="inline-actions checkpoint-block">
              <button type="button" onClick={() => void startQuiz()} disabled={!selectedQuizId}>
                {t("dashboards.student.startQuiz", { subject: selectedQuiz?.title ?? t("dashboards.common.quiz") })}
              </button>
            </div>
          </section>

          {quizAttempt ? (
            <section className="card portal-inner-card checkpoint-block">
              <h4>{t("dashboards.student.attemptTitle", { title: quizAttempt.quiz.title })}</h4>
              <div className="stack-list">
                {quizAttempt.questions.map((question, index) => (
                  <article className="notification-item" key={question.id}>
                    <p>
                      <strong>{t("dashboards.student.questionNumber", { number: index + 1 })}</strong> {question.text}
                    </p>
                    <select
                      value={quizAnswers[question.id] ?? ""}
                      onChange={(event) =>
                        setQuizAnswers((prev) => ({
                          ...prev,
                          [question.id]: event.target.value,
                        }))
                      }
                    >
                      {question.options.map((option) => (
                        <option value={option.key} key={option.key}>
                          {option.key}. {option.text}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              </div>

              <label className="checkpoint-block">
                {t("dashboards.student.hintQuestion")}
                <select value={hintQuestionId} onChange={(event) => setHintQuestionId(event.target.value)}>
                  {quizAttempt.questions.map((question) => (
                    <option value={question.id} key={question.id}>
                      {question.text}
                    </option>
                  ))}
                </select>
              </label>

              <div className="inline-actions checkpoint-block">
                <button type="button" onClick={() => void submitQuiz()}>
                  {t("dashboards.student.submitQuiz")}
                </button>
                <button type="button" className="secondary" onClick={() => void requestHint()}>
                  {t("dashboards.student.useHint")}
                </button>
              </div>
            </section>
          ) : null}
        </article>

        <aside className="portal-side-column">
          <article className="card">
            <h4>{t("dashboards.common.sessionTools")}</h4>
            <FocusTimerCard />
          </article>

          <article className="card">
            <h4>{t("dashboards.student.notificationsTitle")}</h4>
            <div className="stack-list">
              {notifications.slice(0, 3).map((item) => (
                <article className="notification-item" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="card">
            <p className="status-line">{status || t("dashboards.common.idle")}</p>
            <button type="button" className="secondary" onClick={() => void loadAll()}>
              {t("dashboards.common.refresh")}
            </button>
            <p className="muted checkpoint-block">{quizResult || t("dashboards.student.noQuizResult")}</p>
          </article>
        </aside>
      </section>
    </DashboardShell>
  );
}

export function LessonPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const lessonId = id ?? "";
  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [status, setStatus] = useState(t("dashboards.common.idle"));
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [flashcards, setFlashcards] = useState<Array<{ front: string; back: string }>>([]);
  const [games, setGames] = useState<Array<{ id: string; name: string; objective: string; words: string[] }>>([]);

  const loadLesson = async () => {
    if (!lessonId) return;
    setStatus(t("dashboards.lesson.loading"));
    try {
      const [detailRes, flashcardsRes, gamesRes] = await Promise.all([
        apiClient.get<LessonDetail>(`/study/lessons/${lessonId}`, requestConfig),
        apiClient.get<{ items: Array<{ front: string; back: string }> }>(`/study/lessons/${lessonId}/flashcards`, requestConfig),
        apiClient.get<{ items: Array<{ id: string; name: string; objective: string; words: string[] }> }>(
          `/study/lessons/${lessonId}/games`,
          requestConfig,
        ),
      ]);
      setLesson(detailRes.data);
      setFlashcards(flashcardsRes.data.items || []);
      setGames(gamesRes.data.items || []);
      setStatus(t("dashboards.lesson.loaded"));
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  useEffect(() => {
    void loadLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, i18n.resolvedLanguage]);

  return (
    <DashboardShell title={lesson?.title ?? t("dashboards.lesson.title")} subtitle={t("dashboards.lesson.subtitle")}>
      <section className="portal-grid">
        <article className="card portal-main-card">
          <h3>{lesson?.title ?? t("dashboards.lesson.contentTitle")}</h3>
          <p>{lesson?.body ?? t("dashboards.lesson.loadingContent")}</p>
          <p className="muted">{t("dashboards.lesson.difficulty", { level: lesson?.difficulty ?? "-" })}</p>
          <p className="status-line">{status}</p>
        </article>

        <aside className="portal-side-column">
          <article className="card">
            <h4>{t("dashboards.lesson.flashcards")}</h4>
            <div className="stack-list">
              {flashcards.map((card, index) => (
                <article className="notification-item" key={`${card.front}-${index}`}>
                  <strong>{card.front}</strong>
                  <p>{card.back}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="card">
            <h4>{t("dashboards.lesson.games")}</h4>
            <div className="stack-list">
              {games.map((game) => (
                <article className="notification-item" key={game.id}>
                  <strong>{game.name}</strong>
                  <p>{game.objective}</p>
                  <p className="muted">{t("dashboards.lesson.words", { words: game.words.join(locale === "en" ? ", " : "، ") })}</p>
                </article>
              ))}
            </div>
            <Link className="secondary-link checkpoint-block" to={`${localePrefix(i18n.resolvedLanguage)}/student/dashboard`}>
              {t("dashboards.lesson.backToDashboard")}
            </Link>
          </article>
        </aside>
      </section>
    </DashboardShell>
  );
}

export function TeacherDashboardPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [metrics, setMetrics] = useState<TeacherDashboardMetrics | null>(null);
  const [requests, setRequests] = useState<AssistanceRequestItem[]>([]);
  const [activeTab, setActiveTab] = useState<TeacherTab>("overview");
  const [attendanceNote, setAttendanceNote] = useState("");

  const loadAll = async () => {
    setStatus(t("dashboards.common.loading"));
    try {
      const [profileRes, metricsRes, requestsRes] = await Promise.all([
        apiClient.get<Profile>("/tutor/profile", requestConfig),
        apiClient.get<TeacherDashboardMetrics>("/teacher/dashboard", requestConfig),
        apiClient.get<{ items: AssistanceRequestItem[] }>("/teacher/assistance/requests", requestConfig),
      ]);
      setProfile(profileRes.data);
      setMetrics(metricsRes.data);
      setRequests(requestsRes.data.items || []);
      setStatus(t("dashboards.teacher.loaded"));
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage]);

  const scheduleRequest = async (requestId: string) => {
    try {
      await apiClient.patch(
        `/teacher/assistance/requests/${requestId}/schedule`,
        {
          scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          meeting_url: "https://meet.example.com/learnable",
        },
        requestConfig,
      );
      setStatus(t("dashboards.teacher.requestApproved"));
      await loadAll();
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  const completeRequest = async (requestId: string) => {
    try {
      await apiClient.patch(`/teacher/assistance/requests/${requestId}/complete`, {}, requestConfig);
      setStatus(t("dashboards.teacher.requestCompleted"));
      await loadAll();
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  const students = [
    {
      name: t("dashboards.teacher.sampleStudent1"),
      engagement: t("dashboards.teacher.highEngagement"),
      progress: 76,
      attendance: "18/20",
    },
    {
      name: t("dashboards.teacher.sampleStudent2"),
      engagement: t("dashboards.teacher.mediumEngagement"),
      progress: 44,
      attendance: "15/19",
    },
    {
      name: t("dashboards.teacher.sampleStudent3"),
      engagement: t("dashboards.teacher.highEngagement"),
      progress: 88,
      attendance: "20/21",
    },
  ];

  return (
    <DashboardShell title={t("dashboards.teacher.title")} subtitle={t("dashboards.teacher.subtitle")}>
      <TeacherTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" ? (
        <section className="portal-grid">
          <article className="card portal-main-card">
            <h3>{t("dashboards.teacher.studentsOverview")}</h3>
            <div className="stack-list">
              {students.map((student) => (
                <article key={student.name} className="request-card">
                  <div className="request-head-row">
                    <strong>{student.name}</strong>
                    <span className="status-chip">{student.engagement}</span>
                  </div>
                  <p className="muted">{t("dashboards.teacher.progressLabel")}</p>
                  <div className="progress-track">
                    <span className="progress-fill" style={{ width: `${student.progress}%` }} />
                  </div>
                  <p className="muted">{t("dashboards.teacher.attendance", { value: student.attendance })}</p>
                </article>
              ))}
            </div>
          </article>

          <aside className="portal-side-column">
            <article className="card analytics-card">
              <h4>{t("dashboards.teacher.classAnalytics")}</h4>
              <p>{t("dashboards.teacher.avgCompletion", { value: 78 })}</p>
              <p>{t("dashboards.teacher.activeTutorsOnline", { value: metrics?.active_tutors_online ?? 0 })}</p>
              <p>{t("dashboards.teacher.pendingRequests", { count: metrics?.pending_requests ?? 0 })}</p>
            </article>

            <article className="card">
              <p className="status-line">{status || t("dashboards.common.idle")}</p>
              <button type="button" className="secondary" onClick={() => void loadAll()}>
                {t("dashboards.common.refresh")}
              </button>
              <p className="muted checkpoint-block">{profile?.email}</p>
            </article>
          </aside>
        </section>
      ) : null}

      {activeTab === "attendance" ? (
        <section className="card portal-main-card">
          <div className="request-head-row">
            <h3>{t("dashboards.teacher.attendanceManagement")}</h3>
            <p className="muted">{new Date().toLocaleDateString(locale === "en" ? "en-US" : "ar-EG")}</p>
          </div>
          <div className="inline-actions">
            <button type="button">{t("dashboards.teacher.present")}</button>
            <button type="button" className="secondary">{t("dashboards.teacher.late")}</button>
            <button type="button" className="secondary">{t("dashboards.teacher.absent")}</button>
          </div>
          <label className="checkpoint-block">
            {t("dashboards.teacher.classObservation")}
            <textarea
              rows={4}
              value={attendanceNote}
              onChange={(event) => setAttendanceNote(event.target.value)}
              placeholder={t("dashboards.teacher.classObservationPlaceholder")}
            />
          </label>
        </section>
      ) : null}

      {activeTab === "classrooms" ? (
        <section className="portal-grid">
          <article className="card portal-main-card">
            <h3>{t("dashboards.teacher.pendingJoinRequests", { count: requests.length })}</h3>
            <div className="stack-list">
              {requests.map((item) => (
                <article className="request-card" key={item.id}>
                  <div>
                    <strong>{item.topic}</strong>
                    <p>{item.message}</p>
                    <p className="muted">{t("dashboards.teacher.requestStatus", { status: item.status })}</p>
                  </div>
                  <div className="inline-actions">
                    <button type="button" onClick={() => void scheduleRequest(item.id)}>
                      {t("dashboards.teacher.approve")}
                    </button>
                    <button type="button" className="secondary" onClick={() => void completeRequest(item.id)}>
                      {t("dashboards.teacher.reject")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <aside className="portal-side-column">
            <article className="card">
              <h4>{t("dashboards.teacher.myClassrooms")}</h4>
              <div className="subject-grid">
                <article className="subject-card active">
                  <strong>{t("dashboards.teacher.classroomMath")}</strong>
                  <span>{t("dashboards.teacher.classroomPending", { count: 2 })}</span>
                </article>
                <article className="subject-card">
                  <strong>{t("dashboards.teacher.classroomHistory")}</strong>
                  <span>{t("dashboards.teacher.classroomPending", { count: 1 })}</span>
                </article>
              </div>
            </article>
          </aside>
        </section>
      ) : null}

      {activeTab === "courses" ? (
        <section className="card portal-main-card">
          <h3>{t("dashboards.teacher.coursesTitle")}</h3>
          <div className="subject-grid">
            <article className="subject-card active">
              <strong>{t("dashboards.teacher.course1")}</strong>
              <span>{t("dashboards.teacher.courseMeta", { lessons: 10 })}</span>
            </article>
            <article className="subject-card">
              <strong>{t("dashboards.teacher.course2")}</strong>
              <span>{t("dashboards.teacher.courseMeta", { lessons: 8 })}</span>
            </article>
            <article className="subject-card">
              <strong>{t("dashboards.teacher.course3")}</strong>
              <span>{t("dashboards.teacher.courseMeta", { lessons: 6 })}</span>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "schedule" ? (
        <section className="card portal-main-card">
          <h3>{t("dashboards.teacher.scheduleTitle")}</h3>
          <div className="stack-list">
            {requests
              .filter((item) => item.scheduled_at)
              .map((item) => (
                <article className="notification-item" key={item.id}>
                  <strong>{item.topic}</strong>
                  <p>{t("dashboards.teacher.scheduledOn", { date: formatDate(item.scheduled_at, locale) })}</p>
                </article>
              ))}
          </div>
        </section>
      ) : null}

      {activeTab === "messages" ? (
        <section className="card portal-main-card">
          <h3>{t("dashboards.teacher.messagesTitle")}</h3>
          <div className="stack-list">
            {requests.slice(0, 3).map((item) => (
              <article className="notification-item" key={item.id}>
                <strong>{item.topic}</strong>
                <p>{item.message}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </DashboardShell>
  );
}

export function ParentDashboardPage() {
  const { t, i18n } = useTranslation();
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const loadAll = async () => {
    setStatus(t("dashboards.common.loading"));
    try {
      const [profileRes, notificationsRes] = await Promise.all([
        apiClient.get<Profile>("/parent/profile", requestConfig),
        apiClient.get<{ items: NotificationItem[] }>("/notifications", requestConfig),
      ]);
      setProfile(profileRes.data);
      setNotifications(notificationsRes.data.items || []);
      setStatus(t("dashboards.parent.loaded"));
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage]);

  const markNotificationRead = async (id: string) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`, {}, requestConfig);
      await loadAll();
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  return (
    <DashboardShell title={t("dashboards.parent.title")} subtitle={t("dashboards.parent.subtitle")}>
      <section className="portal-grid">
        <article className="card portal-main-card">
          <section className="card portal-inner-card">
            <div className="request-head-row">
              <h3>{t("dashboards.parent.selectChild")}</h3>
              <button type="button">{t("dashboards.parent.addChild")}</button>
            </div>
            <article className="subject-card active child-card">
              <strong>{t("dashboards.parent.childName")}</strong>
              <span>{t("dashboards.parent.childId")}</span>
            </article>
          </section>

          <section className="card portal-inner-card gradient-card checkpoint-block">
            <h3>{t("dashboards.parent.welcomeBack")}</h3>
            <p>{t("dashboards.parent.weeklySummary")}</p>
          </section>

          <section className="checkpoint-block">
            <h3>{t("dashboards.parent.progressTitle")}</h3>
            <div className="metrics-grid">
              <article className="card metric-pill">
                <p>{t("dashboards.parent.level")}</p>
                <strong>12</strong>
              </article>
              <article className="card metric-pill">
                <p>{t("dashboards.parent.lessons")}</p>
                <strong>12/20</strong>
              </article>
              <article className="card metric-pill">
                <p>{t("dashboards.parent.streak")}</p>
                <strong>{t("dashboards.parent.streakDays", { count: 7 })}</strong>
              </article>
            </div>
          </section>

          <section className="card portal-inner-card checkpoint-block">
            <h4>{t("dashboards.parent.overallProgress")}</h4>
            <p className="muted">12 / 20</p>
            <div className="progress-track">
              <span className="progress-fill" style={{ width: "60%" }} />
            </div>
          </section>

          <section className="card portal-inner-card checkpoint-block">
            <h4>{t("dashboards.parent.messagesUpdates")}</h4>
            <div className="stack-list">
              {notifications.slice(0, 3).map((item) => (
                <article className="notification-item" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <div className="inline-actions">
                    {!item.is_read ? (
                      <button type="button" className="secondary" onClick={() => void markNotificationRead(item.id)}>
                        {t("dashboards.common.markRead")}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </article>

        <aside className="portal-side-column">
          <article className="card">
            <h4>{t("dashboards.parent.wellbeing")}</h4>
            <div className="stack-list">
              <div className="status-box status-success">
                <strong>{t("dashboards.parent.overallMood")}</strong>
                <p>{t("dashboards.parent.overallMoodValue")}</p>
              </div>
              <div className="status-box status-info">
                <strong>{t("dashboards.parent.focusLevel")}</strong>
                <p>{t("dashboards.parent.focusLevelValue")}</p>
              </div>
              <div className="status-box status-accent">
                <strong>{t("dashboards.parent.stressLevel")}</strong>
                <p>{t("dashboards.parent.stressLevelValue")}</p>
              </div>
            </div>
          </article>

          <article className="card">
            <h4>{t("dashboards.parent.recommendations")}</h4>
            <ul className="clean-list">
              <li>{t("dashboards.parent.rec1")}</li>
              <li>{t("dashboards.parent.rec2")}</li>
              <li>{t("dashboards.parent.rec3")}</li>
              <li>{t("dashboards.parent.rec4")}</li>
            </ul>
          </article>

          <article className="card quick-actions-card">
            <h4>{t("dashboards.parent.quickActions")}</h4>
            <button type="button">{t("dashboards.parent.messageTeacher")}</button>
            <button type="button" className="secondary">{t("dashboards.parent.viewReport")}</button>
            <button type="button" className="secondary">{t("dashboards.parent.scheduleMeeting")}</button>
          </article>

          <article className="card status-success">
            <h4>{t("dashboards.parent.keepItUp")}</h4>
            <p>{t("dashboards.parent.keepItUpText")}</p>
          </article>

          <article className="card">
            <p className="status-line">{status || t("dashboards.common.idle")}</p>
            <p className="muted">{profile?.email ?? "-"}</p>
          </article>
        </aside>
      </section>
    </DashboardShell>
  );
}

export function PsychologistDashboardPage() {
  const { t, i18n } = useTranslation();
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [status, setStatus] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [studentId, setStudentId] = useState("");
  const [reviewData, setReviewData] = useState("");
  const [supportLevel, setSupportLevel] = useState("MEDIUM");
  const [supportNotes, setSupportNotes] = useState("");

  const monitoringRows = [
    {
      name: t("dashboards.psych.student1"),
      score: 85,
      risk: t("dashboards.psych.lowRisk"),
      attention: t("dashboards.psych.high"),
      tone: "status-success",
    },
    {
      name: t("dashboards.psych.student2"),
      score: 62,
      risk: t("dashboards.psych.mediumRisk"),
      attention: t("dashboards.psych.medium"),
      tone: "status-accent",
    },
    {
      name: t("dashboards.psych.student3"),
      score: 45,
      risk: t("dashboards.psych.highRisk"),
      attention: t("dashboards.psych.low"),
      tone: "status-danger",
    },
  ];

  const loadAll = async () => {
    setStatus(t("dashboards.common.loading"));
    try {
      const notificationsRes = await apiClient.get<{ items: NotificationItem[] }>("/notifications", requestConfig);
      setNotifications(notificationsRes.data.items || []);
      setStatus(t("dashboards.psych.loaded"));
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage]);

  const loadReview = async () => {
    if (!studentId.trim()) return;
    try {
      const response = await apiClient.get(`/psychologist/reviews/students/${studentId}`, requestConfig);
      setReviewData(JSON.stringify(response.data, null, 2));
      setStatus(t("dashboards.psych.reviewLoaded"));
    } catch (error) {
      setReviewData("");
      setStatus(errorMessage(error));
    }
  };

  const confirmSupport = async (event: FormEvent) => {
    event.preventDefault();
    if (!studentId.trim()) return;
    try {
      await apiClient.post(
        `/psychologist/support/${studentId}/confirm`,
        {
          support_level: supportLevel,
          notes: supportNotes,
        },
        requestConfig,
      );
      setStatus(t("dashboards.psych.confirmed"));
      await loadAll();
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  return (
    <DashboardShell title={t("dashboards.psych.title")} subtitle={t("dashboards.psych.subtitle")}>
      <section className="portal-grid">
        <article className="card portal-main-card">
          <h3>{t("dashboards.psych.monitoring")}</h3>
          <div className="stack-list">
            {monitoringRows.map((row) => (
              <article key={row.name} className="request-card">
                <div className="request-head-row">
                  <strong>{row.name}</strong>
                  <span className={`status-chip ${row.tone}`}>{row.risk}</span>
                </div>
                <p>{t("dashboards.psych.screeningScore", { score: row.score })}</p>
                <p>{t("dashboards.psych.attentionLevel", { level: row.attention })}</p>
              </article>
            ))}
          </div>

          <section className="card portal-inner-card checkpoint-block">
            <h4>{t("dashboards.psych.notesRecommendations")}</h4>
            <form className="stack-form" onSubmit={(event) => void confirmSupport(event)}>
              <label>
                {t("dashboards.psych.studentId")}
                <input value={studentId} onChange={(event) => setStudentId(event.target.value)} />
              </label>
              <label>
                {t("dashboards.psych.supportLevel")}
                <input value={supportLevel} onChange={(event) => setSupportLevel(event.target.value)} />
              </label>
              <label>
                {t("dashboards.psych.notes")}
                <textarea rows={3} value={supportNotes} onChange={(event) => setSupportNotes(event.target.value)} />
              </label>
              <div className="inline-actions">
                <button type="button" className="secondary" onClick={() => void loadReview()}>
                  {t("dashboards.psych.loadReview")}
                </button>
                <button type="submit">{t("dashboards.psych.confirmPlan")}</button>
              </div>
            </form>
            <pre className="json-box checkpoint-block">{reviewData || t("dashboards.psych.noReview")}</pre>
          </section>
        </article>

        <aside className="portal-side-column">
          <article className="card analytics-card">
            <h4>{t("dashboards.psych.overview")}</h4>
            <p>{t("dashboards.psych.totalStudents", { count: 24 })}</p>
            <p>{t("dashboards.psych.highRiskCount", { count: 3 })}</p>
            <p>{t("dashboards.psych.mediumRiskCount", { count: 7 })}</p>
            <p>{t("dashboards.psych.lowRiskCount", { count: 14 })}</p>
          </article>

          <article className="card">
            <h4>{t("dashboards.psych.recentAlerts")}</h4>
            <div className="stack-list">
              {notifications.slice(0, 2).map((item) => (
                <article key={item.id} className="notification-item">
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <p className="muted">{formatDate(item.created_at, i18n.resolvedLanguage === "en" ? "en" : "ar")}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="card">
            <p className="status-line">{status || t("dashboards.common.idle")}</p>
            <button type="button" className="secondary" onClick={() => void loadAll()}>
              {t("dashboards.common.refresh")}
            </button>
          </article>
        </aside>
      </section>
    </DashboardShell>
  );
}

export function AdminDashboardPage() {
  const { t, i18n } = useTranslation();
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [spaces, setSpaces] = useState<ForumSpace[]>([]);
  const [reports, setReports] = useState<ForumReport[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const userRows = useMemo(
    () => [
      {
        id: "u1",
        name: t("dashboards.admin.user1"),
        email: "alex@student.com",
        role: t("dashboards.admin.roleStudent"),
        status: t("dashboards.admin.statusActive"),
        joined: "1/15/2026",
      },
      {
        id: "u2",
        name: t("dashboards.admin.user2"),
        email: "maria@student.com",
        role: t("dashboards.admin.roleStudent"),
        status: t("dashboards.admin.statusActive"),
        joined: "1/20/2026",
      },
      {
        id: "u3",
        name: t("dashboards.admin.user3"),
        email: "sarah@teacher.com",
        role: t("dashboards.admin.roleTeacher"),
        status: t("dashboards.admin.statusActive"),
        joined: "12/10/2025",
      },
    ],
    [t],
  );

  const filteredRows = userRows.filter((row) => {
    const roleMatched = roleFilter === "ALL" || row.role === roleFilter;
    const query = search.trim().toLowerCase();
    const searchMatched = !query || `${row.name} ${row.email}`.toLowerCase().includes(query);
    return roleMatched && searchMatched;
  });

  const loadAll = async () => {
    setStatus(t("dashboards.common.loading"));
    try {
      const [profileRes, spacesRes, reportsRes] = await Promise.all([
        apiClient.get<Profile>("/me", requestConfig),
        apiClient.get<{ items: ForumSpace[] }>("/forum/spaces", requestConfig),
        apiClient.get<{ items: ForumReport[] }>("/forum/reports?only_open=false", requestConfig),
      ]);

      setProfile(profileRes.data);
      setSpaces(spacesRes.data.items || []);
      setReports(reportsRes.data.items || []);
      setStatus(t("dashboards.admin.loaded"));
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage]);

  const moderateReport = async (reportId: string, action: "HIDE" | "RESTORE" | "REMOVE" | "DISMISS") => {
    try {
      await apiClient.post(
        `/forum/reports/${reportId}/moderate`,
        {
          action,
          review_notes: t("dashboards.admin.moderationNote"),
        },
        requestConfig,
      );
      setStatus(t("dashboards.admin.reportUpdated"));
      await loadAll();
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  return (
    <DashboardShell title={t("dashboards.admin.title")} subtitle={t("dashboards.admin.subtitle")}>
      <section className="metrics-grid">
        <article className="card metric-pill">
          <p>{t("dashboards.admin.totalUsers")}</p>
          <strong>6</strong>
        </article>
        <article className="card metric-pill">
          <p>{t("dashboards.admin.activeUsers")}</p>
          <strong>4</strong>
        </article>
        <article className="card metric-pill">
          <p>{t("dashboards.admin.pendingApprovals")}</p>
          <strong>{reports.filter((report) => report.status !== "DISMISSED").length}</strong>
        </article>
        <article className="card metric-pill">
          <p>{t("dashboards.admin.psychologists")}</p>
          <strong>{spaces.length}</strong>
        </article>
      </section>

      <section className="card portal-main-card">
        <div className="request-head-row">
          <h3>{t("dashboards.admin.pendingPsychApprovals")}</h3>
          <p className="muted">{profile?.email ?? "-"}</p>
        </div>
        <div className="stack-list">
          {reports.slice(0, 2).map((report) => (
            <article className="request-card" key={report.id}>
              <div>
                <strong>{report.id}</strong>
                <p>{t("dashboards.admin.reportReason", { reason: report.reason })}</p>
                <p className="muted">{t("dashboards.admin.reportType", { type: report.target_type })}</p>
              </div>
              <div className="inline-actions">
                <button type="button" onClick={() => void moderateReport(report.id, "RESTORE")}>
                  {t("dashboards.admin.approve")}
                </button>
                <button type="button" className="secondary" onClick={() => void moderateReport(report.id, "REMOVE")}>
                  {t("dashboards.admin.reject")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card portal-main-card">
        <div className="request-head-row">
          <h3>{t("dashboards.admin.userManagement")}</h3>
          <button type="button">{t("dashboards.admin.addUser")}</button>
        </div>

        <div className="inline-actions checkpoint-block">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("dashboards.admin.searchPlaceholder")}
          />
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="ALL">{t("dashboards.admin.allRoles")}</option>
            <option value={t("dashboards.admin.roleStudent")}>{t("dashboards.admin.roleStudent")}</option>
            <option value={t("dashboards.admin.roleTeacher")}>{t("dashboards.admin.roleTeacher")}</option>
          </select>
        </div>

        <table className="admin-table checkpoint-block">
          <thead>
            <tr>
              <th>{t("dashboards.admin.colName")}</th>
              <th>{t("dashboards.admin.colEmail")}</th>
              <th>{t("dashboards.admin.colRole")}</th>
              <th>{t("dashboards.admin.colStatus")}</th>
              <th>{t("dashboards.admin.colJoined")}</th>
              <th>{t("dashboards.admin.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.email}</td>
                <td>{row.role}</td>
                <td>{row.status}</td>
                <td>{row.joined}</td>
                <td>
                  <button type="button" className="secondary">
                    {t("dashboards.admin.deactivate")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <p className="status-line">{status || t("dashboards.common.idle")}</p>
      </section>
    </DashboardShell>
  );
}