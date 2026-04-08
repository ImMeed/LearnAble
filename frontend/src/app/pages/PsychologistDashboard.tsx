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

  return (
    <DashboardShell title={t("dashboards.psych.title")} subtitle={t("dashboards.psych.subtitle")}>
      <section className="portal-grid">
        <article className="card portal-main-card">
          <h3>{t("dashboards.psych.monitoring")}</h3>
          <div className="inline-actions checkpoint-block">
            <input
              value={reviewSearchInput}
              onChange={(event) => setReviewSearchInput(event.target.value)}
              placeholder={dashboardLabel("dashboards.psych.searchStudentName", "Search student name")}
            />
            <button type="button" className="secondary" onClick={onSearchReviews}>
              {dashboardLabel("dashboards.psych.search", "Search")}
            </button>
            <button type="button" className="secondary" onClick={onPrevPage} disabled={reviewOffset === 0}>
              {dashboardLabel("dashboards.psych.prev", "Prev")}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={onNextPage}
              disabled={reviewOffset + REVIEW_PAGE_SIZE >= reviewTotal}
            >
              {dashboardLabel("dashboards.psych.next", "Next")}
            </button>
          </div>
          <div className="stack-list">
            {monitoringRows.length > 0 ? monitoringRows.map((row) => (
              <article key={row.id} className="request-card" onClick={() => setStudentId(row.id)}>
                <div className="request-head-row">
                  <strong>{row.name}</strong>
                  <span className={`status-chip ${row.tone}`}>{row.risk}</span>
                </div>
                <p>{t("dashboards.psych.screeningScore", { score: row.score })}</p>
                <p>{t("dashboards.psych.focusScore", { score: row.focus })}</p>
                <p>{t("dashboards.psych.readingScore", { score: row.reading })}</p>
                <p>{t("dashboards.psych.memoryScore", { score: row.memory })}</p>
              </article>
            )) : <p className="muted">{t("dashboards.psych.noReview")}</p>}
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
            <p>{t("dashboards.psych.totalStudents", { count: reviewTotal })}</p>
            <p>{t("dashboards.psych.highRiskCount", { count: highRiskCount })}</p>
            <p>{t("dashboards.psych.mediumRiskCount", { count: mediumRiskCount })}</p>
            <p>{t("dashboards.psych.lowRiskCount", { count: lowRiskCount })}</p>
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
            <button type="button" className="secondary" onClick={() => void loadAll(reviewOffset, reviewSearch)}>
              {t("dashboards.common.refresh")}
            </button>
          </article>
        </aside>
      </section>
    </DashboardShell>
  );
}
