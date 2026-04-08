import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BlinkDetector } from '../blinkDetector';

describe('BlinkDetector', () => {
  let detector: BlinkDetector;

  beforeEach(() => {
    detector = new BlinkDetector();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false on first open-eye reading', () => {
    expect(detector.update(0.30)).toBe(false);
  });

  it('detects a valid blink: open → close → open within 400ms', () => {
    detector.update(0.30);            // open
    detector.update(0.05);            // closed
    vi.advanceTimersByTime(150);
    expect(detector.update(0.30)).toBe(true); // re-open = blink counted
  });

  it('does not count a blink if closure lasts longer than 400ms', () => {
    detector.update(0.30);
    detector.update(0.05);
    vi.advanceTimersByTime(500);      // held too long
    expect(detector.update(0.30)).toBe(false);
  });

  it('getBlinksPerMinute returns 0 initially', () => {
    expect(detector.getBlinksPerMinute()).toBe(0);
  });

  it('getBlinksPerMinute counts blinks in the last 60 seconds', () => {
    for (let i = 0; i < 3; i++) {
      detector.update(0.30);
      detector.update(0.05);
      vi.advanceTimersByTime(150);
      detector.update(0.30);
      vi.advanceTimersByTime(1000);
    }
    expect(detector.getBlinksPerMinute()).toBe(3);
  });

  it('reset clears blink history and state', () => {
    detector.update(0.30);
    detector.update(0.05);
    vi.advanceTimersByTime(100);
    detector.update(0.30);
    detector.reset();
    expect(detector.getBlinksPerMinute()).toBe(0);
  });
});
