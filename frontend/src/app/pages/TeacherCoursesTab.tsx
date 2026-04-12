import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { errorMessage, localePrefix, localeRequestConfig } from "./roleDashboardShared";

type TeacherCourseItem = {
  id: string;
  title: string;
  language: string;
  status: string;
  source_page_count: number;
  source_filename?: string;
  created_at: string;
};

type UploadResponse = {
  id: string;
};

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export default function TeacherCoursesTab() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const currentLocale = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<"ar" | "en">(
    i18n.resolvedLanguage === "ar" || i18n.resolvedLanguage === "en" ? i18n.resolvedLanguage : "en",
  );
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [courses, setCourses] = useState<TeacherCourseItem[]>([]);

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(currentLocale === "en" ? "en-US" : "ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(parsed);
  };

  const validateBeforeSubmit = () => {
    if (!title.trim()) {
      setInlineError(t("dashboards.teacher.courses.errorTitleRequired"));
      return false;
    }
    if (!file) {
      setInlineError(t("dashboards.teacher.courses.errorFileRequired"));
      return false;
    }
    const isPdf = file.type === "application/pdf" && file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setInlineError(t("dashboards.teacher.courses.errorFileType"));
      return false;
    }
    if (file.size > MAX_PDF_BYTES) {
      setInlineError(t("dashboards.teacher.courses.errorFileTooBig"));
      return false;
    }
    setInlineError("");
    return true;
  };

  const loadCourses = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const response = await apiClient.get<TeacherCourseItem[]>("/teacher/courses", requestConfig);
      setCourses(response.data ?? []);
    } catch (error) {
      setInlineError(errorMessage(error));
    } finally {
      setIsLoadingList(false);
    }
  }, [requestConfig]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateBeforeSubmit() || !file) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("language", language);
      formData.append("file", file);
      const response = await apiClient.post<UploadResponse>("/teacher/courses", formData, requestConfig);
      const prefix = localePrefix(i18n.resolvedLanguage);
      navigate(`${prefix}/teacher/courses/${response.data.id}/review`);
    } catch (error) {
      setInlineError(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const publishCourse = async (courseId: string) => {
    try {
      await apiClient.post(`/teacher/courses/${courseId}/publish`, {}, requestConfig);
      await loadCourses();
    } catch (error) {
      setInlineError(errorMessage(error));
    }
  };

  const deleteCourse = async (courseId: string) => {
    if (!window.confirm(t("dashboards.teacher.courses.confirmDelete"))) return;
    try {
      await apiClient.delete(`/teacher/courses/${courseId}`, requestConfig);
      await loadCourses();
    } catch (error) {
      setInlineError(errorMessage(error));
    }
  };

  const goToReview = (courseId: string) => {
    const prefix = localePrefix(i18n.resolvedLanguage);
    navigate(`${prefix}/teacher/courses/${courseId}/review`);
  };

  return (
    <section className="card portal-main-card">
      <h3>{t("dashboards.teacher.courses.uploadTitle")}</h3>

      <form className="stack-form checkpoint-block" onSubmit={handleUpload}>
        <label>
          {t("dashboards.teacher.courses.titleLabel")}
          <input
            type="text"
            maxLength={255}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("dashboards.teacher.courses.titlePlaceholder")}
          />
        </label>

        <label>
          {t("dashboards.teacher.courses.languageLabel")}
          <select value={language} onChange={(event) => setLanguage((event.target.value as "ar" | "en"))}>
            <option value="ar">{t("dashboards.teacher.courses.languageAr")}</option>
            <option value="en">{t("dashboards.teacher.courses.languageEn")}</option>
          </select>
        </label>

        <label>
          {t("dashboards.teacher.courses.fileLabel")}
          <input
            type="file"
            accept="application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <p className="muted">{t("dashboards.teacher.courses.disclaimer")}</p>

        {inlineError ? <p className="status-line">{inlineError}</p> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="courses-loading-content">
              <span className="courses-spinner" aria-hidden="true" />
              {t("dashboards.teacher.courses.analyzing")}
            </span>
          ) : (
            t("dashboards.teacher.courses.submit")
          )}
        </button>
      </form>

      <h4 className="checkpoint-block">{t("dashboards.teacher.courses.listTitle")}</h4>
      {isLoadingList ? <p className="muted">{t("dashboards.common.loading")}</p> : null}
      {!isLoadingList && courses.length === 0 ? <p className="muted">{t("dashboards.teacher.courses.empty")}</p> : null}

      {courses.length > 0 ? (
        <div className="stack-list checkpoint-block">
          {courses.map((course) => {
            const isPublished = course.status === "PUBLISHED";
            return (
              <article key={course.id} className="request-card courses-row">
                <div className="courses-row-main">
                  <div className="request-head-row">
                    <strong>{course.title}</strong>
                    <span className="status-chip" style={isPublished ? { background: "var(--success)" } : undefined}>
                      {isPublished
                        ? t("dashboards.teacher.courses.statusPublished")
                        : t("dashboards.teacher.courses.statusDraft")}
                    </span>
                  </div>
                  <p className="muted">
                    {t("dashboards.teacher.courses.pages", { count: course.source_page_count })} •{" "}
                    {formatDate(course.created_at)}
                  </p>
                </div>

                <div className="inline-actions">
                  <button type="button" className="secondary" onClick={() => goToReview(course.id)}>
                    {t("dashboards.teacher.courses.actionReview")}
                  </button>
                  {!isPublished ? (
                    <button type="button" onClick={() => void publishCourse(course.id)}>
                      {t("dashboards.teacher.courses.actionPublish")}
                    </button>
                  ) : null}
                  <button type="button" className="secondary" onClick={() => void deleteCourse(course.id)}>
                    {t("dashboards.teacher.courses.actionDelete")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
