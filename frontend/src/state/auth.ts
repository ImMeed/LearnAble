export type PlatformTrack = "PLUS_TEN" | "READING_LAB";

type Session = {
  accessToken: string;
  role: string;
  platformTrack: PlatformTrack;
};

const STORAGE_KEY = "learnable_session";
export const DEFAULT_PLATFORM_TRACK: PlatformTrack = "PLUS_TEN";

function inferPlatformTrackFromToken(accessToken: string): PlatformTrack | null {
  try {
    const payloadSegment = accessToken.split(".")[1];
    if (!payloadSegment) return null;

    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as { platform_track?: unknown };

    return decoded.platform_track === "READING_LAB" ? "READING_LAB" : decoded.platform_track === "PLUS_TEN" ? "PLUS_TEN" : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed.accessToken || !parsed.role) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      role: parsed.role,
      platformTrack: parsed.platformTrack ?? inferPlatformTrackFromToken(parsed.accessToken) ?? DEFAULT_PLATFORM_TRACK,
    };
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
}
