import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { actionClass, cx, inputClass, surfaceClass } from "./uiStyles";

export type ReadingLabChildOption = {
  student_user_id: string;
  student_label: string;
  student_age_years: number | null;
  support_status: string;
  progress: {
    completed_sessions: number;
    average_accuracy: number;
    total_rounds_completed: number;
  };
};

export type ReadingLabPlan = {
  status: "INACTIVE" | "ACTIVE" | "PAUSED";
  notes: string;
  focus_targets: string[];
  updated_by_role?: string | null;
  updated_at?: string | null;
};

type SupportManagementCardProps = {
  children: ReadingLabChildOption[];
  selectedStudentId: string;
  plan: ReadingLabPlan | null;
  loading?: boolean;
  showPlanDetails?: boolean;
  onSelectStudent: (studentId: string) => void;
  onSave: (nextPlan: ReadingLabPlan) => Promise<void>;
  onLinkStudent?: (studentLinkId: string) => Promise<void>;
};

const STATUS_ORDER: Array<ReadingLabPlan["status"]> = ["ACTIVE", "PAUSED", "INACTIVE"];

export function SupportManagementCard({
  children,
  selectedStudentId,
  plan,
  loading = false,
  showPlanDetails = true,
  onSelectStudent,
  onSave,
  onLinkStudent,
}: SupportManagementCardProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ReadingLabPlan>({ status: "INACTIVE", notes: "", focus_targets: [] });
  const [targetInput, setTargetInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [saving, setSaving] = useState(false);
  const [linkId, setLinkId] = useState("");
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    setDraft(plan ?? { status: "INACTIVE", notes: "", focus_targets: [] });
    setTargetInput("");
    setStatusMessage("");
    setStatusTone("neutral");
  }, [plan, selectedStudentId]);

  const selectedChild = useMemo(
    () => children.find((item) => item.student_user_id === selectedStudentId) ?? null,
    [children, selectedStudentId],
  );

  const updateDraft = (next: Partial<ReadingLabPlan>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  };

  const addTarget = () => {
    const value = targetInput.trim();
    if (!value) return;
    if (draft.focus_targets.includes(value)) {
      setTargetInput("");
      return;
    }
    updateDraft({ focus_targets: [...draft.focus_targets, value] });
    setTargetInput("");
  };

  const removeTarget = (value: string) => {
    updateDraft({ focus_targets: draft.focus_targets.filter((item) => item !== value) });
  };

  const savePlan = async () => {
    const snapshot = { ...draft, focus_targets: [...draft.focus_targets] };
    setSaving(true);
    setStatusMessage("");
    try {
      await onSave(snapshot);
      setStatusMessage(t("readingLab.planSaved"));
      setStatusTone("success");
    } catch (error) {
      setDraft(snapshot);
      setStatusMessage(`${t("readingLab.saveFailed")} ${String(error)}`);
      setStatusTone("error");
    } finally {
      setSaving(false);
    }
  };

  const linkStudent = async () => {
    if (!onLinkStudent) return;
    const studentLinkId = linkId.trim().toUpperCase();
    if (!studentLinkId) return;
    setLinking(true);
    setStatusMessage("");
    try {
      await onLinkStudent(studentLinkId);
      setLinkId("");
      setStatusMessage(t("readingLab.linkStudentSuccess"));
      setStatusTone("success");
    } catch (error) {
      setStatusMessage(`${t("readingLab.linkStudentFailed")} ${String(error)}`);
      setStatusTone("error");
    } finally {
      setLinking(false);
    }
  };

  return (
    <article className={cx(surfaceClass, "p-5 sm:p-6")}>
      <div className="section-title-row">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{t("readingLab.manageTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("readingLab.manageSubtitle")}</p>
        </div>
      </div>

      <div className="stack-form checkpoint-block">
        {onLinkStudent ? (
          <label>
            <span>{t("readingLab.linkStudentLabel")}</span>
            <div className="inline-actions">
              <input
                className={cx(inputClass, "max-w-xs")}
                type="text"
                value={linkId}
                onChange={(event) => setLinkId(event.target.value.toUpperCase())}
                placeholder={t("readingLab.linkStudentPlaceholder")}
                disabled={loading || linking}
              />
              <button
                type="button"
                className={actionClass("soft")}
                onClick={() => void linkStudent()}
                disabled={!linkId.trim() || loading || linking}
              >
                {linking ? t("login.pleaseWait") : t("readingLab.linkStudent")}
              </button>
            </div>
          </label>
        ) : null}

        <label>
          <span>{t("readingLab.selectChild")}</span>
          <select
            className={inputClass}
            value={selectedStudentId}
            onChange={(event) => onSelectStudent(event.target.value)}
            disabled={children.length === 0}
          >
            {children.length === 0 ? <option value="">{t("readingLab.noLinkedChildren")}</option> : null}
            {children.map((child) => (
              <option value={child.student_user_id} key={child.student_user_id}>
                {child.student_label}
              </option>
            ))}
          </select>
        </label>

        {selectedChild ? (
          <div className="metrics-grid">
            <article className="card metric-pill">
              <p>{t("readingLab.completedSessions")}</p>
              <strong>{selectedChild.progress.completed_sessions}</strong>
            </article>
            <article className="card metric-pill">
              <p>{t("readingLab.averageAccuracy")}</p>
              <strong>{selectedChild.progress.average_accuracy}%</strong>
            </article>
            <article className="card metric-pill">
              <p>{t("readingLab.totalRounds")}</p>
              <strong>{selectedChild.progress.total_rounds_completed}</strong>
            </article>
          </div>
        ) : null}

        <div className="inline-actions">
          {STATUS_ORDER.map((status) => (
            <button
              type="button"
              key={status}
              className={draft.status === status ? actionClass() : actionClass("soft")}
              onClick={() => updateDraft({ status })}
              disabled={!selectedChild}
            >
              {t(
                status === "ACTIVE"
                  ? "readingLab.statusActive"
                  : status === "PAUSED"
                    ? "readingLab.statusPaused"
                    : "readingLab.statusInactive",
              )}
            </button>
          ))}
        </div>

        {showPlanDetails ? (
          <>
            <label>
              <span>{t("readingLab.notes")}</span>
              <textarea
                className={cx(inputClass, "!min-h-28 !py-3")}
                rows={4}
                value={draft.notes}
                onChange={(event) => updateDraft({ notes: event.target.value })}
                disabled={!selectedChild || loading}
              />
            </label>

            <div>
              <span className="mb-2 block text-sm font-semibold text-foreground">{t("readingLab.focusTargets")}</span>
              <div className="inline-actions">
                <input
                  className={cx(inputClass, "max-w-xs")}
                  value={targetInput}
                  onChange={(event) => setTargetInput(event.target.value)}
                  placeholder={t("readingLab.targetPlaceholder")}
                  disabled={!selectedChild || loading}
                />
                <button type="button" className={actionClass("soft")} onClick={addTarget} disabled={!selectedChild || !targetInput.trim()}>
                  {t("readingLab.addTarget")}
                </button>
              </div>
              <div className="stack-list">
                {draft.focus_targets.length > 0 ? (
                  <div className="inline-actions">
                    {draft.focus_targets.map((target) => (
                      <span className="status-chip" key={target}>
                        {target}
                        <button
                          type="button"
                          className="!ml-2 !min-h-0 !border-0 !bg-transparent !p-0 !text-current shadow-none"
                          onClick={() => removeTarget(target)}
                          aria-label={`${t("readingLab.removeTile")} ${target}`}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="muted">{t("readingLab.notesEmpty")}</p>
                )}
              </div>
            </div>
          </>
        ) : null}

        <div className="inline-actions">
          <button type="button" className={actionClass()} onClick={() => void savePlan()} disabled={!selectedChild || saving || loading}>
            {saving ? t("login.pleaseWait") : t("readingLab.savePlan")}
          </button>
        </div>
      </div>

      {statusMessage ? (
        <p
          className={cx(
            "mt-4 rounded-[1rem] border px-4 py-3 text-sm leading-6",
            statusTone === "error"
              ? "border-destructive bg-destructive/10 text-foreground"
              : statusTone === "success"
                ? "border-secondary bg-secondary/10 text-foreground"
                : "border-border bg-background text-muted-foreground",
          )}
        >
          {statusMessage}
        </p>
      ) : null}
    </article>
  );
}
