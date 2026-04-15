import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { SupportManagementCard, type ReadingLabChildOption, type ReadingLabPlan } from "../components/SupportManagementCard";
import { READING_LAB_ENABLED } from "../features";
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
  const [linkedChildren, setLinkedChildren] = useState<ReadingLabChildOption[]>([]);
  const [readingLabPlan, setReadingLabPlan] = useState<ReadingLabPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

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

  const isLinkedChild = (candidateStudentId: string) =>
    linkedChildren.some((child) => child.student_user_id === candidateStudentId);

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

  const loadAll = async (nextOffset: number = reviewOffset, nextSearch: string = reviewSearch) => {
    setStatus(t("dashboards.common.loading"));
    try {
      const params = new URLSearchParams();
      params.set("limit", String(REVIEW_PAGE_SIZE));
      params.set("offset", String(nextOffset));
      if (nextSearch.trim()) {
        params.set("search", nextSearch.trim());
      }

      const [notificationsRes, reviewsRes, childrenRes] = await Promise.all([
        apiClient.get<{ items: NotificationItem[] }>("/notifications", requestConfig),
        apiClient.get<PsychologistReviewListResponse>(`/psychologist/reviews/students?${params.toString()}`, requestConfig),
        READING_LAB_ENABLED
          ? apiClient.get<{ items: ReadingLabChildOption[] }>("/reading-lab/children", requestConfig)
          : Promise.resolve({ data: { items: [] } }),
      ]);
      setNotifications(notificationsRes.data.items || []);
      const loadedReviews = reviewsRes.data.items || [];
      setReviews(loadedReviews);
      setReviewTotal(reviewsRes.data.total || 0);
      setReviewOffset(nextOffset);
      setReviewSearch(nextSearch);
      const children = childrenRes.data.items || [];
      setLinkedChildren(children);

      const nextStudentId = studentId || children[0]?.student_user_id || loadedReviews[0]?.student_user_id || "";
      if (nextStudentId) {
        setStudentId(nextStudentId);
        if (children.some((child) => child.student_user_id === nextStudentId)) {
          await loadPlan(nextStudentId);
        } else {
          setReadingLabPlan(null);
        }
      } else {
        setReadingLabPlan(null);
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

  const saveReadingLabPlan = async (nextPlan: ReadingLabPlan) => {
    if (!studentId) return;
    const response = await apiClient.put<ReadingLabPlan>(
      `/reading-lab/support/students/${studentId}`,
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
    if (!studentId && items[0]?.student_user_id) {
      const firstId = items[0].student_user_id;
      setStudentId(firstId);
      await loadPlan(firstId);
    }
  };

  return (
    <DashboardShell title={t("dashboards.psych.title")}>
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
              <article
                key={row.id}
                className="request-card psych-clickable-card"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setStudentId(row.id);
                  if (isLinkedChild(row.id)) {
                    void loadPlan(row.id);
                  } else {
                    setReadingLabPlan(null);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setStudentId(row.id);
                    if (isLinkedChild(row.id)) {
                      void loadPlan(row.id);
                    } else {
                      setReadingLabPlan(null);
                    }
                  }
                }}
              >
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
            <div className="inline-actions checkpoint-block">
              <button type="button" className="secondary" onClick={() => void loadReview()}>
                {t("dashboards.psych.loadReview")}
              </button>
            </div>
            <pre className="json-box checkpoint-block">{reviewData || t("dashboards.psych.noReview")}</pre>
          </section>

          {READING_LAB_ENABLED ? (
            <SupportManagementCard
              children={linkedChildren}
              selectedStudentId={studentId}
              plan={readingLabPlan}
              loading={loadingPlan}
              onSelectStudent={(nextStudentId) => {
                setStudentId(nextStudentId);
                void loadPlan(nextStudentId);
              }}
              onSave={saveReadingLabPlan}
              onLinkStudent={linkStudent}
            />
          ) : null}
        </article>

        <aside className="portal-side-column">
          <article className="card portal-inner-card analytics-card">
            <h4>{t("dashboards.psych.overview")}</h4>
            <p>{t("dashboards.psych.totalStudents", { count: reviewTotal })}</p>
            <p>{t("dashboards.psych.highRiskCount", { count: highRiskCount })}</p>
            <p>{t("dashboards.psych.mediumRiskCount", { count: mediumRiskCount })}</p>
            <p>{t("dashboards.psych.lowRiskCount", { count: lowRiskCount })}</p>
          </article>

          <article className="card portal-inner-card">
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

          <article className="card portal-inner-card">
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
