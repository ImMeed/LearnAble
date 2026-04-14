import { apiClient } from "./client";

export interface Enable2FAResponse {
  qr_code_base64: string;
  secret: string;
}

export async function get2FAStatus(): Promise<{ totp_enabled: boolean }> {
  const res = await apiClient.get("/auth/2fa/status");
  return res.data as { totp_enabled: boolean };
}

export async function enable2FA(): Promise<Enable2FAResponse> {
  const res = await apiClient.post("/auth/2fa/enable");
  return res.data as Enable2FAResponse;
}

export async function confirm2FA(code: string): Promise<void> {
  await apiClient.post("/auth/2fa/confirm", { code });
}

export async function disable2FA(code: string): Promise<void> {
  await apiClient.post("/auth/2fa/disable", { code });
}

export async function loginWithOTP(
  email: string,
  otp_code: string,
): Promise<{ access_token: string; role: string }> {
  const res = await apiClient.post("/auth/login/otp", { email, otp_code });
  return res.data as { access_token: string; role: string };
}
