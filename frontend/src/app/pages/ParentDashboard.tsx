import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { SupportManagementCard, type ReadingLabChildOption, type ReadingLabPlan } from "../components/SupportManagementCard";
import { READING_LAB_ENABLED } from "../features";
import {
  DashboardShell,
  errorMessage,
  localeRequestConfig,
  NotificationItem,
  Profile,
} from "./roleDashboardShared";

export function ParentDashboardPageV2() {
  const { t, i18n } = useTranslation();
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [linkedChildren, setLinkedChildren] = useState<ReadingLabChildOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [readingLabPlan, setReadingLabPlan] = useState<ReadingLabPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  const loadPlan = async (studentId: string) => {
    if (!READING_LAB_ENABLED || !studentId) {
      setReadingLabPlan(null);
      return;
    }
    setLoadingPlan(true);
    try {
      const response = await apiClient.get<ReadingLabPlan>(`/reading-lab/support/students/${studentId}`, requestConfig);
      setReadingLabPlan(response.data);
    } catch (error) {
      setReadingLabPlan(null);
      setStatus(errorMessage(error));
    } finally {
      setLoadingPlan(false);
    }
  };

  const loadAll = async () => {
    setStatus(t("dashboards.common.loading"));
    try {
      const [profileRes, notificationsRes, childrenRes] = await Promise.all([
        apiClient.get<Profile>("/parent/profile", requestConfig),
        apiClient.get<{ items: NotificationItem[] }>("/notifications", requestConfig),
        READING_LAB_ENABLED
          ? apiClient.get<{ items: ReadingLabChildOption[] }>("/reading-lab/children", requestConfig)
          : Promise.resolve({ data: { items: [] } }),
      ]);
      setProfile(profileRes.data);
      setNotifications(notificationsRes.data.items || []);
      const children = childrenRes.data.items || [];
      setLinkedChildren(children);
      const nextStudentId = selectedStudentId || children[0]?.student_user_id || "";
      setSelectedStudentId(nextStudentId);
      if (nextStudentId) {
        await loadPlan(nextStudentId);
      } else {
        setReadingLabPlan(null);
      }
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

  const saveReadingLabPlan = async (nextPlan: ReadingLabPlan) => {
    if (!selectedStudentId) return;
    const response = await apiClient.put<ReadingLabPlan>(
      `/reading-lab/support/students/${selectedStudentId}`,
      nextPlan,
      requestConfig,
    );
    setReadingLabPlan(response.data);
    const refreshedChildren = await apiClient.get<{ items: ReadingLabChildOption[] }>("/reading-lab/children", requestConfig);
    setLinkedChildren(refreshedChildren.data.items || []);
  };

  const linkStudent = async (studentLinkId: string) => {
    await apiClient.post(
      "/reading-lab/children/link",
      { student_link_id: studentLinkId.trim().toUpperCase() },
      requestConfig,
    );
    const refreshedChildren = await apiClient.get<{ items: ReadingLabChildOption[] }>("/reading-lab/children", requestConfig);
    const items = refreshedChildren.data.items || [];
    setLinkedChildren(items);
    if (!selectedStudentId && items[0]?.student_user_id) {
      const firstId = items[0].student_user_id;
      setSelectedStudentId(firstId);
      await loadPlan(firstId);
    }
  };

  const selectedChild = linkedChildren.find((item) => item.student_user_id === selectedStudentId) ?? null;

  return (
    <DashboardShell title={t("dashboards.parent.title")}>
      <section className="portal-grid">
        <article className="card portal-main-card">
          {READING_LAB_ENABLED ? (
            <SupportManagementCard
              children={linkedChildren}
              selectedStudentId={selectedStudentId}
              plan={readingLabPlan}
              loading={loadingPlan}
              showPlanDetails={false}
              onSelectStudent={(studentId) => {
                setSelectedStudentId(studentId);
                void loadPlan(studentId);
              }}
              onSave={saveReadingLabPlan}
              onLinkStudent={linkStudent}
            />
          ) : (
            <section className="card portal-inner-card">
              <div className="request-head-row">
                <h3>{t("dashboards.parent.selectChild")}</h3>
              </div>
              <article className="subject-card active child-card">
                <strong>{t("dashboards.parent.childName")}</strong>
                <span>{t("dashboards.parent.childId")}</span>
              </article>
            </section>
          )}

          <section className="card portal-inner-card gradient-card checkpoint-block">
            <h3>{t("dashboards.parent.welcomeBack")}</h3>
            <p>{t("dashboards.parent.weeklySummary")}</p>
          </section>

          <section className="checkpoint-block">
            <h3>{t("dashboards.parent.progressTitle")}</h3>
            <div className="metrics-grid">
              <article className="card metric-pill">
                <p>{t("dashboards.parent.level")}</p>
                <strong>{selectedChild?.progress.completed_sessions ?? 0}</strong>
              </article>
              <article className="card metric-pill">
                <p>{t("dashboards.parent.lessons")}</p>
                <strong>{selectedChild?.progress.total_rounds_completed ?? 0}</strong>
              </article>
              <article className="card metric-pill">
                <p>{t("dashboards.parent.streak")}</p>
                <strong>{t("dashboards.parent.streakDays", { count: Math.max(selectedChild?.progress.completed_sessions ?? 0, 1) })}</strong>
              </article>
            </div>
          </section>

          <section className="card portal-inner-card checkpoint-block">
            <h4>{t("dashboards.parent.overallProgress")}</h4>
            <p className="muted">{selectedChild?.progress.average_accuracy ?? 0}%</p>
            <div className="progress-track">
              <span className="progress-fill" style={{ width: `${selectedChild?.progress.average_accuracy ?? 0}%` }} />
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
          <article className="card portal-inner-card">
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

          <article className="card portal-inner-card">
            <h4>{t("dashboards.parent.recommendations")}</h4>
            <ul className="clean-list">
              <li>{t("dashboards.parent.rec1")}</li>
              <li>{t("dashboards.parent.rec2")}</li>
              <li>{t("dashboards.parent.rec3")}</li>
              <li>{t("dashboards.parent.rec4")}</li>
            </ul>
          </article>

          <article className="card portal-inner-card quick-actions-card">
            <h4>{t("dashboards.parent.quickActions")}</h4>
            <button type="button">{t("dashboards.parent.messageTeacher")}</button>
            <button type="button" className="secondary">{t("dashboards.parent.viewReport")}</button>
            <button type="button" className="secondary">{t("dashboards.parent.scheduleMeeting")}</button>
          </article>

          <article className="card portal-inner-card status-success">
            <h4>{t("dashboards.parent.keepItUp")}</h4>
            <p>{t("dashboards.parent.keepItUpText")}</p>
          </article>

          <article className="card portal-inner-card">
            <p className="status-line">{status || t("dashboards.common.idle")}</p>
            <p className="muted">{profile?.email ?? t("dashboards.common.none")}</p>
          </article>
        </aside>
      </section>
    </DashboardShell>
  );
}
