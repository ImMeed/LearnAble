import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { BrandLogo } from "../components/BrandLogo";
import { localePrefix, localeRequestConfig } from "./roleDashboardShared";

type Subsection = { id: string; title: string; content: string };
type Section = { id: string; title: string; content: string; subsections: Subsection[] };
type Chapter = { id: string; title: string; sections: Section[] };
type CourseStructure = { chapters: Chapter[] };

type CourseDetail = {
  id: string;
  title: string;
  language: "ar" | "en";
  status: "DRAFT" | "PUBLISHED";
  source_filename: string;
  source_page_count: number;
  structure_json: CourseStructure;
  created_at: string;
  updated_at: string;
};

type SelectedNode = { id: string; title: string; content: string };

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { status?: number; data?: unknown } }).response;
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

export function StudentCourseViewPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setStatus("");
      try {
        const response = await apiClient.get<CourseDetail>(`/courses/${id}`, requestConfig);
        setCourse(response.data);
        // Auto-expand first chapter and select first section
        const firstChapter = response.data.structure_json.chapters[0];
        if (firstChapter) {
          setExpandedChapters(new Set([firstChapter.id]));
          const firstSection = firstChapter.sections[0];
          if (firstSection) {
            setSelectedNode({ id: firstSection.id, title: firstSection.title, content: firstSection.content ?? "" });
          }
        }
      } catch (error) {
        const message = errorMessage(error);
        setStatus(message);
        navigate(`${prefix}/student/courses`);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id, navigate, prefix, requestConfig]);

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const showLanguageBanner = !!course && course.language !== locale;
  const contentDir = course?.language === "ar" ? "rtl" : "ltr";

  // Calculate reading progress
  const allSections = useMemo(() => {
    if (!course) return [];
    return course.structure_json.chapters.flatMap((c) => c.sections);
  }, [course]);

  const currentSectionIndex = selectedNode
    ? allSections.findIndex((s) => s.id === selectedNode.id)
    : -1;

  const goToSection = (delta: 1 | -1) => {
    const next = allSections[currentSectionIndex + delta];
    if (next) setSelectedNode({ id: next.id, title: next.title, content: next.content ?? "" });
  };

  return (
    <main className="page course-reader-page">
      {/* Top bar */}
      <header className="course-reader-topbar card">
        <Link className="secondary-link course-reader-back" to={`${prefix}/student/courses`}>
          ← {t("student.courses.backToList")}
        </Link>
        <div className="course-reader-title-row">
          <BrandLogo className="brand-icon" size={26} />
          <h1 className="course-reader-title">{course?.title ?? t("student.courses.loading")}</h1>
          {course && (
            <span className="status-chip course-reader-lang-badge">
              {course.language === "ar" ? "AR" : "EN"}
            </span>
          )}
        </div>
        {course && allSections.length > 0 && (
          <div className="course-reader-progress-row">
            <div className="course-reader-progress-track">
              <div
                className="course-reader-progress-fill"
                style={{ width: `${((currentSectionIndex + 1) / allSections.length) * 100}%` }}
              />
            </div>
            <span className="course-reader-progress-label muted">
              {currentSectionIndex + 1} / {allSections.length}
            </span>
          </div>
        )}
      </header>

      {showLanguageBanner && (
        <p className="status-line course-reader-banner">
          {course?.language === "ar" ? t("student.courses.languageBannerAr") : t("student.courses.languageBannerEn")}
        </p>
      )}
      {status ? <p className="status-line">{status}</p> : null}
      {loading ? <p className="muted" style={{ padding: "2rem", textAlign: "center" }}>{t("student.courses.loading")}</p> : null}

      {course && (
        <div className="course-reader-body">
          {/* Sidebar */}
          <aside className="course-reader-sidebar">
            <div className="course-reader-sidebar-inner card">
              <p className="course-reader-sidebar-label muted">
                {course.source_page_count} {t("student.courses.pagesLabel", { count: course.source_page_count })}
              </p>
              <nav className="course-reader-nav">
                {course.structure_json.chapters.map((chapter, chapterIndex) => {
                  const isChapterOpen = expandedChapters.has(chapter.id);
                  return (
                    <div key={chapter.id} className="course-reader-chapter">
                      <button
                        type="button"
                        className={`course-reader-chapter-btn ${isChapterOpen ? "open" : ""}`}
                        onClick={() => toggleChapter(chapter.id)}
                        aria-expanded={isChapterOpen}
                      >
                        <span className="course-reader-chapter-num">{chapterIndex + 1}</span>
                        <span className="course-reader-chapter-title">{chapter.title}</span>
                        <span className="course-reader-chevron">{isChapterOpen ? "▾" : "▸"}</span>
                      </button>

                      {isChapterOpen && (
                        <div className="course-reader-sections">
                          {chapter.sections.map((section) => {
                            const isSectionSelected = selectedNode?.id === section.id;
                            const isSectionOpen = expandedSections.has(section.id);
                            const hasSubsections = section.subsections.length > 0;
                            return (
                              <div key={section.id}>
                                <button
                                  type="button"
                                  className={`course-reader-section-btn ${isSectionSelected ? "active" : ""}`}
                                  onClick={() => {
                                    setSelectedNode({ id: section.id, title: section.title, content: section.content ?? "" });
                                    if (hasSubsections) toggleSection(section.id);
                                  }}
                                >
                                  <span>{section.title}</span>
                                  {hasSubsections && (
                                    <span className="course-reader-chevron-sm">{isSectionOpen ? "▾" : "▸"}</span>
                                  )}
                                </button>

                                {hasSubsections && isSectionOpen && (
                                  <div className="course-reader-subsections">
                                    {section.subsections.map((sub) => (
                                      <button
                                        type="button"
                                        key={sub.id}
                                        className={`course-reader-sub-btn ${selectedNode?.id === sub.id ? "active" : ""}`}
                                        onClick={() => setSelectedNode({ id: sub.id, title: sub.title, content: sub.content ?? "" })}
                                      >
                                        {sub.title}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Reading area */}
          <section className="course-reader-content" dir={contentDir}>
            {selectedNode ? (
              <>
                <article className="course-reader-article card">
                  <h2 className="course-reader-article-title">{selectedNode.title}</h2>
                  <div className="course-reader-article-body">
                    {selectedNode.content
                      .split(/\n\s*\n/g)
                      .filter(Boolean)
                      .map((paragraph, index) => (
                        <p key={`${selectedNode.id}-${index}`}>{paragraph}</p>
                      ))}
                  </div>
                </article>

                {/* Prev / Next navigation */}
                <div className="course-reader-nav-btns">
                  <button
                    type="button"
                    className="secondary"
                    disabled={currentSectionIndex <= 0}
                    onClick={() => goToSection(-1)}
                  >
                    ← Previous
                  </button>
                  <button
                    type="button"
                    disabled={currentSectionIndex >= allSections.length - 1}
                    onClick={() => goToSection(1)}
                  >
                    Next →
                  </button>
                </div>
              </>
            ) : (
              <div className="course-reader-empty card">
                <p className="muted">{t("student.courses.selectSection")}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
