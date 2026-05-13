/**
 * farmHealthStatus.test.js — pins the §16 simple-status contract.
 *
 *   1. excellent + good bands → STABLE
 *   2. needs_care → WATCH
 *   3. urgent → NEEDS_ATTENTION
 *   4. Qualitative fallback infers tone from open tasks / scans /
 *      recovery trend
 *   5. Output NEVER contains a numeric score (spec rule)
 *   6. No "critical" / "dangerous" / "fatal" wording in summaries
 *   7. Returns null when nothing actionable + null is honored
 *   8. Never throws on garbage input
 */

import { describe, it, expect } from 'vitest';
import {
  FARM_HEALTH_TONES,
  getFarmHealthStatus,
  shouldShowHealthStatus,
} from '../../../src/lib/farmHealthStatus.js';

// ─── Band → tone mapping ───────────────────────────────────────

describe('getFarmHealthStatus — band mapping', () => {
  it('excellent band → STABLE', () => {
    const r = getFarmHealthStatus({ band: 'excellent', score: 92 });
    expect(r.tone).toBe(FARM_HEALTH_TONES.STABLE);
    expect(r.label).toBe('Stable');
  });

  it('good band → STABLE', () => {
    const r = getFarmHealthStatus({ band: 'good', score: 75 });
    expect(r.tone).toBe(FARM_HEALTH_TONES.STABLE);
  });

  it('needs_care band → WATCH', () => {
    const r = getFarmHealthStatus({ band: 'needs_care', score: 55 });
    expect(r.tone).toBe(FARM_HEALTH_TONES.WATCH);
    expect(r.label).toBe('Watch');
  });

  it('urgent band → NEEDS_ATTENTION', () => {
    const r = getFarmHealthStatus({ band: 'urgent', score: 30 });
    expect(r.tone).toBe(FARM_HEALTH_TONES.NEEDS_ATTENTION);
    expect(r.label).toBe('Needs attention');
  });

  it('is case-insensitive on band string', () => {
    expect(getFarmHealthStatus({ band: 'URGENT' }).tone)
      .toBe(FARM_HEALTH_TONES.NEEDS_ATTENTION);
    expect(getFarmHealthStatus({ band: 'Good' }).tone)
      .toBe(FARM_HEALTH_TONES.STABLE);
  });

  it('result is frozen — UI cannot mutate canonical strings', () => {
    const r = getFarmHealthStatus({ band: 'good' });
    expect(Object.isFrozen(r)).toBe(true);
  });
});

// ─── Qualitative fallback ─────────────────────────────────────

describe('getFarmHealthStatus — qualitative fallback', () => {
  it('2+ recent severe scans → NEEDS_ATTENTION', () => {
    const r = getFarmHealthStatus({
      signals: { recentHighSeverityScans: 2 },
    });
    expect(r.tone).toBe(FARM_HEALTH_TONES.NEEDS_ATTENTION);
  });

  it('3+ open high-urgency tasks → NEEDS_ATTENTION', () => {
    const r = getFarmHealthStatus({
      signals: { openHighUrgencyTasks: 4 },
    });
    expect(r.tone).toBe(FARM_HEALTH_TONES.NEEDS_ATTENTION);
  });

  it('worsening recovery trend → NEEDS_ATTENTION', () => {
    const r = getFarmHealthStatus({
      signals: { recoveryTrend: 'worsening' },
    });
    expect(r.tone).toBe(FARM_HEALTH_TONES.NEEDS_ATTENTION);
  });

  it('1 severe scan → WATCH', () => {
    const r = getFarmHealthStatus({
      signals: { recentHighSeverityScans: 1 },
    });
    expect(r.tone).toBe(FARM_HEALTH_TONES.WATCH);
  });

  it('1 open high-urgency task → WATCH', () => {
    const r = getFarmHealthStatus({
      signals: { openHighUrgencyTasks: 1 },
    });
    expect(r.tone).toBe(FARM_HEALTH_TONES.WATCH);
  });

  it('weather flagged → WATCH', () => {
    const r = getFarmHealthStatus({
      signals: { weatherFlagged: true },
    });
    expect(r.tone).toBe(FARM_HEALTH_TONES.WATCH);
  });

  it('improving recovery → STABLE', () => {
    const r = getFarmHealthStatus({
      signals: { recoveryTrend: 'improving' },
    });
    expect(r.tone).toBe(FARM_HEALTH_TONES.STABLE);
  });

  it('stable recovery → STABLE', () => {
    const r = getFarmHealthStatus({
      signals: { recoveryTrend: 'stable' },
    });
    expect(r.tone).toBe(FARM_HEALTH_TONES.STABLE);
  });

  it('null signals + no band → null (nothing to surface)', () => {
    expect(getFarmHealthStatus({})).toBeNull();
    expect(getFarmHealthStatus({ signals: {} })).toBeNull();
  });
});

// ─── No numeric score in output (spec rule) ────────────────────

describe('output never contains numeric score', () => {
  it('output has only tone/label/summary fields', () => {
    const r = getFarmHealthStatus({ band: 'good', score: 75 });
    expect(Object.keys(r).sort()).toEqual(['label', 'summary', 'tone']);
    expect(r.score).toBeUndefined();
  });

  it('summary text never quotes a numeric score', () => {
    for (const band of ['excellent', 'good', 'needs_care', 'urgent']) {
      const r = getFarmHealthStatus({ band, score: 50 });
      expect(r.summary).not.toMatch(/\d+/);
      expect(r.label).not.toMatch(/\d+/);
    }
  });
});

// ─── Calm wording — no scary language ─────────────────────────

describe('summaries use calm vocabulary only', () => {
  it('no panic words in any band\'s summary', () => {
    const banned = /\b(?:critical|dangerous|catastrophic|fatal|emergency|severe error)\b/i;
    for (const band of ['excellent', 'good', 'needs_care', 'urgent']) {
      const r = getFarmHealthStatus({ band });
      expect(r.summary).not.toMatch(banned);
      expect(r.label).not.toMatch(banned);
    }
  });

  it('label is one of the 3 spec phrases (no others)', () => {
    const expected = new Set(['Stable', 'Watch', 'Needs attention']);
    for (const band of ['excellent', 'good', 'needs_care', 'urgent']) {
      const r = getFarmHealthStatus({ band });
      expect(expected.has(r.label)).toBe(true);
    }
  });
});

// ─── Robustness ───────────────────────────────────────────────

describe('never throws + tolerates garbage', () => {
  it('returns null on null / undefined / non-object', () => {
    expect(getFarmHealthStatus(null)).toBeNull();
    expect(getFarmHealthStatus(undefined)).toBeNull();
    expect(getFarmHealthStatus('not an object')).toBeNull();
  });

  it('returns null on unknown band', () => {
    expect(getFarmHealthStatus({ band: 'totally_unknown' })).toBeNull();
  });

  it('never throws on garbage signals', () => {
    expect(() => getFarmHealthStatus({ signals: 'not an object' })).not.toThrow();
    expect(() => getFarmHealthStatus({ signals: { recentHighSeverityScans: 'a lot' } }))
      .not.toThrow();
  });
});

// ─── shouldShowHealthStatus ───────────────────────────────────

describe('shouldShowHealthStatus', () => {
  it('true for any valid status', () => {
    for (const band of ['excellent', 'good', 'needs_care', 'urgent']) {
      expect(shouldShowHealthStatus(getFarmHealthStatus({ band }))).toBe(true);
    }
  });

  it('false for null / garbage', () => {
    expect(shouldShowHealthStatus(null)).toBe(false);
    expect(shouldShowHealthStatus({})).toBe(false);
    expect(shouldShowHealthStatus({ tone: 'bogus' })).toBe(false);
  });
});

// ─── Frozen registry ──────────────────────────────────────────

describe('FARM_HEALTH_TONES is frozen', () => {
  it('cannot mutate the canonical tone keys', () => {
    expect(Object.isFrozen(FARM_HEALTH_TONES)).toBe(true);
    expect(FARM_HEALTH_TONES.STABLE).toBe('STABLE');
    expect(FARM_HEALTH_TONES.WATCH).toBe('WATCH');
    expect(FARM_HEALTH_TONES.NEEDS_ATTENTION).toBe('NEEDS_ATTENTION');
  });
});
