import { apiClient } from './client';

export interface BookSummary {
  id: string;
  title: string;
  author: string;
  summary: string;
  cover_image_url: string | null;
  points_cost: number;
  owned: boolean;
}

export interface RedeemBookResponse {
  book_id: string;
  points_spent: number;
  wallet_balance: number;
  already_owned: boolean;
}

export interface ReadBookResponse {
  book_id: string;
  title: string;
  reader_url: string;
}

export async function listBooks(): Promise<BookSummary[]> {
  const res = await apiClient.get<{ items: BookSummary[] }>('/books');
  return res.data.items;
}

export async function redeemBook(bookId: string): Promise<RedeemBookResponse> {
  const res = await apiClient.post<RedeemBookResponse>(`/library/books/${bookId}/redeem`);
  return res.data;
}

export async function readBook(bookId: string): Promise<ReadBookResponse> {
  const res = await apiClient.get<ReadBookResponse>(`/books/${bookId}/read`);
  return res.data;
}
