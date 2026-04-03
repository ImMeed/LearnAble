// frontend/src/features/attention/lib/computeAttentionScore.ts

import { RawFeatures, AttentionScore, FocusLabel } from '../types/attention';

// ---- Thresholds ----
const YAW_THRESHOLD_AWAY = 25;     // degrees; |yaw| > this = looking away
const PITCH_THRESHOLD_DOWN = -20;  // degrees; pitch < this = looking down

// ---- Weights (must sum to 1.0) ----
const W_FACE = 0.35;
const W_HEAD = 0.35;
const W_EYE = 0.20;
const W_IRIS = 0.10;

// ---- Normalization constants ----
const EYE_OPEN_FULL = 0.30;   // eye openness ratio at fully open

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Sub-score for face presence: 1.0 if face detected, 0.0 if absent. */
function facePresenceScore(facePresent: boolean): number {
  return facePresent ? 1.0 : 0.0;
}

/**
 * Sub-score for head orientation.
 * 1.0 = within both thresholds (facing screen)
 * 0.5 = one threshold exceeded
 * 0.0 = both thresholds exceeded
 */
function headOrientationScore(yaw: number, pitch: number): number {
  const yawViolation = Math.abs(yaw) > YAW_THRESHOLD_AWAY;
  const pitchViolation = pitch < PITCH_THRESHOLD_DOWN;

  if (!yawViolation && !pitchViolation) return 1.0;
  if (yawViolation && pitchViolation) return 0.0;
  return 0.5;
}

/**
 * Sub-score for eye openness.
 * Normalized: 1.0 at EYE_OPEN_FULL, 0.0 at closed.
 * Clamped to [0, 1].
 */
function eyeOpennessScore(ratio: number): number {
  return clamp(ratio / EYE_OPEN_FULL, 0, 1);
}

/**
 * Sub-score for iris deviation.
 * 1.0 = looking straight (deviation ≤ 0.25)
 * 0.5 = mild deviation (0.25 < deviation ≤ 0.40)
 * 0.0 = strong deviation (> 0.40)
 */
function irisDirectionScore(deviation: number): number {
  if (deviation <= 0.25) return 1.0;
  if (deviation <= 0.40) return 0.5;
  return 0.0;
}

/** Map 0–100 score to a focus label. */
export function scoreToLabel(score: number): FocusLabel {
  if (score >= 70) return 'high';
  if (score >= 40) return 'moderate';
  return 'low';
}

/**
 * Computes a raw attention score 0–100 from extracted features.
 * No smoothing applied here — smoothing happens in the processor.
 */
export function computeRawScore(features: RawFeatures): number {
  if (!features.facePresent) {
    return 0; // If no face is detected, raw score is 0
  }

  const raw =
    W_FACE * facePresenceScore(features.facePresent) +
    W_HEAD * headOrientationScore(features.headYaw, features.headPitch) +
    W_EYE  * eyeOpennessScore(features.eyeOpennessRatio) +
    W_IRIS * irisDirectionScore(features.irisDeviation);

  // Convert 0.0–1.0 to 0–100
  return clamp(raw * 100, 0, 100);
}

/**
 * Applies exponential moving average smoothing.
 *
 * Formula: smoothed(t) = 0.7 * smoothed(t-1) + 0.3 * raw(t)
 *
 * @param previousSmoothed - the smoothed score from the previous frame (0–100)
 * @param rawScore - the raw score from this frame (0–100)
 */
export function applyEMA(previousSmoothed: number, rawScore: number): number {
  return 0.7 * previousSmoothed + 0.3 * rawScore;
}

/**
 * Full score computation pipeline.
 * Takes features and the previous smoothed score.
 * Returns the complete AttentionScore object.
 */
export function computeAttentionScore(
  features: RawFeatures,
  previousSmoothed: number,
): AttentionScore {
  const raw = computeRawScore(features);
  const smoothed = applyEMA(previousSmoothed, raw);
  return {
    raw: Math.round(raw),
    smoothed: Math.round(smoothed),
    label: scoreToLabel(smoothed),
  };
}
