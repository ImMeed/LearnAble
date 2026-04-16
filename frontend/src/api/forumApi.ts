import { apiClient } from "./client";

type ForumCategory = "tips" | "ask" | "resources";

type ForumAuthor = {
  id: string;
  role: string;
  display_name: string;
};

type ForumFeedPostItem = {
  id: string;
  category: ForumCategory;
  title: string;
  content: string;
  status: string;
  is_pinned: boolean;
  is_locked: boolean;
  upvotes: number;
  downvotes: number;
  reply_count: number;
  can_pin: boolean;
  author: ForumAuthor;
  created_at: string;
};

type ForumReplyItem = {
  id: string;
  content: string;
  status: string;
  upvotes: number;
  downvotes: number;
  author: ForumAuthor;
  created_at: string;
};

type ForumFeedPostListResponse = {
  items: ForumFeedPostItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

type ForumPostDetailResponse = {
  post: ForumFeedPostItem;
  replies: ForumReplyItem[];
};

function localeHeaders(locale: "ar" | "en") {
  return { headers: { "x-lang": locale } };
}

export async function listForumPosts(params: {
  category: ForumCategory;
  page: number;
  pageSize?: number;
  locale: "ar" | "en";
}) {
  const response = await apiClient.get<ForumFeedPostListResponse>("/forum/posts", {
    ...localeHeaders(params.locale),
    params: {
      category: params.category,
      page: params.page,
      page_size: params.pageSize ?? 10,
    },
  });
  return response.data;
}

export async function createForumPost(params: {
  category: ForumCategory;
  title: string;
  content: string;
  locale: "ar" | "en";
}) {
  const response = await apiClient.post<ForumFeedPostItem>(
    "/forum/posts",
    {
      category: params.category,
      title: params.title,
      content: params.content,
    },
    localeHeaders(params.locale),
  );
  return response.data;
}

export async function getForumPostDetail(params: { postId: string; locale: "ar" | "en" }) {
  const response = await apiClient.get<ForumPostDetailResponse>(`/forum/posts/${params.postId}`, localeHeaders(params.locale));
  return response.data;
}

export async function createForumReply(params: { postId: string; content: string; locale: "ar" | "en" }) {
  const response = await apiClient.post<ForumReplyItem>(
    `/forum/posts/${params.postId}/reply`,
    { content: params.content },
    localeHeaders(params.locale),
  );
  return response.data;
}

export async function setForumPostPin(params: {
  postId: string;
  isPinned: boolean;
  locale: "ar" | "en";
}) {
  const response = await apiClient.patch<{ post_id: string; is_pinned: boolean }>(
    `/forum/posts/${params.postId}/pin`,
    { is_pinned: params.isPinned },
    localeHeaders(params.locale),
  );
  return response.data;
}

export type { ForumCategory, ForumFeedPostItem, ForumReplyItem, ForumPostDetailResponse };
