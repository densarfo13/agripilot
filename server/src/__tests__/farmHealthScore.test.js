/**
 * farmHealthScore.test.js — pins the §4 health-score contract:
 *   1. Pure function — never throws.
 *   2. Empty inputs return the neutral baseline (no judgement on
 *      a first-time user).
 *   3. Score is clamped to [0, 100].
 *   4. Severity, pending tasks, weather risk, and recovery trend
 *      each move the score in the documented direction.
 *   5. The returned `factors` list explains the WHY of the score.
 */

import { describe, it, expect } from 'vitest';
import { computeFarmHealthScore, HEALTH_THRESHOLDS } from '../../../src/lib/farmHealthScore.js';

const NOW = Date.parse('2026-05-12T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('computeFarmHealthScore — contract', () => {
  it('returns the neutral baseline for empty input', () => {
    const r = computeFarmHealthScore({});
    expect(r.score).toBe(HEALTH_THRESHOLDS.NEUTRAL_BASELINE);
    expect(r.factors).toEqual([]);
    expect(r.band).toBe('good');
  });

  it('does not throw on garbage input', () => {
    expect(() => computeFarmHealthScore(null)).not.toThrow();
    expect(() => computeFarmHealthScore({ scanHistory: 'not-an-array' })).not.toThrow();
    expect(() => computeFarmHealthScore({ scanTasks: 42 })).not.toThrow();
  });

  it('drops the score when recent scans flagged high-severity issues', () => {
    const r = computeFarmHealthScore({
      nowMs: NOW,
      scanHistory: [
        { createdAt: new Date(NOW - 1 * DAY).toISOString(), severity: 'high', crop: 'maize' },
        { createdAt: new Date(NOW - 2 * DAY).toISOString(), severity: 'high', crop: 'maize' },
      ],
    });
    expect(r.score).toBeLessThan(HEALTH_THRESHOLDS.NEUTRAL_BASELINE);
    expect(r.factors.some((f) => f.label.includes('flagged'))).toBe(true);
  });

  it('drops the score for pending scan tasks', () => {
    const r = computeFarmHealthScore({
      nowMs: NOW,
      scanTasks: [{ completed: false }, { completed: false }, { completed: false }],
    });
    expect(r.score).toBeLessThan(HEALTH_THRESHOLDS.NEUTRAL_BASELINE);
    expect(r.stats.pendingTasks).toBe(3);
    expect(r.factors.some((f) => /open scan task/.test(f.label))).toBe(true);
  });

  it('adds a completion-rate bonus when the farmer has finished tasks', () => {
    const noBonus = computeFarmHealthScore({ nowMs: NOW });
    const withBonus = computeFarmHealthScore({
      nowMs: NOW,
      completedTaskCount: 9,
      scanTasks: [{ completed: false }],   // 9 done + 1 pending = 90% rate
    });
    // Bonus from completion partially offsets the 1-pending penalty,
    // and the bonus factor is present.
    expect(withBonus.factors.some((f) => f.label.includes('Task completion'))).toBe(true);
    expect(withBonus.score).toBeGreaterThan(noBonus.score - 3); // penalty mostly offset
  });

  it('drops the score on weather risk signals', () => {
    const r = computeFarmHealthScore({
      nowMs: NOW,
      weatherRisk: { droughtSignal: true, heatStress: true },
    });
    expect(r.score).toBeLessThan(HEALTH_THRESHOLDS.NEUTRAL_BASELINE);
    expect(r.factors.some((f) => f.label.includes('Weather'))).toBe(true);
  });

  it('rewards an improving recovery trend for the same crop', () => {
    const r = computeFarmHealthScore({
      nowMs: NOW,
      scanHistory: [
        // older scan: high severity
        { createdAt: new Date(NOW - 5 * DAY).toISOString(), severity: 'high', crop: 'maize' },
        // newer scan: low severity — improving
        { createdAt: new Date(NOW - 1 * DAY).toISOString(), severity: 'low', crop: 'maize' },
      ],
    });
    expect(r.stats.recoveryTrend).toBe('improving');
    expect(r.factors.some((f) => /improving/i.test(f.label))).toBe(true);
  });

  it('penalises a worsening trend for the same crop', () => {
    const r = computeFarmHealthScore({
      nowMs: NOW,
      scanHistory: [
        { createdAt: new Date(NOW - 5 * DAY).toISOString(), severity: 'low',  crop: 'maize' },
        { createdAt: new Date(NOW - 1 * DAY).toISOString(), severity: 'high', crop: 'maize' },
      ],
    });
    expect(r.stats.recoveryTrend).toBe('worsening');
  });

  it('clamps the score to [0, 100] under heavy pressure', () => {
    const r = computeFarmHealthScore({
      nowMs: NOW,
      scanHistory: Array.from({ length: 12 }, (_, i) => ({
        createdAt: new Date(NOW - (i + 1) * DAY).toISOString(),
        severity:  'high',
        crop:      'maize',
      })),
      scanTasks: Array.from({ length: 20 }, () => ({ completed: false })),
      weatherRisk: { droughtSignal: true, heatStress: true, floodSignal: true },
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.band).toBe('urgent');
  });

  it('assigns the correct band for boundary scores', () => {
    expect(computeFarmHealthScore({}).band).toBe('good');  // baseline 75 → good

    // Force a low score: many high-severity + pending + weather.
    const low = computeFarmHealthScore({
      nowMs: NOW,
      scanHistory: [
        { createdAt: new Date(NOW - 1 * DAY).toISOString(), severity: 'high', crop: 'maize' },
        { createdAt: new Date(NOW - 2 * DAY).toISOString(), severity: 'high', crop: 'maize' },
        { createdAt: new Date(NOW - 3 * DAY).toISOString(), severity: 'high', crop: 'maize' },
      ],
      weatherRisk: { droughtSignal: true },
    });
    expect(['needs_care', 'urgent']).toContain(low.band);
  });
});
