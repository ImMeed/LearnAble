/**
 * Fix 7: audio-only fallback when camera is unavailable.
 * Tests the constraint-retry logic in isolation.
 */
import { describe, it, expect } from "vitest";

// Reproduce the fallback logic from useWebRTC in a pure function for testing
type Constraint = { video: boolean; audio: boolean };

type MediaResult =
  | { type: "success"; constraint: Constraint }
  | { type: "error"; code: string };

async function tryGetMedia(
  getUserMedia: (c: Constraint) => Promise<void>,
): Promise<MediaResult> {
  const constraints: Constraint[] = [
    { video: true, audio: true },
    { video: false, audio: true },
  ];

  for (const constraint of constraints) {
    try {
      await getUserMedia(constraint);
      return { type: "success", constraint };
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        return { type: "error", code: "CAMERA_DENIED" };
      }
      if (constraint.video) continue;
      return { type: "error", code: err.name === "NotFoundError" ? "NO_DEVICE" : "MEDIA_ERROR" };
    }
  }
  return { type: "error", code: "MEDIA_ERROR" };
}

describe("media fallback logic", () => {
  it("succeeds with video+audio when both work", async () => {
    const result = await tryGetMedia(async () => {});
    expect(result.type).toBe("success");
    expect((result as any).constraint).toEqual({ video: true, audio: true });
  });

  it("falls back to audio-only when camera is unavailable (NotReadableError)", async () => {
    let callCount = 0;
    const result = await tryGetMedia(async (c) => {
      callCount++;
      if (c.video) throw Object.assign(new Error(), { name: "NotReadableError" });
    });
    expect(result.type).toBe("success");
    expect((result as any).constraint).toEqual({ video: false, audio: true });
    expect(callCount).toBe(2);
  });

  it("falls back to audio-only when camera device not found (NotFoundError for video)", async () => {
    const result = await tryGetMedia(async (c) => {
      if (c.video) throw Object.assign(new Error(), { name: "NotFoundError" });
    });
    expect(result.type).toBe("success");
    expect((result as any).constraint).toEqual({ video: false, audio: true });
  });

  it("returns CAMERA_DENIED immediately on NotAllowedError — no retry", async () => {
    let callCount = 0;
    const result = await tryGetMedia(async () => {
      callCount++;
      throw Object.assign(new Error(), { name: "NotAllowedError" });
    });
    expect(result.type).toBe("error");
    expect((result as any).code).toBe("CAMERA_DENIED");
    expect(callCount).toBe(1); // should NOT retry after permission denied
  });

  it("returns NO_DEVICE when audio also has no device", async () => {
    const result = await tryGetMedia(async () => {
      throw Object.assign(new Error(), { name: "NotFoundError" });
    });
    expect(result.type).toBe("error");
    expect((result as any).code).toBe("NO_DEVICE");
  });
});
