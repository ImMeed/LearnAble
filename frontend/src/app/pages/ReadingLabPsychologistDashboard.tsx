import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { fetchReadingSupportStudents, linkReadingSupportStudent, updateStudentReadingSupport } from "../../api/readingSupportApi";
import { ReadingLabPortalShell } from "../../features/readingLab/ReadingLabPortalShell";
import { getReadingLabCopy } from "../../features/readingLab/copy";
import { getReadingLabPortalCopy } from "../../features/readingLab/portalCopy";
import { ReadingSupportManagementCard } from "../../features/readingLab/components/ReadingSupportManagementCard";
import type { ReadingSupportStudentOverview } from "../../features/readingLab/types";
import type { NotificationItem } from "./roleDashboardShared";
import { errorMessage, formatDate, localeRequestConfig } from "./roleDashboardShared";

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
};

const SUPPORT_LEVEL_OPTIONS = ["LOW", "MEDIUM", "HIGH"] as const;

export function ReadingLabPsychologistDashboardPage() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const readingCopy = useMemo(() => getReadingLabCopy(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const portalCopy = useMemo(() => getReadingLabPortalCopy(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const labels = useMemo(
    () =>
      locale === "en"
        ? {
            trackBadge: "Clinical reading support workspace",
            caseload: "Linked caseload",
            caseSpotlight: "Selected case snapshot",
            practiceSignals: "Priority follow-up signals",
            selectedPlan: "Current support plan",
            targetedSymbols: "Targeted symbols",
            noCase: "Link or choose a child to open the clinical workspace.",
            lowActivity: "Needs first session",
            attentionFlag: "Needs closer follow-up",
            linkChildTitle: "Link a child by ID",
            linkChildBody: "Add a child to the psychologist caseload with the Reading Lab ID used by the family.",
            reviewTitle: "Clinical confirmation",
            reviewBody: "Confirm the support level, write your note, and keep the child aligned with the same Reading Lab plan used at home.",
            supportLevel: "Support level",
            notes: "Clinical notes",
            confirmAction: "Save clinical confirmation",
            planBadge: "Clinical plan",
            notesBadge: "Psychologist note",
            focusBadge: "Target set",
            activeSupport: "Support active",
            pausedSupport: "Support paused",
            activateSupportAction: "Activate support plan",
            pauseSupportAction: "Pause support plan",
            averageSession: "Avg session time",
            rewards: "Rewards",
            performanceTrend: "Performance trend",
            compositeScore: "Composite score",
            scoreBreakdown: "Focus | Reading | Memory",
            activeCases: "Active cases",
          }
        : {
            trackBadge: "مساحة الأخصائي لدعم القراءة",
            caseload: "الحالات المرتبطة",
            caseSpotlight: "ملخص الحالة المحددة",
            practiceSignals: "إشارات المتابعة ذات الأولوية",
            selectedPlan: "خطة الدعم الحالية",
            targetedSymbols: "العناصر المستهدفة",
            noCase: "اربط طفلا أو اختره لفتح مساحة المتابعة السريرية.",
            lowActivity: "بحاجة إلى أول جلسة",
            attentionFlag: "بحاجة إلى متابعة أقرب",
            linkChildTitle: "ربط طفل بالمعرف",
            linkChildBody: "أضف طفلا إلى قائمة الأخصائي باستخدام معرف مختبر القراءة الخاص به.",
            reviewTitle: "تأكيد سريري",
            reviewBody: "أكد مستوى الدعم واكتب ملاحظتك وحافظ على توافق خطة الطفل بين المنزل والمتابعة السريرية.",
            supportLevel: "مستوى الدعم",
            notes: "ملاحظات سريرية",
            confirmAction: "حفظ التأكيد السريري",
            planBadge: "خطة سريرية",
            notesBadge: "ملاحظة الأخصائي",
            focusBadge: "العناصر المستهدفة",
            activeSupport: "الدعم مفعل",
            pausedSupport: "الدعم متوقف",
            activateSupportAction: "تفعيل خطة الدعم",
            pauseSupportAction: "إيقاف خطة الدعم",
            averageSession: "متوسط الجلسة",
            rewards: "المكافآت",
            performanceTrend: "اتجاه الأداء",
            compositeScore: "النتيجة المركبة",
            scoreBreakdown: "الانتباه | القراءة | الذاكرة",
            activeCases: "الحالات النشطة",
          },
    [locale],
  );

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reviews, setReviews] = useState<PsychologistReview[]>([]);
  const [studentId, setStudentId] = useState("");
  const [supportLevel, setSupportLevel] = useState<(typeof SUPPORT_LEVEL_OPTIONS)[number]>("MEDIUM");
  const [supportNotes, setSupportNotes] = useState("");
  const [supportStudents, setSupportStudents] = useState<ReadingSupportStudentOverview[]>([]);
  const [supportNoteDrafts, setSupportNoteDrafts] = useState<Record<string, string>>({});
  const [supportLetterDrafts, setSupportLetterDrafts] = useState<Record<string, string[]>>({});
  const [supportWordDrafts, setSupportWordDrafts] = useState<Record<string, string[]>>({});
  const [supportNumberDrafts, setSupportNumberDrafts] = useState<Record<string, string[]>>({});
  const [busySupportStudentId, setBusySupportStudentId] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const loadAll = async () => {
    setStatus(readingCopy.loading);
    try {
      const [notificationsRes, reviewsRes, supportStudentsRes] = await Promise.all([
        apiClient.get<{ items: NotificationItem[] }>("/notifications", requestConfig),
        apiClient.get<PsychologistReviewListResponse>("/psychologist/reviews/students?limit=20&offset=0", requestConfig),
        fetchReadingSupportStudents(i18n.resolvedLanguage),
      ]);
      setNotifications(notificationsRes.data.items || []);
      setReviews(reviewsRes.data.items || []);
      setSupportStudents(supportStudentsRes);
      setSupportNoteDrafts(
        supportStudentsRes.reduce<Record<string, string>>((acc, item) => {
          acc[item.student_user_id] = item.support_profile?.notes ?? "";
          return acc;
        }, {}),
      );
      setSupportLetterDrafts(
        supportStudentsRes.reduce<Record<string, string[]>>((acc, item) => {
          acc[item.student_user_id] = item.support_profile?.focus_letters ?? [];
          return acc;
        }, {}),
      );
      setSupportWordDrafts(
        supportStudentsRes.reduce<Record<string, string[]>>((acc, item) => {
          acc[item.student_user_id] = item.support_profile?.focus_words ?? [];
          return acc;
        }, {}),
      );
      setSupportNumberDrafts(
        supportStudentsRes.reduce<Record<string, string[]>>((acc, item) => {
          acc[item.student_user_id] = item.support_profile?.focus_numbers ?? [];
          return acc;
        }, {}),
      );
      if (!studentId && reviewsRes.data.items.length > 0) {
        setStudentId(reviewsRes.data.items[0].student_user_id);
      }
      setStatus(readingCopy.refreshHint);
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  useEffect(() => {
    void loadAll();
  }, [i18n.resolvedLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistReadingSupport = async (studentIdValue: string, nextActive: boolean, successMessage?: string) => {
    setBusySupportStudentId(studentIdValue);
    try {
      await updateStudentReadingSupport(
        studentIdValue,
        {
          is_active: nextActive,
          notes: supportNoteDrafts[studentIdValue] ?? "",
          focus_letters: supportLetterDrafts[studentIdValue] ?? [],
          focus_words: supportWordDrafts[studentIdValue] ?? [],
          focus_numbers: supportNumberDrafts[studentIdValue] ?? [],
        },
        i18n.resolvedLanguage,
      );
      await loadAll();
      setStatus(successMessage ?? (nextActive ? readingCopy.unlockedCardTitle : labels.pausedSupport));
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusySupportStudentId(null);
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
      await loadAll();
      setStatus(labels.confirmAction);
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  const linkStudent = async () => {
    const nextId = studentId.trim();
    if (!nextId) return;

    setStatus(readingCopy.loading);
    try {
      await linkReadingSupportStudent(nextId, i18n.resolvedLanguage);
      await loadAll();
      setStatus(`${readingCopy.linkStudent}: ${nextId}`);
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  const selectedReview = reviews.find((item) => item.student_user_id === studentId) ?? reviews[0] ?? null;
  const activeCount = supportStudents.filter((item) => item.support_profile?.is_active).length;
  const selectedSupportStudent =
    supportStudents.find((item) => item.student_user_id === (selectedReview?.student_user_id ?? studentId))
    ?? supportStudents[0]
    ?? null;
  const focusTokens = selectedSupportStudent
    ? [
        ...(selectedSupportStudent.support_profile?.focus_letters ?? []),
        ...(selectedSupportStudent.support_profile?.focus_words ?? []),
        ...(selectedSupportStudent.support_profile?.focus_numbers ?? []),
      ]
    : [];
  const practiceSignals = [...supportStudents]
    .sort((left, right) => {
      const leftScore = (left.progress.completed_sessions === 0 ? 1000 : 0) + (100 - left.progress.average_accuracy);
      const rightScore = (right.progress.completed_sessions === 0 ? 1000 : 0) + (100 - right.progress.average_accuracy);
      return rightScore - leftScore;
    })
    .slice(0, 3);
  const visibleStudents = supportStudents.some((item) => item.student_user_id === studentId)
    ? supportStudents.filter((item) => item.student_user_id === studentId)
    : supportStudents;

  useEffect(() => {
    if (!selectedReview) return;
    const reviewLevel = selectedReview.screening_summary?.support_level;
    if (reviewLevel && SUPPORT_LEVEL_OPTIONS.includes(reviewLevel as (typeof SUPPORT_LEVEL_OPTIONS)[number])) {
      setSupportLevel(reviewLevel as (typeof SUPPORT_LEVEL_OPTIONS)[number]);
    }
    setSupportNotes(selectedSupportStudent?.support_profile?.notes ?? "");
  }, [selectedReview?.student_user_id, selectedSupportStudent?.student_user_id]);

  return (
    <ReadingLabPortalShell
      title={portalCopy.psychologist.title}
      subtitle={portalCopy.psychologist.subtitle}
      variant="psychologist"
    >
      <section className="reading-portal-clinical-grid">
        <article className="card psych-hero-card">
          <p className="reading-portal-kicker">{labels.trackBadge}</p>
          <h2>{portalCopy.psychologist.heroTitle}</h2>
          <p>{portalCopy.psychologist.heroBody}</p>
          <div className="metrics-grid">
            <article className="card metric-pill">
              <p>{labels.activeCases}</p>
              <strong>{activeCount}</strong>
            </article>
            <article className="card metric-pill">
              <p>{portalCopy.psychologist.reviewTitle}</p>
              <strong>{reviews.length}</strong>
            </article>
            <article className="card metric-pill">
              <p>{portalCopy.psychologist.alertsTitle}</p>
              <strong>{notifications.length}</strong>
            </article>
          </div>
        </article>

        <article className="card psych-plan-card">
          <div className="section-title-row">
            <h3>{labels.linkChildTitle}</h3>
            <span className="reading-support-soft-badge">{readingCopy.studentIdLabel}</span>
          </div>
          <p className="muted">{labels.linkChildBody}</p>
          <div className="stack-form">
            <label>
              {readingCopy.studentIdLabel}
              <input
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                placeholder={readingCopy.studentIdPlaceholder}
              />
            </label>
            <div className="inline-actions">
              <button type="button" onClick={() => void linkStudent()}>
                {readingCopy.linkStudent}
              </button>
            </div>
          </div>
          <p className="muted">{readingCopy.studentLookupHint}</p>
        </article>
      </section>

      <section className="reading-portal-clinical-grid lower">
        <article className="card psych-review-list-card">
          <div className="section-title-row">
            <h3>{labels.caseload}</h3>
            <span className="reading-support-soft-badge">{reviews.length}</span>
          </div>
          <div className="stack-list">
            {reviews.map((review) => (
              <button
                key={review.student_user_id}
                type="button"
                className={review.student_user_id === selectedReview?.student_user_id ? "psych-review-row active" : "psych-review-row"}
                onClick={() => setStudentId(review.student_user_id)}
              >
                <strong>{review.student_label}</strong>
                <span>{review.screening_summary?.support_level ?? "-"}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="card psych-review-detail-card">
          <div className="section-title-row">
            <h3>{labels.caseSpotlight}</h3>
            {selectedSupportStudent ? (
              <span className="reading-support-badge">{selectedSupportStudent.student_label}</span>
            ) : null}
          </div>
          {selectedReview ? (
            <div className="stack-list">
              <article className="reading-portal-note">
                <strong>{labels.compositeScore}</strong>
                <p>{selectedReview.screening_composite_score ?? "-"}</p>
              </article>
              <article className="reading-portal-note">
                <strong>{labels.scoreBreakdown}</strong>
                <p>
                  {selectedReview.screening_summary?.focus_score ?? "-"} | {selectedReview.screening_summary?.reading_score ?? "-"} |{" "}
                  {selectedReview.screening_summary?.memory_score ?? "-"}
                </p>
              </article>
              <article className="reading-portal-note">
                <strong>{labels.selectedPlan}</strong>
                <p>{selectedSupportStudent?.support_profile?.notes ?? labels.noCase}</p>
              </article>
              <article className="reading-portal-note">
                <strong>{labels.targetedSymbols}</strong>
                <div className="reading-lab-focus-chip-row checkpoint-block">
                  {focusTokens.length > 0 ? (
                    focusTokens.map((token) => (
                      <span className="reading-lab-focus-chip" key={`${selectedSupportStudent?.student_user_id ?? "focus"}-${token}`}>
                        {token}
                      </span>
                    ))
                  ) : (
                    <p className="muted">{readingCopy.focusEmpty}</p>
                  )}
                </div>
              </article>
            </div>
          ) : (
            <p className="muted">{labels.noCase}</p>
          )}
        </article>
      </section>

      <section className="reading-portal-clinical-grid lower">
        <article className="card psych-plan-card">
          <div className="section-title-row">
            <h3>{labels.reviewTitle}</h3>
            <span className="reading-support-soft-badge">{selectedReview?.student_label ?? "-"}</span>
          </div>
          <p className="muted">{labels.reviewBody}</p>
          <form className="stack-form" onSubmit={(event) => void confirmSupport(event)}>
            <label>
              {labels.supportLevel}
              <select value={supportLevel} onChange={(event) => setSupportLevel(event.target.value as (typeof SUPPORT_LEVEL_OPTIONS)[number])}>
                {SUPPORT_LEVEL_OPTIONS.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {labels.notes}
              <textarea rows={4} value={supportNotes} onChange={(event) => setSupportNotes(event.target.value)} />
            </label>
            <button type="submit">{labels.confirmAction}</button>
          </form>
          <p className="status-line">{status}</p>
        </article>

        <article className="card psych-alert-card">
          <div className="section-title-row">
            <h3>{labels.practiceSignals}</h3>
            <span className="reading-support-soft-badge">{practiceSignals.length}</span>
          </div>
          <div className="stack-list">
            {practiceSignals.map((student) => (
              <article className="notification-item" key={student.student_user_id}>
                <strong>{student.student_label}</strong>
                <p>
                  {student.progress.completed_sessions === 0 ? labels.lowActivity : `${student.progress.average_accuracy}% ${readingCopy.accuracyLabel}`}
                </p>
                <p className="muted">
                  {student.progress.completed_sessions === 0 ? labels.attentionFlag : formatDate(student.progress.last_played_at, locale, labels.lowActivity)}
                </p>
              </article>
            ))}
            {practiceSignals.length === 0 ? <p className="muted">{labels.noCase}</p> : null}
          </div>
        </article>
      </section>

      <section className="reading-portal-clinical-grid lower">
        <article className="card psych-alert-card">
          <div className="section-title-row">
            <h3>{portalCopy.psychologist.alertsTitle}</h3>
            <span className="reading-support-soft-badge">{notifications.length}</span>
          </div>
          <div className="stack-list">
            {notifications.slice(0, 3).map((item) => (
              <article className="notification-item" key={item.id}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
            {notifications.length === 0 ? <p className="muted">{status}</p> : null}
          </div>
        </article>
      </section>

      <ReadingSupportManagementCard
        title={portalCopy.psychologist.planTitle}
        description={labels.reviewBody}
        badgeLabel={labels.planBadge}
        notesBadgeLabel={labels.notesBadge}
        focusBadgeLabel={labels.focusBadge}
        emptyLabel={readingCopy.noStudents}
        notesLabel={readingCopy.notesLabel}
        notesPlaceholder={readingCopy.notesPlaceholder}
        enableLabel={labels.activateSupportAction}
        disableLabel={labels.pauseSupportAction}
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
        noteDrafts={supportNoteDrafts}
        letterDrafts={supportLetterDrafts}
        wordDrafts={supportWordDrafts}
        numberDrafts={supportNumberDrafts}
        busyStudentId={busySupportStudentId}
        onNoteChange={(studentIdValue, value) =>
          setSupportNoteDrafts((prev) => ({
            ...prev,
            [studentIdValue]: value,
          }))
        }
        onLettersChange={(studentIdValue, values) =>
          setSupportLetterDrafts((prev) => ({
            ...prev,
            [studentIdValue]: values,
          }))
        }
        onWordsChange={(studentIdValue, values) =>
          setSupportWordDrafts((prev) => ({
            ...prev,
            [studentIdValue]: values,
          }))
        }
        onNumbersChange={(studentIdValue, values) =>
          setSupportNumberDrafts((prev) => ({
            ...prev,
            [studentIdValue]: values,
          }))
        }
        onSave={(studentIdValue) => {
          const currentActive = supportStudents.find((item) => item.student_user_id === studentIdValue)?.support_profile?.is_active ?? false;
          void persistReadingSupport(studentIdValue, currentActive, readingCopy.savePlan);
        }}
        onToggle={(studentIdValue, nextActive) => void persistReadingSupport(studentIdValue, nextActive)}
      />
    </ReadingLabPortalShell>
  );
}
