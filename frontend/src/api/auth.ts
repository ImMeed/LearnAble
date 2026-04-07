import { apiClient } from './client';

export type UserRole = 'ROLE_STUDENT' | 'ROLE_TUTOR' | 'ROLE_PARENT';

export interface AuthResponse {
  access_token: string;
  token_type: string;
  role: string;
  totp_required: boolean;
}

export interface Verify2FAResponse {
  access_token: string;
  token_type: string;
  role: string;
}

export interface MeResponse {
  id: string;
  email: string;
  role: string;
}

export async function register(email: string, password: string, role: UserRole): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/register', { email, password, role });
  return res.data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  return res.data;
}

export async function loginWithOTP(email: string, otp_code: string): Promise<Verify2FAResponse> {
  const res = await apiClient.post<Verify2FAResponse>('/auth/login/otp', { email, otp_code });
  return res.data;
}

export async function getMe(): Promise<MeResponse> {
  const res = await apiClient.get<MeResponse>('/me');
  return res.data;
}
