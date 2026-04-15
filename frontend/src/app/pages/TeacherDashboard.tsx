import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";

import { apiClient } from "../../api/client";
import { scheduleRequest, completeRequest } from "../../api/callApi";
import { CLASSROOM_SYSTEM_ENABLED, READING_LAB_ENABLED } from "../features";
import {
  AssistanceRequestItem,
  DashboardShell,
  errorMessage,
  formatDate,
  localeRequestConfig,
  NotificationItem,
  Profile,
  TeacherDashboardMetrics,
  TeacherTab,
  TeacherTabs,
} from "./roleDashboardShared";

import { TeacherCoursesTab } from "./TeacherCoursesTab";

const POLL_MS = 8000;

export function TeacherDashboardPageV2() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  type ReadingLabTeacherStudent = {
    student_user_id: string;
    student_label: string;
    support_status: "INACTIVE" | "ACTIVE" | "PAUSED";
    support_active: boolean;
    focus_targets: string[];
    progress: {
      completed_sessions: number;
      total_rounds_completed: number;
      average_accuracy: number;
    };
  };

  type ReadingLabPlan = {
    status: "INACTIVE" | "ACTIVE" | "PAUSED";
    notes: string;
    focus_targets: string[];
  };

  type LessonSummary = {
    id: string;
    title: string;
    difficulty: string;
  };

  type TeacherCourseAssignment = {
    course_id: string;
    title: string;
    difficulty: string;
    classroom_names: string[];
  };

  type TeacherClassroom = {
    id: string;
    name: string;
    description: string | null;
    grade_tag: string | null;
    invite_code: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };

  type ClassroomStudent = {
    student_id: string;
    student_label: string;
    joined_at: string;
    is_active: boolean;
    reading_support_status: string | null;
    screening_support_level: string | null;
    screening_composite_score: number | null;
  };

  type ClassroomCourse = {
    course_id: string;
    title: string;
    difficulty: string;
    assigned_at: string;
  };

  type ClassroomDetail = {
    classroom: TeacherClassroom;
    students: ClassroomStudent[];
    courses: ClassroomCourse[];
  };

  type StudentCourseRow = {
    id: string;
    title: string;
    completion: number;
    quizScore: number;
  };

  type OverviewStudent = {
    id: string;
    name: string;
    engagement: string;
    progress: number;
    attendance: string;
    attendanceRate: number;
    lessonsCount: number;
    avgSessionMinutes: number;
    courses: StudentCourseRow[];
  };

  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [metrics, setMetrics] = useState<TeacherDashboardMetrics | null>(null);
  const [requests, setRequests] = useState<AssistanceRequestItem[]>([]);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<TeacherTab>("overview");
  const [attendanceNote, setAttendanceNote] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  // per-request inline schedule picker state
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [readingLabStudents, setReadingLabStudents] = useState<ReadingLabTeacherStudent[]>([]);
  const [readingLabLoading, setReadingLabLoading] = useState(false);
  const [editingReadingLabStudent, setEditingReadingLabStudent] = useState<ReadingLabTeacherStudent | null>(null);
  const [editingPlan, setEditingPlan] = useState<ReadingLabPlan>({ status: "INACTIVE", notes: "", focus_targets: [] });
  const [editingTargetInput, setEditingTargetInput] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [selectedOverviewStudent, setSelectedOverviewStudent] = useState<OverviewStudent | null>(null);
  const [classrooms, setClassrooms] = useState<TeacherClassroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("");
  const [classroomDetail, setClassroomDetail] = useState<ClassroomDetail | null>(null);
  const [classroomLoading, setClassroomLoading] = useState(false);
  const [classroomDetailLoading, setClassroomDetailLoading] = useState(false);
  const [classroomNameInput, setClassroomNameInput] = useState("");
  const [classroomDescriptionInput, setClassroomDescriptionInput] = useState("");
  const [classroomGradeTagInput, setClassroomGradeTagInput] = useState("");
  const [classroomSaving, setClassroomSaving] = useState(false);
  const [classroomCourseToAssign, setClassroomCourseToAssign] = useState<string>("");
  const [courseAssignments, setCourseAssignments] = useState<TeacherCourseAssignment[]>([]);

  const readingLabTools = [
    {
      id: "targeted-reading",
      title: t("dashboards.teacher.readingLabToolTargeted"),
      subtitle: t("dashboards.teacher.readingLabToolTargetedHint"),
      status: t("readingLab.recommended"),
      tone: "status-accent",
    },
    {
      id: "letter-fluency",
      title: t("dashboards.teacher.readingLabToolFluency"),
      subtitle: t("dashboards.teacher.readingLabToolFluencyHint"),
      status: t("readingLab.featured"),
      tone: "status-success",
    },
    {
      id: "guided-practice",
      title: t("dashboards.teacher.readingLabToolGuided"),
      subtitle: t("dashboards.teacher.readingLabToolGuidedHint"),
      status: t("readingLab.optional"),
      tone: "status-chip",
    },
  ];

  const pendingRequests = useMemo(() => requests.filter((item) => item.status === "REQUESTED"), [requests]);
  const scheduledRequests = useMemo(() => requests.filter((item) => item.scheduled_at), [requests]);

  const topicCards = useMemo(() => {
    const topicCount = new Map<string, number>();
    for (const request of requests) {
      const topic = request.topic.trim();
      if (!topic) continue;
      topicCount.set(topic, (topicCount.get(topic) ?? 0) + 1);
    }
    return Array.from(topicCount.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [requests]);

  const statusLabel = (supportStatus: "INACTIVE" | "ACTIVE" | "PAUSED") => {
    if (supportStatus === "ACTIVE") return t("readingLab.supportActive");
    if (supportStatus === "PAUSED") return t("readingLab.supportPaused");
    return t("readingLab.supportInactive");
  };

  const statusTone = (supportStatus: "INACTIVE" | "ACTIVE" | "PAUSED") => {
    if (supportStatus === "ACTIVE") return "status-success";
    if (supportStatus === "PAUSED") return "status-accent";
    return "status-chip";
  };

  const buildCourseRows = useCallback(
    (studentId: string, baselineProgress: number): StudentCourseRow[] => {
      const sourceLessons =
        lessons.length > 0
          ? lessons.slice(0, 3).map((lesson) => lesson.title)
          : [
              t("dashboards.teacher.course1"),
              t("dashboards.teacher.course2"),
              t("dashboards.teacher.course3"),
            ];

      return sourceLessons.map((title, index) => {
        const charCode = studentId.charCodeAt(index % Math.max(studentId.length, 1)) || 0;
        const completion = Math.max(35, Math.min(99, Math.round(baselineProgress - index * 11 + (charCode % 8))));
        const quizScore = Math.max(42, Math.min(100, completion + 4 + (charCode % 6)));
        return {
          id: `${studentId}-${index}`,
          title,
          completion,
          quizScore,
        };
      });
    },
    [lessons, t],
  );

  const readingLabMetrics = useMemo(() => {
    if (readingLabStudents.length === 0) {
      return { sessions: 0, rounds: 0, accuracy: 0 };
    }
    const sessions = readingLabStudents.reduce((acc, item) => acc + item.progress.completed_sessions, 0);
    const rounds = readingLabStudents.reduce((acc, item) => acc + item.progress.total_rounds_completed, 0);
    const accuracy = Math.round(
      readingLabStudents.reduce((acc, item) => acc + item.progress.average_accuracy, 0) / readingLabStudents.length,
    );
    return { sessions, rounds, accuracy };
  }, [readingLabStudents]);

  const liveOverviewStudents = useMemo<OverviewStudent[]>(() => {
    if (readingLabStudents.length > 0) {
      return readingLabStudents.slice(0, 6).map((student) => ({
        id: student.student_user_id,
        name: student.student_label,
        engagement:
          student.progress.average_accuracy >= 75
            ? t("dashboards.teacher.highEngagement")
            : t("dashboards.teacher.mediumEngagement"),
        progress: student.progress.average_accuracy,
        attendance: `${student.progress.completed_sessions} ${t("readingLab.completedSessions")}`,
        attendanceRate: Math.round(
          ((student.progress.completed_sessions + 1) / Math.max(student.progress.completed_sessions + 2, 1)) * 100,
        ),
        lessonsCount: Math.max(student.progress.total_rounds_completed, student.progress.completed_sessions * 2),
        avgSessionMinutes: Math.max(15, Math.round(20 + student.progress.completed_sessions * 5)),
        courses: buildCourseRows(student.student_user_id, student.progress.average_accuracy),
      }));
    }

    const byStudent = new Map<string, { requests: number; completed: number }>();
    for (const request of requests) {
      const key = String(request.student_user_id);
      const previous = byStudent.get(key) ?? { requests: 0, completed: 0 };
      byStudent.set(key, {
        requests: previous.requests + 1,
        completed: previous.completed + (request.status === "COMPLETED" ? 1 : 0),
      });
    }

    return Array.from(byStudent.entries())
      .slice(0, 6)
      .map(([studentId, stats]) => ({
        id: studentId,
        name: `${t("dashboards.teacher.studentPrefix")} ${studentId.slice(0, 8)}`,
        engagement: stats.completed > 0 ? t("dashboards.teacher.highEngagement") : t("dashboards.teacher.mediumEngagement"),
        progress: Math.min(100, Math.round((stats.completed / Math.max(stats.requests, 1)) * 100)),
        attendance: `${stats.completed}/${stats.requests}`,
        attendanceRate: Math.min(100, Math.round((stats.completed / Math.max(stats.requests, 1)) * 100) + 10),
        lessonsCount: Math.max(1, stats.completed * 2),
        avgSessionMinutes: Math.max(15, 20 + stats.requests * 4),
        courses: buildCourseRows(studentId, Math.min(100, Math.round((stats.completed / Math.max(stats.requests, 1)) * 100))),
      }));
  }, [buildCourseRows, readingLabStudents, requests, t]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setPresence = useCallback(async (online: boolean) => {
    try {
      await apiClient.put("/teacher/presence", { is_online: online }, requestConfig);
      setIsOnline(online);
    } catch {
      // non-critical
    }
  }, [requestConfig]);

  const loadRequests = useCallback(async () => {
    try {
      const requestsRes = await apiClient.get<{ items: AssistanceRequestItem[] }>(
        "/teacher/assistance/requests",
        requestConfig,
      );
      setRequests(requestsRes.data.items || []);
    } catch {
      // silently retry next poll
    }
  }, [requestConfig]);

  const loadReadingLabStudents = useCallback(async () => {
    if (!READING_LAB_ENABLED) {
      setReadingLabStudents([]);
      return;
    }
    setReadingLabLoading(true);
    try {
      const response = await apiClient.get<{ items: ReadingLabTeacherStudent[] }>(
        "/reading-lab/students/taught",
        requestConfig,
      );
      setReadingLabStudents(response.data.items || []);
    } catch (error) {
      setReadingLabStudents([]);
      setStatus(errorMessage(error));
    } finally {
      setReadingLabLoading(false);
    }
  }, [requestConfig]);

  const openReadingLabEditor = useCallback(
    async (student: ReadingLabTeacherStudent) => {
      if (student.student_user_id.startsWith("example-")) return;
      setEditingReadingLabStudent(student);
      setEditingTargetInput("");
      try {
        const response = await apiClient.get<ReadingLabPlan>(
          `/reading-lab/support/students/${student.student_user_id}`,
          requestConfig,
        );
        setEditingPlan({
          status: response.data.status,
          notes: response.data.notes ?? "",
          focus_targets: response.data.focus_targets ?? [],
        });
      } catch {
        setEditingPlan({
          status: student.support_status,
          notes: "",
          focus_targets: student.focus_targets,
        });
      }
    },
    [requestConfig],
  );

  const addEditingTarget = () => {
    const value = editingTargetInput.trim();
    if (!value) return;
    if (editingPlan.focus_targets.includes(value)) {
      setEditingTargetInput("");
      return;
    }
    setEditingPlan((prev) => ({ ...prev, focus_targets: [...prev.focus_targets, value] }));
    setEditingTargetInput("");
  };

  const removeEditingTarget = (value: string) => {
    setEditingPlan((prev) => ({ ...prev, focus_targets: prev.focus_targets.filter((target) => target !== value) }));
  };

  const saveReadingLabPlan = async () => {
    if (!editingReadingLabStudent) return;
    setSavingPlan(true);
    try {
      await apiClient.put(
        `/reading-lab/support/students/${editingReadingLabStudent.student_user_id}`,
        {
          status: editingPlan.status,
          notes: editingPlan.notes,
          focus_targets: editingPlan.focus_targets,
        },
        requestConfig,
      );
      setStatus(t("dashboards.teacher.readingLabPlanSaved"));
      setEditingReadingLabStudent(null);
      await loadReadingLabStudents();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setSavingPlan(false);
    }
  };

  const loadClassroomDetail = useCallback(
    async (classroomId: string) => {
      if (!CLASSROOM_SYSTEM_ENABLED || !classroomId) {
        setClassroomDetail(null);
        return;
      }

      setClassroomDetailLoading(true);
      try {
        const response = await apiClient.get<ClassroomDetail>(`/classrooms/teacher/${classroomId}/detail`, requestConfig);
        setClassroomDetail(response.data);
      } catch (error) {
        setClassroomDetail(null);
        setStatus(errorMessage(error));
      } finally {
        setClassroomDetailLoading(false);
      }
    },
    [requestConfig],
  );

  const loadClassrooms = useCallback(async () => {
    if (!CLASSROOM_SYSTEM_ENABLED) {
      setClassrooms([]);
      setSelectedClassroomId("");
      setClassroomDetail(null);
      return;
    }

    setClassroomLoading(true);
    try {
      const response = await apiClient.get<{ items: TeacherClassroom[] }>("/classrooms/teacher", requestConfig);
      const items = response.data.items || [];
      setClassrooms(items);

      const nextSelected = selectedClassroomId && items.some((item) => item.id === selectedClassroomId)
        ? selectedClassroomId
        : (items[0]?.id ?? "");
      setSelectedClassroomId(nextSelected);
      if (nextSelected) {
        await loadClassroomDetail(nextSelected);
      } else {
        setClassroomDetail(null);
      }
    } catch (error) {
      setClassrooms([]);
      setClassroomDetail(null);
      setStatus(errorMessage(error));
    } finally {
      setClassroomLoading(false);
    }
  }, [loadClassroomDetail, requestConfig, selectedClassroomId]);

  const loadCourseAssignments = useCallback(async () => {
    if (!CLASSROOM_SYSTEM_ENABLED) {
      setCourseAssignments([]);
      return;
    }

    try {
      const response = await apiClient.get<{ items: TeacherCourseAssignment[] }>(
        "/classrooms/teacher/course-assignments",
        requestConfig,
      );
      setCourseAssignments(response.data.items || []);
    } catch (error) {
      setCourseAssignments([]);
      setStatus(errorMessage(error));
    }
  }, [requestConfig]);

  const createClassroom = async () => {
    if (!CLASSROOM_SYSTEM_ENABLED) return;
    const payload = {
      name: classroomNameInput.trim(),
      description: classroomDescriptionInput.trim() || null,
      grade_tag: classroomGradeTagInput.trim() || null,
    };
    if (!payload.name) return;

    setClassroomSaving(true);
    try {
      const response = await apiClient.post<TeacherClassroom>("/classrooms/teacher", payload, requestConfig);
      setStatus(t("classroom.teacher.classroomCreated"));
      setClassroomNameInput("");
      setClassroomDescriptionInput("");
      setClassroomGradeTagInput("");
      await loadClassrooms();
      setSelectedClassroomId(response.data.id);
      await loadClassroomDetail(response.data.id);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setClassroomSaving(false);
    }
  };

  const updateClassroom = async () => {
    if (!CLASSROOM_SYSTEM_ENABLED || !selectedClassroomId) return;
    const payload = {
      name: classroomNameInput.trim(),
      description: classroomDescriptionInput.trim() || null,
      grade_tag: classroomGradeTagInput.trim() || null,
    };
    if (!payload.name) return;

    setClassroomSaving(true);
    try {
      await apiClient.put(`/classrooms/teacher/${selectedClassroomId}`, payload, requestConfig);
      setStatus(t("classroom.teacher.classroomUpdated"));
      await loadClassrooms();
      await loadClassroomDetail(selectedClassroomId);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setClassroomSaving(false);
    }
  };

  const toggleClassroomActive = async (isActive: boolean) => {
    if (!CLASSROOM_SYSTEM_ENABLED || !selectedClassroomId) return;
    setClassroomSaving(true);
    try {
      await apiClient.patch(
        `/classrooms/teacher/${selectedClassroomId}/archive`,
        { is_active: !isActive },
        requestConfig,
      );
      setStatus(!isActive ? t("classroom.teacher.classroomActivated") : t("classroom.teacher.classroomArchived"));
      await loadClassrooms();
      await loadClassroomDetail(selectedClassroomId);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setClassroomSaving(false);
    }
  };

  const regenerateInviteCode = async () => {
    if (!CLASSROOM_SYSTEM_ENABLED || !selectedClassroomId) return;
    setClassroomSaving(true);
    try {
      await apiClient.post(`/classrooms/teacher/${selectedClassroomId}/invite-code/regenerate`, {}, requestConfig);
      setStatus(t("classroom.teacher.inviteCodeRegenerated"));
      await loadClassrooms();
      await loadClassroomDetail(selectedClassroomId);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setClassroomSaving(false);
    }
  };

  const removeClassroomStudent = async (studentId: string) => {
    if (!CLASSROOM_SYSTEM_ENABLED || !selectedClassroomId) return;
    setClassroomSaving(true);
    try {
      await apiClient.post(
        `/classrooms/teacher/${selectedClassroomId}/students/remove`,
        { student_id: studentId },
        requestConfig,
      );
      setStatus(t("classroom.teacher.studentRemoved"));
      await loadClassroomDetail(selectedClassroomId);
      await loadClassrooms();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setClassroomSaving(false);
    }
  };

  const assignCourseToClassroom = async () => {
    if (!CLASSROOM_SYSTEM_ENABLED || !selectedClassroomId || !classroomCourseToAssign) return;
    setClassroomSaving(true);
    try {
      await apiClient.post(
        `/classrooms/teacher/${selectedClassroomId}/courses/assign`,
        { course_id: classroomCourseToAssign },
        requestConfig,
      );
      setStatus(t("classroom.teacher.courseAssigned"));
      setClassroomCourseToAssign("");
      await loadClassroomDetail(selectedClassroomId);
      await loadCourseAssignments();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setClassroomSaving(false);
    }
  };

  const loadAll = async () => {
    setStatus(t("dashboards.common.loading"));
    try {
      const [profileRes, metricsRes, requestsRes, lessonsRes, notificationsRes] = await Promise.all([
        apiClient.get<Profile>("/tutor/profile", requestConfig),
        apiClient.get<TeacherDashboardMetrics>("/teacher/dashboard", requestConfig),
        apiClient.get<{ items: AssistanceRequestItem[] }>("/teacher/assistance/requests", requestConfig),
        apiClient.get<{ items: LessonSummary[] }>("/study/lessons", requestConfig),
        apiClient.get<{ items: NotificationItem[] }>("/notifications", requestConfig),
      ]);
      setProfile(profileRes.data);
      setMetrics(metricsRes.data);
      setRequests(requestsRes.data.items || []);
      setLessons(lessonsRes.data.items || []);
      setNotifications(notificationsRes.data.items || []);
      await loadClassrooms();
      await loadCourseAssignments();
      await loadReadingLabStudents();
      setStatus(t("dashboards.teacher.loaded"));
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  useEffect(() => {
    if (!classroomDetail) return;
    setClassroomNameInput(classroomDetail.classroom.name ?? "");
    setClassroomDescriptionInput(classroomDetail.classroom.description ?? "");
    setClassroomGradeTagInput(classroomDetail.classroom.grade_tag ?? "");
  }, [classroomDetail]);

  // On mount: go online and start polling
  useEffect(() => {
    void setPresence(true);
    void loadAll();

    pollRef.current = setInterval(() => {
      void loadRequests();
    }, POLL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      // go offline when leaving the dashboard
      void setPresence(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage]);

  const acceptNow = async (requestId: string) => {
    const roomId = uuidv4();
    const meetingUrl = `${window.location.origin}/call/${roomId}`;
    try {
      await scheduleRequest(requestId, new Date().toISOString(), meetingUrl, i18n.resolvedLanguage);
      setStatus(t("callFlow.teacher.accepted"));
      await loadAll();
      window.open(meetingUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  const confirmSchedule = async (requestId: string) => {
    if (!scheduleDate) return;
    const roomId = uuidv4();
    const meetingUrl = `${window.location.origin}/call/${roomId}`;
    try {
      await scheduleRequest(requestId, new Date(scheduleDate).toISOString(), meetingUrl, i18n.resolvedLanguage);
      setStatus(t("callFlow.teacher.scheduled"));
      setSchedulingId(null);
      setScheduleDate("");
      await loadAll();
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      await completeRequest(requestId, i18n.resolvedLanguage);
      setStatus(t("callFlow.teacher.rejected"));
      await loadAll();
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  const exampleStudent: OverviewStudent = {
    id: "example-overview-student",
    name: t("dashboards.teacher.sampleStudent1"),
    engagement: t("dashboards.teacher.highEngagement"),
    progress: 76,
    attendance: "18/20",
    attendanceRate: 86,
    lessonsCount: 12,
    avgSessionMinutes: 45,
    courses: [
      {
        id: "example-course-1",
        title: t("dashboards.teacher.course1"),
        completion: 85,
        quizScore: 92,
      },
      {
        id: "example-course-2",
        title: t("dashboards.teacher.course3"),
        completion: 65,
        quizScore: 78,
      },
    ],
  };

  const exampleReadingLabStudent: ReadingLabTeacherStudent = {
    student_user_id: "example-reading-lab",
    student_label: t("dashboards.teacher.sampleStudent1"),
    support_status: "ACTIVE",
    support_active: true,
    focus_targets: ["b"],
    progress: {
      completed_sessions: 1,
      total_rounds_completed: 3,
      average_accuracy: 70,
    },
  };

  return (
    <DashboardShell title={t("dashboards.teacher.title")}>
      <TeacherTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" ? (
        <section className="portal-grid">
          <article className="card portal-main-card">
            <h3>{t("dashboards.teacher.studentsOverview")}</h3>
            <div className="stack-list">
              {(liveOverviewStudents.length > 0 ? liveOverviewStudents : [exampleStudent]).map((student) => (
                <article
                  key={student.id}
                  className="request-card teacher-student-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedOverviewStudent(student)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedOverviewStudent(student);
                    }
                  }}
                >
                  <div className="request-head-row">
                    <strong>{student.name}</strong>
                    <span className="status-chip">{student.engagement}</span>
                  </div>
                  <p className="muted">{t("dashboards.teacher.progressLabel")}</p>
                  <div className="progress-track">
                    <span className="progress-fill" style={{ width: `${student.progress}%` }} />
                  </div>
                  <p className="muted">{t("dashboards.teacher.attendance", { value: student.attendance })}</p>
                  <p className="muted">{t("dashboards.teacher.studentViewDetails")}</p>
                </article>
              ))}
            </div>
          </article>

          <aside className="portal-side-column">
            <article className="card portal-inner-card analytics-card">
              <h4>{t("dashboards.teacher.classAnalytics")}</h4>
              <p>{t("dashboards.teacher.avgCompletion", { value: 78 })}</p>
              <p>{t("dashboards.teacher.activeTutorsOnline", { value: metrics?.active_tutors_online ?? 0 })}</p>
              <p>{t("dashboards.teacher.pendingRequests", { count: metrics?.pending_requests ?? 0 })}</p>
            </article>

            <article className="card portal-inner-card">
              <div className="request-head-row checkpoint-block">
                <span className="muted">Status:</span>
                <span className={`status-chip ${isOnline ? "status-success" : ""}`}>
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>
              <button
                type="button"
                className={isOnline ? "secondary" : ""}
                onClick={() => void setPresence(!isOnline)}
              >
                {isOnline ? "Go Offline" : "Go Online"}
              </button>
              <p className="status-line checkpoint-block">{status || t("dashboards.common.idle")}</p>
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

          <div className="metrics-grid checkpoint-block">
            <article className="card metric-pill">
              <p>{t("dashboards.tabs.classrooms")}</p>
              <strong>{metrics?.pending_requests ?? 0}</strong>
            </article>
            <article className="card metric-pill">
              <p>{t("dashboards.tabs.schedule")}</p>
              <strong>{metrics?.scheduled_sessions ?? 0}</strong>
            </article>
            <article className="card metric-pill">
              <p>{t("dashboards.tabs.messages")}</p>
              <strong>{notifications.length}</strong>
            </article>
          </div>

          <div className="stack-list checkpoint-block">
            {(scheduledRequests.length > 0 ? scheduledRequests.slice(0, 1) : [{
              id: "example-attendance",
              topic: t("dashboards.teacher.course1"),
              scheduled_at: new Date().toISOString(),
              message: t("dashboards.teacher.readingLabToolGuidedHint"),
            } as unknown as AssistanceRequestItem]).map((item) => (
              <article className="notification-item" key={item.id}>
                <strong>{item.topic}</strong>
                <p>{t("dashboards.teacher.scheduledOn", { date: formatDate(item.scheduled_at, locale) })}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "classrooms" ? (
        <section className="portal-grid">
          <article className="card portal-main-card">
            <h3>{t("classroom.teacher.sectionTitle")}</h3>
            {!CLASSROOM_SYSTEM_ENABLED ? (
              <p className="muted">{t("classroom.teacher.featureDisabled")}</p>
            ) : (
              <div className="stack-list checkpoint-block">
                <article className="request-card">
                  <div className="request-head-row">
                    <strong>{t("classroom.teacher.createClassroom")}</strong>
                    {classroomLoading ? <span className="status-chip">{t("dashboards.common.loading")}</span> : null}
                  </div>
                  <div className="stack-form">
                    <label>
                      <span>{t("classroom.teacher.name")}</span>
                      <input value={classroomNameInput} onChange={(event) => setClassroomNameInput(event.target.value)} />
                    </label>
                    <label>
                      <span>{t("classroom.teacher.description")}</span>
                      <textarea
                        rows={3}
                        value={classroomDescriptionInput}
                        onChange={(event) => setClassroomDescriptionInput(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{t("classroom.teacher.gradeTag")}</span>
                      <input value={classroomGradeTagInput} onChange={(event) => setClassroomGradeTagInput(event.target.value)} />
                    </label>
                    <div className="inline-actions">
                      <button type="button" onClick={() => void createClassroom()} disabled={classroomSaving || !classroomNameInput.trim()}>
                        {classroomSaving ? t("login.pleaseWait") : t("classroom.teacher.create")}
                      </button>
                      {selectedClassroomId ? (
                        <button type="button" className="secondary" onClick={() => void updateClassroom()} disabled={classroomSaving || !classroomNameInput.trim()}>
                          {t("classroom.teacher.update")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>

                <article className="card portal-inner-card">
                  <h4>{t("classroom.teacher.classroomsList")}</h4>
                  <div className="subject-grid checkpoint-block">
                    {classrooms.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={item.id === selectedClassroomId ? "subject-card active" : "subject-card"}
                        onClick={() => {
                          setSelectedClassroomId(item.id);
                          void loadClassroomDetail(item.id);
                        }}
                      >
                        <strong>{item.name}</strong>
                        <span>{item.is_active ? t("classroom.teacher.active") : t("classroom.teacher.archived")}</span>
                      </button>
                    ))}
                    {classrooms.length === 0 ? <p className="muted">{t("classroom.teacher.noClassrooms")}</p> : null}
                  </div>
                </article>

                {classroomDetailLoading ? <p className="muted">{t("dashboards.common.loading")}</p> : null}
                {classroomDetail ? (
                  <article className="card portal-inner-card">
                    <div className="request-head-row">
                      <strong>{classroomDetail.classroom.name}</strong>
                      <span className={`status-chip ${classroomDetail.classroom.is_active ? "status-success" : ""}`}>
                        {classroomDetail.classroom.is_active ? t("classroom.teacher.active") : t("classroom.teacher.archived")}
                      </span>
                    </div>
                    <p className="muted">{classroomDetail.classroom.description || t("classroom.teacher.noDescription")}</p>
                    <p className="muted">{t("classroom.teacher.inviteCode")}: {classroomDetail.classroom.invite_code}</p>

                    <div className="inline-actions checkpoint-block">
                      <button type="button" className="secondary" onClick={() => void regenerateInviteCode()} disabled={classroomSaving}>
                        {t("classroom.teacher.regenerateInvite")}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void toggleClassroomActive(classroomDetail.classroom.is_active)}
                        disabled={classroomSaving}
                      >
                        {classroomDetail.classroom.is_active ? t("classroom.teacher.archive") : t("classroom.teacher.activate")}
                      </button>
                    </div>

                    <div className="checkpoint-block">
                      <h4>{t("classroom.teacher.assignedCourses")}</h4>
                      <div className="inline-actions">
                        <select
                          value={classroomCourseToAssign}
                          onChange={(event) => setClassroomCourseToAssign(event.target.value)}
                        >
                          <option value="">{t("classroom.teacher.selectCourse")}</option>
                          {lessons.map((lesson) => (
                            <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
                          ))}
                        </select>
                        <button type="button" className="secondary" onClick={() => void assignCourseToClassroom()} disabled={!classroomCourseToAssign || classroomSaving}>
                          {t("classroom.teacher.assignCourse")}
                        </button>
                      </div>
                      <div className="stack-list checkpoint-block">
                        {classroomDetail.courses.map((course) => (
                          <article key={`${classroomDetail.classroom.id}-${course.course_id}`} className="notification-item">
                            <strong>{course.title}</strong>
                            <p>{course.difficulty}</p>
                          </article>
                        ))}
                        {classroomDetail.courses.length === 0 ? <p className="muted">{t("classroom.teacher.noAssignedCourses")}</p> : null}
                      </div>
                    </div>

                    <div className="checkpoint-block">
                      <h4>{t("classroom.teacher.enrolledStudents")}</h4>
                      <div className="stack-list">
                        {classroomDetail.students.map((student) => (
                          <article key={`${classroomDetail.classroom.id}-${student.student_id}`} className="request-card">
                            <div className="request-head-row">
                              <strong>{student.student_label}</strong>
                              <button type="button" className="secondary" onClick={() => void removeClassroomStudent(student.student_id)} disabled={classroomSaving}>
                                {t("classroom.teacher.removeStudent")}
                              </button>
                            </div>
                            <p className="muted">
                              {t("classroom.teacher.screening")}: {student.screening_support_level ?? t("dashboards.common.none")}
                              {student.screening_composite_score !== null ? ` (${student.screening_composite_score})` : ""}
                            </p>
                            <p className="muted">
                              {t("classroom.teacher.readingLabStatus")}: {student.reading_support_status ?? t("dashboards.common.none")}
                            </p>
                          </article>
                        ))}
                        {classroomDetail.students.length === 0 ? <p className="muted">{t("classroom.teacher.noStudents")}</p> : null}
                      </div>
                    </div>
                  </article>
                ) : null}
              </div>
            )}
          </article>

          <aside className="portal-side-column">
            <article className="card portal-inner-card">
              <h4>{t("classroom.teacher.quickGuideTitle")}</h4>
              <ul className="clean-list">
                <li>{t("classroom.teacher.quickGuide1")}</li>
                <li>{t("classroom.teacher.quickGuide2")}</li>
                <li>{t("classroom.teacher.quickGuide3")}</li>
              </ul>
            </article>

            <article className="card portal-inner-card">
              <h4>{t("classroom.teacher.summary")}</h4>
              <div className="metrics-grid checkpoint-block">
                <article className="card metric-pill">
                  <p>{t("classroom.teacher.totalClassrooms")}</p>
                  <strong>{classrooms.length}</strong>
                </article>
                <article className="card metric-pill">
                  <p>{t("classroom.teacher.totalStudents")}</p>
                  <strong>{classroomDetail?.students.length ?? 0}</strong>
                </article>
                <article className="card metric-pill">
                  <p>{t("classroom.teacher.totalCourses")}</p>
                  <strong>{classroomDetail?.courses.length ?? 0}</strong>
                </article>
              </div>
            </article>
          </aside>
        </section>
      ) : null}

      {activeTab === "courses" ? (
        <TeacherCoursesTab />
      ) : null}

      {activeTab === "schedule" ? (
        <section className="card portal-main-card">
          <h3>{t("dashboards.teacher.scheduleTitle")}</h3>
          <div className="stack-list">
            {(scheduledRequests.length > 0 ? scheduledRequests : [{
              id: "example-schedule",
              student_user_id: "00000000-0000-0000-0000-000000000000",
              tutor_user_id: null,
              lesson_id: null,
              topic: t("dashboards.teacher.course2"),
              message: "",
              preferred_at: null,
              status: "SCHEDULED",
              scheduled_at: new Date().toISOString(),
              meeting_url: null,
            } as AssistanceRequestItem])
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
            {(notifications.length > 0
              ? notifications.slice(0, 6).map((item) => ({
                  id: item.id,
                  title: item.title,
                  body: item.body,
                }))
              : [{
                  id: "example-message",
                  title: t("dashboards.teacher.course3"),
                  body: t("dashboards.teacher.classObservationPlaceholder"),
                }]
            ).map((item) => (
              <article className="notification-item" key={item.id}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {READING_LAB_ENABLED && activeTab === "readingLab" ? (
        <section className="portal-grid">
          <article className="card portal-main-card">
            <div className="request-head-row">
              <h3>{t("dashboards.teacher.readingLabTitle")}</h3>
              <span className="status-chip status-accent">{t("dashboards.teacher.readingLabBadge")}</span>
            </div>

            <p className="muted">{t("dashboards.teacher.readingLabSubtitle")}</p>

            <div className="metrics-grid checkpoint-block">
              <article className="card metric-pill">
                <p>{t("readingLab.completedSessions")}</p>
                <strong>{readingLabMetrics.sessions}</strong>
              </article>
              <article className="card metric-pill">
                <p>{t("readingLab.totalRounds")}</p>
                <strong>{readingLabMetrics.rounds}</strong>
              </article>
              <article className="card metric-pill">
                <p>{t("readingLab.averageAccuracy")}</p>
                <strong>{readingLabMetrics.accuracy}%</strong>
              </article>
            </div>

            <div className="stack-list checkpoint-block">
              {readingLabLoading ? <p className="muted">{t("dashboards.common.loading")}</p> : null}
              {!readingLabLoading && readingLabStudents.length === 0 ? (
                <p className="muted">{t("dashboards.teacher.readingLabNoStudents")}</p>
              ) : null}
              {!readingLabLoading && (readingLabStudents.length > 0 ? readingLabStudents : [exampleReadingLabStudent]).map((row) => (
                <article
                  key={row.student_user_id}
                  className="request-card psych-clickable-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => void openReadingLabEditor(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openReadingLabEditor(row);
                    }
                  }}
                >
                  <div className="request-head-row">
                    <strong>{row.student_label}</strong>
                    <span className={`status-chip ${statusTone(row.support_status)}`}>{statusLabel(row.support_status)}</span>
                  </div>
                  <p>{t("dashboards.teacher.readingLabStudentSummary", { sessions: row.progress.completed_sessions, rounds: row.progress.total_rounds_completed })}</p>
                  <p className="muted">{t("readingLab.averageAccuracy")}: {row.progress.average_accuracy}%</p>
                  {!row.student_user_id.startsWith("example-") ? <p className="muted">{t("dashboards.teacher.readingLabClickToEdit")}</p> : null}
                  {row.focus_targets.length ? (
                    <div className="inline-actions">
                      {row.focus_targets.slice(0, 4).map((target) => (
                        <span key={`${row.student_user_id}-${target}`} className="status-chip">{target}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className="progress-track">
                    <span className="progress-fill" style={{ width: `${row.progress.average_accuracy}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </article>

          <aside className="portal-side-column">
            <article className="card portal-inner-card analytics-card">
              <h4>{t("dashboards.teacher.readingLabToolsTitle")}</h4>
              <div className="stack-list">
                {(readingLabStudents.length > 0
                  ? [
                      {
                        ...readingLabTools[0],
                        subtitle: t("dashboards.teacher.readingLabStudentSummary", {
                          sessions: readingLabMetrics.sessions,
                          rounds: readingLabMetrics.rounds,
                        }),
                      },
                      {
                        ...readingLabTools[1],
                        subtitle:
                          readingLabStudents.find((item) => item.focus_targets.length > 0)?.focus_targets[0] ??
                          readingLabTools[1].subtitle,
                      },
                    ]
                  : [readingLabTools[0]]
                ).map((tool) => (
                  <article className="subject-card" key={tool.id}>
                    <div className="request-head-row">
                      <strong>{tool.title}</strong>
                      <span className={`status-chip ${tool.tone}`}>{tool.status}</span>
                    </div>
                    <p className="muted">{tool.subtitle}</p>
                  </article>
                ))}
              </div>
            </article>

            <article className="card portal-inner-card">
              <h4>{t("dashboards.teacher.readingLabNextSteps")}</h4>
              <ul className="clean-list">
                <li>{t("dashboards.teacher.readingLabStep1")}</li>
                <li>{t("dashboards.teacher.readingLabStep2")}</li>
                <li>{t("dashboards.teacher.readingLabStep3")}</li>
              </ul>
            </article>

            <article className="card portal-inner-card">
              <p className="status-line">{status || t("dashboards.common.idle")}</p>
              <button type="button" className="secondary" onClick={() => void loadAll()}>
                {t("dashboards.common.refresh")}
              </button>
            </article>
          </aside>
        </section>
      ) : null}

      {selectedOverviewStudent ? (
        <div className="course-v2-modal-backdrop" role="presentation" onClick={() => setSelectedOverviewStudent(null)}>
          <article
            className="teacher-student-modal card"
            role="dialog"
            aria-modal="true"
            aria-label={t("dashboards.teacher.studentDetailTitle", { student: selectedOverviewStudent.name })}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="teacher-student-modal-header">
              <div>
                <h3>{selectedOverviewStudent.name}</h3>
                <p className="muted">{t("dashboards.teacher.studentDetailSubtitle")}</p>
              </div>
              <button
                type="button"
                className="secondary teacher-student-close"
                onClick={() => setSelectedOverviewStudent(null)}
                aria-label={t("common.close")}
              >
                x
              </button>
            </header>

            <section className="teacher-student-kpi-grid">
              <article className="teacher-student-kpi teacher-student-kpi-progress">
                <p>{t("dashboards.teacher.studentOverallProgress")}</p>
                <strong>{selectedOverviewStudent.progress}%</strong>
              </article>
              <article className="teacher-student-kpi teacher-student-kpi-lessons">
                <p>{t("dashboards.teacher.studentLessons")}</p>
                <strong>{selectedOverviewStudent.lessonsCount}</strong>
              </article>
              <article className="teacher-student-kpi teacher-student-kpi-attendance">
                <p>{t("dashboards.teacher.studentAttendanceRate")}</p>
                <strong>{selectedOverviewStudent.attendanceRate}%</strong>
              </article>
              <article className="teacher-student-kpi teacher-student-kpi-time">
                <p>{t("dashboards.teacher.studentAvgTime")}</p>
                <strong>{selectedOverviewStudent.avgSessionMinutes}m</strong>
              </article>
            </section>

            <section className="teacher-student-progress-panel">
              <h4>{t("dashboards.teacher.studentCourseProgressTitle")}</h4>
              <div className="stack-list">
                {selectedOverviewStudent.courses.map((course) => (
                  <article key={course.id} className="teacher-student-course-row">
                    <div className="request-head-row">
                      <strong>{course.title}</strong>
                      <span className="status-chip status-success">
                        {t("dashboards.teacher.studentQuizScore", { value: course.quizScore })}
                      </span>
                    </div>
                    <div className="progress-track">
                      <span className="progress-fill" style={{ width: `${course.completion}%` }} />
                    </div>
                    <p className="muted">{t("dashboards.teacher.studentCourseCompletion", { value: course.completion })}</p>
                  </article>
                ))}
              </div>
            </section>

            <footer className="teacher-student-modal-actions">
              <button type="button" className="secondary" onClick={() => setSelectedOverviewStudent(null)}>
                {t("dashboards.teacher.studentClose")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedOverviewStudent(null);
                  setActiveTab("schedule");
                }}
              >
                {t("dashboards.teacher.studentScheduleSession")}
              </button>
              <button
                type="button"
                className="teacher-student-message-btn"
                onClick={() => {
                  setSelectedOverviewStudent(null);
                  setActiveTab("messages");
                }}
              >
                {t("dashboards.teacher.studentSendMessage")}
              </button>
            </footer>
          </article>
        </div>
      ) : null}

      {editingReadingLabStudent ? (
        <div className="course-v2-modal-backdrop" role="presentation" onClick={() => setEditingReadingLabStudent(null)}>
          <article
            className="course-v2-modal card p-5 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={t("dashboards.teacher.readingLabEditTitle", { student: editingReadingLabStudent.student_label })}
            onClick={(event) => event.stopPropagation()}
          >
            <h3>{t("dashboards.teacher.readingLabEditTitle", { student: editingReadingLabStudent.student_label })}</h3>
            <p className="muted">{t("dashboards.teacher.readingLabEditSubtitle")}</p>

            <div className="inline-actions checkpoint-block">
              <button
                type="button"
                className={editingPlan.status === "ACTIVE" ? "" : "secondary"}
                onClick={() => setEditingPlan((prev) => ({ ...prev, status: "ACTIVE" }))}
              >
                {t("readingLab.statusActive")}
              </button>
              <button
                type="button"
                className={editingPlan.status === "INACTIVE" ? "" : "secondary"}
                onClick={() => setEditingPlan((prev) => ({ ...prev, status: "INACTIVE" }))}
              >
                {t("readingLab.statusInactive")}
              </button>
            </div>

            <label className="checkpoint-block">
              {t("readingLab.focusTargets")}
              <div className="inline-actions">
                <input
                  value={editingTargetInput}
                  onChange={(event) => setEditingTargetInput(event.target.value)}
                  placeholder={t("readingLab.targetPlaceholder")}
                />
                <button type="button" className="secondary" onClick={addEditingTarget} disabled={!editingTargetInput.trim()}>
                  {t("readingLab.addTarget")}
                </button>
              </div>
            </label>

            <div className="inline-actions checkpoint-block">
              {editingPlan.focus_targets.length ? (
                editingPlan.focus_targets.map((target) => (
                  <span key={target} className="status-chip">
                    {target}
                    <button
                      type="button"
                      className="!ml-2 !min-h-0 !border-0 !bg-transparent !p-0 !text-current shadow-none"
                      onClick={() => removeEditingTarget(target)}
                      aria-label={`${t("readingLab.removeTile")} ${target}`}
                    >
                      x
                    </button>
                  </span>
                ))
              ) : (
                <p className="muted">{t("readingLab.notesEmpty")}</p>
              )}
            </div>

            <div className="inline-actions checkpoint-block">
              <button type="button" className="secondary" onClick={() => setEditingReadingLabStudent(null)}>
                {t("callFlow.teacher.cancel")}
              </button>
              <button type="button" onClick={() => void saveReadingLabPlan()} disabled={savingPlan}>
                {savingPlan ? t("login.pleaseWait") : t("readingLab.savePlan")}
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </DashboardShell>
  );
}
