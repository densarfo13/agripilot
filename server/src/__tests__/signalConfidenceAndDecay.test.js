/**
 * signalConfidenceAndDecay.test.js — verifies:
 *   • sample size, recency, consistency, reliability, type boost
 *     compose correctly in getSignalConfidenceScore
 *   • decay weights shrink as signals age
 *   • rolling window drops stale signals
 *   • effective sample size reflects decay
 */

import { describe, it, expect } from 'vitest';
import {
  getSignalConfidenceScore,
  getSignalReliability,
  buildSignalConfidenceSummary,
  SIGNAL_RELIABILITY,
} from '../services/decision/signalConfidence.js';
import {
  applySignalDecay,
  getDecayedSignalWeight,
  getWindowedSignals,
  partitionByRecency,
  computeEffectiveSampleSize,
} from '../services/decision/signalDecay.js';

const NOW = new Date('2026-04-19T00:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function positive(n, startDaysAgo = 0, spanDays = 1) {
  return Array.from({ length: n }).map((_, i) => ({
    timestamp: NOW - (startDaysAgo + i * spanDays) * DAY,
    direction: +1,
    weight: 1,
  }));
}
function negative(n, startDaysAgo = 0, spanDays = 1) {
  return positive(n, startDaysAgo, spanDays).map((s) => ({ ...s, direction: -1 }));
}

// ─── signal confidence ────────────────────────────────────
describe('getSignalConfidenceScore', () => {
  it('strong harvest outcomes produce HIGH confidence', () => {
    const r = getSignalConfidenceScore({
      signalType: 'harvest_outcome',
      samples: positive(14, 0, 3), // 14 recent aligned samples
      now: NOW,
    });
    expect(r.confidenceScore).toBeGreaterThan(0.5);
    expect(r.sourceCount).toBe(14);
    expect(r.consistencyScore).toBe(1);
  });

  it('a single recent recommendation acceptance is weaker than many harvests', () => {
    const rec = getSignalConfidenceScore({
      signalType: 'recommendation_acceptance',
      samples: positive(1),
      now: NOW,
    });
    const harvest = getSignalConfidenceScore({
      signalType: 'harvest_outcome',
      samples: positive(14, 0, 2),
      now: NOW,
    });
    expect(rec.confidenceScore).toBeLessThan(harvest.confidenceScore);
    // A single sample can't compete with a strong behavioral pattern,
    // even when aligned in direction.
    expect(rec.confidenceScore).toBeLessThan(0.6);
  });

  it('a single weak_engagement signal stays weak', () => {
    const weak = getSignalConfidenceScore({
      signalType: 'weak_engagement',
      samples: positive(1),
      now: NOW,
    });
    const harvest = getSignalConfidenceScore({
      signalType: 'harvest_outcome',
      samples: positive(10),
      now: NOW,
    });
    // The weak-engagement signal must fall well below a strong harvest,
    // and must not be confused for a "confident" signal (>= 0.5).
    expect(weak.confidenceScore).toBeLessThan(0.5);
    expect(weak.confidenceScore).toBeLessThan(harvest.confidenceScore * 0.6);
  });

  it('weak_engagement with many aged samples stays near-zero', () => {
    const r = getSignalConfidenceScore({
      signalType: 'weak_engagement',
      samples: positive(10, 45),  // 45-day-old samples
      now: NOW,
    });
    expect(r.confidenceScore).toBeLessThan(0.1);
  });

  it('ancient samples drop recencyWeight', () => {
    const r = getSignalConfidenceScore({
      signalType: 'harvest_outcome',
      samples: positive(10, /*startDaysAgo=*/120, 1), // 120+ days old
      now: NOW,
      halfLifeDays: 14,
    });
    expect(r.recencyWeight).toBeLessThan(0.01);
    expect(r.confidenceScore).toBeLessThan(0.2);
  });

  it('mixed directions collapse consistency', () => {
    const samples = [...positive(5), ...negative(5)];
    const r = getSignalConfidenceScore({ signalType: 'recommendation_acceptance', samples, now: NOW });
    expect(r.consistencyScore).toBeLessThan(0.2);
    expect(r.confidenceScore).toBeLessThan(0.3);
  });

  it('empty samples produce zero confidence (but still return reliability)', () => {
    const r = getSignalConfidenceScore({ signalType: 'harvest_outcome', samples: [] });
    expect(r.confidenceScore).toBe(0);
    expect(r.sourceCount).toBe(0);
    expect(r.reliability).toBe(SIGNAL_RELIABILITY.harvest_outcome);
  });

  it('harvest_outcome outranks recommendation_acceptance even at same sample size', () => {
    const harvest = getSignalConfidenceScore({
      signalType: 'harvest_outcome',
      samples: positive(8),
      now: NOW,
    });
    const acceptance = getSignalConfidenceScore({
      signalType: 'recommendation_acceptance',
      samples: positive(8),
      now: NOW,
    });
    expect(harvest.confidenceScore).toBeGreaterThan(acceptance.confidenceScore);
  });
});

describe('getSignalReliability', () => {
  it('returns the registered constant', () => {
    expect(getSignalReliability('harvest_outcome')).toBe(1);
    expect(getSignalReliability('unknown_thing')).toBe(SIGNAL_RELIABILITY.unknown);
  });
});

describe('buildSignalConfidenceSummary', () => {
  it('sorts rows by confidence and exposes strongest/weakest', () => {
    const summary = buildSignalConfidenceSummary({
      signals: {
        harvest_outcome:           positive(10),
        recommendation_acceptance: positive(2),
        weak_engagement:           positive(1, 60),
      },
      now: NOW,
    });
    expect(summary.rows[0].signalType).toBe('harvest_outcome');
    expect(summary.strongest.signalType).toBe('harvest_outcome');
    expect(summary.weakest.signalType).toBe('weak_engagement');
  });
});

// ─── decay + windowing ────────────────────────────────────
describe('signal decay', () => {
  it('decayedWeight halves across one half-life', () => {
    const base = { timestamp: NOW - 14 * DAY, weight: 1 };
    const out = applySignalDecay(base, { halfLifeDays: 14, now: NOW });
    expect(out.decayedWeight).toBeGreaterThan(0.49);
    expect(out.decayedWeight).toBeLessThan(0.51);
  });

  it('getDecayedSignalWeight and applySignalDecay agree', () => {
    const ts = NOW - 7 * DAY;
    const fromStruct = applySignalDecay({ timestamp: ts, weight: 2 }, { halfLifeDays: 14, now: NOW });
    const direct = getDecayedSignalWeight({ timestamp: ts, weight: 2, halfLifeDays: 14, now: NOW });
    expect(direct).toBeCloseTo(fromStruct.decayedWeight, 4);
  });

  it('getWindowedSignals drops anything older than window', () => {
    const signals = [
      { timestamp: NOW - 10 * DAY },
      { timestamp: NOW - 80 * DAY },
      { timestamp: NOW - 120 * DAY }, // dropped at default window 90d
    ];
    expect(getWindowedSignals(signals, { windowDays: 90, now: NOW })).toHaveLength(2);
  });

  it('partitionByRecency splits thirds', () => {
    const signals = [
      { timestamp: NOW - 5 * DAY },   // recent
      { timestamp: NOW - 45 * DAY },  // middle
      { timestamp: NOW - 80 * DAY },  // old
    ];
    const out = partitionByRecency(signals, { windowDays: 90, now: NOW });
    expect(out.recent).toHaveLength(1);
    expect(out.middle).toHaveLength(1);
    expect(out.old).toHaveLength(1);
  });

  it('computeEffectiveSampleSize is smaller than raw count for aged signals', () => {
    const raw = [
      { timestamp: NOW - 40 * DAY, weight: 1 },
      { timestamp: NOW - 45 * DAY, weight: 1 },
      { timestamp: NOW - 50 * DAY, weight: 1 },
    ];
    const ess = computeEffectiveSampleSize(raw, { halfLifeDays: 14, now: NOW });
    expect(ess).toBeLessThan(raw.length);
    expect(ess).toBeGreaterThan(0);
  });
});
