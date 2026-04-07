import { apiClient } from './client';

export interface ForumSpace {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  [key: string]: unknown;
}

export async function listSpaces(): Promise<ForumSpace[]> {
  const res = await apiClient.get<{ items: ForumSpace[] }>('/forum/spaces');
  return res.data.items;
}
