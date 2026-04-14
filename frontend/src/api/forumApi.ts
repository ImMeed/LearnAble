import { apiClient } from "./client";

export interface ForumSpace {
  id: string;
  slug: string;
  name: string;
  description: string;
  is_active: boolean;
}

export interface ForumPost {
  id: string;
  space_id: string;
  author_user_id: string;
  title: string;
  content: string;
  status: "ACTIVE" | "HIDDEN" | "REMOVED";
  is_locked: boolean;
  upvotes: number;
  downvotes: number;
  created_at: string;
}

export interface ForumComment {
  id: string;
  post_id: string;
  author_user_id: string;
  content: string;
  status: "ACTIVE" | "HIDDEN" | "REMOVED";
  upvotes: number;
  downvotes: number;
  created_at: string;
}

export interface ForumReport {
  id: string;
  target_type: "POST" | "COMMENT";
  target_id: string;
  reporter_user_id: string;
  reason: string;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  reviewed_by_user_id: string | null;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export type ModerationAction = "HIDE" | "RESTORE" | "REMOVE" | "LOCK" | "UNLOCK" | "DISMISS";

function langHeader(locale: string) {
  return { headers: { "x-lang": locale === "en" ? "en" : "ar" } };
}

export async function listSpaces(locale: string): Promise<ForumSpace[]> {
  const res = await apiClient.get<{ items: ForumSpace[] }>("/forum/spaces", langHeader(locale));
  return res.data.items;
}

export async function listPosts(spaceId: string, locale: string): Promise<ForumPost[]> {
  const res = await apiClient.get<{ items: ForumPost[] }>(`/forum/spaces/${spaceId}/posts`, langHeader(locale));
  return res.data.items;
}

export async function createPost(spaceId: string, title: string, content: string, locale: string): Promise<ForumPost> {
  const res = await apiClient.post<ForumPost>(`/forum/spaces/${spaceId}/posts`, { title, content }, langHeader(locale));
  return res.data;
}

export async function listComments(postId: string, locale: string): Promise<ForumComment[]> {
  const res = await apiClient.get<{ items: ForumComment[] }>(`/forum/posts/${postId}/comments`, langHeader(locale));
  return res.data.items;
}

export async function createComment(postId: string, content: string, locale: string): Promise<ForumComment> {
  const res = await apiClient.post<ForumComment>(`/forum/posts/${postId}/comments`, { content }, langHeader(locale));
  return res.data;
}

export async function castVote(
  targetType: "POST" | "COMMENT",
  targetId: string,
  value: 1 | -1,
): Promise<{ upvotes: number; downvotes: number }> {
  const res = await apiClient.post<{ upvotes: number; downvotes: number }>("/forum/votes", {
    target_type: targetType,
    target_id: targetId,
    value,
  });
  return res.data;
}

export async function reportTarget(
  targetType: "POST" | "COMMENT",
  targetId: string,
  reason: string,
): Promise<void> {
  await apiClient.post("/forum/reports", { target_type: targetType, target_id: targetId, reason });
}

export async function listOpenReports(locale: string): Promise<ForumReport[]> {
  const res = await apiClient.get<{ items: ForumReport[] }>("/forum/reports?only_open=true", langHeader(locale));
  return res.data.items;
}

export async function moderateReport(
  reportId: string,
  action: ModerationAction,
  review_notes?: string,
): Promise<void> {
  await apiClient.post(`/forum/reports/${reportId}/moderate`, {
    action,
    review_notes: review_notes ?? null,
  });
}
