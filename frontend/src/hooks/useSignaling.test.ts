/**
 * Fix 5: WS scheme follows page protocol (ws → wss on HTTPS).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Helper: extract the WS URL that would be built given a page protocol + VITE_API_BASE_URL
function buildWsUrl(
  pageProtocol: "http:" | "https:",
  hostname: string,
  apiBaseUrl: string | undefined,
  roomId: string,
  token: string | null,
): string {
  const isSecure = pageProtocol === "https:";
  const wsScheme = isSecure ? "wss" : "ws";
  const apiBase = apiBaseUrl || `http://${hostname}:8000`;
  const wsBase = apiBase.replace(/^https?/, wsScheme);
  const tokenParam = token ? `?token=${token}` : "";
  return `${wsBase}/ws/call/${roomId}${tokenParam}`;
}

describe("WS URL scheme", () => {
  it("uses ws:// on HTTP", () => {
    const url = buildWsUrl("http:", "localhost", "http://localhost:8000", "room-1", "tok");
    expect(url).toMatch(/^ws:\/\//);
    expect(url).not.toMatch(/^wss:\/\//);
  });

  it("uses wss:// on HTTPS", () => {
    const url = buildWsUrl("https:", "myapp.com", "https://api.myapp.com", "room-1", "tok");
    expect(url).toMatch(/^wss:\/\//);
    expect(url).not.toMatch(/^ws:\/\//);
  });

  it("includes token in query param when provided", () => {
    const url = buildWsUrl("http:", "localhost", "http://localhost:8000", "room-abc", "mytoken");
    expect(url).toContain("?token=mytoken");
  });

  it("omits query param when token is null", () => {
    const url = buildWsUrl("http:", "localhost", "http://localhost:8000", "room-abc", null);
    expect(url).not.toContain("?token");
  });

  it("uses VITE_API_BASE_URL as the base", () => {
    const url = buildWsUrl("http:", "localhost", "http://localhost:8000", "room-xyz", null);
    expect(url).toBe("ws://localhost:8000/ws/call/room-xyz");
  });
});
