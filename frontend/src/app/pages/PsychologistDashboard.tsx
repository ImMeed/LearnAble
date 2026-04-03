import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import {
  DashboardShell,
  errorMessage,
  formatDate,
  localeRequestConfig,
  NotificationItem,
} from "./roleDashboardShared";

export function PsychologistDashboardPageV2() {
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
                  <p className="muted">
                    {formatDate(item.created_at, i18n.resolvedLanguage === "en" ? "en" : "ar", t("dashboards.common.none"))}
                  </p>
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
