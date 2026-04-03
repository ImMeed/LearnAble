import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { SessionPanel } from "../../features/dev/SessionPanel";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

type ForumReportItem = {
  id: string;
  target_type: "POST" | "COMMENT";
  target_id: string;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  reason: string;
};

type NotificationsPayload =
  | { items?: NotificationItem[] }
  | NotificationItem[];

function normalizeNotifications(payload: NotificationsPayload | undefined): NotificationItem[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload.items) ? payload.items : [];
}

export function PhaseCheckpointPage() {
  const { i18n } = useTranslation();
  const [status, setStatus] = useState<string>("Idle");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [lessonId, setLessonId] = useState("");
  const [assistanceTopic, setAssistanceTopic] = useState("Need one-to-one support");
  const [assistanceMessage, setAssistanceMessage] = useState("Please help me with the latest lesson section.");

  const [studentId, setStudentId] = useState("");
  const [supportLevel, setSupportLevel] = useState("MEDIUM");
  const [supportNotes, setSupportNotes] = useState("Structured educational support approved.");
  const [psychReview, setPsychReview] = useState<string>("");

  const [spaceSlug, setSpaceSlug] = useState("checkpoint-space");
  const [spaceNameAr, setSpaceNameAr] = useState("مساحة نقطة التحقق");
  const [spaceNameEn, setSpaceNameEn] = useState("Checkpoint Space");
  const [spaceId, setSpaceId] = useState("");

  const [postTitle, setPostTitle] = useState("Checkpoint forum post");
  const [postContent, setPostContent] = useState("Testing forum flow from checkpoint page.");
  const [postId, setPostId] = useState("");
  const [reportReason, setReportReason] = useState("Needs moderator review.");
  const [forumReports, setForumReports] = useState<ForumReportItem[]>([]);

  const requestConfig = {
    headers: {
      "x-lang": i18n.resolvedLanguage === "en" ? "en" : "ar",
    },
  };

  const loadNotifications = async () => {
    try {
      const response = await apiClient.get<NotificationsPayload>("/notifications", requestConfig);
      const nextItems = normalizeNotifications(response.data);
      setNotifications(nextItems);
      setStatus(`Loaded ${nextItems.length} notifications.`);
    } catch (error) {
      setNotifications([]);
      setStatus(`Notifications load failed: ${String(error)}`);
    }
  };

  useEffect(() => {
    void loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markRead = async (notificationId: string) => {
    try {
      await apiClient.patch(`/notifications/${notificationId}/read`, {}, requestConfig);
      await loadNotifications();
    } catch (error) {
      setStatus(`Mark read failed: ${String(error)}`);
    }
  };

  const submitAssistance = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await apiClient.post(
        "/teacher/assistance/requests",
        {
          lesson_id: lessonId.trim() || null,
          topic: assistanceTopic,
          message: assistanceMessage,
        },
        requestConfig,
      );
      setStatus("Assistance request submitted.");
    } catch (error) {
      setStatus(`Assistance request failed: ${String(error)}`);
    }
  };

  const runPsychReview = async () => {
    if (!studentId.trim()) {
      setStatus("Student ID is required for psychologist review.");
      return;
    }
    try {
      const response = await apiClient.get(`/psychologist/reviews/students/${studentId.trim()}`, requestConfig);
      setPsychReview(JSON.stringify(response.data, null, 2));
      setStatus("Psychologist review loaded.");
    } catch (error) {
      setPsychReview("");
      setStatus(`Psychologist review failed: ${String(error)}`);
    }
  };

  const confirmSupport = async (event: FormEvent) => {
    event.preventDefault();
    if (!studentId.trim()) {
      setStatus("Student ID is required to confirm support.");
      return;
    }
    try {
      const response = await apiClient.post(
        `/psychologist/support/${studentId.trim()}/confirm`,
        {
          support_level: supportLevel,
          notes: supportNotes,
        },
        requestConfig,
      );
      setStatus(`Support confirmed. Parent notifications sent: ${response.data.parent_notifications_sent}`);
    } catch (error) {
      setStatus(`Support confirmation failed: ${String(error)}`);
    }
  };

  const createSpace = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await apiClient.post(
        "/forum/spaces",
        {
          slug: `${spaceSlug.trim()}-${Date.now().toString().slice(-5)}`,
          name_ar: spaceNameAr,
          name_en: spaceNameEn,
          description_ar: "مساحة تجريبية لاختبار تدفقات المنتدى",
          description_en: "Temporary space for forum flow checks",
        },
        requestConfig,
      );
      setSpaceId(response.data.id);
      setStatus(`Forum space created: ${response.data.id}`);
    } catch (error) {
      setStatus(`Create space failed: ${String(error)}`);
    }
  };

  const createPost = async (event: FormEvent) => {
    event.preventDefault();
    if (!spaceId.trim()) {
      setStatus("Space ID is required to create a post.");
      return;
    }
    try {
      const response = await apiClient.post(
        `/forum/spaces/${spaceId.trim()}/posts`,
        {
          title: postTitle,
          content: postContent,
        },
        requestConfig,
      );
      setPostId(response.data.id);
      setStatus(`Forum post created: ${response.data.id}`);
    } catch (error) {
      setStatus(`Create post failed: ${String(error)}`);
    }
  };

  const votePost = async () => {
    if (!postId.trim()) {
      setStatus("Post ID is required to vote.");
      return;
    }
    try {
      const response = await apiClient.post(
        "/forum/votes",
        {
          target_type: "POST",
          target_id: postId.trim(),
          value: 1,
        },
        requestConfig,
      );
      setStatus(`Vote submitted. Upvotes: ${response.data.upvotes}`);
    } catch (error) {
      setStatus(`Vote failed: ${String(error)}`);
    }
  };

  const reportPost = async () => {
    if (!postId.trim()) {
      setStatus("Post ID is required to report.");
      return;
    }
    try {
      const response = await apiClient.post(
        "/forum/reports",
        {
          target_type: "POST",
          target_id: postId.trim(),
          reason: reportReason,
        },
        requestConfig,
      );
      setStatus(`Report submitted: ${response.data.id}`);
      await loadForumReports();
    } catch (error) {
      setStatus(`Report failed: ${String(error)}`);
    }
  };

  const loadForumReports = async () => {
    try {
      const response = await apiClient.get<{ items?: ForumReportItem[] }>("/forum/reports", requestConfig);
      const items = Array.isArray(response.data.items) ? response.data.items : [];
      setForumReports(items);
      setStatus(`Loaded ${items.length} forum reports.`);
    } catch (error) {
      setForumReports([]);
      setStatus(`Load reports failed: ${String(error)}`);
    }
  };

  const moderateReport = async (reportId: string, action: "HIDE" | "RESTORE" | "REMOVE" | "DISMISS") => {
    try {
      await apiClient.post(
        `/forum/reports/${reportId}/moderate`,
        {
          action,
          review_notes: "Checkpoint moderation action",
        },
        requestConfig,
      );
      await loadForumReports();
      setStatus(`Report ${reportId} moderated with action ${action}.`);
    } catch (error) {
      setStatus(`Moderation failed: ${String(error)}`);
    }
  };

  return (
    <main className="page">
      <section className="card">
        <h1>Phase Checkpoint</h1>
        <p className="muted">Thin integration UI for Phase 6/7 endpoints.</p>
        <p className="status-line">Status: {status}</p>
      </section>

      <SessionPanel onSessionChanged={() => void loadNotifications()} />

      <section className="card checkpoint-block">
        <h3>Notifications</h3>
        <div className="inline-actions">
          <button type="button" onClick={() => void loadNotifications()}>
            Refresh Notifications
          </button>
        </div>
        <div className="stack-list">
          {(notifications ?? []).map((item) => (
            <article key={item.id} className="notification-item">
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <div className="inline-actions">
                <span className="muted">{item.type}</span>
                <span className="muted">{item.is_read ? "Read" : "Unread"}</span>
                {!item.is_read ? (
                  <button type="button" onClick={() => void markRead(item.id)}>
                    Mark Read
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card checkpoint-block">
        <h3>Student Assistance Request</h3>
        <form onSubmit={submitAssistance} className="stack-form">
          <label>
            Lesson ID (optional)
            <input value={lessonId} onChange={(event) => setLessonId(event.target.value)} placeholder="lesson UUID" />
          </label>
          <label>
            Topic
            <input value={assistanceTopic} onChange={(event) => setAssistanceTopic(event.target.value)} />
          </label>
          <label>
            Message
            <textarea value={assistanceMessage} onChange={(event) => setAssistanceMessage(event.target.value)} rows={3} />
          </label>
          <button type="submit">Submit Assistance Request</button>
        </form>
      </section>

      <section className="card checkpoint-block">
        <h3>Psychologist Review and Confirm</h3>
        <div className="stack-form">
          <label>
            Student ID
            <input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="student UUID" />
          </label>
          <div className="inline-actions">
            <button type="button" onClick={() => void runPsychReview()}>
              Load Review
            </button>
          </div>
          <pre className="json-box">{psychReview || "No review loaded yet."}</pre>
          <form onSubmit={confirmSupport} className="stack-form">
            <label>
              Support Level
              <input value={supportLevel} onChange={(event) => setSupportLevel(event.target.value)} />
            </label>
            <label>
              Notes
              <textarea value={supportNotes} onChange={(event) => setSupportNotes(event.target.value)} rows={3} />
            </label>
            <button type="submit">Confirm Support</button>
          </form>
        </div>
      </section>

      <section className="card checkpoint-block">
        <h3>Phase 8 Forum Checkpoint</h3>
        <form onSubmit={createSpace} className="stack-form">
          <label>
            Space Slug Prefix
            <input value={spaceSlug} onChange={(event) => setSpaceSlug(event.target.value)} />
          </label>
          <label>
            Space Name (AR)
            <input value={spaceNameAr} onChange={(event) => setSpaceNameAr(event.target.value)} />
          </label>
          <label>
            Space Name (EN)
            <input value={spaceNameEn} onChange={(event) => setSpaceNameEn(event.target.value)} />
          </label>
          <button type="submit">Create Space (Admin)</button>
        </form>

        <form onSubmit={createPost} className="stack-form checkpoint-block">
          <label>
            Space ID
            <input value={spaceId} onChange={(event) => setSpaceId(event.target.value)} placeholder="forum space UUID" />
          </label>
          <label>
            Post Title
            <input value={postTitle} onChange={(event) => setPostTitle(event.target.value)} />
          </label>
          <label>
            Post Content
            <textarea value={postContent} onChange={(event) => setPostContent(event.target.value)} rows={3} />
          </label>
          <button type="submit">Create Post (Student/Tutor)</button>
        </form>

        <div className="stack-form checkpoint-block">
          <label>
            Post ID
            <input value={postId} onChange={(event) => setPostId(event.target.value)} placeholder="forum post UUID" />
          </label>
          <label>
            Report Reason
            <input value={reportReason} onChange={(event) => setReportReason(event.target.value)} />
          </label>
          <div className="inline-actions">
            <button type="button" onClick={() => void votePost()}>
              Upvote Post
            </button>
            <button type="button" onClick={() => void reportPost()}>
              Report Post
            </button>
            <button type="button" onClick={() => void loadForumReports()}>
              Load Reports (Tutor/Admin)
            </button>
          </div>
        </div>

        <div className="stack-list checkpoint-block">
          {forumReports.map((item) => (
            <article className="notification-item" key={item.id}>
              <strong>{item.id}</strong>
              <p>
                {item.target_type} / {item.status}
              </p>
              <p>{item.reason}</p>
              <div className="inline-actions">
                <button type="button" onClick={() => void moderateReport(item.id, "HIDE")}>
                  Hide
                </button>
                <button type="button" onClick={() => void moderateReport(item.id, "RESTORE")}>
                  Restore
                </button>
                <button type="button" onClick={() => void moderateReport(item.id, "DISMISS")} className="secondary">
                  Dismiss
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
