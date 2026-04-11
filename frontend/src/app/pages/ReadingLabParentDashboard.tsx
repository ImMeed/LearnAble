import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import {
  createReadingSupportStudent,
  fetchReadingSupportStudents,
  linkReadingSupportStudent,
  updateStudentReadingSupport,
} from "../../api/readingSupportApi";
import { ReadingLabPortalShell } from "../../features/readingLab/ReadingLabPortalShell";
import { ReadingSupportManagementCard } from "../../features/readingLab/components/ReadingSupportManagementCard";
import { getReadingLabCopy } from "../../features/readingLab/copy";
import { getReadingLabPortalCopy } from "../../features/readingLab/portalCopy";
import type { ReadingSupportStudentOverview } from "../../features/readingLab/types";
import type { NotificationItem, Profile } from "./roleDashboardShared";
import { errorMessage, formatDate, localeRequestConfig } from "./roleDashboardShared";

function formatDuration(seconds: number, locale: "ar" | "en") {
  if (!seconds) {
    return locale === "en" ? "0 min" : "0 د";
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return locale === "en" ? `${minutes} min` : `${minutes} د`;
}

export function ReadingLabParentDashboardPage() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const readingCopy = useMemo(() => getReadingLabCopy(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const portalCopy = useMemo(() => getReadingLabPortalCopy(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const labels = useMemo(
    () =>
      locale === "en"
        ? {
            trackBadge: "Family reading support workspace",
            parentName: "Parent",
            linkedChildren: "Children on your dashboard",
            childSnapshot: "Selected child snapshot",
            currentPlan: "Current support note",
            targetSymbols: "Current focus items",
            topGame: "Top game",
            latestActivity: "Latest activity",
            createChildTitle: "1. Add a child account",
            createChildBody: "Create a Reading Lab child account here, then keep the generated child ID for future linking and support follow-up.",
            childName: "Child name",
            childEmail: "Child email",
            childPassword: "Temporary password",
            createChildAction: "Create child and generate ID",
            createChildHint: "This creates the child account directly inside Reading Lab.",
            linkChildTitle: "2. Link an existing child",
            linkChildBody: "If the child already has a Reading Lab account, paste the child ID here to add them to your family dashboard.",
            supportTitle: "3. Mark this child for dyslexia support",
            supportBody:
              "When activated, the child gets Reading Lab access, progress tracking, rewards, and Gemini-based practice sessions shaped by the plan below.",
            supportReady: "Reading support is active for this child.",
            supportPaused: "Reading support is paused for this child.",
            activateSupport: "Mark as dyslexia support child",
            pauseSupport: "Pause dyslexia support",
            saveSelectedPlan: "Save selected child plan",
            selectedChild: "Selected child",
            noChild: "Create a child or link an existing child ID to unlock the family workspace.",
            noSelectedChild: "Select a child first to manage dyslexia support.",
            statusTitle: "Workspace status",
            statusIdle: "Family dashboard is ready. Choose a child to continue.",
            childCreatedPrefix: "Child created. Save this ID",
            childLinkedPrefix: "Child linked",
            childNotLinked: "This child is not linked yet. Use Link child to add them first.",
            averageSession: "Avg session time",
            rewards: "Rewards",
            workflowTitle: "Clear family workflow",
            workflowSteps: [
              "Create a child account or link an existing child ID.",
              "Activate dyslexia support for the selected child.",
              "Define letters, words, and numbers the child needs to practice.",
              "The child receives games generated around that plan and you track results here.",
            ],
            homeRoutineTitle: "Suggested home routine",
            updatesTitle: "Recent updates",
            planBuilderTitle: "4. Build the daily support plan",
            planBuilderBody:
              "These notes and focus items are the instructions used when Reading Lab prepares the child's personalized practice sessions.",
            planBadge: "Live support plan",
            notesBadge: "Family note",
            focusBadge: "Gemini focus",
            activeSupport: "Support active",
            pausedSupport: "Support paused",
            performanceTrend: "Performance trend",
            focusEmpty: "No focus items added yet.",
            noActivity: "No finished Reading Lab session yet.",
            supportUnlocked: "Reading Lab unlocked for this child.",
            supportSaved: "Reading support plan saved.",
          }
        : {
            trackBadge: "مساحة الأسرة لدعم القراءة",
            parentName: "ولي الأمر",
            linkedChildren: "الأطفال الموجودون في لوحتك",
            childSnapshot: "ملخص الطفل المحدد",
            currentPlan: "ملاحظة الدعم الحالية",
            targetSymbols: "العناصر المستهدفة حاليا",
            topGame: "أفضل لعبة",
            latestActivity: "آخر نشاط",
            createChildTitle: "1. إنشاء حساب طفل",
            createChildBody: "أنشئ حساب الطفل داخل مختبر القراءة هنا ثم احتفظ بمعرف الطفل لعمليات الربط والمتابعة لاحقا.",
            childName: "اسم الطفل",
            childEmail: "بريد الطفل",
            childPassword: "كلمة مرور مؤقتة",
            createChildAction: "إنشاء الطفل وتوليد المعرف",
            createChildHint: "يتم إنشاء حساب الطفل مباشرة داخل مختبر القراءة.",
            linkChildTitle: "2. ربط طفل موجود",
            linkChildBody: "إذا كان الطفل يملك حسابا في مختبر القراءة بالفعل، ألصق معرفه هنا لإضافته إلى لوحة الأسرة.",
            supportTitle: "3. تحديد الطفل كحالة دعم لعسر القراءة",
            supportBody: "عند التفعيل يحصل الطفل على الوصول إلى مختبر القراءة وتتبع التقدم والمكافآت وجلسات التدريب المبنية على الخطة أدناه.",
            supportReady: "دعم القراءة مفعل لهذا الطفل.",
            supportPaused: "دعم القراءة متوقف لهذا الطفل.",
            activateSupport: "تحديد الطفل كحالة دعم لعسر القراءة",
            pauseSupport: "إيقاف دعم عسر القراءة",
            saveSelectedPlan: "حفظ خطة الطفل المحدد",
            selectedChild: "الطفل المحدد",
            noChild: "أنشئ طفلا أو اربط معرف طفل موجود لفتح مساحة الأسرة.",
            noSelectedChild: "اختر طفلا أولا لإدارة دعم عسر القراءة.",
            statusTitle: "حالة المساحة",
            statusIdle: "لوحة الأسرة جاهزة. اختر طفلا للمتابعة.",
            childCreatedPrefix: "تم إنشاء الطفل. احفظ هذا المعرف",
            childLinkedPrefix: "تم ربط الطفل",
            childNotLinked: "هذا الطفل غير مرتبط بعد. استخدم ربط الطفل لإضافته أولا.",
            averageSession: "متوسط الجلسة",
            rewards: "المكافآت",
            workflowTitle: "مسار أسري واضح",
            workflowSteps: [
              "أنشئ حساب الطفل أو اربط معرف طفل موجود.",
              "فعّل دعم عسر القراءة للطفل المحدد.",
              "حدد الحروف والكلمات والأرقام التي يحتاج الطفل إلى التدريب عليها.",
              "يتلقى الطفل ألعابا مبنية على هذه الخطة وتتابع النتائج من هنا.",
            ],
            homeRoutineTitle: "روتين منزلي مقترح",
            updatesTitle: "آخر التحديثات",
            planBuilderTitle: "4. بناء خطة الدعم اليومية",
            planBuilderBody: "هذه الملاحظات والعناصر المستهدفة هي التعليمات التي يعتمد عليها مختبر القراءة عند تجهيز الجلسات الشخصية للطفل.",
            planBadge: "خطة دعم نشطة",
            notesBadge: "ملاحظة الأسرة",
            focusBadge: "تركيز Gemini",
            activeSupport: "الدعم مفعل",
            pausedSupport: "الدعم متوقف",
            performanceTrend: "اتجاه الأداء",
            focusEmpty: "لم تتم إضافة عناصر مستهدفة بعد.",
            noActivity: "لا توجد جلسة مكتملة بعد.",
            supportUnlocked: "تم فتح مختبر القراءة لهذا الطفل.",
            supportSaved: "تم حفظ خطة الدعم.",
          },
    [locale],
  );

  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [supportStudents, setSupportStudents] = useState<ReadingSupportStudentOverview[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [letterDrafts, setLetterDrafts] = useState<Record<string, string[]>>({});
  const [wordDrafts, setWordDrafts] = useState<Record<string, string[]>>({});
  const [numberDrafts, setNumberDrafts] = useState<Record<string, string[]>>({});
  const [studentIdInput, setStudentIdInput] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [newChildName, setNewChildName] = useState("");
  const [newChildEmail, setNewChildEmail] = useState("");
  const [newChildPassword, setNewChildPassword] = useState("");
  const [creatingChild, setCreatingChild] = useState(false);
  const [status, setStatus] = useState("");

  const loadAll = async () => {
    setStatus(readingCopy.loading);
    try {
      const [profileRes, notificationsRes, supportStudentsRes] = await Promise.all([
        apiClient.get<Profile>("/parent/profile", requestConfig),
        apiClient.get<{ items: NotificationItem[] }>("/notifications", requestConfig),
        fetchReadingSupportStudents(i18n.resolvedLanguage),
      ]);

      setProfile(profileRes.data);
      setNotifications(notificationsRes.data.items || []);
      setSupportStudents(supportStudentsRes);
      setNoteDrafts(
        supportStudentsRes.reduce<Record<string, string>>((acc, item) => {
          acc[item.student_user_id] = item.support_profile?.notes ?? "";
          return acc;
        }, {}),
      );
      setLetterDrafts(
        supportStudentsRes.reduce<Record<string, string[]>>((acc, item) => {
          acc[item.student_user_id] = item.support_profile?.focus_letters ?? [];
          return acc;
        }, {}),
      );
      setWordDrafts(
        supportStudentsRes.reduce<Record<string, string[]>>((acc, item) => {
          acc[item.student_user_id] = item.support_profile?.focus_words ?? [];
          return acc;
        }, {}),
      );
      setNumberDrafts(
        supportStudentsRes.reduce<Record<string, string[]>>((acc, item) => {
          acc[item.student_user_id] = item.support_profile?.focus_numbers ?? [];
          return acc;
        }, {}),
      );
      setStatus(labels.statusIdle);
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  useEffect(() => {
    void loadAll();
  }, [i18n.resolvedLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedStudentId && supportStudents.length > 0) {
      setSelectedStudentId(supportStudents[0].student_user_id);
    }
  }, [selectedStudentId, supportStudents]);

  const persistReadingSupport = async (studentId: string, nextActive: boolean, successMessage?: string) => {
    setBusyStudentId(studentId);
    try {
      await updateStudentReadingSupport(
        studentId,
        {
          is_active: nextActive,
          notes: noteDrafts[studentId] ?? "",
          focus_letters: letterDrafts[studentId] ?? [],
          focus_words: wordDrafts[studentId] ?? [],
          focus_numbers: numberDrafts[studentId] ?? [],
        },
        i18n.resolvedLanguage,
      );
      await loadAll();
      setStatus(successMessage ?? (nextActive ? labels.supportUnlocked : labels.pausedSupport));
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusyStudentId(null);
    }
  };

  const createChild = async (event: FormEvent) => {
    event.preventDefault();
    if (!newChildName.trim() || !newChildEmail.trim() || !newChildPassword.trim()) {
      return;
    }

    setCreatingChild(true);
    setStatus(readingCopy.loading);
    try {
      const child = await createReadingSupportStudent(
        {
          display_name: newChildName.trim(),
          email: newChildEmail.trim(),
          password: newChildPassword,
        },
        i18n.resolvedLanguage,
      );
      setSelectedStudentId(child.student_user_id);
      setStudentIdInput(child.student_user_id);
      setNewChildName("");
      setNewChildEmail("");
      setNewChildPassword("");
      await loadAll();
      setStatus(`${labels.childCreatedPrefix}: ${child.student_user_id}`);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setCreatingChild(false);
    }
  };

  const applyStudentFilter = () => {
    const nextId = studentIdInput.trim();
    if (!nextId) {
      setSelectedStudentId("");
      setStatus(labels.statusIdle);
      return;
    }

    if (supportStudents.some((item) => item.student_user_id === nextId)) {
      setSelectedStudentId(nextId);
      setStatus(`${readingCopy.studentIdLabel}: ${nextId}`);
      return;
    }

    setStatus(labels.childNotLinked);
  };

  const linkStudent = async () => {
    const nextId = studentIdInput.trim();
    if (!nextId) return;

    setStatus(readingCopy.loading);
    try {
      await linkReadingSupportStudent(nextId, i18n.resolvedLanguage);
      setSelectedStudentId(nextId);
      await loadAll();
      setStatus(`${labels.childLinkedPrefix}: ${nextId}`);
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  const activeCount = supportStudents.filter((item) => item.support_profile?.is_active).length;
  const totalSessions = supportStudents.reduce((sum, item) => sum + item.progress.completed_sessions, 0);
  const averageAccuracy = supportStudents.length
    ? Math.round(supportStudents.reduce((sum, item) => sum + item.progress.average_accuracy, 0) / supportStudents.length)
    : 0;
  const averageSessionSeconds = supportStudents.length
    ? Math.round(supportStudents.reduce((sum, item) => sum + item.progress.average_session_seconds, 0) / supportStudents.length)
    : 0;
  const totalRewards = supportStudents.reduce((sum, item) => sum + item.progress.unlocked_rewards.length, 0);

  const selectedStudent =
    supportStudents.find((item) => item.student_user_id === selectedStudentId) ?? supportStudents[0] ?? null;
  const visibleStudents = selectedStudentId
    ? supportStudents.filter((item) => item.student_user_id === selectedStudentId)
    : supportStudents;
  const spotlightGames = [...(selectedStudent?.progress.by_game ?? [])]
    .filter((item) => item.play_count > 0)
    .sort((left, right) => right.best_accuracy - left.best_accuracy || right.play_count - left.play_count)
    .slice(0, 3);
  const focusTokens = selectedStudent
    ? [
        ...(selectedStudent.support_profile?.focus_letters ?? []),
        ...(selectedStudent.support_profile?.focus_words ?? []),
        ...(selectedStudent.support_profile?.focus_numbers ?? []),
      ]
    : [];

  return (
    <ReadingLabPortalShell title={portalCopy.parent.title} subtitle={portalCopy.parent.subtitle} variant="parent">
      <section className="reading-portal-family-grid">
        <article className="card family-hero-card">
          <p className="reading-portal-kicker">{labels.trackBadge}</p>
          <h2>{portalCopy.parent.heroTitle}</h2>
          <p>{portalCopy.parent.heroBody}</p>
          <div className="metrics-grid">
            <article className="card metric-pill">
              <p>{labels.linkedChildren}</p>
              <strong>{supportStudents.length}</strong>
            </article>
            <article className="card metric-pill">
              <p>{labels.activeSupport}</p>
              <strong>{activeCount}</strong>
            </article>
            <article className="card metric-pill">
              <p>{readingCopy.sessionsLabel}</p>
              <strong>{totalSessions}</strong>
            </article>
            <article className="card metric-pill">
              <p>{readingCopy.averageAccuracy}</p>
              <strong>{averageAccuracy}%</strong>
            </article>
            <article className="card metric-pill">
              <p>{labels.averageSession}</p>
              <strong>{formatDuration(averageSessionSeconds, locale)}</strong>
            </article>
            <article className="card metric-pill">
              <p>{labels.rewards}</p>
              <strong>{totalRewards}</strong>
            </article>
            <article className="card metric-pill">
              <p>{labels.parentName}</p>
              <strong>{profile?.display_name || profile?.email || "-"}</strong>
            </article>
          </div>
        </article>

        <article className="card family-flow-card">
          <div className="section-title-row">
            <h3>{labels.workflowTitle}</h3>
            <span className="reading-support-soft-badge">4 steps</span>
          </div>
          <div className="family-step-list">
            {labels.workflowSteps.map((step, index) => (
              <article className="family-step" key={step}>
                <span className="family-step-index">{index + 1}</span>
                <p>{step}</p>
              </article>
            ))}
          </div>
          <div className="reading-auth-callout">
            <strong>{labels.statusTitle}</strong>
            <p>{status || labels.statusIdle}</p>
          </div>
        </article>
      </section>

      <section className="reading-portal-family-grid lower">
        <article className="card family-action-card">
          <div className="section-title-row">
            <h3>{labels.createChildTitle}</h3>
            <span className="reading-support-soft-badge">{portalCopy.parent.title}</span>
          </div>
          <p className="muted">{labels.createChildBody}</p>
          <form className="stack-form" onSubmit={(event) => void createChild(event)}>
            <label>
              {labels.childName}
              <input value={newChildName} onChange={(event) => setNewChildName(event.target.value)} autoComplete="name" />
            </label>
            <label>
              {labels.childEmail}
              <input
                type="email"
                value={newChildEmail}
                onChange={(event) => setNewChildEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <label>
              {labels.childPassword}
              <input
                type="password"
                value={newChildPassword}
                onChange={(event) => setNewChildPassword(event.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" disabled={creatingChild}>
              {creatingChild ? "..." : labels.createChildAction}
            </button>
          </form>
          <p className="muted">{labels.createChildHint}</p>
        </article>

        <article className="card family-action-card">
          <div className="section-title-row">
            <h3>{labels.linkChildTitle}</h3>
            <span className="reading-support-soft-badge">{readingCopy.studentIdLabel}</span>
          </div>
          <p className="muted">{labels.linkChildBody}</p>
          <div className="stack-form">
            <label>
              {readingCopy.studentIdLabel}
              <input
                value={studentIdInput}
                onChange={(event) => setStudentIdInput(event.target.value)}
                placeholder={readingCopy.studentIdPlaceholder}
              />
            </label>
            <div className="inline-actions">
              <button type="button" className="secondary" onClick={applyStudentFilter}>
                {readingCopy.findStudent}
              </button>
              <button type="button" onClick={() => void linkStudent()}>
                {readingCopy.linkStudent}
              </button>
              {selectedStudentId ? (
                <button type="button" className="secondary" onClick={() => setSelectedStudentId("")}>
                  {readingCopy.clearStudentFilter}
                </button>
              ) : null}
            </div>
          </div>
          <p className="muted">{readingCopy.studentLookupHint}</p>
        </article>

        <article className="card family-support-card">
          <div className="section-title-row">
            <h3>{labels.supportTitle}</h3>
            {selectedStudent ? <span className="reading-support-badge">{selectedStudent.student_label}</span> : null}
          </div>
          <p className="muted">{labels.supportBody}</p>
          {selectedStudent ? (
            <div className="stack-list">
              <article className="reading-auth-callout">
                <strong>{labels.selectedChild}</strong>
                <p>
                  {selectedStudent.student_label} | {readingCopy.studentIdLabel}: {selectedStudent.student_user_id}
                </p>
              </article>
              <div className="family-summary-stack">
                <div className="status-box status-success">
                  <strong>{selectedStudent.support_profile?.is_active ? labels.activeSupport : labels.pausedSupport}</strong>
                  <p>{selectedStudent.support_profile?.is_active ? labels.supportReady : labels.supportPaused}</p>
                </div>
                <div className="status-box status-info">
                  <strong>{labels.latestActivity}</strong>
                  <p>{formatDate(selectedStudent.progress.last_played_at, locale, labels.noActivity)}</p>
                </div>
              </div>
              <div className="inline-actions">
                <button
                  type="button"
                  onClick={() =>
                    void persistReadingSupport(
                      selectedStudent.student_user_id,
                      !(selectedStudent.support_profile?.is_active ?? false),
                      selectedStudent.support_profile?.is_active ? labels.supportPaused : labels.supportUnlocked,
                    )
                  }
                  disabled={busyStudentId === selectedStudent.student_user_id}
                >
                  {busyStudentId === selectedStudent.student_user_id
                    ? "..."
                    : selectedStudent.support_profile?.is_active
                      ? labels.pauseSupport
                      : labels.activateSupport}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    void persistReadingSupport(
                      selectedStudent.student_user_id,
                      selectedStudent.support_profile?.is_active ?? false,
                      labels.supportSaved,
                    )
                  }
                  disabled={busyStudentId === selectedStudent.student_user_id}
                >
                  {labels.saveSelectedPlan}
                </button>
              </div>
            </div>
          ) : (
            <p className="muted">{labels.noSelectedChild}</p>
          )}
        </article>
      </section>

      <section className="reading-portal-family-grid lower">
        <article className="card family-roster-card">
          <div className="section-title-row">
            <h3>{labels.linkedChildren}</h3>
            <span className="reading-support-soft-badge">{supportStudents.length}</span>
          </div>
          {supportStudents.length === 0 ? <p className="muted">{labels.noChild}</p> : null}
          <div className="family-roster-grid">
            {supportStudents.map((student) => {
              const selected = student.student_user_id === (selectedStudent?.student_user_id ?? "");
              return (
                <button
                  key={student.student_user_id}
                  type="button"
                  className={selected ? "family-roster-button active" : "family-roster-button"}
                  onClick={() => setSelectedStudentId(student.student_user_id)}
                >
                  <strong>{student.student_label}</strong>
                  <span>{student.support_profile?.is_active ? labels.activeSupport : labels.pausedSupport}</span>
                  <span>
                    {student.progress.completed_sessions} {readingCopy.sessionsLabel}
                  </span>
                  <span>{student.progress.average_accuracy}%</span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="card family-spotlight-card">
          <div className="section-title-row">
            <h3>{labels.childSnapshot}</h3>
            {selectedStudent ? <span className="reading-support-badge">{selectedStudent.student_label}</span> : null}
          </div>
          {selectedStudent ? (
            <div className="stack-list">
              <article className="reading-portal-note">
                <strong>{labels.currentPlan}</strong>
                <p>{selectedStudent.support_profile?.notes || labels.planBuilderBody}</p>
              </article>
              <article className="reading-portal-note">
                <strong>{labels.targetSymbols}</strong>
                <div className="reading-lab-focus-chip-row checkpoint-block">
                  {focusTokens.length > 0 ? (
                    focusTokens.map((token) => (
                      <span className="reading-lab-focus-chip" key={`${selectedStudent.student_user_id}-${token}`}>
                        {token}
                      </span>
                    ))
                  ) : (
                    <p className="muted">{labels.focusEmpty}</p>
                  )}
                </div>
              </article>
              <article className="family-summary-stack">
                <div className="status-box status-info">
                  <strong>{labels.latestActivity}</strong>
                  <p>{formatDate(selectedStudent.progress.last_played_at, locale, labels.noActivity)}</p>
                </div>
                <div className="status-box status-success">
                  <strong>{labels.topGame}</strong>
                  <p>{spotlightGames[0]?.title ?? labels.noActivity}</p>
                </div>
                <div className="status-box status-info">
                  <strong>{labels.averageSession}</strong>
                  <p>{formatDuration(selectedStudent.progress.average_session_seconds, locale)}</p>
                </div>
                <div className="status-box status-success">
                  <strong>{labels.rewards}</strong>
                  <p>{selectedStudent.progress.unlocked_rewards.length}</p>
                </div>
              </article>
            </div>
          ) : (
            <p className="muted">{labels.noChild}</p>
          )}
        </article>
      </section>

      <section className="reading-portal-family-grid lower">
        <article className="card family-guide-card">
          <div className="section-title-row">
            <h3>{labels.homeRoutineTitle}</h3>
            <span className="reading-support-soft-badge">{portalCopy.parent.guideItems.length}</span>
          </div>
          <div className="stack-list">
            {portalCopy.parent.guideItems.map((item) => (
              <article className="reading-portal-note" key={item}>
                <p>{item}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="card family-notification-card">
          <div className="section-title-row">
            <h3>{labels.updatesTitle}</h3>
            <span className="reading-support-soft-badge">{notifications.length}</span>
          </div>
          <div className="stack-list">
            {notifications.slice(0, 4).map((item) => (
              <article className="notification-item" key={item.id}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
            {notifications.length === 0 ? <p className="muted">{readingCopy.noGameHistory}</p> : null}
          </div>
        </article>
      </section>

      <ReadingSupportManagementCard
        title={labels.planBuilderTitle}
        description={labels.planBuilderBody}
        badgeLabel={labels.planBadge}
        notesBadgeLabel={labels.notesBadge}
        focusBadgeLabel={labels.focusBadge}
        emptyLabel={readingCopy.noStudents}
        notesLabel={readingCopy.notesLabel}
        notesPlaceholder={readingCopy.notesPlaceholder}
        enableLabel={labels.activateSupport}
        disableLabel={labels.pauseSupport}
        activeLabel={labels.activeSupport}
        inactiveLabel={labels.pausedSupport}
        progressLabel={readingCopy.progressSummary}
        bestAccuracyLabel={readingCopy.bestAccuracy}
        levelLabel={readingCopy.level}
        averageSessionLabel={labels.averageSession}
        rewardsLabel={labels.rewards}
        trendLabel={labels.performanceTrend}
        lastPlayedLabel={readingCopy.lastPlayed}
        noGameHistoryLabel={readingCopy.noGameHistory}
        sessionsLabel={readingCopy.sessionsLabel}
        accuracyLabel={readingCopy.accuracyLabel}
        studentIdLabel={readingCopy.studentIdLabel}
        focusLettersLabel={readingCopy.focusLettersLabel}
        focusWordsLabel={readingCopy.focusWordsLabel}
        focusNumbersLabel={readingCopy.focusNumbersLabel}
        focusEmptyLabel={readingCopy.focusEmpty}
        focusLettersPlaceholder={readingCopy.focusLettersPlaceholder}
        focusWordsPlaceholder={readingCopy.focusWordsPlaceholder}
        focusNumbersPlaceholder={readingCopy.focusNumbersPlaceholder}
        savePlanLabel={readingCopy.savePlan}
        locale={locale}
        items={visibleStudents}
        noteDrafts={noteDrafts}
        letterDrafts={letterDrafts}
        wordDrafts={wordDrafts}
        numberDrafts={numberDrafts}
        busyStudentId={busyStudentId}
        onNoteChange={(studentId, value) => setNoteDrafts((prev) => ({ ...prev, [studentId]: value }))}
        onLettersChange={(studentId, values) => setLetterDrafts((prev) => ({ ...prev, [studentId]: values }))}
        onWordsChange={(studentId, values) => setWordDrafts((prev) => ({ ...prev, [studentId]: values }))}
        onNumbersChange={(studentId, values) => setNumberDrafts((prev) => ({ ...prev, [studentId]: values }))}
        onSave={(studentId) => {
          const currentActive = supportStudents.find((item) => item.student_user_id === studentId)?.support_profile?.is_active ?? false;
          void persistReadingSupport(studentId, currentActive, labels.supportSaved);
        }}
        onToggle={(studentId, nextActive) => void persistReadingSupport(studentId, nextActive)}
      />
    </ReadingLabPortalShell>
  );
}
