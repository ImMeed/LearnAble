import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
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
            <p className="muted">{profile?.email ?? t("dashboards.common.none")}</p>
          </article>
        </aside>
      </section>
    </DashboardShell>
  );
}
