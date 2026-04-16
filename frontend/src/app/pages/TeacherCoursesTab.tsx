import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { BookOpen, FileUp, MoreVertical, Plus, Trash2, Copy } from "lucide-react";

import { apiClient } from "../../api/client";
import { actionClass, cx, inputClass, surfaceClass } from "../components/uiStyles";
import { errorMessage, formatDate, localePrefix, localeRequestConfig } from "./roleDashboardShared";

type CourseListItem = {
  id: string;
  title: string;
  language: string;
  status: string;
  source_page_count: number | null;
  created_at: string;
};

export function TeacherCoursesTab() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Form state
  const [creationMode, setCreationMode] = useState<"pdf" | "blank">("pdf");
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [file, setFile] = useState<File | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<CourseListItem[]>("/teacher/courses", localeRequestConfig(i18n.resolvedLanguage));
      setCourses(res.data);
    } catch (err) {
      console.error(err);
      setStatusMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCourses();
  }, [i18n.resolvedLanguage]);

  const onBlankCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setUploading(true);
      setStatusMsg(null);
      const res = await apiClient.post<CourseListItem>(
        "/teacher/courses/blank", 
        { title: title.trim(), language }, 
        localeRequestConfig(i18n.resolvedLanguage)
      );
      setTitle("");
      navigate(`${localePrefix(i18n.resolvedLanguage)}/teacher/courses/${res.data.id}/review`);
    } catch (err) {
      console.error(err);
      setStatusMsg(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    try {
      setUploading(true);
      setStatusMsg(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());
      formData.append("language", language);

      const res = await apiClient.post<CourseListItem>("/teacher/courses/", formData, localeRequestConfig(i18n.resolvedLanguage));
      
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      // Navigate to review page
      navigate(`${localePrefix(i18n.resolvedLanguage)}/teacher/courses/${res.data.id}/review`);
    } catch (err) {
      console.error(err);
      setStatusMsg(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const onPublish = async (id: string) => {
    try {
      await apiClient.post(`/teacher/courses/${id}/publish`, {}, localeRequestConfig(i18n.resolvedLanguage));
      void fetchCourses();
    } catch (err) {
      setStatusMsg(errorMessage(err));
    }
  };

  const onDelete = async (id: string) => {
    try {
      await apiClient.delete(`/teacher/courses/${id}`, localeRequestConfig(i18n.resolvedLanguage));
      setConfirmDeleteId(null);
      void fetchCourses();
    } catch (err) {
      setStatusMsg(errorMessage(err));
    }
  };

  const onDuplicate = async (id: string) => {
    try {
      await apiClient.post(`/teacher/courses/${id}/duplicate`, {}, localeRequestConfig(i18n.resolvedLanguage));
      void fetchCourses();
    } catch (err) {
      setStatusMsg(errorMessage(err));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Upload Sidebar */}
      <div className={cx(surfaceClass, "flex flex-col gap-6 p-6")}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Plus size={22} />
          </div>
          <h3 className="text-lg font-semibold">{t("dashboards.teacher.courseUploadTitle", "Create Course")}</h3>
        </div>

        <div className="flex rounded-lg border bg-muted/20 p-1">
          <button
            className={cx("flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition", creationMode === "pdf" ? "bg-background shadow text-foreground" : "text-muted-foreground")}
            onClick={() => setCreationMode("pdf")}
            type="button"
          >
            From PDF
          </button>
          <button
            className={cx("flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition", creationMode === "blank" ? "bg-background shadow text-foreground" : "text-muted-foreground")}
            onClick={() => setCreationMode("blank")}
            type="button"
          >
            Blank Course
          </button>
        </div>

        <form onSubmit={creationMode === "pdf" ? onUpload : onBlankCourse} className="flex flex-col gap-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{t("dashboards.teacher.courseTitleLabel")}</label>
            <input
              type="text"
              className={inputClass}
              placeholder={t("dashboards.teacher.courseTitlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{t("dashboards.teacher.courseLanguageLabel")}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={cx(
                  "flex h-11 items-center justify-center rounded-xl border text-sm font-medium transition",
                  language === "ar" ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground",
                )}
                onClick={() => setLanguage("ar")}
              >
                {t("dashboards.teacher.courseLanguageAr")}
              </button>
              <button
                type="button"
                className={cx(
                  "flex h-11 items-center justify-center rounded-xl border text-sm font-medium transition",
                  language === "en" ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground",
                )}
                onClick={() => setLanguage("en")}
              >
                {t("dashboards.teacher.courseLanguageEn")}
              </button>
            </div>
          </div>

          {creationMode === "pdf" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">{t("dashboards.teacher.courseFileLabel")}</label>
              <div
                className={cx(
                  "group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[1.5rem] border-2 border-dashed border-border bg-background py-8 transition hover:border-primary/50",
                  file && "border-primary/50 bg-primary/5",
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp size={32} className={cx("text-muted-foreground", file && "text-primary")} />
                <div className="text-center">
                  <p className="text-sm font-medium">{file ? file.name : t("dashboards.teacher.courseFileLabel")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">PDF (max 10MB)</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
          )}

          <button type="submit" className={actionClass("primary")} disabled={uploading || (!file && creationMode === "pdf") || !title.trim()}>
            {uploading ? t("dashboards.teacher.courseUploading", "Creating...") : (creationMode === "pdf" ? t("dashboards.teacher.courseUploadBtn", "Upload & Generate") : "Create Blank Course")}
          </button>

          {statusMsg && <p className="text-center text-sm font-medium text-destructive">{statusMsg}</p>}
        </form>
      </div>

      {/* Course List */}
      <div className="lg:col-span-2">
        {loading ? (
          <div className={cx(surfaceClass, "flex items-center justify-center py-20")}>
            <p className="text-muted-foreground">{t("dashboards.common.loading")}</p>
          </div>
        ) : courses.length === 0 ? (
          <div className={cx(surfaceClass, "flex flex-col items-center justify-center gap-4 py-20 text-center")}>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <BookOpen size={32} />
            </div>
            <p className="text-lg font-medium text-muted-foreground">{t("dashboards.teacher.courseEmpty")}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {courses.map((course) => (
              <div key={course.id} className={cx(surfaceClass, "flex items-center justify-between p-5")}>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">{course.title}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className={cx("h-1.5 w-1.5 rounded-full", course.status === "PUBLISHED" ? "bg-green-500" : "bg-amber-500")} />
                        {course.status === "PUBLISHED" ? t("dashboards.teacher.courseStatusPublished") : t("dashboards.teacher.courseStatusDraft")}
                      </span>
                      <span>{t("dashboards.teacher.coursePages", { count: course.source_page_count || 0 })}</span>
                      <span>{formatDate(course.created_at, i18n.resolvedLanguage as "ar" | "en")}</span>
                      <span className="uppercase">{course.language}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className={actionClass("soft")}
                    onClick={() => navigate(`${localePrefix(i18n.resolvedLanguage)}/teacher/courses/${course.id}/review`)}
                  >
                    {t("dashboards.teacher.courseReview")}
                  </button>

                  <button 
                    className={actionClass("soft")} 
                    onClick={() => onDuplicate(course.id)}
                    title={t("dashboards.teacher.courseDuplicate", "Duplicate")}
                  >
                    <Copy size={18} className="sm:mr-1 sm:rtl:ml-1" />
                    <span className="hidden sm:inline">Duplicate</span>
                  </button>

                  {course.status === "DRAFT" && (
                    <button className={actionClass("secondary")} onClick={() => onPublish(course.id)}>
                      {t("dashboards.teacher.coursePublish")}
                    </button>
                  )}

                  {confirmDeleteId === course.id ? (
                    <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
                      <button className={cx(actionClass("primary"), "!bg-destructive !border-destructive")} onClick={() => onDelete(course.id)}>
                        {t("dashboards.teacher.courseDelete")}
                      </button>
                      <button className={actionClass("ghost")} onClick={() => setConfirmDeleteId(null)}>
                        {t("common.close")}
                      </button>
                    </div>
                  ) : (
                    <button className={actionClass("ghost")} onClick={() => setConfirmDeleteId(course.id)}>
                      <Trash2 size={18} className="text-destructive" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
