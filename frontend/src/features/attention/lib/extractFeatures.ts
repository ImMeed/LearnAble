// frontend/src/features/attention/lib/extractFeatures.ts

import { NormalizedLandmark } from '@mediapipe/face_mesh';
import { RawFeatures } from '../types/attention';

// Landmark indices (see Phase 2 reference table)
const IDX_NOSE_TIP = 1;
const IDX_LEFT_EAR = 234;
const IDX_RIGHT_EAR = 454;
const IDX_CHIN = 152;
const IDX_FOREHEAD = 10;
const IDX_LEFT_LID_UPPER = 159;
const IDX_LEFT_LID_LOWER = 145;
const IDX_LEFT_EYE_OUTER = 33;
const IDX_LEFT_EYE_INNER = 133;
const IDX_RIGHT_LID_UPPER = 386;
const IDX_RIGHT_LID_LOWER = 374;
const IDX_RIGHT_EYE_OUTER = 263;
const IDX_RIGHT_EYE_INNER = 362;
const IDX_LEFT_IRIS = 468;
const IDX_RIGHT_IRIS = 473;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Estimates horizontal head rotation (yaw) in approximate degrees.
 *
 * Method: Compare the horizontal distances from nose tip to each ear.
 * If the face is straight, both distances are equal.
 * If the face turns right, the left ear moves closer to the nose (smaller dist),
 * and the right ear moves farther (larger dist) — and vice versa.
 *
 * Returns degrees in range roughly -90 to +90.
 * Positive = turned right, Negative = turned left.
 */
function computeHeadYaw(lm: NormalizedLandmark[]): number {
  const nose = lm[IDX_NOSE_TIP];
  const leftEar = lm[IDX_LEFT_EAR];
  const rightEar = lm[IDX_RIGHT_EAR];

  const distLeft = nose.x - leftEar.x;   // positive when nose is right of left ear
  const distRight = rightEar.x - nose.x; // positive when right ear is right of nose

  const total = distLeft + distRight;
  if (total < 0.001) return 0; // degenerate case

  // asymmetry ratio: 0 = fully left, 0.5 = straight, 1 = fully right
  const asymmetry = distLeft / total;
  // Map [0, 1] to [-90, +90] degrees
  const yaw = (asymmetry - 0.5) * 180;
  return yaw;
}

/**
 * Estimates vertical head tilt (pitch) in approximate degrees.
 *
 * Method: Compare the ratio of forehead-to-nose distance vs nose-to-chin distance.
 * When looking straight ahead, these are roughly equal.
 * When looking down, the chin moves closer to the nose.
 *
 * Returns degrees in range roughly -60 to +60.
 * Negative = looking down, Positive = looking up.
 */
function computeHeadPitch(lm: NormalizedLandmark[]): number {
  const nose = lm[IDX_NOSE_TIP];
  const chin = lm[IDX_CHIN];
  const forehead = lm[IDX_FOREHEAD];

  const foreheadToNose = nose.y - forehead.y; // positive when nose is below forehead (normal)
  const noseToChin = chin.y - nose.y;         // positive when chin is below nose (normal)

  const total = foreheadToNose + noseToChin;
  if (total < 0.001) return 0;

  // ratio: 0.5 = straight ahead
  const ratio = noseToChin / total;
  // Map: ratio > 0.5 means more chin (looking up), ratio < 0.5 means less chin (looking down)
  const pitch = (0.5 - ratio) * 120; // scale to approximate degrees
  return pitch;
}

/**
 * Computes eye openness ratio for one eye.
 *
 * Formula: vertical_distance / horizontal_width
 * Typical values: ~0.30 when fully open, ~0.0 when closed, ~0.10 when squinting.
 */
function computeSingleEyeOpenness(
  lm: NormalizedLandmark[],
  upperLidIdx: number,
  lowerLidIdx: number,
  outerCornerIdx: number,
  innerCornerIdx: number,
): number {
  const upper = lm[upperLidIdx];
  const lower = lm[lowerLidIdx];
  const outer = lm[outerCornerIdx];
  const inner = lm[innerCornerIdx];

  const vertDist = Math.abs(upper.y - lower.y);
  const horizDist = Math.abs(outer.x - inner.x);

  if (horizDist < 0.001) return 0;
  return vertDist / horizDist;
}

/**
 * Computes how far the iris has deviated from the center of the eye.
 *
 * Formula: |iris_center_x - eye_center_x| / eye_width
 * 0.0 = looking straight ahead.
 * > 0.35 = gaze shifted significantly left or right.
 */
function computeSingleIrisDeviation(
  lm: NormalizedLandmark[],
  irisIdx: number,
  outerCornerIdx: number,
  innerCornerIdx: number,
): number {
  const iris = lm[irisIdx];
  const outer = lm[outerCornerIdx];
  const inner = lm[innerCornerIdx];

  const eyeCenterX = (outer.x + inner.x) / 2;
  const eyeWidth = Math.abs(outer.x - inner.x);

  if (eyeWidth < 0.001) return 0;
  return Math.abs(iris.x - eyeCenterX) / eyeWidth;
}

/**
 * Main extraction function. Takes the full 478-landmark array from one face result.
 *
 * @param landmarks - results.multiFaceLandmarks[0] from MediaPipe
 * @returns RawFeatures object with all computed signals
 */
export function extractFeatures(landmarks: NormalizedLandmark[]): RawFeatures {
  const headYaw = computeHeadYaw(landmarks);
  const headPitch = computeHeadPitch(landmarks);

  const leftEyeOpenness = computeSingleEyeOpenness(
    landmarks,
    IDX_LEFT_LID_UPPER, IDX_LEFT_LID_LOWER,
    IDX_LEFT_EYE_OUTER, IDX_LEFT_EYE_INNER,
  );
  const rightEyeOpenness = computeSingleEyeOpenness(
    landmarks,
    IDX_RIGHT_LID_UPPER, IDX_RIGHT_LID_LOWER,
    IDX_RIGHT_EYE_OUTER, IDX_RIGHT_EYE_INNER,
  );
  const eyeOpennessRatio = (leftEyeOpenness + rightEyeOpenness) / 2;

  const leftIrisDeviation = computeSingleIrisDeviation(
    landmarks,
    IDX_LEFT_IRIS, IDX_LEFT_EYE_OUTER, IDX_LEFT_EYE_INNER,
  );
  const rightIrisDeviation = computeSingleIrisDeviation(
    landmarks,
    IDX_RIGHT_IRIS, IDX_RIGHT_EYE_OUTER, IDX_RIGHT_EYE_INNER,
  );
  const irisDeviation = (leftIrisDeviation + rightIrisDeviation) / 2;

  return {
    facePresent: true,       // caller only calls this when face is detected
    headYaw: clamp(headYaw, -90, 90),
    headPitch: clamp(headPitch, -60, 60),
    eyeOpennessRatio: clamp(eyeOpennessRatio, 0, 1),
    irisDeviation: clamp(irisDeviation, 0, 1),
  };
}

/** Returns a RawFeatures object for the case where no face is detected. */
export function noFaceFeatures(): RawFeatures {
  return {
    facePresent: false,
    headYaw: 0,
    headPitch: 0,
    eyeOpennessRatio: 0,
    irisDeviation: 0,
  };
}
