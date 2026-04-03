import { describe, it, expect } from 'vitest';
import { computeRawScore, applyEMA, scoreToLabel } from '../computeAttentionScore';
import { RawFeatures } from '../../types/attention';

const FULLY_ATTENTIVE: RawFeatures = {
  facePresent: true,
  headYaw: 0,
  headPitch: 0,
  eyeOpennessRatio: 0.30,
  irisDeviation: 0.10,
};

const FACE_ABSENT: RawFeatures = {
  facePresent: false,
  headYaw: 0,
  headPitch: 0,
  eyeOpennessRatio: 0,
  irisDeviation: 0,
};

const HEAD_TURNED: RawFeatures = {
  facePresent: true,
  headYaw: 45,       // exceeds 25° threshold
  headPitch: 0,
  eyeOpennessRatio: 0.30,
  irisDeviation: 0.10,
};

const LOOKING_DOWN: RawFeatures = {
  facePresent: true,
  headYaw: 0,
  headPitch: -30,    // below -20° threshold
  eyeOpennessRatio: 0.30,
  irisDeviation: 0.10,
};

const EYES_CLOSED: RawFeatures = {
  facePresent: true,
  headYaw: 0,
  headPitch: 0,
  eyeOpennessRatio: 0.0,
  irisDeviation: 0.10,
};

describe('computeRawScore', () => {
  it('returns ~100 for a fully attentive face', () => {
    const score = computeRawScore(FULLY_ATTENTIVE);
    expect(score).toBeGreaterThan(90);
  });

  it('returns 0 when face is absent', () => {
    const score = computeRawScore(FACE_ABSENT);
    expect(score).toBe(0);
  });

  it('returns a lower score when head is turned away', () => {
    const straight = computeRawScore(FULLY_ATTENTIVE);
    const turned = computeRawScore(HEAD_TURNED);
    expect(turned).toBeLessThan(straight);
  });

  it('returns a lower score when looking down', () => {
    const straight = computeRawScore(FULLY_ATTENTIVE);
    const down = computeRawScore(LOOKING_DOWN);
    expect(down).toBeLessThan(straight);
  });

  it('returns a lower score when eyes are closed', () => {
    const open = computeRawScore(FULLY_ATTENTIVE);
    const closed = computeRawScore(EYES_CLOSED);
    expect(closed).toBeLessThan(open);
  });
});

describe('applyEMA', () => {
  it('smooths toward the new value over time', () => {
    let smoothed = 50;
    for (let i = 0; i < 20; i++) {
      smoothed = applyEMA(smoothed, 100);
    }
    expect(smoothed).toBeGreaterThan(90);
  });

  it('does not jump instantly to the raw value', () => {
    const smoothed = applyEMA(50, 100);
    expect(smoothed).toBeLessThan(100);
    expect(smoothed).toBeGreaterThan(50);
  });
});

describe('scoreToLabel', () => {
  it('maps 70+ to high', () => expect(scoreToLabel(70)).toBe('high'));
  it('maps 40-69 to moderate', () => expect(scoreToLabel(55)).toBe('moderate'));
  it('maps below 40 to low', () => expect(scoreToLabel(39)).toBe('low'));
  it('maps 0 to low', () => expect(scoreToLabel(0)).toBe('low'));
  it('maps 100 to high', () => expect(scoreToLabel(100)).toBe('high'));
});
