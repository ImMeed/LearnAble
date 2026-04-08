import { describe, it, expect } from 'vitest';
import { extractFeatures, noFaceFeatures } from '../extractFeatures';
import { NormalizedLandmark } from '@mediapipe/face_mesh';

// Build a minimal 478-landmark array at a neutral forward-facing position
function makeNeutralLandmarks(): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));

  lm[1]   = { x: 0.5,  y: 0.5,  z: 0 }; // nose tip
  lm[234] = { x: 0.2,  y: 0.5,  z: 0 }; // left ear
  lm[454] = { x: 0.8,  y: 0.5,  z: 0 }; // right ear
  lm[10]  = { x: 0.5,  y: 0.25, z: 0 }; // forehead
  lm[152] = { x: 0.5,  y: 0.75, z: 0 }; // chin

  // Left eye: open
  lm[159] = { x: 0.35, y: 0.42, z: 0 }; // upper lid
  lm[145] = { x: 0.35, y: 0.47, z: 0 }; // lower lid
  lm[33]  = { x: 0.28, y: 0.44, z: 0 }; // outer corner
  lm[133] = { x: 0.42, y: 0.44, z: 0 }; // inner corner

  // Right eye: open
  lm[386] = { x: 0.65, y: 0.42, z: 0 }; // upper lid
  lm[374] = { x: 0.65, y: 0.47, z: 0 }; // lower lid
  lm[263] = { x: 0.72, y: 0.44, z: 0 }; // outer corner
  lm[362] = { x: 0.58, y: 0.44, z: 0 }; // inner corner

  // Iris centered
  lm[468] = { x: 0.35, y: 0.44, z: 0 }; // left iris center
  lm[473] = { x: 0.65, y: 0.44, z: 0 }; // right iris center

  return lm;
}

describe('extractFeatures', () => {
  it('returns facePresent: true', () => {
    expect(extractFeatures(makeNeutralLandmarks()).facePresent).toBe(true);
  });

  it('returns near-zero yaw for a straight-ahead face', () => {
    expect(Math.abs(extractFeatures(makeNeutralLandmarks()).headYaw)).toBeLessThan(5);
  });

  it('returns positive yaw when face turns right', () => {
    const lm = makeNeutralLandmarks();
    lm[454] = { x: 0.6, y: 0.5, z: 0 }; // right ear closer
    expect(extractFeatures(lm).headYaw).toBeGreaterThan(0);
  });

  it('returns near-zero pitch for a straight-ahead face', () => {
    expect(Math.abs(extractFeatures(makeNeutralLandmarks()).headPitch)).toBeLessThan(10);
  });

  it('returns negative pitch when looking up', () => {
    const lm = makeNeutralLandmarks();
    lm[152] = { x: 0.5, y: 0.90, z: 0 }; // chin further from nose
    expect(extractFeatures(lm).headPitch).toBeLessThan(0);
  });

  it('returns positive eyeOpennessRatio for open eyes', () => {
    expect(extractFeatures(makeNeutralLandmarks()).eyeOpennessRatio).toBeGreaterThan(0.05);
  });

  it('returns near-zero eyeOpennessRatio for closed eyes', () => {
    const lm = makeNeutralLandmarks();
    lm[159] = { ...lm[145] }; // collapse upper lid onto lower
    lm[386] = { ...lm[374] };
    expect(extractFeatures(lm).eyeOpennessRatio).toBeLessThan(0.02);
  });

  it('returns near-zero irisDeviation for centered iris', () => {
    expect(extractFeatures(makeNeutralLandmarks()).irisDeviation).toBeLessThan(0.1);
  });
});

describe('noFaceFeatures', () => {
  it('returns facePresent: false', () => {
    expect(noFaceFeatures().facePresent).toBe(false);
  });

  it('returns zero for all numeric fields', () => {
    const f = noFaceFeatures();
    expect(f.headYaw).toBe(0);
    expect(f.headPitch).toBe(0);
    expect(f.eyeOpennessRatio).toBe(0);
    expect(f.irisDeviation).toBe(0);
  });
});
