import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BookOpen, Search } from "lucide-react";

import { apiClient } from "../../api/client";
import { cx, surfaceClass } from "../components/uiStyles";
import {
  DashboardShell,
  errorMessage,
  localePrefix,
  localeRequestConfig,
} from "./roleDashboardShared";

type CourseListItem = {
  id: string;
  title: string;
  language: string;
  status: string;
  source_page_count: number | null;
  created_at: string;
};

export function StudentCoursesListPage() {
  const { t, i18n } = useTranslation();
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "ar" | "en">(
    (i18n.resolvedLanguage as "ar" | "en") || "all"
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        setStatusMsg(null);
        let url = "/courses/";
        if (filter !== "all") {
          url += `?language=${filter}`;
        }
        const res = await apiClient.get<CourseListItem[]>(url, localeRequestConfig(i18n.resolvedLanguage));
        setCourses(res.data);
      } catch (err) {
        setStatusMsg(errorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    void fetchCourses();
  }, [filter, i18n.resolvedLanguage]);

  return (
    <DashboardShell title={t("pdfCourse.studentListTitle")} subtitle="">
      <div className="flex flex-col gap-6">
        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {(["all", "ar", "en"] as const).map((f) => (
            <button
              key={f}
              className={cx(
                "whitespace-nowrap rounded-xl border px-5 py-2 text-sm font-semibold transition",
                filter === f ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? t("pdfCourse.filterAll") : f === "ar" ? t("pdfCourse.filterAr") : t("pdfCourse.filterEn")}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={cx(surfaceClass, "flex items-center justify-center py-20")}>
            <p className="text-muted-foreground">{t("dashboards.common.loading")}</p>
          </div>
        ) : courses.length === 0 ? (
          <div className={cx(surfaceClass, "flex flex-col items-center justify-center gap-4 py-20 text-center")}>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Search size={32} />
            </div>
            <p className="text-lg font-medium text-muted-foreground">{t("pdfCourse.studentListEmpty")}</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Link
                key={course.id}
                to={`${localePrefix(i18n.resolvedLanguage)}/student/courses/${course.id}`}
                className={cx(surfaceClass, "group flex flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-lg")}
              >
                <div className="aspect-video relative flex items-center justify-center bg-primary/5 p-8 transition group-hover:bg-primary/10">
                   <div className="h-16 w-16 rounded-2xl bg-white/50 backdrop-blur shadow-sm flex items-center justify-center text-primary">
                      <BookOpen size={36} />
                   </div>
                   <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur shadow-sm">
                        {course.language}
                      </span>
                   </div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                   <h3 className="line-clamp-2 min-h-[3rem] text-lg font-bold leading-tight text-foreground transition group-hover:text-primary">
                     {course.title}
                   </h3>
                   <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                     <span>{t("pdfCourse.pageCount", { count: course.source_page_count || 0 })}</span>
                   </div>
                   <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <span className="text-sm font-semibold text-primary">{t("pdfCourse.openCourse")}</span>
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary transition group-hover:bg-primary group-hover:text-white">
                         {i18n.dir() === "rtl" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                      </div>
                   </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {statusMsg && (
          <div className={cx(surfaceClass, "p-4 text-center text-destructive")}>
            {statusMsg}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

// Minimal icons for internal use
function ChevronRight({ size }: { size: number }) {
  return <path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />;
}
function ChevronLeft({ size }: { size: number }) {
  return <path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />;
}
