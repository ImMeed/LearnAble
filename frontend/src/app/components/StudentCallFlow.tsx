import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";

import {
  createAssistanceRequest,
  fetchActiveTeachers,
  fetchMyAssistanceRequests,
} from "../../api/callApi";
import type { AssistanceRequestItem, TeacherPresenceItem } from "../pages/roleDashboardShared";

const POLL_MS = 6000;

function statusChipClass(status: string): string {
  if (status === "SCHEDULED") return "scf-chip scf-chip--scheduled";
  if (status === "COMPLETED") return "scf-chip scf-chip--completed";
  return "scf-chip scf-chip--requested";
}

export function StudentCallFlow({ lang }: { lang?: string }) {
  const { t } = useTranslation();

  const [teachers, setTeachers] = useState<TeacherPresenceItem[]>([]);
  const [latestRequest, setLatestRequest] = useState<AssistanceRequestItem | null>(null);
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [joined, setJoined] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTeachers = async () => {
    try {
      const items = await fetchActiveTeachers(lang);
      setTeachers(items);
    } catch {
      // silently ignore — teachers list is non-critical
    }
  };

  const loadLatestRequest = async () => {
    try {
      const items = await fetchMyAssistanceRequests(lang);
      if (items.length > 0) {
        // backend returns requests ordered by created_at desc — first item is most recent
        setLatestRequest(items[0]);
      }
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    void loadTeachers();
    void loadLatestRequest();

    pollRef.current = setInterval(() => {
      void loadLatestRequest();
    }, POLL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const requestCall = async (index: number) => {
    setSending(true);
    setStatusMsg("");
    try {
      const teacherLabel = t("callFlow.teacherName", { n: index + 1 });
      const req = await createAssistanceRequest(
        t("callFlow.requestTopic"),
        t("callFlow.requestMessage", { teacher: teacherLabel }),
        lang,
      );
      setLatestRequest(req);
      setStatusMsg(t("callFlow.requestSent"));
    } catch {
      setStatusMsg(t("callFlow.requestError"));
    } finally {
      setSending(false);
    }
  };

  const joinCall = () => {
    if (!latestRequest?.meeting_url) return;
    setJoined(true);
    window.open(latestRequest.meeting_url, "_blank", "noopener,noreferrer");
  };

  const hasCallReady =
    latestRequest?.status === "SCHEDULED" && !!latestRequest.meeting_url;

  return (
    <article className="card checkpoint-block scf-root" aria-label={t("callFlow.sectionLabel")}>
      <h3 className="scf-title">{t("callFlow.sectionTitle")}</h3>

      {/* ── Step 1: pick a teacher ── */}
      {!latestRequest && (
        <section className="scf-step" aria-label={t("callFlow.step1Label")}>
          <p className="muted scf-hint">{t("callFlow.pickTeacherHint")}</p>
          {teachers.length === 0 ? (
            <p className="muted">{t("callFlow.noTeachers")}</p>
          ) : (
            <div className="scf-teacher-list">
              {teachers.map((_, i) => (
                <article key={i} className="scf-teacher-card">
                  <span className="scf-teacher-name">
                    {t("callFlow.teacherName", { n: i + 1 })}
                  </span>
                  <span className="scf-online-dot" aria-hidden="true" />
                  <button
                    type="button"
                    className="scf-request-btn"
                    disabled={sending}
                    onClick={() => void requestCall(i)}
                    aria-label={t("callFlow.requestCallAria", { n: i + 1 })}
                  >
                    {sending ? t("callFlow.sending") : t("callFlow.requestCall")}
                  </button>
                </article>
              ))}
            </div>
          )}
          {statusMsg && <p className="scf-status-msg">{statusMsg}</p>}
        </section>
      )}

      {/* ── Step 2: waiting for teacher reply ── */}
      {latestRequest && latestRequest.status === "REQUESTED" && (
        <section className="scf-step" aria-live="polite">
          <div className="scf-request-card">
            <span className={statusChipClass(latestRequest.status)}>
              {t("callFlow.statusRequested")}
            </span>
            <p className="scf-topic">{latestRequest.topic}</p>
            <p className="muted scf-hint">{t("callFlow.waitingHint")}</p>
          </div>
          <button
            type="button"
            className="secondary scf-new-btn"
            onClick={() => setLatestRequest(null)}
          >
            {t("callFlow.newRequest")}
          </button>
        </section>
      )}

      {/* ── Step 3a: call is ready — join ── */}
      {hasCallReady && !joined && (
        <section className="scf-step scf-step--ready" aria-live="assertive">
          <div className="scf-join-banner">
            <span className="scf-join-icon" aria-hidden="true">📹</span>
            <div>
              <p className="scf-join-title">{t("callFlow.callReady")}</p>
              <p className="muted scf-hint">{t("callFlow.callReadyHint")}</p>
            </div>
          </div>
          <button type="button" className="scf-join-btn" onClick={joinCall}>
            {t("callFlow.joinCall")}
          </button>
        </section>
      )}

      {/* ── Step 3b: joined ── */}
      {joined && (
        <section className="scf-step" aria-live="polite">
          <span className={`scf-chip scf-chip--joined`}>{t("callFlow.statusJoined")}</span>
          <p className="muted scf-hint">{t("callFlow.joinedHint")}</p>
          <button
            type="button"
            className="secondary scf-new-btn"
            onClick={() => { setJoined(false); setLatestRequest(null); }}
          >
            {t("callFlow.newRequest")}
          </button>
        </section>
      )}

      {/* ── Rejected / completed ── */}
      {latestRequest && latestRequest.status === "COMPLETED" && !hasCallReady && !joined && (
        <section className="scf-step" aria-live="polite">
          <span className={statusChipClass(latestRequest.status)}>
            {t("callFlow.statusCompleted")}
          </span>
          <p className="muted scf-hint">{t("callFlow.completedHint")}</p>
          <button
            type="button"
            className="secondary scf-new-btn"
            onClick={() => setLatestRequest(null)}
          >
            {t("callFlow.newRequest")}
          </button>
        </section>
      )}
    </article>
  );
}
