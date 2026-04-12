import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { AccessibilityToolbar } from "../components/AccessibilityToolbar";
import { ADHDToDoList } from "../components/ADHDToDoList";
import { BrandLogo } from "../components/BrandLogo";
import { FocusTimer } from "../components/FocusTimer";
import { ProgressBar } from "../components/ProgressBar";
import { useAccessibility } from "../../features/accessibility/AccessibilityContext";
import { clearSession } from "../../state/auth";
import { StudentCallFlow } from "../components/StudentCallFlow";

type LessonSummary = {
  id: string;
  title: string;
  difficulty: string;
};

type BadgeItem = {
  code: string;
  title: string;
  description: string;
  unlocked: boolean;
};

type Progression = {
  total_xp: number;
  current_level: number;
  next_level_xp: number;
  badges: BadgeItem[];
};

type GoalItem = {
  id: string;
  title: string;
  current: number;
  target: number;
};

type AiMessage = {
  role: "user" | "ai";
  text: string;
};

type AssistanceRequestItem = {
  id: string;
  topic: string;
  message: string;
  status: string;
  scheduled_at: string | null;
  meeting_url: string | null;
};

type TeacherPresenceItem = {
  tutor_user_id: string;
  updated_at: string;
};

type BadgeIconVariant = "streak" | "quiz" | "focus" | "xp" | "default";

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

function badgeVariantForCode(code: string): BadgeIconVariant {
  const key = code.toLowerCase();
  if (key.includes("streak")) return "streak";
  if (key.includes("quiz")) return "quiz";
  if (key.includes("focus")) return "focus";
  if (key.includes("xp") || key.includes("level")) return "xp";
  return "default";
}

function TrophyIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h10v3a5 5 0 0 1-10 0V4Z" fill="currentColor" />
      <path d="M5 5h2v2a3 3 0 0 1-3 3V8a3 3 0 0 0 1-3Zm14 0h-2v2a3 3 0 0 0 3 3V8a3 3 0 0 1-1-3Z" fill="currentColor" />
      <rect x="10" y="12" width="4" height="4" fill="currentColor" />
      <rect x="8" y="17" width="8" height="2" fill="currentColor" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3c0 3-3 4-3 7a3 3 0 0 0 6 0c0-2-1-3-3-7Z" fill="currentColor" />
      <path d="M6 14a6 6 0 0 0 12 0c0-2-1-4-3-6 0 3-2 5-3 5s-3-2-3-5c-2 2-3 4-3 6Z" fill="currentColor" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Z" fill="currentColor" />
      <path d="M8 7h7v2H8V7Zm0 4h7v2H8v-2Z" fill="var(--card)" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v10H9l-5 4V5Z" fill="currentColor" />
    </svg>
  );
}

function BadgeIcon({ variant }: { variant: BadgeIconVariant }) {
  const className = `student-v2-badge-svg ${variant}`;
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v10M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function StudentDashboardPageV2() {
  const { t, i18n } = useTranslation();
  const { settings, setFocusMode } = useAccessibility();
  const navigate = useNavigate();

  const [status, setStatus] = useState("");
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [progression, setProgression] = useState<Progression | null>(null);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [showTodoList, setShowTodoList] = useState(true);
  const [showAIChat, setShowAIChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<AiMessage[]>([]);
  const [activeTeachers, setActiveTeachers] = useState<TeacherPresenceItem[]>([]);
  const [assistanceRequests, setAssistanceRequests] = useState<AssistanceRequestItem[]>([]);
  const [requestingTeacherId, setRequestingTeacherId] = useState<string | null>(null);

  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const fallbackGoals: GoalItem[] = [
    { id: "goal-lessons", title: t("dashboards.studentV2.goalLessons"), current: 1, target: 2 },
    { id: "goal-minutes", title: t("dashboards.studentV2.goalMinutes"), current: 22, target: 30 },
    { id: "goal-xp", title: t("dashboards.studentV2.goalXp"), current: 150, target: 200 },
  ];
  const visibleLessons = lessons.slice(0, 6);

  const requestStatusLabel = (status: string): string => {
    if (status === "REQUESTED") return t("callFlow.statusRequested");
    if (status === "SCHEDULED") return t("callFlow.statusScheduled");
    if (status === "COMPLETED") return t("callFlow.statusCompleted");
    return status;
  };

  const displayTeacherName = (teacherId: string): string => {
    return t("callFlow.teacherName", { n: teacherId.slice(0, 8) });
  };

  const openMeetingLink = (meetingUrl: string) => {
    if (meetingUrl.startsWith("http://") || meetingUrl.startsWith("https://")) {
      window.location.href = meetingUrl;
      return;
    }

    const normalizedPath = meetingUrl.startsWith("/") ? meetingUrl : `/${meetingUrl}`;
    navigate(normalizedPath);
  };

  const requestCall = async (teacherId: string) => {
    setRequestingTeacherId(teacherId);
    try {
      await apiClient.post(
        "/teacher/assistance/requests",
        {
          topic: t("callFlow.requestTopic"),
          message: t("callFlow.requestMessage", { teacher: displayTeacherName(teacherId) }),
          preferred_at: new Date().toISOString(),
        },
        requestConfig,
      );
      setStatus(t("callFlow.requestSent"));
      await loadDashboard();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setRequestingTeacherId(null);
    }
  };

  const loadDashboard = async () => {
    setStatus(t("dashboards.common.loading"));
    try {
      const [lessonRes, progressionRes, activeTeachersRes, requestsRes] = await Promise.all([
        apiClient.get<{ items: LessonSummary[] }>("/study/lessons", requestConfig),
        apiClient.get<Progression>("/gamification/progression/me", requestConfig),
        apiClient.get<{ items: TeacherPresenceItem[] }>("/teacher/presence/active", requestConfig),
        apiClient.get<{ items: AssistanceRequestItem[] }>("/teacher/assistance/requests", requestConfig),
      ]);

      setLessons(lessonRes.data.items || []);
      setProgression(progressionRes.data);
      setActiveTeachers(activeTeachersRes.data.items || []);
      setAssistanceRequests(requestsRes.data.items || []);

      setGoals(fallbackGoals);

      setStatus(t("dashboards.studentV2.loaded"));
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage]);

  const onLogout = () => {
    clearSession();
    navigate(`${prefix}/login`);
  };

  const sendAiMessage = async () => {
    const text = chatInput.trim();
    if (!text) return;

    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatInput("");

    try {
      const response = await apiClient.post<{ explanation: string }>(
        "/ai/explain",
        { text },
        requestConfig,
      );
      setChatMessages((prev) => [...prev, { role: "ai", text: response.data.explanation }]);
    } catch (error) {
      setChatMessages((prev) => [...prev, { role: "ai", text: errorMessage(error) }]);
    }
  };

  return (
    <main className="page dashboard-page student-v2-page">
      <section className="card dashboard-header student-v2-header">
        <div className="student-v2-brand">
          <BrandLogo className="brand-icon" />
          <h1>{t("appTitle")}</h1>
        </div>
        <div className="dashboard-header-actions">
          <AccessibilityToolbar />
          <button type="button" className="secondary" onClick={onLogout}>
            {t("dashboards.shell.logout")}
          </button>
        </div>
      </section>

      {settings.xpSystem && progression ? (
        <section className="card student-v2-xp-row">
          <p><TrophyIcon /> {t("dashboards.studentV2.level", { level: progression.current_level })}</p>
          <p><FlameIcon /> {t("dashboards.studentV2.streak", { days: 7 })}</p>
          <ProgressBar current={progression.total_xp} max={progression.next_level_xp} color="accent" />
        </section>
      ) : null}

      {settings.focusMode ? (
        <section className="focus-banner">
          <p>{t("dashboards.studentV2.focusModeActive")}</p>
          <button type="button" className="secondary" onClick={() => setFocusMode(false)}>
            {t("dashboards.studentV2.exitFocusMode")}
          </button>
        </section>
      ) : null}

      <section className="dashboard-grid student-v2-grid">
        <section className="left-span student-v2-main-column">
          <article className="card">
            <div className="section-title-row">
              <h2>{t("dashboards.studentV2.continueLearning")}</h2>
              <div className="inline-actions">
                <Link className="secondary-link" to={`${prefix}/student/courses`}>
                  {t("student.dashboard.coursesLink")}
                </Link>
                {!settings.focusMode ? (
                  <button type="button" className="secondary" onClick={() => setFocusMode(true)}>
                    {t("dashboards.studentV2.enableFocusMode")}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="lesson-grid">
              {visibleLessons.map((lesson, index) => (
                <Link className="lesson-card" to={`${prefix}/student/course/${lesson.id}`} key={lesson.id}>
                  <div className="request-head-row">
                    <div>
                      <p className="lesson-subject">{lesson.difficulty}</p>
                      <h3>{lesson.title}</h3>
                    </div>
                    <BookIcon />
                  </div>
                  <ProgressBar current={(index + 1) * 20} max={100} showPercentage={false} />
                </Link>
              ))}
            </div>
          </article>

          {settings.badges ? (
            <article className="card checkpoint-block">
              <h2>{t("dashboards.studentV2.achievements")}</h2>
              <div className="student-v2-badges-grid">
                {(progression?.badges || []).map((badge) => (
                  <article
                    key={badge.code}
                    className={`student-v2-badge ${badge.unlocked ? "unlocked" : "locked"}`}
                    title={badge.description}
                  >
                    <BadgeIcon variant={badgeVariantForCode(badge.code)} />
                    <p>{badge.title}</p>
                  </article>
                ))}
              </div>
            </article>
          ) : null}

          <article className="card checkpoint-block">
            <div className="section-title-row">
              <h2>{t("dashboards.studentV2.myTasks")}</h2>
              <button type="button" className="secondary" onClick={() => setShowTodoList((prev) => !prev)}>
                {showTodoList ? t("dashboards.studentV2.hideTasks") : t("dashboards.studentV2.showTasks")}
              </button>
            </div>
            {showTodoList ? <ADHDToDoList /> : null}
          </article>
        </section>

        <aside className="student-v2-side-column">
          <FocusTimer defaultDuration={25} />

          <article className="card checkpoint-block">
            <h3><ClockIcon /> {t("dashboards.studentV2.todayGoals")}</h3>
            <div className="stack-list">
              {goals.map((goal) => (
                <div key={goal.id}>
                  <p className="muted">{goal.title}</p>
                  <ProgressBar current={goal.current} max={goal.target} showPercentage={false} />
                </div>
              ))}
            </div>
          </article>

          <article className="card checkpoint-block">
            <p className="muted">{t("callFlow.sectionLabel")}</p>
            <h3>{t("callFlow.sectionTitle")}</h3>

            <div className="stack-list checkpoint-block">
              {activeTeachers.length === 0 ? (
                <p className="muted">{t("callFlow.noTeachers")}</p>
              ) : (
                activeTeachers.map((teacher) => {
                  const teacherName = displayTeacherName(teacher.tutor_user_id);
                  const isSending = requestingTeacherId === teacher.tutor_user_id;
                  return (
                    <article key={teacher.tutor_user_id} className="notification-item">
                      <strong>{teacherName}</strong>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void requestCall(teacher.tutor_user_id)}
                        aria-label={t("callFlow.requestCallAria", { n: teacherName })}
                        disabled={isSending}
                      >
                        {isSending ? t("callFlow.sending") : t("callFlow.requestCall")}
                      </button>
                    </article>
                  );
                })
              )}
            </div>

            <div className="stack-list checkpoint-block">
              {assistanceRequests.slice(0, 4).map((request) => (
                <article key={request.id} className="notification-item">
                  <strong>{request.topic}</strong>
                  <p>{requestStatusLabel(request.status)}</p>
                  {request.status === "SCHEDULED" && request.meeting_url ? (
                    <button type="button" onClick={() => openMeetingLink(request.meeting_url as string)}>
                      {t("callFlow.joinCall")}
                    </button>
                  ) : null}
                </article>
              ))}
              {assistanceRequests.length === 0 ? <p className="muted">{t("dashboards.common.none")}</p> : null}
            </div>
          </article>

          <article className="card checkpoint-block">
            <button type="button" onClick={() => setShowAIChat((prev) => !prev)}>
              <ChatIcon /> {t("dashboards.studentV2.aiAssistant")}
            </button>

            {showAIChat ? (
              <div className="student-v2-ai-chat">
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
                    placeholder={t("dashboards.studentV2.askPlaceholder")}
                  />
                  <button type="button" onClick={() => void sendAiMessage()} disabled={!chatInput.trim()}>
                    {t("dashboards.studentV2.send")}
                  </button>
                </div>
              </div>
            ) : null}
          </article>

          <StudentCallFlow lang={i18n.resolvedLanguage} />

          <article className="card checkpoint-block">
            <p className="status-line">{status || t("dashboards.common.idle")}</p>
            <button type="button" className="secondary" onClick={() => void loadDashboard()}>
              {t("dashboards.common.refresh")}
            </button>
          </article>
        </aside>
      </section>
    </main>
  );
}
