/**
 * scanPatternDetection.test.js — pins the §5+§6 contract:
 *   1. Empty history → 'first_scan' / no recurrence.
 *   2. Before/after diff for the same crop (improving/worsening/stable).
 *   3. Recurrence triggers at 3+ matching scans inside the lookback.
 *   4. Never throws on garbage inputs.
 *   5. Ignores scans outside the lookback windows.
 */

import { describe, it, expect } from 'vitest';
import {
  detectScanPattern,
  PATTERN_THRESHOLDS,
} from '../../../src/lib/scanPatternDetection.js';

const NOW = Date.parse('2026-05-12T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const makeCurrent = (overrides = {}) => ({
  scanId:        'cur',
  cropName:      'maize',
  possibleIssue: 'leaf rust',
  severity:      'medium',
  ...overrides,
});

describe('detectScanPattern — contract', () => {
  it('returns first_scan with no prior on empty history', () => {
    const r = detectScanPattern(makeCurrent(), [], { nowMs: NOW });
    expect(r.previous).toBeNull();
    expect(r.trend).toBe('first_scan');
    expect(r.recurrence.count).toBe(0);
  });

  it('does not throw on garbage input', () => {
    expect(() => detectScanPattern(null, null)).not.toThrow();
    expect(() => detectScanPattern({}, 'not-an-array')).not.toThrow();
  });

  it('detects an improving trend when the prior same-crop scan was higher severity', () => {
    const r = detectScanPattern(
      makeCurrent({ severity: 'low' }),
      [
        { id: 'p1', crop: 'maize', severity: 'high', createdAt: new Date(NOW - 5 * DAY).toISOString(), noticed: 'leaf rust' },
      ],
      { nowMs: NOW },
    );
    expect(r.previous).not.toBeNull();
    expect(r.previous.id).toBe('p1');
    expect(r.previous.daysAgo).toBe(5);
    expect(r.trend).toBe('improving');
  });

  it('detects a worsening trend when the prior was lower severity', () => {
    const r = detectScanPattern(
      makeCurrent({ severity: 'high' }),
      [
        { id: 'p1', crop: 'maize', severity: 'low', createdAt: new Date(NOW - 3 * DAY).toISOString(), noticed: 'leaf rust' },
      ],
      { nowMs: NOW },
    );
    expect(r.trend).toBe('worsening');
  });

  it('detects a stable trend when severities match', () => {
    const r = detectScanPattern(
      makeCurrent({ severity: 'medium' }),
      [
        { id: 'p1', crop: 'maize', severity: 'medium', createdAt: new Date(NOW - 2 * DAY).toISOString(), noticed: 'leaf rust' },
      ],
      { nowMs: NOW },
    );
    expect(r.trend).toBe('stable');
  });

  it('ignores prior scans outside the 60-day before/after window', () => {
    const r = detectScanPattern(
      makeCurrent(),
      [
        { id: 'p1', crop: 'maize', severity: 'high', createdAt: new Date(NOW - 90 * DAY).toISOString(), noticed: 'leaf rust' },
      ],
      { nowMs: NOW },
    );
    expect(r.previous).toBeNull();
    expect(r.trend).toBe('first_scan');
  });

  it('ignores prior scans of a different crop', () => {
    const r = detectScanPattern(
      makeCurrent({ cropName: 'maize' }),
      [
        { id: 'p1', crop: 'tomato', severity: 'high', createdAt: new Date(NOW - 5 * DAY).toISOString(), noticed: 'leaf rust' },
      ],
      { nowMs: NOW },
    );
    expect(r.previous).toBeNull();
  });

  it('fires recurrence when same crop + same issue scanned 3+ times in 2 weeks', () => {
    const r = detectScanPattern(
      makeCurrent(),
      [
        { id: 'p1', crop: 'maize', severity: 'low', createdAt: new Date(NOW - 2 * DAY).toISOString(), noticed: 'leaf rust' },
        { id: 'p2', crop: 'maize', severity: 'low', createdAt: new Date(NOW - 6 * DAY).toISOString(), noticed: 'leaf rust' },
      ],
      { nowMs: NOW },
    );
    expect(r.recurrence.count).toBe(3); // current + 2 priors
    expect(r.recurrence.issue).toBe('leaf rust');
    expect(r.recurrence.sinceDays).toBeGreaterThan(0);
  });

  it('does NOT fire recurrence for unrelated issues even on same crop', () => {
    const r = detectScanPattern(
      makeCurrent({ possibleIssue: 'leaf rust' }),
      [
        { id: 'p1', crop: 'maize', severity: 'low', createdAt: new Date(NOW - 2 * DAY).toISOString(), noticed: 'pest damage' },
        { id: 'p2', crop: 'maize', severity: 'low', createdAt: new Date(NOW - 6 * DAY).toISOString(), noticed: 'water stress' },
      ],
      { nowMs: NOW },
    );
    expect(r.recurrence.count).toBe(0);
  });

  it('ignores priors outside the 14-day recurrence window', () => {
    const r = detectScanPattern(
      makeCurrent(),
      [
        { id: 'p1', crop: 'maize', severity: 'low', createdAt: new Date(NOW -  2 * DAY).toISOString(), noticed: 'leaf rust' },
        { id: 'p2', crop: 'maize', severity: 'low', createdAt: new Date(NOW - 30 * DAY).toISOString(), noticed: 'leaf rust' },
      ],
      { nowMs: NOW },
    );
    // Only 1 prior is in-window so count = 2, below the 3 minimum.
    expect(r.recurrence.count).toBe(0);
  });

  it('excludes the current scan itself from the history walk', () => {
    const r = detectScanPattern(
      makeCurrent({ scanId: 'p1' }),  // collides with prior id
      [
        { id: 'p1', crop: 'maize', severity: 'high', createdAt: new Date(NOW - 5 * DAY).toISOString(), noticed: 'leaf rust' },
      ],
      { nowMs: NOW },
    );
    expect(r.previous).toBeNull();
  });

  it('exposes frozen tunables', () => {
    expect(Object.isFrozen(PATTERN_THRESHOLDS)).toBe(true);
    expect(PATTERN_THRESHOLDS.RECURRENCE_MIN).toBe(3);
    expect(PATTERN_THRESHOLDS.LOOKBACK_MS).toBeGreaterThan(0);
  });
});
