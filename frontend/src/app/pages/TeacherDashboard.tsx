import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";

import { apiClient } from "../../api/client";
import { scheduleRequest, completeRequest } from "../../api/callApi";
import {
  AssistanceRequestItem,
  DashboardShell,
  errorMessage,
  formatDate,
  localeRequestConfig,
  Profile,
  TeacherDashboardMetrics,
  TeacherTab,
  TeacherTabs,
} from "./roleDashboardShared";

const POLL_MS = 8000;

export function TeacherDashboardPageV2() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [metrics, setMetrics] = useState<TeacherDashboardMetrics | null>(null);
  const [requests, setRequests] = useState<AssistanceRequestItem[]>([]);
  const [activeTab, setActiveTab] = useState<TeacherTab>("overview");
  const [attendanceNote, setAttendanceNote] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  // per-request inline schedule picker state
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");

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

  const students = [
    {
      id: "s1",
      name: t("dashboards.teacher.sampleStudent1"),
      engagement: t("dashboards.teacher.highEngagement"),
      engagementLevel: "high",
      progress: 76,
      attendance: { present: 18, absent: 2, late: 1 },
      prevNote: t("dashboards.teacher.sampleNote1", { defaultValue: "Excellent participation in class discussions" }),
    },
    {
      id: "s2",
      name: t("dashboards.teacher.sampleStudent2"),
      engagement: t("dashboards.teacher.mediumEngagement"),
      engagementLevel: "medium",
      progress: 44,
      attendance: { present: 15, absent: 4, late: 2 },
      prevNote: t("dashboards.teacher.sampleNote2", { defaultValue: "Needs more focus during lessons" }),
    },
    {
      id: "s3",
      name: t("dashboards.teacher.sampleStudent3"),
      engagement: t("dashboards.teacher.highEngagement"),
      engagementLevel: "high",
      progress: 88,
      attendance: { present: 20, absent: 0, late: 1 },
      prevNote: "",
    },
  ];

  type AttStatus = "present" | "late" | "absent";
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, AttStatus>>({
    s1: "present",
    s2: "late",
    s3: "absent",
  });

  return (
    <DashboardShell title={t("dashboards.teacher.title")} subtitle={t("dashboards.teacher.subtitle")}>
      <TeacherTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" ? (
        <section className="portal-grid">
          <article className="card portal-main-card">
            <h3 className="teacher-section-title">{t("dashboards.teacher.studentsOverview")}</h3>
            <div className="stack-list">
              {students.map((student) => (
                <article key={student.id} className="teacher-student-card">
                  <div className="teacher-student-header">
                    <strong>{student.name}</strong>
                    <div className="teacher-student-badges">
                      {student.engagementLevel === "medium" && (
                        <span className="teacher-needs-help-badge">⚠ Needs Help</span>
                      )}
                      <span className={`teacher-engagement-badge ${student.engagementLevel}`}>
                        {student.engagement}
                      </span>
                    </div>
                  </div>
                  <div className="teacher-student-progress-row">
                    <span className="muted">{t("dashboards.teacher.progressLabel")}</span>
                  </div>
                  <div className="progress-track">
                    <span className="progress-fill" style={{ width: `${student.progress}%` }} />
                  </div>
                  <div className="teacher-attendance-row">
                    <span className="muted">{t("dashboards.teacher.attendanceLabel", { defaultValue: "Attendance" })}</span>
                    <span className="att-present">✓ {student.attendance.present}</span>
                    <span className="att-absent">✗ {student.attendance.absent}</span>
                    <span className="att-late">⏰ {student.attendance.late}</span>
                  </div>
                  <button type="button" className="teacher-detail-link">
                    {t("dashboards.teacher.clickDetailedAnalytics", { defaultValue: "Click for detailed analytics →" })}
                  </button>
                </article>
              ))}
            </div>
          </article>

          <aside className="portal-side-column">
            <article className="card teacher-analytics-card">
              <h4 className="teacher-analytics-title">📊 {t("dashboards.teacher.classAnalytics")}</h4>
              <div className="teacher-analytics-row">
                <span className="teacher-analytics-label">{t("dashboards.teacher.avgCompletion", { value: "" })}</span>
                <span className="teacher-analytics-val blue">78%</span>
              </div>
              <div className="teacher-analytics-row">
                <span className="teacher-analytics-label">{t("dashboards.teacher.activeStudentsLabel", { defaultValue: "Active Students" })}</span>
                <span className="teacher-analytics-val green">
                  18/{students.length * 8}
                </span>
              </div>
            </article>

            <article className="card">
              <div className="teacher-presence-row">
                <span className="muted">Status:</span>
                <span className={`teacher-presence-chip ${isOnline ? "online" : "offline"}`}>
                  {isOnline ? "● Online" : "○ Offline"}
                </span>
              </div>
              <button
                type="button"
                className={isOnline ? "secondary" : ""}
                onClick={() => void setPresence(!isOnline)}
              >
                {isOnline ? "Go Offline" : "Go Online"}
              </button>
              {status ? <p className="status-line checkpoint-block">{status}</p> : null}
              <button type="button" className="secondary checkpoint-block" onClick={() => void loadAll()}>
                {t("dashboards.common.refresh")}
              </button>
            </article>

          </aside>
        </section>
      ) : null}

      {activeTab === "attendance" ? (
        <section>
          <div className="teacher-att-header">
            <h3>📋 {t("dashboards.teacher.attendanceManagement")}</h3>
            <span className="teacher-att-date muted">
              {new Date().toLocaleDateString(locale === "en" ? "en-US" : "ar-EG", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
            </span>
          </div>
          <div className="stack-list">
            {students.map((student) => (
              <article key={student.id} className="card teacher-att-card">
                <strong>{student.name}</strong>
                <div className="teacher-att-buttons">
                  <button
                    type="button"
                    className={`att-btn att-present-btn${attendanceStatus[student.id] === "present" ? " att-active-present" : ""}`}
                    onClick={() => setAttendanceStatus((prev) => ({ ...prev, [student.id]: "present" }))}
                  >
                    👤 {t("dashboards.teacher.present")}
                  </button>
                  <button
                    type="button"
                    className={`att-btn att-late-btn${attendanceStatus[student.id] === "late" ? " att-active-late" : ""}`}
                    onClick={() => setAttendanceStatus((prev) => ({ ...prev, [student.id]: "late" }))}
                  >
                    ⏰ {t("dashboards.teacher.late")}
                  </button>
                  <button
                    type="button"
                    className={`att-btn att-absent-btn${attendanceStatus[student.id] === "absent" ? " att-active-absent" : ""}`}
                    onClick={() => setAttendanceStatus((prev) => ({ ...prev, [student.id]: "absent" }))}
                  >
                    👤✕ {t("dashboards.teacher.absent")}
                  </button>
                </div>
                {student.prevNote ? (
                  <div className="teacher-prev-note">
                    <span className="muted">Previous Note:</span>
                    <p className="teacher-prev-note-text">{student.prevNote}</p>
                  </div>
                ) : null}
                <label className="teacher-obs-label">
                  {t("dashboards.teacher.classObservation")}
                  <textarea
                    className="teacher-obs-textarea"
                    rows={3}
                    value={attendanceNote}
                    onChange={(e) => setAttendanceNote(e.target.value)}
                    placeholder={t("dashboards.teacher.classObservationPlaceholder")}
                  />
                </label>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "classrooms" ? (
        <section className="portal-grid">
          <article className="card portal-main-card">
            <h3>{t("dashboards.teacher.pendingJoinRequests", { count: requests.length })}</h3>
            <div className="stack-list">
              {requests.filter((r) => r.status === "REQUESTED").map((item) => (
                <article className="request-card tcf-request-card" key={item.id}>
                  <div className="request-head-row">
                    <strong>{item.topic}</strong>
                    <span className="status-chip">{t("callFlow.statusRequested")}</span>
                  </div>
                  <p className="muted">{item.message}</p>

                  {schedulingId === item.id ? (
                    <div className="tcf-schedule-row">
                      <input
                        type="datetime-local"
                        className="tcf-date-input"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        aria-label={t("callFlow.teacher.pickDate")}
                      />
                      <button type="button" onClick={() => void confirmSchedule(item.id)} disabled={!scheduleDate}>
                        {t("callFlow.teacher.confirmDate")}
                      </button>
                      <button type="button" className="secondary" onClick={() => setSchedulingId(null)}>
                        {t("callFlow.teacher.cancel")}
                      </button>
                    </div>
                  ) : (
                    <div className="inline-actions tcf-actions">
                      <button type="button" className="tcf-btn-accept" onClick={() => void acceptNow(item.id)}>
                        {t("callFlow.teacher.acceptNow")}
                      </button>
                      <button type="button" className="secondary" onClick={() => { setSchedulingId(item.id); setScheduleDate(""); }}>
                        {t("callFlow.teacher.setDate")}
                      </button>
                      <button type="button" className="secondary tcf-btn-reject" onClick={() => void rejectRequest(item.id)}>
                        {t("callFlow.teacher.reject")}
                      </button>
                    </div>
                  )}
                </article>
              ))}
              {requests.filter((r) => r.status === "SCHEDULED").map((item) => (
                <article className="request-card" key={item.id}>
                  <div className="request-head-row">
                    <strong>{item.topic}</strong>
                    <span className="status-chip">{t("callFlow.statusScheduled")}</span>
                  </div>
                  {item.meeting_url && (
                    <a
                      href={item.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tcf-join-link"
                    >
                      {t("callFlow.teacher.openCall")}
                    </a>
                  )}
                </article>
              ))}
            </div>
          </article>

          <aside className="portal-side-column">
            <article className="card">
              <div className="request-head-row checkpoint-block">
                <span className="muted">Status:</span>
                <span className="status-chip" style={{ background: isOnline ? "var(--success, #22c55e)" : undefined }}>
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
              <p className="muted checkpoint-block" style={{ fontSize: "0.8em" }}>
                Auto-refreshing every 8s
              </p>
            </article>
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
      <Link
        className="forum-fab"
        to={`${i18n.resolvedLanguage === "en" ? "/en" : "/ar"}/forum`}
        title={t("nav.forum", { defaultValue: "Forum" })}
      >
        <span className="forum-fab-icon">💬</span>
        <span className="forum-fab-label">{t("nav.forum", { defaultValue: "Forum" })}</span>
      </Link>
    </DashboardShell>
  );
}
