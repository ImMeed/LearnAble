type Session = {
  accessToken: string;
  role: string;
};

const STORAGE_KEY = "learnable_session";
const PENDING_OTP_KEY = "learnable_pending_otp";

export function getSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Session;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PENDING_OTP_KEY);
}

/** Saved when backend returns totp_required=true — holds email until OTP is verified. */
export function setPendingOTP(email: string): void {
  localStorage.setItem(PENDING_OTP_KEY, email);
}

export function getPendingOTP(): string | null {
  return localStorage.getItem(PENDING_OTP_KEY);
}

export function clearPendingOTP(): void {
  localStorage.removeItem(PENDING_OTP_KEY);
}
