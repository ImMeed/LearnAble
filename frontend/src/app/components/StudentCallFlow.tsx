import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  createAssistanceRequest,
  fetchCallRoomStatus,
  fetchActiveTeachers,
  fetchMyAssistanceRequests,
} from "../../api/callApi";
import type { AssistanceRequestItem, TeacherPresenceItem } from "../pages/roleDashboardShared";

const POLL_MS = 6000;
const SCHEDULED_MAX_AGE_MINUTES = 30;

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

  const extractRoomIdFromMeetingUrl = (meetingUrl: string | null): string | null => {
    if (!meetingUrl) return null;
    const match = meetingUrl.match(/\/call\/([^/?#]+)/i);
    return match?.[1] ?? null;
  };

  const isScheduledRequestJoinable = async (request: AssistanceRequestItem): Promise<boolean> => {
    if (request.status !== "SCHEDULED" || !request.meeting_url) return false;

    if (request.scheduled_at) {
      const scheduledMs = new Date(request.scheduled_at).getTime();
      if (!Number.isNaN(scheduledMs)) {
        const ageMinutes = (Date.now() - scheduledMs) / 60_000;
        if (ageMinutes > SCHEDULED_MAX_AGE_MINUTES) return false;
      }
    }

    const roomId = extractRoomIdFromMeetingUrl(request.meeting_url);
    if (!roomId) {
      // External meeting URLs are considered valid.
      return true;
    }

    try {
      const status = await fetchCallRoomStatus(roomId);
      return status.exists;
    } catch {
      // If status check fails (network hiccup), do not force-join stale links.
      return false;
    }
  };

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
      if (items.length === 0) {
        setLatestRequest(null);
        setJoined(false);
        return;
      }

      // Pick the first truly active request.
      let candidate: AssistanceRequestItem | null = null;
      for (const item of items.slice(0, 8)) {
        if (item.status === "REQUESTED") {
          candidate = item;
          break;
        }
        if (item.status === "SCHEDULED" && await isScheduledRequestJoinable(item)) {
          candidate = item;
          break;
        }
      }

      setLatestRequest(candidate);
      if (!candidate) {
        setJoined(false);
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

  // COMPLETED with no meeting_url = teacher rejected (never scheduled a room)
  // COMPLETED with a meeting_url = call actually happened
  const wasRejected =
    latestRequest?.status === "COMPLETED" && !latestRequest.meeting_url;

  return (
    <article className="card checkpoint-block scf-root" aria-label={t("callFlow.sectionLabel")}>
      <h3 className="scf-title">{t("callFlow.sectionTitle")}</h3>

      {/* ── Step 1: request a call ── */}
      {!latestRequest && (
        <section className="scf-step" aria-label={t("callFlow.step1Label")}>
          <button
            type="button"
            className="scf-request-btn"
            disabled={sending || teachers.length === 0}
            onClick={() => void requestCall(0)}
          >
            {sending ? t("callFlow.sending") : t("callFlow.requestCall")}
          </button>
          {teachers.length === 0 && <p className="muted">{t("callFlow.noTeachers")}</p>}
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

      {/* ── Rejected (completed with no meeting_url) ── */}
      {wasRejected && !joined && (
        <section className="scf-step" aria-live="polite">
          <span className="scf-chip scf-chip--completed">
            {t("callFlow.statusRejected")}
          </span>
          <p className="muted scf-hint">{t("callFlow.rejectedHint")}</p>
          <button
            type="button"
            className="secondary scf-new-btn"
            onClick={() => setLatestRequest(null)}
          >
            {t("callFlow.newRequest")}
          </button>
        </section>
      )}

      {/* ── Completed (call actually happened) ── */}
      {latestRequest?.status === "COMPLETED" && !!latestRequest.meeting_url && !joined && (
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
