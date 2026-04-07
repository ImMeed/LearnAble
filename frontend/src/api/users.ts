import { apiClient } from './client';

export interface MeResponse {
  id: string;
  email: string;
  role: string;
}

export async function getMe(): Promise<MeResponse> {
  const res = await apiClient.get<MeResponse>('/me');
  return res.data;
}
