import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { CLASSROOM_SYSTEM_ENABLED, READING_LAB_ENABLED } from "../features";
import { ADHDToDoList } from "../components/ADHDToDoList";
import { FocusTimer } from "../components/FocusTimer";
import { ProgressBar } from "../components/ProgressBar";
import { actionClass, cx, inputClass, surfaceClass } from "../components/uiStyles";
import { useAccessibility } from "../../features/accessibility/AccessibilityContext";
import { StudentCallFlow } from "../components/StudentCallFlow";
import { DashboardShell, errorMessage, localePrefix, localeRequestConfig } from "./roleDashboardShared";

type LessonSummary = {
  id: string;
  title: string;
  difficulty: string;
};

type CourseListItem = {
  id: string;
  title: string;
  language: string;
  status: string;
  source_page_count: number | null;
  created_at: string;
};

type CourseOrLesson = 
  | (LessonSummary & { type: "lesson" })
  | (CourseListItem & { type: "course" });

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

type ReadingLabSummary = {
  student_age_years?: number | null;
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
  activities: Array<{ key: string; title: string; description: string }>;
};

type StudentLinkIdResponse = {
  student_user_id: string;
  student_link_id: string;
};

type ClassroomCourseRef = {
  id: string;
  title: string;
  language: string;
  kind: "course" | "lesson";
};

type StudentClassroomItem = {
  classroom_id: string;
  classroom_name: string;
  teacher_name: string;
  joined_at: string;
  courses: ClassroomCourseRef[];
};

type ClassroomJoinPreview = {
  classroom_id: string;
  classroom_name: string;
  teacher_name: string;
  teacher_id: string;
};

type StudentSection = "courses" | "tasks" | "forum" | "progress";

type ForumHighlight = {
  id: string;
  title: string;
  body: string;
  tag: string;
};

type CoursePreviewCard = {
  id: string;
  title: string;
  subject: string;
  nextTopic: string;
  minutes: number;
  completion: number;
  itemType: "lesson" | "course";
};

type BadgeIconVariant = "streak" | "quiz" | "focus" | "xp" | "default";

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

function SectionCoursesIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6a2 2 0 0 1 2-2h6v14H5a2 2 0 0 0-2 2V6Zm18 0a2 2 0 0 0-2-2h-6v14h6a2 2 0 0 1 2 2V6Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SectionTasksIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h6M12 6h8M4 12h6M12 12h8M4 18h6M12 18h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m5 6 1.2 1.2L8 5.4M5 12l1.2 1.2L8 11.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionForumIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h14v10H9l-4 4V5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function SectionProgressIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 16 10 10l4 4 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 8h4v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GamepadIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="7" width="18" height="12" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 13h4M10 11v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16.5" cy="12" r="1" fill="currentColor" />
      <circle cx="18.5" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="ui-prefix-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
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
  const [coursesAndLessons, setCoursesAndLessons] = useState<CourseOrLesson[]>([]);
  const [progression, setProgression] = useState<Progression | null>(null);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [showTodoList, setShowTodoList] = useState(true);
  const [showAIChat, setShowAIChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<AiMessage[]>([]);
  const [activeTeachers, setActiveTeachers] = useState<TeacherPresenceItem[]>([]);
  const [assistanceRequests, setAssistanceRequests] = useState<AssistanceRequestItem[]>([]);
  const [requestingTeacherId, setRequestingTeacherId] = useState<string | null>(null);
  const [readingLabSummary, setReadingLabSummary] = useState<ReadingLabSummary | null>(null);
  const [studentLinkId, setStudentLinkId] = useState("");
  const [activeSection, setActiveSection] = useState<StudentSection>("courses");
  const [showReadingLab, setShowReadingLab] = useState(true);
  const [readingLabVisibilityInitialized, setReadingLabVisibilityInitialized] = useState(false);
  const [studentClassrooms, setStudentClassrooms] = useState<StudentClassroomItem[]>([]);
  const [courseProgressMap, setCourseProgressMap] = useState<Record<string, number>>({});
  const [classroomInviteCode, setClassroomInviteCode] = useState("");
  const [joinPreview, setJoinPreview] = useState<ClassroomJoinPreview | null>(null);
  const [joiningClassroom, setJoiningClassroom] = useState(false);
  const [leavingClassroomId, setLeavingClassroomId] = useState<string | null>(null);

  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const fallbackGoals: GoalItem[] = [
    { id: "goal-lessons", title: t("dashboards.studentV2.goalLessons"), current: 1, target: 2 },
    { id: "goal-minutes", title: t("dashboards.studentV2.goalMinutes"), current: 22, target: 30 },
    { id: "goal-xp", title: t("dashboards.studentV2.goalXp"), current: 150, target: 200 },
  ];
  const lessons = coursesAndLessons.filter((i) => i.type === "lesson") as Array<LessonSummary & { type: "lesson" }>;
  const visibleLessons = lessons.slice(0, 6);
  const shouldGateCourses = CLASSROOM_SYSTEM_ENABLED && studentClassrooms.length === 0;
  const xpCurrent = progression?.total_xp ?? 0;
  const xpTarget = progression?.next_level_xp ?? 200;
  const xpPercent = Math.max(0, Math.min(100, Math.round((xpCurrent / Math.max(xpTarget, 1)) * 100)));
  const currentLevel = progression?.current_level ?? 1;
  const streakDays = 7;
  const readingLabProminenceLabel =
    readingLabSummary?.prominence === "HIGHLY_PROMINENT"
      ? t("readingLab.highlyProminent")
      : readingLabSummary?.prominence === "PROMINENT"
        ? t("readingLab.recommended")
        : readingLabSummary?.prominence === "FEATURED"
          ? t("readingLab.featured")
          : t("readingLab.optional");
  const isReadingLabOlderStudent = (readingLabSummary?.student_age_years ?? 0) > 12;
  const requestStatusLabel = (status: string): string => {
    if (status === "REQUESTED") return t("callFlow.statusRequested");
    if (status === "SCHEDULED") return t("callFlow.statusScheduled");
    if (status === "COMPLETED") return t("callFlow.statusCompleted");
    return status;
  };

  const lessonPreviewCards = useMemo<CoursePreviewCard[]>(() => {
    const nextTopics = [
      t("dashboards.studentV2.courseNextTopic1"),
      t("dashboards.studentV2.courseNextTopic2"),
      t("dashboards.studentV2.courseNextTopic3"),
    ];
    return visibleLessons.slice(0, 3).map((lesson, index) => {
      const seeded = lesson.title.length % 12;
      return {
        id: lesson.id,
        title: lesson.title,
        subject: lesson.difficulty || t("dashboards.studentV2.subjectGeneral"),
        nextTopic: nextTopics[index] ?? nextTopics[nextTopics.length - 1],
        minutes: 20 + index * 5,
        completion: Math.max(28, Math.min(94, 82 - index * 18 + seeded)),
        itemType: "lesson" as const,
      };
    });
  }, [t, visibleLessons]);

  const forumHighlights = useMemo<ForumHighlight[]>(() => {
    const highlights: ForumHighlight[] = [];

    if (readingLabSummary?.notes?.length) {
      const firstNote = readingLabSummary.notes[0];
      highlights.push({
        id: `reading-lab-${firstNote.source}`,
        title: firstNote.label,
        body: firstNote.note,
        tag: t("readingLab.title"),
      });
    }

    if (assistanceRequests.length > 0) {
      highlights.push(
        ...assistanceRequests.slice(0, 2).map((request) => ({
          id: request.id,
          title: request.topic,
          body: request.message,
          tag: requestStatusLabel(request.status),
        })),
      );
    }

    if (highlights.length === 0) {
      highlights.push({
        id: "forum-placeholder",
        title: t("dashboards.studentV2.forumPlaceholderTitle"),
        body: t("dashboards.studentV2.forumPlaceholderBody"),
        tag: t("dashboards.studentV2.sectionForum"),
      });
    }

    return highlights.slice(0, 4);
  }, [assistanceRequests, readingLabSummary, requestStatusLabel, t]);

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

  const loadStudentClassrooms = async () => {
    if (!CLASSROOM_SYSTEM_ENABLED) {
      setStudentClassrooms([]);
      return;
    }

    try {
      const response = await apiClient.get<{ items: StudentClassroomItem[] }>("/classrooms/student/me", requestConfig);
      setStudentClassrooms(response.data.items || []);
    } catch (error) {
      setStudentClassrooms([]);
      setStatus(errorMessage(error));
    }
  };

  const previewJoinClassroom = async () => {
    const inviteCode = classroomInviteCode.trim();
    if (!inviteCode || !CLASSROOM_SYSTEM_ENABLED) return;

    setJoiningClassroom(true);
    try {
      const response = await apiClient.post<ClassroomJoinPreview>(
        "/classrooms/student/join/preview",
        { invite_code: inviteCode },
        requestConfig,
      );
      setJoinPreview(response.data);
      setStatus("");
    } catch (error) {
      setJoinPreview(null);
      setStatus(errorMessage(error));
    } finally {
      setJoiningClassroom(false);
    }
  };

  const confirmJoinClassroom = async () => {
    const inviteCode = classroomInviteCode.trim();
    if (!inviteCode || !CLASSROOM_SYSTEM_ENABLED) return;

    setJoiningClassroom(true);
    try {
      await apiClient.post(
        "/classrooms/student/join",
        { invite_code: inviteCode },
        requestConfig,
      );
      setStatus(t("classroom.student.joined"));
      setJoinPreview(null);
      setClassroomInviteCode("");
      await loadDashboard();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setJoiningClassroom(false);
    }
  };

  const leaveClassroom = async (classroomId: string) => {
    if (!CLASSROOM_SYSTEM_ENABLED) return;

    setLeavingClassroomId(classroomId);
    try {
      await apiClient.post(`/classrooms/student/${classroomId}/leave`, {}, requestConfig);
      setStatus(t("classroom.student.left"));
      await loadDashboard();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setLeavingClassroomId(null);
    }
  };

  const loadDashboard = async () => {
    setStatus(t("dashboards.common.loading"));

    const classroomPromise = CLASSROOM_SYSTEM_ENABLED
      ? apiClient.get<{ items: StudentClassroomItem[] }>("/classrooms/student/me", requestConfig)
      : Promise.resolve({ data: { items: [] as StudentClassroomItem[] } });

    const [lessonsResult, progressionResult, classroomResult] = await Promise.allSettled([
      apiClient.get<{ items: LessonSummary[] }>("/study/lessons", requestConfig),
      apiClient.get<Progression>("/gamification/progression/me", requestConfig),
      classroomPromise,
    ]);

    const classrooms = classroomResult.status === "fulfilled" ? classroomResult.value.data.items || [] : [];
    setStudentClassrooms(classrooms);
    if (!CLASSROOM_SYSTEM_ENABLED) {
      setJoinPreview(null);
    }

    // Fetch real progress for all classroom courses in one batch
    const allCourseIds = classrooms.flatMap(c => c.courses.map(cr => cr.id));
    if (allCourseIds.length > 0) {
      const batchRes = await apiClient.post<Array<{ course_id: string; percent: number }>>(
        "/courses/progress/batch",
        { course_ids: allCourseIds },
        requestConfig,
      ).catch(() => ({ data: [] as Array<{ course_id: string; percent: number }> }));
      const map: Record<string, number> = {};
      batchRes.data.forEach(item => { map[item.course_id] = item.percent; });
      setCourseProgressMap(map);
    }

    if (READING_LAB_ENABLED) {
      try {
        const readingLabRes = await apiClient.get<ReadingLabSummary>("/reading-lab/summary/me", requestConfig);
        const linkIdRes = await apiClient.get<StudentLinkIdResponse>("/reading-lab/link-id/me", requestConfig);
        setReadingLabSummary(readingLabRes.data);
        setStudentLinkId(linkIdRes.data.student_link_id);
        if (!readingLabVisibilityInitialized) {
          setShowReadingLab((readingLabRes.data.student_age_years ?? 0) <= 12);
          setReadingLabVisibilityInitialized(true);
        }
      } catch {
        setReadingLabSummary(null);
        setStudentLinkId("");
      }
    } else {
      setReadingLabSummary(null);
      setStudentLinkId("");
      setShowReadingLab(true);
      setReadingLabVisibilityInitialized(false);
    }

    const lessons =
      lessonsResult.status === "fulfilled"
        ? (lessonsResult.value.data.items || []).map(l => ({ ...l, type: "lesson" as const }))
        : [];

    // Courses now come from classroom data — no separate flat fetch needed
    setCoursesAndLessons([...lessons]);

    if (progressionResult.status === "fulfilled") {
      setProgression(progressionResult.value.data);
    }
    setGoals(fallbackGoals);

    setStatus(t("dashboards.studentV2.loaded"));

    // Load teacher presence and assistance requests independently so failures don't block the dashboard
    try {
      const activeTeachersRes = await apiClient.get<{ items: TeacherPresenceItem[] }>("/teacher/presence/active", requestConfig);
      setActiveTeachers(activeTeachersRes.data.items || []);
    } catch {
      setActiveTeachers([]);
    }
    try {
      const requestsRes = await apiClient.get<{ items: AssistanceRequestItem[] }>("/teacher/assistance/requests", requestConfig);
      setAssistanceRequests(requestsRes.data.items || []);
    } catch {
      setAssistanceRequests([]);
    }
  };

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage]);

  useEffect(() => {
    setJoinPreview(null);
  }, [classroomInviteCode]);

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

  const copyLinkId = async () => {
    if (!studentLinkId) {
      setStatus(t("readingLab.linkIdCopyFailed"));
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(studentLinkId);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = studentLinkId;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setStatus(t("readingLab.linkIdCopied"));
    } catch {
      setStatus(t("readingLab.linkIdCopyFailed"));
    }
  };

  return (
    <DashboardShell title={t("dashboards.studentV2.title")}>
      {settings.focusMode ? (
        <section className="focus-banner">
          <p>{t("dashboards.studentV2.focusModeActive")}</p>
          <button type="button" className={actionClass("soft")} onClick={() => setFocusMode(false)}>
            {t("dashboards.studentV2.exitFocusMode")}
          </button>
        </section>
      ) : null}

      <section className={cx(surfaceClass, "student-v2-progress-hero p-5 sm:p-6")}> 
        <div className="student-v2-progress-hero-head">
          <div>
            <h2>{t("dashboards.studentV2.todayProgressTitle")}</h2>
            <p>{t("dashboards.studentV2.todayProgressSubtitle")}</p>
          </div>
          <div className="student-v2-progress-meta">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <FlameIcon /> {t("dashboards.studentV2.streak", { days: streakDays })}
            </p>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrophyIcon /> {t("dashboards.studentV2.level", { level: currentLevel })}
            </p>
          </div>
        </div>

        <div className="student-v2-progress-bar-wrap">
          <div className="request-head-row">
            <strong>{t("dashboards.studentV2.dailyXpGoal")}</strong>
            <strong>{xpCurrent} / {xpTarget}</strong>
          </div>
          <div className="progress-track">
            <span className="progress-fill" style={{ width: `${xpPercent}%` }} />
          </div>
        </div>
      </section>

      <nav className={cx(surfaceClass, "student-v2-section-tabs p-2 sm:p-3")} aria-label={t("dashboards.studentV2.sectionsLabel")}>
        {([
          { key: "courses", label: t("dashboards.studentV2.sectionCourses"), Icon: SectionCoursesIcon },
          { key: "tasks", label: t("dashboards.studentV2.sectionTasks"), Icon: SectionTasksIcon },
          { key: "forum", label: t("dashboards.studentV2.sectionForum"), Icon: SectionForumIcon },
          { key: "progress", label: t("dashboards.studentV2.sectionProgress"), Icon: SectionProgressIcon },
        ] as Array<{ key: StudentSection; label: string; Icon: () => ReturnType<typeof SectionCoursesIcon> }>).map((item) => (
          <button
            key={item.key}
            type="button"
            className={cx("student-v2-section-tab", activeSection === item.key && "is-active")}
            onClick={() => setActiveSection(item.key)}
          >
            <item.Icon />
            {item.label}
          </button>
        ))}
      </nav>

      {activeSection === "courses" ? (
        <section className="student-courses-layout kid-stagger-list">
          <article className={cx(surfaceClass, "portal-inner-card student-courses-panel p-5 sm:p-6")}> 
            <div className="student-courses-head">
              <h2>{t("dashboards.studentV2.yourCoursesTitle")}</h2>
              <button type="button" className="student-courses-link-btn" onClick={() => setActiveSection("progress")}>
                {t("dashboards.studentV2.viewCompleted")}
              </button>
            </div>

            <div className="student-courses-list checkpoint-block">
              {shouldGateCourses ? (
                <p className="muted">{t("classroom.student.mustJoinClassroom")}</p>
              ) : studentClassrooms.length === 0 ? (
                <p className="muted">{t("classroom.student.noCoursesYet")}</p>
              ) : (
                studentClassrooms.map((classroom) => (
                  <div key={classroom.classroom_id}>
                    <h3 className="classroom-group-label">{classroom.classroom_name}</h3>
                    {classroom.courses.length === 0 ? (
                      <p className="muted" style={{ marginBottom: "0.75rem" }}>{t("classroom.student.noCoursesYet")}</p>
                    ) : (
                      classroom.courses.map((course) => {
                        const pct = Math.round(courseProgressMap[course.id] ?? 0);
                        const courseUrl = course.kind === "lesson"
                          ? `${prefix}/student/course/${course.id}`
                          : `${prefix}/student/courses/${course.id}`;
                        return (
                          <Link
                            className="student-course-card"
                            to={courseUrl}
                            key={course.id}
                          >
                            <div className="student-course-head">
                              <span className="student-course-subject">{t("dashboards.studentV2.subjectPdfCourse", { defaultValue: "PDF Course" })}</span>
                              <span className="student-course-chevron" aria-hidden="true">{">"}</span>
                            </div>
                            <h3>{course.title}</h3>
                            <div className="student-course-meta">
                              <span>{course.language.toUpperCase()}</span>
                              <span>{pct}% {t("dashboards.studentV2.courseComplete")}</span>
                            </div>
                            <div className="progress-track">
                              <span className="progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                ))
              )}
              {/* Lesson cards (from non-classroom lessons) */}
              {!shouldGateCourses && lessonPreviewCards.length > 0 && (
                <div>
                  <h3 className="classroom-group-label">{t("dashboards.studentV2.moreWaysToLearn")}</h3>
                  {lessonPreviewCards.map((lesson) => (
                    <Link className="student-course-card" to={`${prefix}/student/course/${lesson.id}`} key={lesson.id}>
                      <div className="student-course-head">
                        <span className="student-course-subject">{lesson.subject}</span>
                        <span className="student-course-chevron" aria-hidden="true">{">"}</span>
                      </div>
                      <h3>{lesson.title}</h3>
                      <div className="student-course-meta">
                        <span>{lesson.minutes} min</span>
                        <span>{lesson.completion}% {t("dashboards.studentV2.courseComplete")}</span>
                      </div>
                      <div className="progress-track">
                        <span className="progress-fill" style={{ width: `${lesson.completion}%` }} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="checkpoint-block">
              <h3 className="student-courses-subheading">{t("dashboards.studentV2.moreWaysToLearn")}</h3>
              <div className="student-courses-more-grid checkpoint-block">
                <Link className="student-courses-more-card student-courses-more-play" to={`${prefix}/games`}>
                  <div className="student-courses-more-head">
                    <span className="student-courses-icon-wrap">
                      <GamepadIcon />
                    </span>
                    <span className="student-course-chevron" aria-hidden="true">{">"}</span>
                  </div>
                  <strong>{t("dashboards.studentV2.playGamesTitle")}</strong>
                  <p>{t("dashboards.studentV2.playGamesBody")}</p>
                </Link>
                <article className="student-courses-more-card student-courses-more-muted student-courses-more-join">
                  <div className="student-courses-more-head">
                    <span className="student-courses-icon-wrap is-plus">
                      <PlusIcon />
                    </span>
                  </div>
                  <strong>{t("dashboards.studentV2.joinClassTitle")}</strong>
                  {CLASSROOM_SYSTEM_ENABLED ? (
                    <div className="stack-list">
                      <input
                        className={inputClass}
                        value={classroomInviteCode}
                        onChange={(event) => setClassroomInviteCode(event.target.value.toUpperCase())}
                        placeholder={t("classroom.student.inviteCodePlaceholder")}
                      />
                      <div className="inline-actions">
                        <button
                          type="button"
                          className={actionClass("soft")}
                          onClick={() => void previewJoinClassroom()}
                          disabled={!classroomInviteCode.trim() || joiningClassroom}
                        >
                          {t("classroom.student.previewJoin")}
                        </button>
                        <button
                          type="button"
                          className={actionClass()}
                          onClick={() => void confirmJoinClassroom()}
                          disabled={!joinPreview || joiningClassroom}
                        >
                          {joiningClassroom ? t("login.pleaseWait") : t("classroom.student.confirmJoin")}
                        </button>
                      </div>
                      {joinPreview ? (
                        <p className="muted">
                          {t("classroom.student.joinPreview", {
                            classroom: joinPreview.classroom_name,
                            teacher: joinPreview.teacher_name,
                          })}
                        </p>
                      ) : (
                        <p>{t("dashboards.studentV2.joinClassBody")}</p>
                      )}
                    </div>
                  ) : (
                    <p>{t("dashboards.studentV2.joinClassBody")}</p>
                  )}
                </article>
              </div>

              {CLASSROOM_SYSTEM_ENABLED ? (
                <div className="checkpoint-block">
                  <h3 className="student-courses-subheading">{t("classroom.student.myClassrooms")}</h3>
                  <div className="stack-list checkpoint-block">
                    {studentClassrooms.map((classroom) => (
                      <article className="notification-item" key={classroom.classroom_id}>
                        <div className="request-head-row">
                          <strong>{classroom.classroom_name}</strong>
                          <button
                            type="button"
                            className={actionClass("soft")}
                            onClick={() => void leaveClassroom(classroom.classroom_id)}
                            disabled={leavingClassroomId === classroom.classroom_id}
                          >
                            {leavingClassroomId === classroom.classroom_id ? t("login.pleaseWait") : t("classroom.student.leave")}
                          </button>
                        </div>
                        <p className="muted">{t("classroom.student.teacher", { teacher: classroom.teacher_name })}</p>
                        {classroom.courses.length > 0 ? (
                          <p className="muted">{t("classroom.student.availableCourses", { courses: classroom.courses.map(c => c.title).join(", ") })}</p>
                        ) : (
                          <p className="muted">{t("classroom.student.noCoursesYet")}</p>
                        )}
                      </article>
                    ))}
                    {studentClassrooms.length === 0 ? <p className="muted">{t("classroom.student.noClassrooms")}</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </article>

          {READING_LAB_ENABLED && readingLabSummary ? (
            <section className={cx(surfaceClass, "student-courses-reading-lab kid-attention-panel kid-stagger-item p-5 sm:p-6")}>
              <div className="section-title-row">
                <div>
                  <p className="muted">{readingLabProminenceLabel}</p>
                  <h2 className="text-[clamp(1.35rem,2vw,1.9rem)] font-semibold tracking-[-0.03em] text-foreground">
                    {t("readingLab.title")}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {readingLabSummary.support_status === "ACTIVE"
                      ? t("readingLab.supportActive")
                      : readingLabSummary.support_status === "PAUSED"
                        ? t("readingLab.supportPaused")
                        : t("readingLab.supportInactive")}
                  </p>
                </div>
                <div className="inline-actions">
                  {isReadingLabOlderStudent ? (
                    <button
                      type="button"
                      className={actionClass("soft")}
                      onClick={() => setShowReadingLab((prev) => !prev)}
                    >
                      {showReadingLab ? t("readingLab.hideSection") : t("readingLab.showSection")}
                    </button>
                  ) : null}
                  {showReadingLab ? (
                    <Link className={actionClass()} to={`${prefix}/student/reading-lab`}>
                      {t("readingLab.enterLab")}
                    </Link>
                  ) : null}
                </div>
              </div>

              {isReadingLabOlderStudent && !showReadingLab ? (
                <p className="checkpoint-block text-sm leading-6 text-muted-foreground">
                  {t("readingLab.hiddenForOlderStudents")}
                </p>
              ) : null}

              {showReadingLab ? (
                <>
                  <div className="metrics-grid checkpoint-block">
                    <article className="card metric-pill kid-metric-pill">
                      <p>{t("readingLab.completedSessions")}</p>
                      <strong>{readingLabSummary.progress.completed_sessions}</strong>
                    </article>
                    <article className="card metric-pill kid-metric-pill">
                      <p>{t("readingLab.averageAccuracy")}</p>
                      <strong>{readingLabSummary.progress.average_accuracy}%</strong>
                    </article>
                    <article className="card metric-pill kid-metric-pill">
                      <p>{t("readingLab.totalRounds")}</p>
                      <strong>{readingLabSummary.progress.total_rounds_completed}</strong>
                    </article>
                  </div>

                  <div className="stack-list checkpoint-block">
                    <div className="inline-actions">
                      {readingLabSummary.focus_targets.map((target) => (
                        <span className="status-chip kid-focus-chip" key={target}>{target}</span>
                      ))}
                    </div>

                    {readingLabSummary.notes.length ? (
                      <div className="stack-list">
                        {readingLabSummary.notes.map((note, index) => (
                          <article className="notification-item" key={`${note.source}-${index}`}>
                            <strong>{note.label}</strong>
                            <p>{note.note}</p>
                          </article>
                        ))}
                      </div>
                    ) : null}

                    <div className="lesson-grid kid-activity-stagger">
                      {readingLabSummary.activities.slice(0, 3).map((activity) => (
                        <article className="lesson-card kid-activity-card" key={activity.key}>
                          <strong>{activity.title}</strong>
                          <p className="muted">{activity.description}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          {READING_LAB_ENABLED && readingLabSummary ? (
            <article className={cx(surfaceClass, "student-courses-link-id-card portal-inner-card p-5 sm:p-6")}> 
              <strong>{t("readingLab.myLinkId")}</strong>
              <p>{studentLinkId || t("dashboards.common.none")}</p>
              <button type="button" className={actionClass("soft")} onClick={() => void copyLinkId()}>
                {t("readingLab.copyLinkId")}
              </button>
            </article>
          ) : null}
        </section>
      ) : null}

      {activeSection === "tasks" ? (
        <section className="portal-grid student-v2-grid kid-stagger-list">
          <section className="student-v2-main-column">
            <article className={cx(surfaceClass, "portal-inner-card p-5 sm:p-6")}> 
              <div className="section-title-row">
                <h2 className="text-[clamp(1.2rem,1.7vw,1.55rem)] font-semibold tracking-[-0.03em] text-foreground">
                  {t("dashboards.studentV2.myTasks")}
                </h2>
                <button type="button" className={actionClass("soft")} onClick={() => setShowTodoList((prev) => !prev)}>
                  {showTodoList ? t("dashboards.studentV2.hideTasks") : t("dashboards.studentV2.showTasks")}
                </button>
              </div>
              {showTodoList ? <ADHDToDoList /> : null}
            </article>

            <article className={cx(surfaceClass, "portal-inner-card p-5 sm:p-6")}> 
              <h3>{t("dashboards.studentV2.taskRequestsTitle")}</h3>
              <div className="stack-list checkpoint-block">
                {assistanceRequests.slice(0, 2).map((request) => (
                  <article key={request.id} className="notification-item">
                    <strong>{request.topic}</strong>
                    <p>{requestStatusLabel(request.status)}</p>
                    {request.status === "SCHEDULED" && request.meeting_url ? (
                      <button type="button" className={actionClass()} onClick={() => openMeetingLink(request.meeting_url as string)}>
                        {t("callFlow.joinCall")}
                      </button>
                    ) : null}
                  </article>
                ))}
                {assistanceRequests.length === 0 ? <p className="muted">{t("dashboards.common.none")}</p> : null}
              </div>
            </article>
          </section>

          <aside className="student-v2-side-column">
            <FocusTimer defaultDuration={25} />

            <article className={cx(surfaceClass, "portal-inner-card p-5 sm:p-6")}> 
              <h3 className="inline-flex items-center gap-2 text-lg font-semibold tracking-[-0.02em] text-foreground">
                <ClockIcon /> {t("dashboards.studentV2.todayGoals")}
              </h3>
              <div className="stack-list">
                {goals.map((goal) => (
                  <div key={goal.id}>
                    <p className="muted">{goal.title}</p>
                    <ProgressBar current={goal.current} max={goal.target} showPercentage={false} />
                  </div>
                ))}
              </div>
            </article>

            <article className={cx(surfaceClass, "portal-inner-card p-5 sm:p-6")}> 
              <p className="muted">{t("callFlow.sectionLabel")}</p>
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{t("callFlow.sectionTitle")}</h3>
              <div className="stack-list checkpoint-block">
                {activeTeachers.length === 0 ? (
                  <p className="muted">{t("callFlow.noTeachers")}</p>
                ) : (
                  activeTeachers.slice(0, 2).map((teacher) => {
                    const teacherName = displayTeacherName(teacher.tutor_user_id);
                    const isSending = requestingTeacherId === teacher.tutor_user_id;
                    return (
                      <article key={teacher.tutor_user_id} className="notification-item">
                        <strong>{teacherName}</strong>
                        <button
                          type="button"
                          className={actionClass("soft")}
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
            </article>
          </aside>
        </section>
      ) : null}

      {activeSection === "forum" ? (
        <section className="portal-grid student-v2-grid kid-stagger-list">
          <section className="student-v2-main-column">
            <article className={cx(surfaceClass, "portal-inner-card p-5 sm:p-6")}> 
              <div className="section-title-row">
                <div>
                  <h2 className="text-[clamp(1.35rem,2vw,1.9rem)] font-semibold tracking-[-0.03em] text-foreground">
                    {t("dashboards.studentV2.forumHubTitle")}
                  </h2>
                  <p className="muted">{t("dashboards.studentV2.forumHubSubtitle")}</p>
                </div>
                <Link className={actionClass()} to={`${prefix}/forum`}>{t("dashboards.studentV2.openForum")}</Link>
              </div>

              <div className="stack-list checkpoint-block">
                {forumHighlights.map((item) => (
                  <article className="notification-item" key={item.id}>
                    <div className="request-head-row">
                      <strong>{item.title}</strong>
                      <span className="status-chip">{item.tag}</span>
                    </div>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            </article>

            <article className={cx(surfaceClass, "portal-inner-card p-5 sm:p-6")}> 
              <button type="button" className={actionClass("soft")} onClick={() => setShowAIChat((prev) => !prev)}>
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
                    <button type="button" className={actionClass()} onClick={() => void sendAiMessage()} disabled={!chatInput.trim()}>
                      {t("dashboards.studentV2.send")}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          </section>

          <aside className="student-v2-side-column">
            <StudentCallFlow lang={i18n.resolvedLanguage} />

            <article className={cx(surfaceClass, "portal-inner-card p-5 sm:p-6")}> 
              <p className="status-line">{status || t("dashboards.common.idle")}</p>
              <button type="button" className={actionClass("soft")} onClick={() => void loadDashboard()}>
                {t("dashboards.common.refresh")}
              </button>
            </article>
          </aside>
        </section>
      ) : null}

      {activeSection === "progress" ? (
        <section className="portal-grid student-v2-grid kid-stagger-list">
          <section className="student-v2-main-column">
            {settings.badges ? (
              <article className={cx(surfaceClass, "portal-inner-card p-5 sm:p-6")}> 
                <h2 className="text-[clamp(1.2rem,1.7vw,1.55rem)] font-semibold tracking-[-0.03em] text-foreground">
                  {t("dashboards.studentV2.achievements")}
                </h2>
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

            <article className={cx(surfaceClass, "portal-inner-card p-5 sm:p-6")}> 
              <h3>{t("dashboards.studentV2.progressSnapshotTitle")}</h3>
              <div className="metrics-grid checkpoint-block">
                <article className="card metric-pill">
                  <p>{t("dashboards.studentV2.level", { level: currentLevel })}</p>
                  <strong>{xpPercent}%</strong>
                </article>
                <article className="card metric-pill">
                  <p>{t("dashboards.studentV2.streak", { days: streakDays })}</p>
                  <strong>{xpCurrent}</strong>
                </article>
                <article className="card metric-pill">
                  <p>{t("dashboards.studentV2.progressLessons")}</p>
                  <strong>{visibleLessons.length}</strong>
                </article>
              </div>
            </article>
          </section>

          <aside className="student-v2-side-column">
            <article className={cx(surfaceClass, "portal-inner-card p-5 sm:p-6")}> 
              <h4>{t("dashboards.studentV2.progressActionsTitle")}</h4>
              <p className="muted">{t("dashboards.studentV2.progressActionsBody")}</p>
              <button type="button" className={actionClass("soft")} onClick={() => void loadDashboard()}>
                {t("dashboards.common.refresh")}
              </button>
            </article>
          </aside>
        </section>
      ) : null}
    </DashboardShell>
  );
}
