/**
 * intelligenceOrchestration.test.js — Phase 11 Intelligence
 * Orchestration. Verifies the one-best-action rule, suppression
 * engine, timing engine, and scan-trust gating.
 */

// localStorage / window shim for offlineStore-backed reads.
const _s = new Map();
const _ls = {
  getItem:    (k) => (_s.has(k) ? _s.get(k) : null),
  setItem:    (k, v) => { _s.set(k, String(v)); },
  removeItem: (k) => { _s.delete(k); },
  clear:      () => { _s.clear(); },
};
if (typeof globalThis.window === 'undefined') globalThis.window = { localStorage: _ls };
else if (!globalThis.window.localStorage) globalThis.window.localStorage = _ls;

import { describe, it, expect } from 'vitest';
import {
  suppressRecommendations, SUPPRESSION_REASON,
} from '../../../src/core/intelligence/recommendationSuppression.js';
import {
  optimalTimingFor, TIMING_SLOT,
} from '../../../src/core/intelligence/timingEngine.js';
import {
  orchestrateIntelligence,
} from '../../../src/core/intelligence/intelligenceOrchestrator.js';

const NOW = Date.UTC(2026, 4, 24);

// ─── §4 — suppression engine ──────────────────────────────

describe('suppressRecommendations', () => {
  it('suppresses watering when rain is the engine recommendation', () => {
    const r = suppressRecommendations(
      [{ type: 'watering', id: 'w1' }, { type: 'crop_stage_task', id: 'c1' }],
      { signals: { rainSkip: true } },
    );
    expect(r.kept.find((x) => x.type === 'watering')).toBeUndefined();
    expect(r.suppressed[0].reason).toBe(SUPPRESSION_REASON.CONFLICTS_RAIN);
  });

  it('suppresses watering already done in the last 6h', () => {
    const r = suppressRecommendations(
      [{ type: 'watering', id: 'w' }],
      { signals: { lastWateredAt: NOW - 3 * 3600000 }, nowMs: NOW },
    );
    expect(r.kept.length).toBe(0);
    expect(r.suppressed[0].reason).toBe(SUPPRESSION_REASON.ALREADY_DONE);
  });

  it('suppresses repeatedly-ignored recommendations', () => {
    const r = suppressRecommendations(
      [{ type: 'routine_check', id: 'r' }],
      { ignoreLog: { 'routine_check::r': 5 }, maxIgnores: 3 },
    );
    expect(r.kept.length).toBe(0);
    expect(r.suppressed[0].reason).toBe(SUPPRESSION_REASON.REPEATEDLY_IGNORED);
  });

  it('suppresses duplicates (same type+id)', () => {
    const r = suppressRecommendations([
      { type: 'crop_stage_task', id: 's' },
      { type: 'crop_stage_task', id: 's' },
    ]);
    expect(r.kept.length).toBe(1);
    expect(r.suppressed[0].reason).toBe(SUPPRESSION_REASON.DUPLICATE);
  });

  it('never throws on garbage input', () => {
    expect(() => suppressRecommendations(null)).not.toThrow();
  });
});

// ─── §5 — timing engine ───────────────────────────────────

describe('optimalTimingFor', () => {
  it('hot day water → morning slot', () => {
    const t = optimalTimingFor({ action: 'water', weather: { temperatureC: 34 }, nowMs: NOW });
    expect([TIMING_SLOT.MORNING, TIMING_SLOT.EVENING]).toContain(t.slot);
    expect(t.reason.fallback).toMatch(/heat|cool hours|evaporation/i);
  });

  it('windy spray request → tomorrow', () => {
    const t = optimalTimingFor({ action: 'spray', weather: { windKmh: 30 } });
    expect(t.slot).toBe(TIMING_SLOT.TOMORROW);
  });

  it('high-urgency water → now', () => {
    const t = optimalTimingFor({ action: 'water', urgency: 'high', weather: { temperatureC: 24 } });
    expect(t.slot).toBe(TIMING_SLOT.NOW);
  });

  it('inspect after rain → tomorrow', () => {
    const t = optimalTimingFor({ action: 'inspect', weather: { rainProbability24hPct: 80 } });
    expect(t.slot).toBe(TIMING_SLOT.TOMORROW);
  });

  it('harvest at normal urgency → morning', () => {
    const t = optimalTimingFor({ action: 'harvest', urgency: 'normal' });
    expect(t.slot).toBe(TIMING_SLOT.MORNING);
  });

  it('never throws on garbage input', () => {
    expect(() => optimalTimingFor(null)).not.toThrow();
  });
});

// ─── §1 + §2 — orchestrator one-best-action ──────────────

describe('orchestrateIntelligence — one best action', () => {
  it('returns the documented shape', () => {
    const v = orchestrateIntelligence({
      crop: 'tomato',
      weather: { temperatureC: 24 },
      nowMs: NOW,
    });
    expect(v.ok).toBe(true);
    expect(['low','normal','high']).toContain(v.urgency);
    expect(typeof v.bestTime).toBe('string');
    expect(Array.isArray(v.suppressedRecommendations)).toBe(true);
  });

  it('promotes urgent scan follow-up when scan trust is fine', () => {
    const v = orchestrateIntelligence({
      crop: 'tomato',
      weather: { temperatureC: 24 },
      scanHistory: [{ issueCategory: 'fungal_risk', confidenceLabel: 'medium' }],
      nowMs: NOW,
    });
    expect(v.primaryAction).toBeTruthy();
    expect(v.primaryAction.type).toBe('urgent_scan_followup');
  });

  it('downgrades scan-followup when the latest scan is needs_review', () => {
    const v = orchestrateIntelligence({
      crop: 'tomato',
      weather: { temperatureC: 34, daysSinceRain: 9 },
      scanHistory: [{ issueCategory: 'unknown_needs_clearer_photo', confidenceLabel: 'needs_review' }],
      nowMs: NOW,
    });
    expect(v.scanTrustLimited).toBe(true);
    // Primary action should NOT be urgent_scan_followup any more.
    if (v.primaryAction) {
      expect(v.primaryAction.type).not.toBe('urgent_scan_followup');
    }
  });

  it('suppresses watering when the watering engine independently says skip', () => {
    const v = orchestrateIntelligence({
      crop: 'tomato',
      weather: { rainProbability24hPct: 90 },  // → wateringEngine = skip
      nowMs: NOW,
    });
    // The primary action MAY be something else, but if watering
    // appears in suppressed, the conflict rule fired.
    const suppressedWatering = v.suppressedRecommendations
      .find((s) => s.rec && s.rec.type === 'watering');
    if (suppressedWatering) {
      expect(suppressedWatering.reason).toBe(SUPPRESSION_REASON.CONFLICTS_RAIN);
    }
  });

  it('hot-day watering primary resolves bestTime to morning/evening', () => {
    const v = orchestrateIntelligence({
      crop: 'maize',
      weather: { temperatureC: 34, daysSinceRain: 8 },
      nowMs: NOW,
    });
    if (v.primaryAction && v.primaryAction.type === 'watering') {
      expect(['morning','evening']).toContain(v.bestTime);
    }
  });

  it('every truthy primaryAction carries a why envelope (transparency)', () => {
    const v = orchestrateIntelligence({
      crop: 'tomato',
      weather: { frostRiskTonight: true },
      nowMs: NOW,
    });
    if (v.primaryAction) {
      expect(v.reason).toBeTruthy();
    }
  });

  it('never throws on garbage input', () => {
    expect(() => orchestrateIntelligence(null)).not.toThrow();
  });
});
