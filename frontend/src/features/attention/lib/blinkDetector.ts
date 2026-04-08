// frontend/src/features/attention/lib/blinkDetector.ts

const BLINK_CLOSED_THRESHOLD = 0.10;   // eye openness ratio below this = closed
const BLINK_MAX_DURATION_MS = 400;     // blink must be shorter than this
const BPM_WINDOW_SECONDS = 60;         // rolling window for blinks-per-minute

interface BlinkEvent {
  timestamp: number; // ms (Date.now())
}

export class BlinkDetector {
  private eyeWasClosed = false;
  private eyeClosedAt: number | null = null;
  private blinkHistory: BlinkEvent[] = [];

  /**
   * Call this on every frame with the current averaged eye openness ratio.
   * Returns true if a blink was completed on this frame.
   */
  update(eyeOpennessRatio: number): boolean {
    const now = Date.now();
    const isClosed = eyeOpennessRatio < BLINK_CLOSED_THRESHOLD;

    if (isClosed && !this.eyeWasClosed) {
      // Eye just closed — record the start
      this.eyeWasClosed = true;
      this.eyeClosedAt = now;
      return false;
    }

    if (!isClosed && this.eyeWasClosed) {
      // Eye just opened
      this.eyeWasClosed = false;
      const duration = this.eyeClosedAt !== null ? now - this.eyeClosedAt : 0;
      this.eyeClosedAt = null;

      if (duration > 0 && duration < BLINK_MAX_DURATION_MS) {
        // Valid blink
        this.blinkHistory.push({ timestamp: now });
        return true;
      }
    }

    return false;
  }

  /**
   * Returns blinks per minute over the last 60 seconds.
   */
  getBlinksPerMinute(): number {
    const now = Date.now();
    const windowStart = now - BPM_WINDOW_SECONDS * 1000;
    this.blinkHistory = this.blinkHistory.filter(b => b.timestamp > windowStart);
    return this.blinkHistory.length; // count in last 60s === blinks per minute
  }

  reset(): void {
    console.log('[BlinkDetector] reset() called');
    this.eyeWasClosed = false;
    this.eyeClosedAt = null;
    this.blinkHistory = [];
  }
}
