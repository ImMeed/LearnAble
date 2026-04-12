import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { errorMessage, localePrefix, localeRequestConfig } from "./roleDashboardShared";

type Subsection = { id: string; title: string; content: string };
type Section = { id: string; title: string; content: string; subsections: Subsection[] };
type Chapter = { id: string; title: string; sections: Section[] };
type CourseStructure = { chapters: Chapter[] };

type Course = {
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

type SelectedNode = { kind: "chapter" | "section" | "subsection"; path: number[] };
type RenameState = { kind: "chapter" | "section" | "subsection"; path: number[]; value: string } | null;

function samePath(a: number[], b: number[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function makeNodeId() {
  return `new_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function TeacherCourseReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [course, setCourse] = useState<Course | null>(null);
  const [draft, setDraft] = useState<CourseStructure | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [renameState, setRenameState] = useState<RenameState>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const loadCourse = async () => {
    if (!id) return;
    setLoading(true);
    setStatus("");
    try {
      const response = await apiClient.get<Course>(`/teacher/courses/${id}`, requestConfig);
      setCourse(response.data);
      setDraft(response.data.structure_json);
      setDraftTitle(response.data.title);
      setSelected(response.data.structure_json.chapters.length ? { kind: "chapter", path: [0] } : null);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, i18n.resolvedLanguage]);

  const isDirty =
    !!course &&
    !!draft &&
    (draftTitle !== course.title || JSON.stringify(draft) !== JSON.stringify(course.structure_json));

  const updateSelectedNode = (updater: (node: Chapter | Section | Subsection) => void) => {
    if (!draft || !selected) return;
    const next = structuredClone(draft);
    if (selected.kind === "chapter") {
      const chapter = next.chapters[selected.path[0]];
      if (!chapter) return;
      updater(chapter);
    } else if (selected.kind === "section") {
      const chapter = next.chapters[selected.path[0]];
      const section = chapter?.sections[selected.path[1]];
      if (!section) return;
      updater(section);
    } else {
      const chapter = next.chapters[selected.path[0]];
      const section = chapter?.sections[selected.path[1]];
      const subsection = section?.subsections[selected.path[2]];
      if (!subsection) return;
      updater(subsection);
    }
    setDraft(next);
  };

  const startRename = (node: SelectedNode, currentValue: string) => {
    setRenameState({ kind: node.kind, path: node.path, value: currentValue });
  };

  const commitRename = () => {
    if (!renameState || !draft) return;
    const cleanTitle = renameState.value.trim();
    if (!cleanTitle) {
      setRenameState(null);
      return;
    }
    const next = structuredClone(draft);
    if (renameState.kind === "chapter") {
      const chapter = next.chapters[renameState.path[0]];
      if (chapter) chapter.title = cleanTitle;
    } else if (renameState.kind === "section") {
      const section = next.chapters[renameState.path[0]]?.sections[renameState.path[1]];
      if (section) section.title = cleanTitle;
    } else {
      const subsection =
        next.chapters[renameState.path[0]]?.sections[renameState.path[1]]?.subsections[renameState.path[2]];
      if (subsection) subsection.title = cleanTitle;
    }
    setDraft(next);
    setRenameState(null);
  };

  const deleteNode = (node: SelectedNode) => {
    if (!draft) return;
    if (!window.confirm(t("dashboards.teacher.courses.review.confirmDeleteNode"))) return;
    const next = structuredClone(draft);
    if (node.kind === "chapter") {
      next.chapters.splice(node.path[0], 1);
    } else if (node.kind === "section") {
      next.chapters[node.path[0]]?.sections.splice(node.path[1], 1);
    } else {
      next.chapters[node.path[0]]?.sections[node.path[1]]?.subsections.splice(node.path[2], 1);
    }
    setDraft(next);
    setSelected(null);
  };

  const addChapter = () => {
    if (!draft) return;
    const next = structuredClone(draft);
    next.chapters.push({
      id: makeNodeId(),
      title: `${t("dashboards.teacher.courses.review.chapterLabel")} ${next.chapters.length + 1}`,
      sections: [],
    });
    setDraft(next);
  };

  const addSection = (chapterIndex: number) => {
    if (!draft) return;
    const next = structuredClone(draft);
    const chapter = next.chapters[chapterIndex];
    if (!chapter) return;
    chapter.sections.push({
      id: makeNodeId(),
      title: `${t("dashboards.teacher.courses.review.sectionLabel")} ${chapter.sections.length + 1}`,
      content: "",
      subsections: [],
    });
    setDraft(next);
  };

  const addSubsection = (chapterIndex: number, sectionIndex: number) => {
    if (!draft) return;
    const next = structuredClone(draft);
    const section = next.chapters[chapterIndex]?.sections[sectionIndex];
    if (!section) return;
    section.subsections.push({
      id: makeNodeId(),
      title: `${t("dashboards.teacher.courses.review.subsectionLabel")} ${section.subsections.length + 1}`,
      content: "",
    });
    setDraft(next);
  };

  const saveDraft = async () => {
    if (!id || !draft) return false;
    setSaving(true);
    try {
      const response = await apiClient.patch<Course>(
        `/teacher/courses/${id}`,
        { title: draftTitle, structure_json: draft },
        requestConfig,
      );
      setCourse(response.data);
      setDraft(response.data.structure_json);
      setDraftTitle(response.data.title);
      setStatus(t("dashboards.teacher.courses.review.savedAt", { date: new Date().toLocaleTimeString() }));
      return true;
    } catch (error) {
      setStatus(errorMessage(error));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!id || !draft) return;
    if (isDirty) {
      const shouldSave = window.confirm(t("dashboards.teacher.courses.review.unsavedChanges"));
      if (!shouldSave) return;
      const saved = await saveDraft();
      if (!saved) return;
    }
    if (!window.confirm(t("dashboards.teacher.courses.review.publishConfirm"))) return;
    setPublishing(true);
    try {
      await apiClient.post(`/teacher/courses/${id}/publish`, {}, requestConfig);
      navigate(`${prefix}/teacher/dashboard`);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setPublishing(false);
    }
  };

  const selectedNode = (() => {
    if (!draft || !selected) return null;
    if (selected.kind === "chapter") return draft.chapters[selected.path[0]] ?? null;
    if (selected.kind === "section") return draft.chapters[selected.path[0]]?.sections[selected.path[1]] ?? null;
    return draft.chapters[selected.path[0]]?.sections[selected.path[1]]?.subsections[selected.path[2]] ?? null;
  })();

  const contentDir = course?.language === "ar" ? "rtl" : "ltr";

  if (loading) {
    return (
      <main className="page">
        <section className="card">
          <p>{t("dashboards.teacher.courses.review.loading")}</p>
        </section>
      </main>
    );
  }

  if (!course || !draft) {
    return (
      <main className="page">
        <section className="card">
          <p>{status || t("dashboards.teacher.courses.review.error")}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card">
        <div className="request-head-row">
          <Link className="secondary-link" to={`${prefix}/teacher/dashboard`}>
            {t("dashboards.teacher.courses.review.headerBack")}
          </Link>
          <div className="inline-actions">
            <button type="button" className="secondary" disabled={!isDirty || saving} onClick={() => void saveDraft()}>
              {saving ? t("dashboards.common.loading") : t("dashboards.teacher.courses.review.saveButton")}
            </button>
            <button
              type="button"
              disabled={publishing || saving || draft.chapters.length === 0}
              onClick={() => void publish()}
            >
              {publishing ? t("dashboards.common.loading") : t("dashboards.teacher.courses.review.publishButton")}
            </button>
          </div>
        </div>

        <label className="checkpoint-block">
          {t("dashboards.teacher.courses.titleLabel")}
          <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
        </label>
        {status ? <p className="status-line">{status}</p> : null}
      </section>

      <section className="card course-review-layout">
        <aside className="course-review-tree">
          <h3>{t("dashboards.teacher.courses.tabTitle")}</h3>
          <ul className="course-tree-list">
            {draft.chapters.map((chapter, cIdx) => (
              <li key={chapter.id}>
                <div
                  className={`course-tree-row ${selected?.kind === "chapter" && samePath(selected.path, [cIdx]) ? "active" : ""}`}
                  onClick={() => {
                    commitRename();
                    setSelected({ kind: "chapter", path: [cIdx] });
                  }}
                >
                  {renameState?.kind === "chapter" && samePath(renameState.path, [cIdx]) ? (
                    <input
                      autoFocus
                      value={renameState.value}
                      onChange={(event) => setRenameState((prev) => (prev ? { ...prev, value: event.target.value } : prev))}
                      onBlur={commitRename}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename();
                      }}
                    />
                  ) : (
                    <span>{chapter.title}</span>
                  )}
                  <div className="inline-actions">
                    <button type="button" className="secondary" onClick={() => startRename({ kind: "chapter", path: [cIdx] }, chapter.title)}>
                      {t("dashboards.teacher.courses.review.titleLabel")}
                    </button>
                    <button type="button" className="secondary" onClick={() => deleteNode({ kind: "chapter", path: [cIdx] })}>
                      {t("dashboards.teacher.courses.actionDelete")}
                    </button>
                  </div>
                </div>

                <ul className="course-tree-list nested">
                  {chapter.sections.map((section, sIdx) => (
                    <li key={section.id}>
                      <div
                        className={`course-tree-row ${selected?.kind === "section" && samePath(selected.path, [cIdx, sIdx]) ? "active" : ""}`}
                        onClick={() => {
                          commitRename();
                          setSelected({ kind: "section", path: [cIdx, sIdx] });
                        }}
                      >
                        {renameState?.kind === "section" && samePath(renameState.path, [cIdx, sIdx]) ? (
                          <input
                            autoFocus
                            value={renameState.value}
                            onChange={(event) =>
                              setRenameState((prev) => (prev ? { ...prev, value: event.target.value } : prev))
                            }
                            onBlur={commitRename}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") commitRename();
                            }}
                          />
                        ) : (
                          <span>{section.title}</span>
                        )}
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => startRename({ kind: "section", path: [cIdx, sIdx] }, section.title)}
                          >
                            {t("dashboards.teacher.courses.review.titleLabel")}
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => deleteNode({ kind: "section", path: [cIdx, sIdx] })}
                          >
                            {t("dashboards.teacher.courses.actionDelete")}
                          </button>
                        </div>
                      </div>

                      <ul className="course-tree-list nested">
                        {section.subsections.map((subsection, kIdx) => (
                          <li key={subsection.id}>
                            <div
                              className={`course-tree-row ${selected?.kind === "subsection" && samePath(selected.path, [cIdx, sIdx, kIdx]) ? "active" : ""}`}
                              onClick={() => {
                                commitRename();
                                setSelected({ kind: "subsection", path: [cIdx, sIdx, kIdx] });
                              }}
                            >
                              {renameState?.kind === "subsection" && samePath(renameState.path, [cIdx, sIdx, kIdx]) ? (
                                <input
                                  autoFocus
                                  value={renameState.value}
                                  onChange={(event) =>
                                    setRenameState((prev) => (prev ? { ...prev, value: event.target.value } : prev))
                                  }
                                  onBlur={commitRename}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") commitRename();
                                  }}
                                />
                              ) : (
                                <span>{subsection.title}</span>
                              )}
                              <div className="inline-actions">
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() =>
                                    startRename({ kind: "subsection", path: [cIdx, sIdx, kIdx] }, subsection.title)
                                  }
                                >
                                  {t("dashboards.teacher.courses.review.titleLabel")}
                                </button>
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => deleteNode({ kind: "subsection", path: [cIdx, sIdx, kIdx] })}
                                >
                                  {t("dashboards.teacher.courses.actionDelete")}
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <button type="button" className="secondary checkpoint-block" onClick={() => addSubsection(cIdx, sIdx)}>
                        {t("dashboards.teacher.courses.review.addSubsection")}
                      </button>
                    </li>
                  ))}
                </ul>

                <button type="button" className="secondary checkpoint-block" onClick={() => addSection(cIdx)}>
                  {t("dashboards.teacher.courses.review.addSection")}
                </button>
              </li>
            ))}
          </ul>

          <button type="button" className="secondary checkpoint-block" onClick={addChapter}>
            {t("dashboards.teacher.courses.review.addChapter")}
          </button>
        </aside>

        <section className="course-review-editor">
          {!selected || !selectedNode ? <p className="muted">{t("dashboards.teacher.courses.review.selectNode")}</p> : null}
          {selected && selectedNode ? (
            <div className="stack-form">
              <label>
                {t("dashboards.teacher.courses.review.titleLabel")}
                <input
                  value={selectedNode.title}
                  onChange={(event) => updateSelectedNode((node) => {
                    node.title = event.target.value;
                  })}
                />
              </label>
              {selected.kind !== "chapter" ? (
                <label>
                  {t("dashboards.teacher.courses.review.contentLabel")}
                  <textarea
                    dir={contentDir}
                    rows={14}
                    value={(selectedNode as Section | Subsection).content}
                    onChange={(event) =>
                      updateSelectedNode((node) => {
                        (node as Section | Subsection).content = event.target.value;
                      })
                    }
                  />
                </label>
              ) : null}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
