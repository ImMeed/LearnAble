import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
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
