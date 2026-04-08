// frontend/src/features/attention/types/attention.ts

/** Which role the user selected in the RolePickerScreen. */
export type UserRole = 'teacher' | 'student';

/** Attention quality tier mapped from the smoothed score. */
export type FocusLabel = 'high' | 'moderate' | 'low';

/**
 * Raw signals extracted from a single MediaPipe frame.
 * Computed in Phase 2 by extractFeatures().
 */
export interface RawFeatures {
  facePresent: boolean;
  headYaw: number;          // degrees; positive = turned right, negative = turned left
  headPitch: number;        // degrees; negative = looking down, positive = looking up
  eyeOpennessRatio: number; // 0.0 (fully closed) to ~0.35 (fully open)
  irisDeviation: number;    // 0.0 (centered) to 1.0 (extreme side gaze)
}

/**
 * Intermediate score object produced by computeAttentionScore().
 * Exists inside the student-side processor only — never sent over the wire.
 */
export interface AttentionScore {
  raw: number;      // 0–100 before smoothing
  smoothed: number; // 0–100 after EMA smoothing
  label: FocusLabel;
}

/**
 * The WebSocket message payload sent from student browser to teacher browser.
 * This is the only attention data that crosses the network.
 */
export interface AttentionMetrics {
  peerId?: string;        // optional — populated in Phase 6 for multi-student support
  score: number;          // smoothed score 0–100
  label: FocusLabel;
  distraction: boolean;   // true = 2+ consecutive low-focus intervals detected
  signals: {
    face_present: boolean;
    head_yaw: number;
    head_pitch: number;
    eye_openness: number;
    blink_rate: number;   // blinks per minute, computed in Phase 2
    iris_deviation: number;
  };
  timestamp: number;      // seconds since the call started (not a Unix timestamp)
}

/**
 * One entry in the teacher-side in-memory timeline array.
 * Appended every 4 seconds. Cleared when the call ends.
 */
export interface AttentionDataPoint {
  timestamp: number;    // seconds since call start
  score: number;        // 0–100
  label: FocusLabel;
  distraction: boolean;
}

/**
 * The complete WebSocket message envelope for attention metrics.
 * type === "attention_metrics" is the discriminator used in useSignaling.ts.
 */
export interface AttentionMetricsMessage {
  type: 'attention_metrics';
  payload: AttentionMetrics;
}
