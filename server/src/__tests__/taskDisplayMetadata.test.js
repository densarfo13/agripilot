/**
 * taskDisplayMetadata.test.js — pins the §7 derivation contract:
 *   1. Known actionType returns numeric estimatedMinutes + a calm
 *      bestTime narrative.
 *   2. Unknown actionType returns { null, null } (caller skips render).
 *   3. Null / garbage input returns { null, null }.
 *   4. High urgency or overdue tasks surface a time-pressure variant.
 *   5. Batch helper returns a parallel array.
 *   6. Cadence stays in sync with the normalizer (sanity check).
 */

import { describe, it, expect } from 'vitest';
import {
  getTaskDisplayMetadata,
  getBatchTaskDisplayMetadata,
} from '../../../src/lib/taskDisplayMetadata.js';

const NOW = Date.parse('2026-05-12T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe('getTaskDisplayMetadata — contract', () => {
  it('returns { null, null } on null / garbage', () => {
    expect(getTaskDisplayMetadata(null)).toEqual({ bestTime: null, estimatedMinutes: null });
    expect(getTaskDisplayMetadata(undefined)).toEqual({ bestTime: null, estimatedMinutes: null });
    expect(getTaskDisplayMetadata('not an object')).toEqual({ bestTime: null, estimatedMinutes: null });
  });

  it('returns numeric minutes for known actionTypes', () => {
    expect(getTaskDisplayMetadata({ actionType: 'spray' }).estimatedMinutes).toBe(25);
    expect(getTaskDisplayMetadata({ actionType: 'inspect' }).estimatedMinutes).toBe(10);
    expect(getTaskDisplayMetadata({ actionType: 'harvest' }).estimatedMinutes).toBe(60);
  });

  it('returns calm bestTime narrative for known actionTypes', () => {
    expect(getTaskDisplayMetadata({ actionType: 'spray' }).bestTime.toLowerCase()).toMatch(/evening/);
    expect(getTaskDisplayMetadata({ actionType: 'water' }).bestTime.toLowerCase()).toMatch(/dawn|sunset/);
    expect(getTaskDisplayMetadata({ actionType: 'harvest' }).bestTime.toLowerCase()).toMatch(/mid-?morning/);
  });

  it('returns { null, null } for unknown actionType', () => {
    expect(getTaskDisplayMetadata({ actionType: 'totally_unknown' })).toEqual({
      bestTime: null,
      estimatedMinutes: null,
    });
  });

  it('returns { null, null } when actionType is missing', () => {
    expect(getTaskDisplayMetadata({})).toEqual({ bestTime: null, estimatedMinutes: null });
  });

  it('high-urgency adds time-pressure context to bestTime', () => {
    const r = getTaskDisplayMetadata({ actionType: 'fertilize', urgency: 'high' }, { nowMs: NOW });
    // 'fertilize' base is "On a calm, dry day" — high urgency tacks
    // the (today) qualifier.
    expect(r.bestTime).toContain('today');
  });

  it('overdue task surfaces "Today — task is overdue"', () => {
    const r = getTaskDisplayMetadata({
      actionType: 'inspect',
      urgency: 'medium',
      dueAt: new Date(NOW - 6 * HOUR).toISOString(),
    }, { nowMs: NOW });
    expect(r.bestTime).toMatch(/overdue/i);
  });

  it('future-due task keeps the calm narrative', () => {
    const r = getTaskDisplayMetadata({
      actionType: 'inspect',
      urgency: 'medium',
      dueAt: new Date(NOW + 48 * HOUR).toISOString(),
    }, { nowMs: NOW });
    expect(r.bestTime).not.toMatch(/overdue/i);
  });

  it('is case-insensitive on actionType', () => {
    expect(getTaskDisplayMetadata({ actionType: 'SPRAY' }).estimatedMinutes).toBe(25);
    expect(getTaskDisplayMetadata({ actionType: 'Inspect' }).estimatedMinutes).toBe(10);
  });
});

describe('getBatchTaskDisplayMetadata', () => {
  it('returns a parallel array', () => {
    const out = getBatchTaskDisplayMetadata([
      { actionType: 'spray' },
      null,
      { actionType: 'water' },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0].estimatedMinutes).toBe(25);
    expect(out[1]).toEqual({ bestTime: null, estimatedMinutes: null });
    expect(out[2].estimatedMinutes).toBe(15);
  });

  it('returns [] for non-array input', () => {
    expect(getBatchTaskDisplayMetadata(null)).toEqual([]);
    expect(getBatchTaskDisplayMetadata('not an array')).toEqual([]);
  });
});

describe('cadence sync with nextBestActionNormalizer (sanity)', () => {
  it('produces the same estimatedMinutes for the same actionType', async () => {
    const { normalizeNextBestAction } = await import('../../../src/lib/nextBestActionNormalizer.js');
    for (const a of ['spray', 'water', 'inspect', 'harvest', 'fertilize']) {
      const fromTask = getTaskDisplayMetadata({ actionType: a }).estimatedMinutes;
      const fromNorm = normalizeNextBestAction({
        kind: 'task_top',
        title: 't',
        reason: 'r',
        actionType: a,
      }).estimatedMinutes;
      expect(fromTask).toBe(fromNorm);
    }
  });
});
