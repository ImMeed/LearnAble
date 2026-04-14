import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  type ForumComment,
  type ForumPost,
  type ForumReport,
  type ForumSpace,
  type ModerationAction,
  castVote,
  createComment,
  createPost,
  listComments,
  listOpenReports,
  listPosts,
  listSpaces,
  moderateReport,
  reportTarget,
} from "../../api/forumApi";
import { getSession } from "../../state/auth";
import { AccessibilityToolbar } from "../components/AccessibilityToolbar";
import { BrandLogo } from "../components/BrandLogo";

type View = "spaces" | "posts" | "detail";

type ReportTarget = { type: "POST" | "COMMENT"; id: string } | null;

const REPORT_REASONS = [
  { value: "offensive_content", label: "Offensive or hateful content" },
  { value: "sexual_content", label: "Sexual or inappropriate content" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "spam", label: "Spam or repeated posting" },
  { value: "off_topic", label: "Off-topic / not related to learning" },
  { value: "other", label: "Other" },
];

function shortId(uuid: string) {
  return uuid.slice(0, 8);
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function readApiError(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const payload = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof payload === "object" && payload && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      if (typeof detail === "object" && detail && "message" in detail) {
        return String((detail as { message?: unknown }).message);
      }
      if (typeof detail === "string") return detail;
    }
  }
  return "Something went wrong.";
}

// ── Vote row ──────────────────────────────────────────────────────────────────

function VoteRow({
  targetType,
  targetId,
  upvotes,
  downvotes,
  onVoted,
}: {
  targetType: "POST" | "COMMENT";
  targetId: string;
  upvotes: number;
  downvotes: number;
  onVoted: (up: number, down: number) => void;
}) {
  const [busy, setBusy] = useState(false);

  const vote = async (value: 1 | -1) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await castVote(targetType, targetId, value);
      onVoted(res.upvotes, res.downvotes);
    } finally {
      setBusy(false);
    }
  };

  const score = upvotes - downvotes;

  return (
    <div className="forum-vote-row">
      <button type="button" className="forum-vote-btn" onClick={() => void vote(1)} disabled={busy} title="Upvote">
        ▲
      </button>
      <span className={`forum-score ${score > 0 ? "forum-score-pos" : score < 0 ? "forum-score-neg" : ""}`}>
        {score}
      </span>
      <button type="button" className="forum-vote-btn" onClick={() => void vote(-1)} disabled={busy} title="Downvote">
        ▼
      </button>
    </div>
  );
}

// ── Report modal ──────────────────────────────────────────────────────────────

function ReportModal({
  target,
  onClose,
  onSubmitted,
}: {
  target: ReportTarget;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0].value);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!target) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fullReason = details.trim() ? `${reason}: ${details.trim()}` : reason;
      await reportTarget(target.type, target.id, fullReason);
      onSubmitted();
      onClose();
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="forum-modal-backdrop" onClick={onClose}>
      <div className="forum-modal" onClick={(e) => e.stopPropagation()}>
        <div className="forum-modal-header">
          <h3>Report {target.type === "POST" ? "Post" : "Comment"}</h3>
          <button type="button" className="forum-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="forum-modal-body">
          <p className="forum-modal-desc">
            Help us keep the forum safe. Select the reason for your report:
          </p>
          <div className="forum-reason-list">
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className={`forum-reason-option ${reason === r.value ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                />
                {r.label}
              </label>
            ))}
          </div>
          <textarea
            className="forum-report-details"
            placeholder="Additional details (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            rows={3}
          />
          {error && <p className="forum-error">{error}</p>}
          <div className="forum-modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-danger" disabled={busy}>
              {busy ? "Submitting…" : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Moderation panel (teacher only) ──────────────────────────────────────────

function ModerationPanel() {
  const [reports, setReports] = useState<ForumReport[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setReports(await listOpenReports());
    } catch {
      // non-critical
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const act = async (reportId: string, action: ModerationAction) => {
    setBusy(reportId);
    setError("");
    try {
      await moderateReport(reportId, action);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy(null);
    }
  };

  if (reports.length === 0) return null;

  return (
    <div className="forum-mod-panel">
      <button
        type="button"
        className="forum-mod-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        🚨 {reports.length} Open Report{reports.length !== 1 ? "s" : ""} {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="forum-mod-list">
          {error && <p className="forum-error">{error}</p>}
          {reports.map((r) => (
            <div key={r.id} className="forum-mod-item">
              <div className="forum-mod-meta">
                <span className="forum-mod-type">{r.target_type}</span>
                <span className="forum-mod-reason">{r.reason}</span>
                <span className="forum-muted">reported {timeAgo(r.created_at)}</span>
              </div>
              <div className="forum-mod-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy === r.id}
                  onClick={() => void act(r.id, "DISMISS")}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy === r.id}
                  onClick={() => void act(r.id, "HIDE")}
                >
                  Hide
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busy === r.id}
                  onClick={() => void act(r.id, "REMOVE")}
                >
                  Remove
                </button>
                {r.target_type === "POST" && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy === r.id}
                    onClick={() => void act(r.id, "LOCK")}
                  >
                    Lock
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ForumPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const prefix = i18n.resolvedLanguage === "en" ? "/en" : "/ar";
  const session = getSession();
  const isTeacher = session?.role === "ROLE_TUTOR";
  const canComment = session?.role === "ROLE_STUDENT" || session?.role === "ROLE_TUTOR";

  const [view, setView] = useState<View>("spaces");
  const [spaces, setSpaces] = useState<ForumSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<ForumSpace | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);

  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const [newComment, setNewComment] = useState("");

  const [reportTarget, setReportTarget] = useState<ReportTarget>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");

  // Load spaces on mount
  useEffect(() => {
    listSpaces()
      .then(setSpaces)
      .catch(() => setError("Failed to load forum spaces."));
  }, []);

  const openSpace = async (space: ForumSpace) => {
    setError("");
    setSelectedSpace(space);
    setView("posts");
    try {
      const data = await listPosts(space.id);
      setPosts(data);
    } catch {
      setError("Failed to load posts.");
    }
  };

  const openPost = async (post: ForumPost) => {
    setError("");
    setSelectedPost(post);
    setView("detail");
    try {
      const data = await listComments(post.id);
      setComments(data);
    } catch {
      setError("Failed to load comments.");
    }
  };

  const submitPost = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSpace || !newPostTitle.trim() || !newPostContent.trim()) return;
    setBusy(true);
    setError("");
    try {
      const post = await createPost(selectedSpace.id, newPostTitle.trim(), newPostContent.trim());
      setPosts((prev) => [post, ...prev]);
      setNewPostTitle("");
      setNewPostContent("");
      setShowNewPostForm(false);
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPost || !newComment.trim()) return;
    setBusy(true);
    setCommentError("");
    try {
      const comment = await createComment(selectedPost.id, newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment("");
    } catch (err) {
      setCommentError(readApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const dashboardPath =
    session?.role === "ROLE_TUTOR"
      ? `${prefix}/teacher/dashboard`
      : session?.role === "ROLE_ADMIN"
        ? `${prefix}/admin/dashboard`
        : `${prefix}/student/dashboard`;

  return (
    <main className="page forum-page">
      {/* Header */}
      <section className="card forum-header">
        <div className="portal-brand">
          <BrandLogo className="brand-icon" />
          <div>
            <h1>{t("appTitle")}</h1>
            <p className="muted">Forum</p>
          </div>
        </div>
        <div className="dashboard-header-actions">
          <AccessibilityToolbar />
          <Link className="secondary-link" to={dashboardPath}>
            {t("common.back")}
          </Link>
        </div>
      </section>

      {/* Breadcrumb */}
      <nav className="forum-breadcrumb">
        <button type="button" className="forum-crumb" onClick={() => setView("spaces")}>
          Forum
        </button>
        {selectedSpace && (
          <>
            <span className="forum-crumb-sep">/</span>
            <button
              type="button"
              className="forum-crumb"
              onClick={() => { setView("posts"); setSelectedPost(null); }}
            >
              {selectedSpace.name}
            </button>
          </>
        )}
        {selectedPost && (
          <>
            <span className="forum-crumb-sep">/</span>
            <span className="forum-crumb forum-crumb-active">{selectedPost.title}</span>
          </>
        )}
      </nav>

      {/* Teacher moderation panel */}
      {isTeacher && <ModerationPanel />}

      {error && <p className="forum-error forum-page-error">{error}</p>}

      {/* ── Spaces view ── */}
      {view === "spaces" && (
        <section className="forum-section">
          <div className="forum-section-head">
            <h2 className="forum-section-title">Choose a Space</h2>
          </div>
          {spaces.length === 0 ? (
            <p className="forum-empty">No spaces available yet.</p>
          ) : (
            <div className="forum-spaces-grid">
              {spaces.map((space) => (
                <button
                  key={space.id}
                  type="button"
                  className="forum-space-card"
                  onClick={() => void openSpace(space)}
                >
                  <span className="forum-space-icon">💬</span>
                  <span className="forum-space-name">{space.name}</span>
                  <span className="forum-space-desc">{space.description}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Posts view ── */}
      {view === "posts" && selectedSpace && (
        <section className="forum-section">
          <div className="forum-section-head">
            <h2 className="forum-section-title">{selectedSpace.name}</h2>
            <button
              type="button"
              onClick={() => setShowNewPostForm((v) => !v)}
            >
              {showNewPostForm ? "Cancel" : "+ New Post"}
            </button>
          </div>

          {showNewPostForm && (
            <form className="forum-new-post-form" onSubmit={(e) => void submitPost(e)}>
              <input
                type="text"
                placeholder="Post title…"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                maxLength={220}
                required
              />
              <textarea
                placeholder="What's on your mind?"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                maxLength={4000}
                rows={5}
                required
              />
              <div className="forum-form-actions">
                <button type="submit" disabled={busy || !newPostTitle.trim() || !newPostContent.trim()}>
                  {busy ? "Posting…" : "Post"}
                </button>
              </div>
            </form>
          )}

          {posts.length === 0 ? (
            <p className="forum-empty">No posts yet. Be the first to post!</p>
          ) : (
            <div className="forum-post-list">
              {posts.map((post) => (
                <div key={post.id} className="forum-post-card">
                  <VoteRow
                    targetType="POST"
                    targetId={post.id}
                    upvotes={post.upvotes}
                    downvotes={post.downvotes}
                    onVoted={(up, down) =>
                      setPosts((prev) =>
                        prev.map((p) => (p.id === post.id ? { ...p, upvotes: up, downvotes: down } : p)),
                      )
                    }
                  />
                  <div className="forum-post-body">
                    <button
                      type="button"
                      className="forum-post-title"
                      onClick={() => void openPost(post)}
                    >
                      {post.title}
                    </button>
                    <p className="forum-post-excerpt">
                      {post.content.length > 160 ? `${post.content.slice(0, 160)}…` : post.content}
                    </p>
                    <div className="forum-post-meta">
                      <span>by @{shortId(post.author_user_id)}</span>
                      <span>{timeAgo(post.created_at)}</span>
                      {post.is_locked && <span className="forum-badge-locked">🔒 locked</span>}
                      <button
                        type="button"
                        className="forum-post-reply-btn"
                        onClick={() => void openPost(post)}
                        title="Reply to this post"
                      >
                        💬 Reply
                      </button>
                      <button
                        type="button"
                        className="forum-report-btn"
                        onClick={() => setReportTarget({ type: "POST", id: post.id })}
                        title="Report post"
                      >
                        ⚑ Report
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Post detail view ── */}
      {view === "detail" && selectedPost && (
        <section className="forum-section">
          {/* Post */}
          <div className="forum-post-detail card">
            <div className="forum-detail-vote-row">
              <VoteRow
                targetType="POST"
                targetId={selectedPost.id}
                upvotes={selectedPost.upvotes}
                downvotes={selectedPost.downvotes}
                onVoted={(up, down) => setSelectedPost((p) => p ? { ...p, upvotes: up, downvotes: down } : p)}
              />
            </div>
            <div className="forum-detail-content">
              <h2 className="forum-detail-title">{selectedPost.title}</h2>
              <div className="forum-post-meta">
                <span>by @{shortId(selectedPost.author_user_id)}</span>
                <span>{timeAgo(selectedPost.created_at)}</span>
                {selectedPost.is_locked && <span className="forum-badge-locked">🔒 locked</span>}
                <button
                  type="button"
                  className="forum-report-btn"
                  onClick={() => setReportTarget({ type: "POST", id: selectedPost.id })}
                >
                  ⚑ Report
                </button>
              </div>
              <p className="forum-detail-body">{selectedPost.content}</p>
            </div>
          </div>

          {/* Comments */}
          <div className="forum-comments-section">
            <h3 className="forum-comments-title">
              {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
            </h3>

            {comments.map((comment) => (
              <div key={comment.id} className="forum-comment-card">
                <VoteRow
                  targetType="COMMENT"
                  targetId={comment.id}
                  upvotes={comment.upvotes}
                  downvotes={comment.downvotes}
                  onVoted={(up, down) =>
                    setComments((prev) =>
                      prev.map((c) => (c.id === comment.id ? { ...c, upvotes: up, downvotes: down } : c)),
                    )
                  }
                />
                <div className="forum-comment-body">
                  <p className="forum-comment-content">{comment.content}</p>
                  <div className="forum-post-meta">
                    <span>by @{shortId(comment.author_user_id)}</span>
                    <span>{timeAgo(comment.created_at)}</span>
                    <button
                      type="button"
                      className="forum-report-btn"
                      onClick={() => setReportTarget({ type: "COMMENT", id: comment.id })}
                    >
                      ⚑ Report
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div className="forum-reply-section">
              <p className="forum-reply-heading">Write a Reply</p>
              {selectedPost.is_locked ? (
                <p className="forum-locked-notice">🔒 This post is locked. No new comments.</p>
              ) : !canComment ? (
                <p className="forum-locked-notice">Only students and teachers can post replies.</p>
              ) : (
                <form className="forum-comment-form" onSubmit={(e) => void submitComment(e)}>
                  <textarea
                    placeholder="Share your thoughts…"
                    value={newComment}
                    onChange={(e) => { setNewComment(e.target.value); setCommentError(""); }}
                    maxLength={2000}
                    rows={4}
                    required
                  />
                  {commentError && <p className="forum-comment-error">{commentError}</p>}
                  <button type="submit" disabled={busy || !newComment.trim()}>
                    {busy ? "Posting…" : "Post Reply"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Report modal */}
      {reportTarget && (
        <ReportModal
          target={reportTarget}
          onClose={() => setReportTarget(null)}
          onSubmitted={() => setReportTarget(null)}
        />
      )}
    </main>
  );
}
