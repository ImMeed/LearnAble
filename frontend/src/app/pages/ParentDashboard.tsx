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

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activeDays = [0, 1, 2, 4]; // Mon Tue Wed Fri active

  return (
    <DashboardShell title={t("dashboards.parent.title")} subtitle={t("dashboards.parent.subtitle")}>
      <section className="parent-child-selector">
        <div className="parent-child-header">
          <span className="parent-child-icon">👤</span>
          <span className="parent-child-label">{t("dashboards.parent.selectChild")}</span>
        </div>
        <button type="button" className="btn-primary btn-add-child">
          👤+ {t("dashboards.parent.addChild")}
        </button>
      </section>
      <div className="parent-child-chips">
        <article className="parent-child-chip active">
          <strong>{t("dashboards.parent.childName")}</strong>
          <span>{t("dashboards.parent.childId")}</span>
        </article>
      </div>

      <section className="portal-grid">
        <article className="card portal-main-card">
          <section className="parent-welcome-card">
            <h3>{t("dashboards.parent.welcomeBack")}</h3>
            <p>{t("dashboards.parent.weeklySummary")}</p>
          </section>

          <section className="checkpoint-block">
            <h3 className="parent-section-title">{t("dashboards.parent.progressTitle")}</h3>
            <div className="parent-progress-grid">
              <article className="parent-prog-card">
                <span className="parent-prog-icon">🏅</span>
                <p className="parent-prog-label">{t("dashboards.parent.level")}</p>
                <p className="parent-prog-value purple">12</p>
              </article>
              <article className="parent-prog-card">
                <span className="parent-prog-icon">📖</span>
                <p className="parent-prog-label">{t("dashboards.parent.lessons")}</p>
                <p className="parent-prog-value blue">12/20</p>
              </article>
              <article className="parent-prog-card">
                <span className="parent-prog-icon">🔥</span>
                <p className="parent-prog-label">{t("dashboards.parent.streak")}</p>
                <p className="parent-prog-value green">{t("dashboards.parent.streakDays", { count: 7 })}</p>
              </article>
            </div>
          </section>

          <section className="card portal-inner-card checkpoint-block">
          </section>

          <section className="card portal-inner-card checkpoint-block">
            <h4>{t("dashboards.parent.overallProgress")}</h4>
            <div className="parent-overall-progress">
              <span className="muted">{t("dashboards.parent.currentModule", { defaultValue: "Current Module" })}</span>
              <span>12 / 20</span>
            </div>
            <div className="progress-track">
              <span className="progress-fill" style={{ width: "60%" }} />
            </div>
          </section>

          <section className="card portal-inner-card checkpoint-block">
            <h4>{t("dashboards.parent.weekActivity", { defaultValue: "This Week's Activity" })}</h4>
            <div className="parent-week-grid">
              {weekDays.map((day, i) => (
                <div key={day} className="parent-week-day">
                  <span className="parent-week-label">{day}</span>
                  <div className={`parent-week-dot${activeDays.includes(i) ? " active" : ""}`}>
                    {activeDays.includes(i) && <span>✓</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </article>

        <aside className="portal-side-column">
          <article className="card parent-wellbeing-card">
            <h4 className="parent-wellbeing-title">
              ❤️ {t("dashboards.parent.wellbeing")}
            </h4>
            <div className="parent-wellbeing-list">
              <div className="parent-wellbeing-row">
                <div>
                  <p className="parent-wb-label">{t("dashboards.parent.overallMood")}</p>
                  <p className="muted parent-wb-sub">{t("dashboards.parent.overallMoodValue")}</p>
                </div>
                <span className="parent-wb-emoji">😊</span>
              </div>
              <div className="parent-wellbeing-row">
                <div>
                  <p className="parent-wb-label">{t("dashboards.parent.focusLevel")}</p>
                  <p className="muted parent-wb-sub">{t("dashboards.parent.focusLevelSub", { defaultValue: "Maintaining good attention" })}</p>
                </div>
                <span className="parent-wb-value blue">{t("dashboards.parent.focusLevelValue")}</span>
              </div>
              <div className="parent-wellbeing-row">
                <div>
                  <p className="parent-wb-label">{t("dashboards.parent.stressLevel")}</p>
                  <p className="muted parent-wb-sub">{t("dashboards.parent.stressSub", { defaultValue: "Comfortable learning pace" })}</p>
                </div>
                <span className="parent-wb-value purple">{t("dashboards.parent.stressLevelValue")}</span>
              </div>
            </div>
          </article>

          <article className="card parent-recs-card">
            <h4>ℹ️ {t("dashboards.parent.recommendations")}</h4>
            <ul className="parent-recs-list">
              <li>• {t("dashboards.parent.rec1")}</li>
              <li>• {t("dashboards.parent.rec2")}</li>
              <li>• {t("dashboards.parent.rec3")}</li>
              <li>• {t("dashboards.parent.rec4")}</li>
            </ul>
          </article>

          {status ? (
            <article className="card">
              <p className="status-line">{status}</p>
            </article>
          ) : null}
        </aside>
      </section>
    </DashboardShell>
  );
}
