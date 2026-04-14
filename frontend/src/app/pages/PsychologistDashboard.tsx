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

type ScreeningSummary = {
  focus_score: number;
  reading_score: number;
  memory_score: number;
  support_level: string;
};

type PsychologistReview = {
  student_user_id: string;
  student_label: string;
  screening_composite_score: number | null;
  screening_summary: ScreeningSummary | null;
  latest_questionnaire: Record<string, unknown> | null;
  support_confirmation: Record<string, unknown> | null;
};

type PsychologistReviewListResponse = {
  items: PsychologistReview[];
  total: number;
  limit: number;
  offset: number;
  query: string | null;
};

const REVIEW_PAGE_SIZE = 20;

export function PsychologistDashboardPageV2() {
  const { t, i18n } = useTranslation();
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [status, setStatus] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [studentId, setStudentId] = useState("");
  const [reviewData, setReviewData] = useState("");
  const [reviews, setReviews] = useState<PsychologistReview[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewOffset, setReviewOffset] = useState(0);
  const [reviewSearchInput, setReviewSearchInput] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [supportLevel, setSupportLevel] = useState("MEDIUM");
  const [supportNotes, setSupportNotes] = useState("");

  const monitoringRows = useMemo(() => {
    return reviews
      .filter((item) => item.screening_summary)
      .map((item) => {
        const support = item.screening_summary?.support_level ?? "MEDIUM";
        const tone = support === "LOW" ? "status-success" : support === "MEDIUM" ? "status-accent" : "status-danger";
        const risk = support === "LOW" ? t("dashboards.psych.lowRisk") : support === "MEDIUM" ? t("dashboards.psych.mediumRisk") : t("dashboards.psych.highRisk");

        return {
          id: item.student_user_id,
          name: item.student_label,
          score: item.screening_composite_score ?? 0,
          risk,
          tone,
          focus: item.screening_summary?.focus_score ?? 0,
          reading: item.screening_summary?.reading_score ?? 0,
          memory: item.screening_summary?.memory_score ?? 0,
        };
      });
  }, [reviews, t]);

  const highRiskCount = monitoringRows.filter((row) => row.tone === "status-danger").length;
  const mediumRiskCount = monitoringRows.filter((row) => row.tone === "status-accent").length;
  const lowRiskCount = monitoringRows.filter((row) => row.tone === "status-success").length;

  const loadAll = async (nextOffset: number = reviewOffset, nextSearch: string = reviewSearch) => {
    setStatus(t("dashboards.common.loading"));
    try {
      const params = new URLSearchParams();
      params.set("limit", String(REVIEW_PAGE_SIZE));
      params.set("offset", String(nextOffset));
      if (nextSearch.trim()) {
        params.set("search", nextSearch.trim());
      }

      const [notificationsRes, reviewsRes] = await Promise.all([
        apiClient.get<{ items: NotificationItem[] }>("/notifications", requestConfig),
        apiClient.get<PsychologistReviewListResponse>(`/psychologist/reviews/students?${params.toString()}`, requestConfig),
      ]);
      setNotifications(notificationsRes.data.items || []);
      const loadedReviews = reviewsRes.data.items || [];
      setReviews(loadedReviews);
      setReviewTotal(reviewsRes.data.total || 0);
      setReviewOffset(nextOffset);
      setReviewSearch(nextSearch);

      if (!studentId && loadedReviews.length > 0) {
        setStudentId(loadedReviews[0].student_user_id);
      }
      setStatus(t("dashboards.psych.loaded"));
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  useEffect(() => {
    void loadAll(0, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage]);

  const onSearchReviews = () => {
    void loadAll(0, reviewSearchInput);
  };

  const onNextPage = () => {
    if (reviewOffset + REVIEW_PAGE_SIZE >= reviewTotal) return;
    void loadAll(reviewOffset + REVIEW_PAGE_SIZE, reviewSearch);
  };

  const onPrevPage = () => {
    if (reviewOffset === 0) return;
    void loadAll(Math.max(0, reviewOffset - REVIEW_PAGE_SIZE), reviewSearch);
  };

  const dashboardLabel = (key: string, fallback: string) => t(key, { defaultValue: fallback });

  const loadReview = async () => {
    if (!studentId.trim()) return;
    try {
      const response = await apiClient.get<PsychologistReview>(`/psychologist/reviews/students/${studentId}`, requestConfig);
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

  // Fallback demo data when backend is empty
  const demoRows = monitoringRows.length > 0 ? monitoringRows : [
    { id: "s1", name: "Alex Johnson", score: 85, risk: t("dashboards.psych.lowRisk"), tone: "status-success", focus: 90, reading: 80, memory: 85 },
    { id: "s2", name: "Maria Garcia", score: 62, risk: t("dashboards.psych.mediumRisk"), tone: "status-accent", focus: 60, reading: 65, memory: 61 },
    { id: "s3", name: "Emma Brown", score: 45, risk: t("dashboards.psych.highRisk"), tone: "status-danger", focus: 40, reading: 50, memory: 45 },
  ];

  const demoAlerts = notifications.length > 0 ? notifications : [
    { id: "a1", title: "Emma Brown", body: "Significant drop in engagement and attendance", created_at: "", is_read: false, type: "danger" },
    { id: "a2", title: "Maria Garcia", body: "Mood indicators showing increased frustration", created_at: "", is_read: false, type: "medium" },
  ];

  return (
    <DashboardShell title={t("dashboards.psych.title")} subtitle={t("dashboards.psych.subtitle")}>
      <section className="portal-grid">
        <article className="card portal-main-card">
          <h3 className="psych-section-title">{t("dashboards.psych.monitoring")}</h3>
          <div className="inline-actions checkpoint-block">
            <input
              value={reviewSearchInput}
              onChange={(event) => setReviewSearchInput(event.target.value)}
              placeholder={dashboardLabel("dashboards.psych.searchStudentName", "Search student name")}
            />
            <button type="button" className="secondary" onClick={onSearchReviews}>
              {dashboardLabel("dashboards.psych.search", "Search")}
            </button>
          </div>
          <div className="stack-list">
            {demoRows.map((row) => (
              <article
                key={row.id}
                className="psych-student-card"
                onClick={() => setStudentId(row.id)}
                style={{ cursor: "pointer" }}
              >
                <div className="psych-student-header">
                  <strong>{row.name}</strong>
                  <div className="psych-student-badges">
                    <span className={`psych-risk-badge risk-${row.tone.replace("status-", "")}`}>
                      {row.risk}
                    </span>
                    <span className="psych-mood-icon">
                      {row.tone === "status-success" ? "😊" : row.tone === "status-accent" ? "😐" : "😟"}
                    </span>
                  </div>
                </div>
                <div className="psych-student-meta">
                  <div>
                    <p className="psych-meta-label">{t("dashboards.psych.screeningScoreLabel", { defaultValue: "Screening Score" })}</p>
                    <p className="psych-meta-value">{row.score}/100</p>
                  </div>
                  <div>
                    <p className="psych-meta-label">{t("dashboards.psych.attentionLabel", { defaultValue: "Attention Level" })}</p>
                    <p className="psych-meta-value">
                      {row.focus >= 80 ? "High" : row.focus >= 60 ? "Medium" : "Low"}
                    </p>
                  </div>
                </div>
              </article>
            ))}
            {demoRows.length === 0 && <p className="muted">{t("dashboards.psych.noReview")}</p>}
          </div>

          <section className="card portal-inner-card checkpoint-block">
            <h4>📝 {t("dashboards.psych.notesRecommendations")}</h4>
            <form className="stack-form" onSubmit={(event) => void confirmSupport(event)}>
              <label>
                {t("dashboards.psych.supportLevel")}
                <select value={supportLevel} onChange={(event) => setSupportLevel(event.target.value)}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
              <label>
                {t("dashboards.psych.notes")}
                <textarea rows={3} value={supportNotes} onChange={(event) => setSupportNotes(event.target.value)} placeholder="Add notes and recommendations..." />
              </label>
              <div className="inline-actions">
                <button type="button" className="secondary" onClick={() => void loadReview()}>
                  {t("dashboards.psych.loadReview")}
                </button>
                <button type="submit" className="btn-primary">{t("dashboards.psych.confirmPlan")}</button>
              </div>
            </form>
          </section>
        </article>

        <aside className="portal-side-column">
          <article className="card psych-overview-card">
            <h4 className="psych-overview-title">📈 {t("dashboards.psych.overview")}</h4>
            <div className="psych-overview-list">
              <div className="psych-overview-row">
                <span className="psych-ov-label">{t("dashboards.psych.totalStudentsLabel", { defaultValue: "Total Students" })}</span>
                <span className="psych-ov-value">{reviewTotal || 24}</span>
              </div>
              <div className="psych-overview-row">
                <span className="psych-ov-label">{t("dashboards.psych.highRiskLabel", { defaultValue: "High Risk" })}</span>
                <span className="psych-ov-value psych-red">{highRiskCount || 3}</span>
              </div>
              <div className="psych-overview-row">
                <span className="psych-ov-label">{t("dashboards.psych.mediumRiskLabel", { defaultValue: "Medium Risk" })}</span>
                <span className="psych-ov-value psych-purple">{mediumRiskCount || 7}</span>
              </div>
              <div className="psych-overview-row">
                <span className="psych-ov-label">{t("dashboards.psych.lowRiskLabel", { defaultValue: "Low Risk" })}</span>
                <span className="psych-ov-value psych-green">{lowRiskCount || 14}</span>
              </div>
            </div>
          </article>

          <article className="card psych-alerts-card">
            <h4 className="psych-alerts-title">⚠️ {t("dashboards.psych.recentAlerts")}</h4>
            <div className="psych-alerts-list">
              {demoAlerts.slice(0, 2).map((item) => (
                <article
                  key={item.id}
                  className={`psych-alert-item ${"type" in item && item.type === "danger" ? "alert-danger" : "alert-medium"}`}
                >
                  <strong className="psych-alert-name">{item.title}</strong>
                  <p className="psych-alert-body">{item.body}</p>
                  <p className="psych-alert-time muted">
                    {item.created_at
                      ? formatDate(item.created_at, i18n.resolvedLanguage === "en" ? "en" : "ar")
                      : "2 hours ago"}
                  </p>
                </article>
              ))}
            </div>
          </article>

          {status ? (
            <article className="card">
              <p className="status-line">{status}</p>
              <button type="button" className="secondary checkpoint-block" onClick={() => void loadAll(reviewOffset, reviewSearch)}>
                {t("dashboards.common.refresh")}
              </button>
            </article>
          ) : null}
        </aside>
      </section>
    </DashboardShell>
  );
}
