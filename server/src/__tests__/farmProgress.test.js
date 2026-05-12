/**
 * farmProgress.test.js — pins the §10 contract:
 *   1. Empty input → no positive signals.
 *   2. Completed tasks are counted within today + this-week windows.
 *   3. Improving recovery trend surfaces as a positive signal.
 *   4. Health band excellent/good adds a signal; needs_care/urgent
 *      does NOT (we don't celebrate problems).
 *   5. positiveSignals capped at 3.
 */

import { describe, it, expect } from 'vitest';
import { computeFarmProgress } from '../../../src/lib/farmProgress.js';

const NOW = Date.parse('2026-05-12T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY  = 24 * HOUR;

describe('computeFarmProgress — contract', () => {
  it('returns a stable empty shape', () => {
    const r = computeFarmProgress({});
    expect(r.completedToday).toBe(0);
    expect(r.completedThisWeek).toBe(0);
    expect(r.recoveryTrend).toBe('first_scan');
    expect(r.healthBand).toBeNull();
    expect(r.healthScore).toBeNull();
    expect(r.positiveSignals).toEqual([]);
  });

  it('does not throw on null / garbage', () => {
    expect(() => computeFarmProgress(null)).not.toThrow();
    expect(() => computeFarmProgress({ scanTasks: 'not-array' })).not.toThrow();
  });

  it('counts tasks completed today and this week separately', () => {
    const r = computeFarmProgress({
      nowMs: NOW,
      scanTasks: [
        { completed: true, completedAt: new Date(NOW - 2 * HOUR).toISOString() },
        { completed: true, completedAt: new Date(NOW - 3 * DAY).toISOString() },
        { completed: true, completedAt: new Date(NOW - 30 * DAY).toISOString() },
      ],
    });
    expect(r.completedToday).toBe(1);
    expect(r.completedThisWeek).toBe(2);
  });

  it('surfaces improving recovery trend as a positive signal', () => {
    const r = computeFarmProgress({
      nowMs: NOW,
      pattern: { trend: 'improving' },
    });
    expect(r.positiveSignals.some((s) => /improving/i.test(s))).toBe(true);
  });

  it('does not surface a positive signal for worsening trend', () => {
    const r = computeFarmProgress({
      nowMs: NOW,
      pattern: { trend: 'worsening' },
    });
    expect(r.positiveSignals.some((s) => /improving/i.test(s))).toBe(false);
  });

  it('celebrates excellent / good health bands', () => {
    const e = computeFarmProgress({
      nowMs: NOW,
      healthScore: { score: 92, band: 'excellent' },
    });
    expect(e.positiveSignals.some((s) => /on track/i.test(s))).toBe(true);

    const g = computeFarmProgress({
      nowMs: NOW,
      healthScore: { score: 78, band: 'good' },
    });
    expect(g.positiveSignals.some((s) => /mostly healthy/i.test(s))).toBe(true);
  });

  it('does NOT add a health signal for needs_care / urgent', () => {
    const r = computeFarmProgress({
      nowMs: NOW,
      healthScore: { score: 35, band: 'urgent' },
    });
    expect(r.positiveSignals.some((s) => /score/i.test(s))).toBe(false);
  });

  it('caps positiveSignals at 3', () => {
    const r = computeFarmProgress({
      nowMs: NOW,
      pattern: { trend: 'improving' },
      healthScore: { score: 90, band: 'excellent' },
      scanTasks: Array.from({ length: 5 }, () => ({
        completed: true, completedAt: new Date(NOW - HOUR).toISOString(),
      })),
    });
    expect(r.positiveSignals.length).toBeLessThanOrEqual(3);
  });
});
