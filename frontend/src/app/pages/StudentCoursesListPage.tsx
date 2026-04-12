import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { localePrefix, localeRequestConfig } from "./roleDashboardShared";

type CourseListItem = {
  id: string;
  title: string;
  language: "ar" | "en";
  status: "DRAFT" | "PUBLISHED";
  source_page_count: number;
  created_at: string;
};

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    const payload = response?.data;
    if (typeof payload === "object" && payload && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (typeof detail === "object" && detail && "message" in detail) {
        return String((detail as { message?: unknown }).message);
      }
    }
    if (typeof payload === "object" && payload && "message" in payload) {
      return String((payload as { message?: unknown }).message);
    }
  }
  return String(error);
}

export function StudentCoursesListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const loadCourses = async (allLanguages: boolean) => {
    setLoading(true);
    setStatus("");
    try {
      const params = allLanguages ? undefined : { language: locale };
      const response = await apiClient.get<CourseListItem[]>("/courses", { ...requestConfig, params });
      setCourses(response.data ?? []);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCourses(showAllLanguages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllLanguages, locale]);

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(parsed);
  };

  return (
    <main className="page dashboard-page student-v2-page">
      <section className="card student-v2-header">
        <h2>{t("student.courses.listTitle")}</h2>
        <button
          type="button"
          className="secondary"
          onClick={() => setShowAllLanguages((prev) => !prev)}
        >
          {t("student.courses.showAllLanguagesToggle")}
        </button>
      </section>

      {status ? <p className="status-line">{status}</p> : null}
      {loading ? <p className="muted">{t("student.courses.loading")}</p> : null}
      {!loading && courses.length === 0 ? <p className="muted">{t("student.courses.empty")}</p> : null}

      {courses.length > 0 ? (
        <section className="lesson-grid">
          {courses.map((course) => (
            <article key={course.id} className="lesson-card">
              <div className="request-head-row">
                <h3>{course.title}</h3>
                <span className="status-chip">
                  {course.language === "ar"
                    ? t("student.courses.languageBadgeAr")
                    : t("student.courses.languageBadgeEn")}
                </span>
              </div>
              <p className="muted">{t("student.courses.pagesLabel", { count: course.source_page_count })}</p>
              <p className="muted">{formatDate(course.created_at)}</p>
              <button type="button" onClick={() => navigate(`${prefix}/student/courses/${course.id}`)}>
                {t("student.courses.openButton")}
              </button>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
