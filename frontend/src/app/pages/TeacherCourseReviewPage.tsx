import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BarChart2, ChevronLeft, ChevronRight, Plus, Save, Trash2, Upload } from "lucide-react";

import { apiClient } from "../../api/client";
import { actionClass, cx, inputClass, surfaceClass } from "../components/uiStyles";
import {
  DashboardShell,
  errorMessage,
  localePrefix,
  localeRequestConfig,
} from "./roleDashboardShared";

type Subsection = { id: string; title: string; content: string };
type Section = { id: string; title: string; content: string; subsections: Subsection[] };
type Chapter = { id: string; title: string; sections: Section[] };
type CourseStructure = { page_count: number; chapters: Chapter[] };

type CourseDetail = {
  id: string;
  title: string;
  language: string;
  status: string;
  source_filename: string | null;
  source_page_count: number | null;
  structure_json: CourseStructure | null;
  created_at: string;
  updated_at: string;
};

type NodePath = {
  chapterIndex: number;
  sectionIndex?: number;
  subsectionIndex?: number;
};

export function TeacherCourseReviewPage() {
  const { courseId } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [structure, setStructure] = useState<CourseStructure | null>(null);
  const [selectedPath, setSelectedPath] = useState<NodePath | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"editor" | "analytics">("editor");
  const [analytics, setAnalytics] = useState<{
    course_title: string;
    total_sections: number;
    enrolled_students: number;
    students: Array<{
      student_user_id: string;
      completed_sections: number;
      total_sections: number;
      best_quiz_score: number | null;
      quiz_total_questions: number | null;
      quiz_attempt_count: number;
    }>;
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get<CourseDetail>(`/teacher/courses/${courseId}`, localeRequestConfig(i18n.resolvedLanguage));
        setCourse(res.data);
        setStructure(res.data.structure_json);
        if (res.data.structure_json?.chapters.length) {
          setSelectedPath({ chapterIndex: 0 });
        }
      } catch (err) {
        setStatusMsg(errorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    void fetchDetail();
  }, [courseId, i18n.resolvedLanguage]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const onSave = async () => {
    if (!course || !structure) return;
    try {
      setSaving(true);
      setStatusMsg(null);
      await apiClient.patch(
        `/teacher/courses/${courseId}`,
        { structure_json: structure, title: course.title },
        localeRequestConfig(i18n.resolvedLanguage)
      );
      setIsDirty(false);
      setStatusMsg(t("pdfCourse.saved"));
    } catch (err) {
      setStatusMsg(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    if (!courseId) return;
    try {
      setSaving(true);
      await apiClient.post(`/teacher/courses/${courseId}/publish`, {}, localeRequestConfig(i18n.resolvedLanguage));
      navigate(`${localePrefix(i18n.resolvedLanguage)}/teacher/dashboard`);
    } catch (err) {
      setStatusMsg(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const fetchAnalytics = async () => {
    if (analytics) return;
    try {
      setAnalyticsLoading(true);
      const res = await apiClient.get<{
        course_title: string;
        total_sections: number;
        enrolled_students: number;
        students: Array<{
          student_user_id: string;
          completed_sections: number;
          total_sections: number;
          best_quiz_score: number | null;
          quiz_total_questions: number | null;
          quiz_attempt_count: number;
        }>;
      }>(`/teacher/courses/${courseId}/analytics`, localeRequestConfig(i18n.resolvedLanguage));
      setAnalytics(res.data);
    } catch (err) {
      setStatusMsg(errorMessage(err));
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const updateSelectedNode = (fields: Partial<{ title: string; content: string; video_url: string; resources: any[] }>) => {
    if (!structure || !selectedPath) return;
    const newStructure = { ...structure };
    const { chapterIndex, sectionIndex, subsectionIndex } = selectedPath;
    
    const chapter = newStructure.chapters[chapterIndex];
    if (subsectionIndex !== undefined && sectionIndex !== undefined) {
      chapter.sections[sectionIndex].subsections[subsectionIndex] = {
        ...chapter.sections[sectionIndex].subsections[subsectionIndex],
        ...fields,
      };
    } else if (sectionIndex !== undefined) {
      chapter.sections[sectionIndex] = { ...chapter.sections[sectionIndex], ...fields };
    } else {
      newStructure.chapters[chapterIndex] = { ...chapter, ...fields };
    }
    
    setStructure(newStructure);
    setIsDirty(true);
  };

  const addNode = (type: "chapter" | "section" | "subsection", parentPath?: NodePath) => {
    if (!structure) return;
    const newStructure = { ...structure };
    setIsDirty(true);

    if (type === "chapter") {
      const idx = newStructure.chapters.length + 1;
      newStructure.chapters.push({ id: `c${idx}`, title: `${t("pdfCourse.chapterLabel")} ${idx}`, sections: [] });
      setSelectedPath({ chapterIndex: newStructure.chapters.length - 1 });
    } else if (type === "section" && parentPath) {
      const chapter = newStructure.chapters[parentPath.chapterIndex];
      const idx = chapter.sections.length + 1;
      chapter.sections.push({ id: `${chapter.id}s${idx}`, title: `${t("pdfCourse.sectionLabel")} ${idx}`, content: "", subsections: [] });
      setSelectedPath({ chapterIndex: parentPath.chapterIndex, sectionIndex: chapter.sections.length - 1 });
    } else if (type === "subsection" && parentPath && parentPath.sectionIndex !== undefined) {
      const section = newStructure.chapters[parentPath.chapterIndex].sections[parentPath.sectionIndex];
      const idx = section.subsections.length + 1;
      section.subsections.push({ id: `${section.id}_${idx}`, title: `${t("pdfCourse.subsectionLabel")} ${idx}`, content: "" });
      setSelectedPath({ ...parentPath, subsectionIndex: section.subsections.length - 1 });
    }
    setStructure(newStructure);
  };

  const deleteNode = (path: NodePath) => {
    if (!structure) return;
    const newStructure = { ...structure };
    setIsDirty(true);

    const { chapterIndex, sectionIndex, subsectionIndex } = path;
    if (subsectionIndex !== undefined && sectionIndex !== undefined) {
      newStructure.chapters[chapterIndex].sections[sectionIndex].subsections.splice(subsectionIndex, 1);
    } else if (sectionIndex !== undefined) {
      newStructure.chapters[chapterIndex].sections.splice(sectionIndex, 1);
    } else {
      newStructure.chapters.splice(chapterIndex, 1);
    }
    
    setStructure(newStructure);
    setSelectedPath(null);
  };

  const getActiveNode = () => {
    if (!structure || !selectedPath) return null;
    const { chapterIndex, sectionIndex, subsectionIndex } = selectedPath;
    const chapter = structure.chapters[chapterIndex];
    if (subsectionIndex !== undefined && sectionIndex !== undefined) {
      return chapter.sections[sectionIndex].subsections[subsectionIndex];
    }
    if (sectionIndex !== undefined) {
      return chapter.sections[sectionIndex];
    }
    return chapter;
  };

  if (loading) return (
    <DashboardShell title={t("pdfCourse.reviewTitle")} subtitle="">
      <div className={cx(surfaceClass, "flex items-center justify-center py-20")}>
        <p className="text-muted-foreground">{t("dashboards.common.loading")}</p>
      </div>
    </DashboardShell>
  );

  const activeNode = getActiveNode();

  return (
    <DashboardShell title={t("pdfCourse.reviewTitle")} subtitle={course?.title || ""}>
      <div className="flex flex-col gap-4">
        {/* Actions Header */}
        <div className={cx(surfaceClass, "flex items-center justify-between p-4")}>
          <div className="flex items-center gap-3">
             <Link to={`${localePrefix(i18n.resolvedLanguage)}/teacher/dashboard`} className={actionClass("soft")}>
               {i18n.dir() === "rtl" ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
               {t("pdfCourse.backToList")}
             </Link>
             {isDirty && <span className="text-sm font-medium text-amber-500">{t("pdfCourse.unsavedWarning")}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button className={actionClass("primary")} onClick={onSave} disabled={saving || !isDirty}>
              <Save size={18} className="mr-2 rtl:ml-2" />
              {saving ? t("pdfCourse.saving") : t("pdfCourse.saveStructure")}
            </button>
            <button className={actionClass("secondary")} onClick={onPublish} disabled={saving || course?.status === "PUBLISHED"}>
              <Upload size={18} className="mr-2 rtl:ml-2" />
              {saving ? t("pdfCourse.publishing") : t("pdfCourse.publishBtn")}
            </button>
          </div>
        </div>

        <div className="flex border-b px-4 mt-2 gap-6">
          <button
            className={cx("pb-3 text-sm font-semibold border-b-2 transition", activeTab === "editor" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
            onClick={() => setActiveTab("editor")}
          >
            {t("common.editor", "Editor")}
          </button>
          <button
            className={cx("pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2", activeTab === "analytics" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
            onClick={() => {
              setActiveTab("analytics");
              void fetchAnalytics();
            }}
          >
            <BarChart2 size={16} /> {t("dashboards.teacher.analyticsTab", "Analytics")}
          </button>
        </div>

        {activeTab === "editor" ? (
          <div className="grid h-[calc(100vh-320px)] min-h-[500px] gap-4 lg:grid-cols-12">
          {/* Tree Panel */}
          <div className={cx(surfaceClass, "flex flex-col overflow-hidden lg:col-span-4")}>
             <div className="border-b p-4 font-semibold">{t("pdfCourse.structureLabel")}</div>
             <div className="flex-1 overflow-y-auto p-2">
                {structure?.chapters.map((chapter, ci) => (
                  <div key={chapter.id} className="mb-2">
                    <div 
                      className={cx(
                        "group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition cursor-pointer",
                        selectedPath?.chapterIndex === ci && selectedPath.sectionIndex === undefined ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      )}
                      onClick={() => setSelectedPath({ chapterIndex: ci })}
                    >
                      <span className="truncate">{chapter.title}</span>
                      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                         <button onClick={(e) => { e.stopPropagation(); addNode("section", { chapterIndex: ci }); }}><Plus size={14} /></button>
                         <button onClick={(e) => { e.stopPropagation(); deleteNode({ chapterIndex: ci }); }}><Trash2 size={14} className="text-destructive" /></button>
                      </div>
                    </div>
                    
                    <div className="ml-4 mt-1 space-y-1 border-l-2 pl-2 rtl:ml-0 rtl:mr-4 rtl:border-l-0 rtl:border-r-2 rtl:pl-0 rtl:pr-2">
                      {chapter.sections.map((section, si) => (
                        <div key={section.id}>
                          <div 
                            className={cx(
                              "group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition cursor-pointer",
                              selectedPath?.chapterIndex === ci && selectedPath.sectionIndex === si && selectedPath.subsectionIndex === undefined ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
                            )}
                            onClick={() => setSelectedPath({ chapterIndex: ci, sectionIndex: si })}
                          >
                            <span className="truncate">{section.title}</span>
                            <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                               <button onClick={(e) => { e.stopPropagation(); addNode("subsection", { chapterIndex: ci, sectionIndex: si }); }}><Plus size={14} /></button>
                               <button onClick={(e) => { e.stopPropagation(); deleteNode({ chapterIndex: ci, sectionIndex: si }); }}><Trash2 size={14} className="text-destructive" /></button>
                            </div>
                          </div>
                          
                          <div className="ml-4 mt-1 space-y-1 border-l pl-2 rtl:ml-0 rtl:mr-4 rtl:border-l-0 rtl:border-r rtl:pl-0 rtl:pr-2">
                            {section.subsections.map((sub, ssi) => (
                              <div 
                                key={sub.id}
                                className={cx(
                                  "group flex items-center justify-between rounded-lg px-3 py-2 text-xs transition cursor-pointer",
                                  selectedPath?.chapterIndex === ci && selectedPath.sectionIndex === si && selectedPath.subsectionIndex === ssi ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground/80 hover:bg-muted"
                                )}
                                onClick={() => setSelectedPath({ chapterIndex: ci, sectionIndex: si, subsectionIndex: ssi })}
                              >
                                <span className="truncate">{sub.title}</span>
                                <button className="opacity-0 transition group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); deleteNode({ chapterIndex: ci, sectionIndex: si, subsectionIndex: ssi }); }}>
                                  <Trash2 size={12} className="text-destructive" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                <button 
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-3 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                  onClick={() => addNode("chapter")}
                >
                  <Plus size={16} />
                  {t("pdfCourse.addChapter")}
                </button>
             </div>
          </div>

          {/* Edit Panel */}
          <div className={cx(surfaceClass, "flex flex-col lg:col-span-8 overflow-hidden")}>
             {activeNode ? (
               <div className="flex flex-col h-full p-6">
                 <div className="mb-4">
                    <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">{t("pdfCourse.titlePlaceholder")}</label>
                    <input 
                      className={cx(inputClass, "!text-lg !font-semibold")} 
                      value={activeNode.title}
                      onChange={(e) => updateSelectedNode({ title: e.target.value })}
                    />
                 </div>
                 
                 {/* Content only for sections and subsections */}
                 {(selectedPath?.sectionIndex !== undefined) && (
                   <div className="flex-1 flex flex-col h-full">
                     <div className="flex-1 flex flex-col">
                        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">{t("pdfCourse.contentPlaceholder")}</label>
                        <textarea 
                          className={cx(inputClass, "flex-1 resize-none py-4 min-h-[150px]")}
                          value={(activeNode as Section | Subsection).content}
                          onChange={(e) => updateSelectedNode({ content: e.target.value })}
                        />
                     </div>
                     
                     <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Video URL</label>
                          <input
                            type="url"
                            className={inputClass}
                            placeholder="https://youtube.com/..."
                            value={(activeNode as any).video_url || ""}
                            onChange={(e) => updateSelectedNode({ video_url: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center justify-between uppercase tracking-wider">
                            Resources
                            <button type="button" className="text-primary hover:underline hover:text-primary/80 lowercase" onClick={() => {
                               const current = (activeNode as any).resources || [];
                               updateSelectedNode({ resources: [...current, { title: "New Link", url: "" }] });
                            }}>+ Add</button>
                          </label>
                          <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                             {((activeNode as any).resources || []).length === 0 && (
                                <p className="text-sm text-muted-foreground italic">No resources appended.</p>
                             )}
                             {((activeNode as any).resources || []).map((res: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <input 
                                    className={cx(inputClass, "!py-1 !text-xs w-1/3")} 
                                    placeholder="Title" 
                                    value={res.title}
                                    onChange={(e) => {
                                       const newRes = [...((activeNode as any).resources || [])];
                                       newRes[idx].title = e.target.value;
                                       updateSelectedNode({ resources: newRes });
                                    }}
                                  />
                                  <input 
                                    className={cx(inputClass, "!py-1 !text-xs flex-1")} 
                                    placeholder="URL" 
                                    value={res.url}
                                    onChange={(e) => {
                                       const newRes = [...((activeNode as any).resources || [])];
                                       newRes[idx].url = e.target.value;
                                       updateSelectedNode({ resources: newRes });
                                    }}
                                  />
                                  <button type="button" className="text-destructive p-1" onClick={() => {
                                     const newRes = [...((activeNode as any).resources || [])];
                                     newRes.splice(idx, 1);
                                     updateSelectedNode({ resources: newRes });
                                  }}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                             ))}
                          </div>
                        </div>
                     </div>
                   </div>
                 )}
                 
                 {!selectedPath?.sectionIndex && (
                   <div className="flex-1 flex items-center justify-center text-muted-foreground italic bg-muted/30 rounded-2xl">
                     {t("pdfCourse.chapterLabel")} - {t("pdfCourse.contentPlaceholder")} is available at Section/Subsection level.
                   </div>
                 )}
               </div>
             ) : (
               <div className="flex h-full items-center justify-center text-muted-foreground italic">
                 Select a chapter or section to edit
               </div>
             )}
          </div>
        </div>
        ) : (
          <div className={cx(surfaceClass, "min-h-[500px] p-6")}>
            {analyticsLoading ? (
               <div className="flex items-center justify-center h-40"><p className="text-muted-foreground">{t("dashboards.common.loading")}</p></div>
            ) : analytics ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
                    <p className="text-sm text-muted-foreground mb-1">Enrolled Students</p>
                    <p className="text-3xl font-bold text-primary">{analytics.enrolled_students}</p>
                  </div>
                  <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
                    <p className="text-sm text-muted-foreground mb-1">Total Sections</p>
                    <p className="text-3xl font-bold text-primary">{analytics.total_sections}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-4 text-xl">Student Progress</h4>
                  {analytics.students.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic w-full text-center py-10">No students have started this course yet.</p>
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden bg-background shadow-sm">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground text-xs uppercase font-semibold tracking-wider">
                          <tr>
                            <th className="px-5 py-4">Student ID</th>
                            <th className="px-5 py-4">Progress</th>
                            <th className="px-5 py-4">Best Quiz Score</th>
                            <th className="px-5 py-4 text-center">Quiz Attempts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {analytics.students.map((st) => (
                            <tr key={st.student_user_id} className="hover:bg-muted/30 transition">
                              <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{st.student_user_id.substring(0, 8)}...</td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-32 h-2.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary" style={{ width: `${(st.completed_sections / Math.max(1, analytics.total_sections)) * 100}%` }} />
                                  </div>
                                  <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{st.completed_sections} / {analytics.total_sections}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 font-medium">
                                {st.best_quiz_score !== null ? (
                                  <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md text-xs font-bold">{st.best_quiz_score} / {st.quiz_total_questions}</span>
                                ) : (
                                  <span className="text-muted-foreground italic">-</span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-center">{st.quiz_attempt_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {statusMsg && (
          <div className={cx(surfaceClass, "p-3 text-center text-sm font-medium", statusMsg === t("pdfCourse.saved") ? "text-primary" : "text-destructive")}>
            {statusMsg}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
