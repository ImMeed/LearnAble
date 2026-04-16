import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import {
  createForumPost,
  createForumReply,
  getForumPostDetail,
  listForumPosts,
  setForumPostPin,
  type ForumCategory,
  type ForumFeedPostItem,
  type ForumReplyItem,
} from "../../api/forumApi";
import { getSession } from "../../state/auth";
import { PublicHeader } from "../components/PublicHeader";
import { actionClass, cx, inputClass, pageShellClass, sectionFrameClass, surfaceClass } from "../components/uiStyles";

const PAGE_SIZE = 10;

const CATEGORIES: ForumCategory[] = ["tips", "ask", "resources"];

function mapRole(role: string | undefined): string {
  if (!role) return "guest";
  if (role === "ROLE_TUTOR") return "tutor";
  if (role === "ROLE_PARENT") return "parent";
  if (role === "ROLE_PSYCHOLOGIST") return "psychologist";
  if (role === "ROLE_ADMIN") return "admin";
  return "student";
}

function allowsCategory(role: string, category: ForumCategory): boolean {
  if (role === "student") return category === "ask";
  if (role === "parent") return category === "tips" || category === "ask";
  if (role === "tutor" || role === "psychologist") return true;
  return false;
}

function canPin(role: string): boolean {
  return role === "tutor" || role === "psychologist";
}

function relativeTimeLabel(value: string, locale: "ar" | "en"): string {
  const then = Date.parse(value);
  if (Number.isNaN(then)) return value;
  const deltaSeconds = Math.round((then - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale === "en" ? "en" : "ar", { numeric: "auto" });

  const abs = Math.abs(deltaSeconds);
  if (abs < 60) return formatter.format(deltaSeconds, "second");
  if (abs < 3600) return formatter.format(Math.round(deltaSeconds / 60), "minute");
  if (abs < 86400) return formatter.format(Math.round(deltaSeconds / 3600), "hour");
  return formatter.format(Math.round(deltaSeconds / 86400), "day");
}

type ForumPageProps = {
  embedded?: boolean;
};

export function ForumPage({ embedded = false }: ForumPageProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale: "ar" | "en" = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const prefix = locale === "en" ? "/en" : "/ar";
  const session = getSession();
  const role = mapRole(session?.role);

  const forumText = (key: string, options?: Record<string, unknown>) => t(`dashboards.forum.${key}`, options);

  const [category, setCategory] = useState<ForumCategory>(role === "student" ? "ask" : "tips");
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<ForumFeedPostItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPosts, setTotalPosts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [selectedPostId, setSelectedPostId] = useState<string>("");
  const [replies, setReplies] = useState<ForumReplyItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [submittingPost, setSubmittingPost] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);

  const selectedPost = useMemo(() => posts.find((item) => item.id === selectedPostId) ?? null, [posts, selectedPostId]);

  const canWriteSelectedCategory = allowsCategory(role, category);
  const canPinPosts = canPin(role);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listForumPosts({ category, page, pageSize: PAGE_SIZE, locale });
      setPosts(data.items);
      setTotalPages(data.total_pages || 1);
      setTotalPosts(data.total || 0);
      if (data.items.length > 0) {
        setSelectedPostId((current) => (data.items.some((item) => item.id === current) ? current : data.items[0].id));
      }
      if (data.items.length === 0) {
        setSelectedPostId("");
        setReplies([]);
      }
    } catch (loadError) {
      setError(forumText("errors.loadFailed"));
      void loadError;
    } finally {
      setLoading(false);
    }
  }, [category, locale, page, t]);

  const loadPostDetail = useCallback(
    async (postId: string) => {
      setDetailLoading(true);
      try {
        const data = await getForumPostDetail({ postId, locale });
        setReplies(data.replies);
      } catch {
        setReplies([]);
      } finally {
        setDetailLoading(false);
      }
    },
    [locale],
  );

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!selectedPostId) {
      setReplies([]);
      return;
    }
    void loadPostDetail(selectedPostId);
  }, [loadPostDetail, selectedPostId]);

  const onCategoryChange = (next: ForumCategory) => {
    setCategory(next);
    setPage(1);
    setSelectedPostId("");
  };

  const onCreatePost = async () => {
    const title = draftTitle.trim();
    const content = draftBody.trim();
    if (title.length < 3 || content.length < 3) {
      setError(forumText("errors.validation"));
      return;
    }
    setSubmittingPost(true);
    setError("");
    try {
      await createForumPost({ category, title, content, locale });
      setDraftTitle("");
      setDraftBody("");
      await loadPosts();
    } catch {
      setError(forumText("errors.createFailed"));
    } finally {
      setSubmittingPost(false);
    }
  };

  const onCreateReply = async () => {
    if (!selectedPostId) return;
    const content = replyBody.trim();
    if (content.length < 2) {
      setError(forumText("errors.validation"));
      return;
    }
    setSubmittingReply(true);
    setError("");
    try {
      await createForumReply({ postId: selectedPostId, content, locale });
      setReplyBody("");
      await loadPostDetail(selectedPostId);
      await loadPosts();
    } catch {
      setError(forumText("errors.replyFailed"));
    } finally {
      setSubmittingReply(false);
    }
  };

  const onTogglePin = async (post: ForumFeedPostItem) => {
    if (!canPinPosts) return;
    try {
      await setForumPostPin({ postId: post.id, isPinned: !post.is_pinned, locale });
      await loadPosts();
      if (selectedPostId) {
        await loadPostDetail(selectedPostId);
      }
    } catch {
      setError(forumText("errors.pinFailed"));
    }
  };

  const forumContent = (
    <section className={cx("forum-page", embedded ? "forum-page-embedded" : "")}> 
      <header className={cx(surfaceClass, "forum-toolbar")}> 
        <div className="forum-toolbar-row">
          <h2>{forumText("title")}</h2>
          {!embedded ? (
            <button type="button" className={actionClass("soft")} onClick={() => navigate(`${prefix}/home`)}>
              {t("common.back")}
            </button>
          ) : null}
        </div>
        <p className="muted">{forumText("subtitle")}</p>
        <div className="forum-category-tabs" role="tablist" aria-label={forumText("categoriesLabel")}>
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              className={cx("forum-category-tab", item === category && "is-active")}
              onClick={() => onCategoryChange(item)}
            >
              {forumText(`categories.${item}`)}
            </button>
          ))}
        </div>
      </header>

      {error ? <p className="forum-error">{error}</p> : null}

      <div className="forum-layout">
        <aside className={cx(surfaceClass, "forum-list")}> 
          <div className="forum-list-header">
            <strong>{forumText("listHeader", { total: totalPosts })}</strong>
          </div>
          {loading ? <p className="muted">{t("dashboards.common.loading")}</p> : null}
          {!loading && posts.length === 0 ? <p className="muted">{forumText("empty")}</p> : null}

          <div className="forum-post-items">
            {posts.map((item) => (
              <article key={item.id} className={cx("forum-post-item", item.id === selectedPostId && "is-selected")}>
                <button type="button" className="forum-post-select" onClick={() => setSelectedPostId(item.id)}>
                  <div className="forum-post-title-row">
                    <strong>{item.title}</strong>
                    {item.is_pinned ? <span className="status-chip status-accent">{forumText("pinned")}</span> : null}
                  </div>
                  <p className="muted">{item.author.display_name}</p>
                  <p className="muted">{relativeTimeLabel(item.created_at, locale)}</p>
                  <p className="muted">{forumText("repliesCount", { count: item.reply_count })}</p>
                </button>
                {canPinPosts && item.can_pin ? (
                  <button type="button" className={actionClass("ghost")} onClick={() => void onTogglePin(item)}>
                    {item.is_pinned ? forumText("unpin") : forumText("pin")}
                  </button>
                ) : null}
              </article>
            ))}
          </div>

          <div className="forum-pagination">
            <button type="button" className={actionClass("soft")} onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
              {forumText("prev")}
            </button>
            <span>{forumText("pageOf", { page, totalPages })}</span>
            <button
              type="button"
              className={actionClass("soft")}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
            >
              {forumText("next")}
            </button>
          </div>
        </aside>

        <section className={cx(surfaceClass, "forum-detail")}> 
          {selectedPost ? (
            <>
              <header className="forum-detail-head">
                <h3>{selectedPost.title}</h3>
                <p className="muted">{selectedPost.author.display_name}</p>
              </header>
              <p className="forum-detail-content">{selectedPost.content}</p>

              <div className="forum-replies">
                <h4>{forumText("repliesTitle")}</h4>
                {detailLoading ? <p className="muted">{t("dashboards.common.loading")}</p> : null}
                {!detailLoading && replies.length === 0 ? <p className="muted">{forumText("noReplies")}</p> : null}
                {replies.map((reply) => (
                  <article key={reply.id} className="forum-reply-item">
                    <p>{reply.content}</p>
                    <p className="muted">
                      {reply.author.display_name} · {relativeTimeLabel(reply.created_at, locale)}
                    </p>
                  </article>
                ))}
              </div>

              {allowsCategory(role, selectedPost.category) ? (
                <div className="forum-reply-form">
                  <textarea
                    className={inputClass}
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    rows={4}
                    placeholder={forumText("replyPlaceholder")}
                  />
                  <button type="button" className={actionClass()} onClick={() => void onCreateReply()} disabled={submittingReply}>
                    {submittingReply ? t("login.pleaseWait") : forumText("replyAction")}
                  </button>
                </div>
              ) : (
                <p className="muted">{forumText("readOnlyCategory")}</p>
              )}
            </>
          ) : (
            <p className="muted">{forumText("selectPost")}</p>
          )}
        </section>
      </div>

      {canWriteSelectedCategory ? (
        <section className={cx(surfaceClass, "forum-create")}> 
          <h3>{forumText("createTitle")}</h3>
          <input
            className={inputClass}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder={forumText("titlePlaceholder")}
          />
          <textarea
            className={inputClass}
            value={draftBody}
            onChange={(event) => setDraftBody(event.target.value)}
            rows={5}
            placeholder={forumText("bodyPlaceholder")}
          />
          <div className="forum-create-actions">
            <button type="button" className={actionClass()} onClick={() => void onCreatePost()} disabled={submittingPost}>
              {submittingPost ? t("login.pleaseWait") : forumText("createAction")}
            </button>
            {!embedded ? (
              <Link to={`${prefix}/home`} className={actionClass("soft")}>
                {t("dashboards.shell.backHome")}
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className={cx(surfaceClass, "forum-create")}> 
          <p className="muted">{forumText("cannotPostInCategory")}</p>
        </section>
      )}
    </section>
  );

  if (embedded) {
    return forumContent;
  }

  return (
    <main className={pageShellClass}>
      <PublicHeader className="bg-background" />
      <section className={cx(sectionFrameClass, "py-6")}>{forumContent}</section>
    </main>
  );
}
