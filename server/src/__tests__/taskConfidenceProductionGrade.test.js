/**
 * taskConfidenceProductionGrade.test.js — production-grade
 * audit of taskConfidence.js.
 *
 * Covers what the spec asked for:
 *   • boolean return safety (no undefined leaks)
 *   • partial confidence object tolerance
 *   • risky vs low-risk intent classification
 *   • check-first only when level=low + risky intent + real reason
 *   • no over-softening of observational tasks
 *   • no imperative wording surviving low-confidence conflicts
 *   • reason allowlist (check-first reasons stay tight)
 */

import { describe, it, expect } from 'vitest';

import {
  shouldUseCheckFirst,
  shouldUseSoftWhy,
  shouldUseStateFirst,
  isRiskyIntent,
  hasConflictReason,
  normalizeConfidence,
  applyConfidenceWording,
  scoreTaskConfidence,
  _internal,
} from '../services/today/taskConfidence.js';

// ─── 1. BOOLEAN-RETURN SAFETY ────────────────────────────
describe('shouldUseCheckFirst — boolean return safety', () => {
  it('returns false (not undefined) for missing confidence', () => {
    expect(shouldUseCheckFirst({ intent: 'plant' }, undefined)).toBe(false);
    expect(shouldUseCheckFirst({ intent: 'plant' }, null)).toBe(false);
  });

  it('returns false for a confidence object with no reasons field', () => {
    // The failing historical test: `{ intent: 'scout' }, { level: 'low' }`
    expect(shouldUseCheckFirst({ intent: 'scout' }, { level: 'low' })).toBe(false);
    // And the same call with a risky intent — still false, because
    // low alone isn't enough: we require a conflict reason.
    expect(shouldUseCheckFirst({ intent: 'plant' }, { level: 'low' })).toBe(false);
  });

  it('returns false for an explicit empty reasons array', () => {
    expect(shouldUseCheckFirst({ intent: 'plant' },
      { level: 'low', reasons: [] })).toBe(false);
  });

  it('returns an explicit boolean (type === boolean) for every path', () => {
    const paths = [
      [shouldUseCheckFirst(null, null)],
      [shouldUseCheckFirst({}, { level: 'high' })],
      [shouldUseCheckFirst({ intent: 'plant' }, { level: 'medium', reasons: ['conflict_land_vs_stage'] })],
      [shouldUseCheckFirst({ intent: 'plant' }, { level: 'low',  reasons: ['conflict_land_vs_stage'] })],
      [shouldUseCheckFirst({ intent: 'scout' }, { level: 'low',  reasons: ['conflict_land_vs_stage'] })],
    ];
    for (const [result] of paths) {
      expect(typeof result).toBe('boolean');
    }
  });
});

// ─── 2. CHECK-FIRST LOGIC CORRECTNESS ────────────────────
describe('shouldUseCheckFirst — contract', () => {
  it('true only when level=low AND intent is risky AND a reason fired', () => {
    expect(shouldUseCheckFirst({ intent: 'plant' },
      { level: 'low', reasons: ['conflict_land_vs_stage'] })).toBe(true);
  });

  it('false when level is medium even on a real conflict', () => {
    expect(shouldUseCheckFirst({ intent: 'plant' },
      { level: 'medium', reasons: ['conflict_land_vs_stage'] })).toBe(false);
  });

  it('false when level is high even on a real conflict', () => {
    expect(shouldUseCheckFirst({ intent: 'plant' },
      { level: 'high', reasons: ['conflict_land_vs_stage'] })).toBe(false);
  });

  it('false for low-risk intents even when level=low and conflict present', () => {
    for (const intent of ['scout', 'inspect', 'observe', 'review', 'check_status', 'water']) {
      expect(shouldUseCheckFirst({ intent },
        { level: 'low', reasons: ['conflict_land_vs_stage'] })).toBe(false);
    }
  });

  it('false for risky intents at low confidence WITHOUT a conflict reason', () => {
    for (const intent of ['plant', 'drain', 'clear', 'prep', 'fertilize', 'spray', 'harvest']) {
      expect(shouldUseCheckFirst({ intent },
        { level: 'low', reasons: ['weather_missing'] })).toBe(false);
    }
  });

  it('true for risky intents when any allowlisted reason fires', () => {
    const allowlisted = [
      'conflict_land_vs_stage',
      'conflict_weather_vs_land',
      'stale_offline_state',
      'weak_camera_signal',
      'camera_uncertain',
      'compound_wet_risk',
    ];
    for (const reason of allowlisted) {
      expect(shouldUseCheckFirst({ intent: 'plant' },
        { level: 'low', reasons: [reason] })).toBe(true);
    }
  });

  it('falls back to task.code when task.intent is missing', () => {
    expect(shouldUseCheckFirst({ code: 'plant' },
      { level: 'low', reasons: ['conflict_land_vs_stage'] })).toBe(true);
  });

  it('no intent + no code → false (no implicit match)', () => {
    expect(shouldUseCheckFirst({},
      { level: 'low', reasons: ['conflict_land_vs_stage'] })).toBe(false);
  });

  it('broad substring matches that used to fire no longer do', () => {
    // Old regex /plant|drain|prep|clear/ would fire for "plantain"
    // or any intent containing those substrings. The new set-based
    // match uses exact lowercase equality.
    expect(shouldUseCheckFirst({ intent: 'plantain_check' },
      { level: 'low', reasons: ['conflict_land_vs_stage'] })).toBe(false);
    expect(shouldUseCheckFirst({ intent: 'preparation_report' },
      { level: 'low', reasons: ['conflict_land_vs_stage'] })).toBe(false);
  });
});

// ─── 3. PARTIAL CONFIDENCE OBJECTS ───────────────────────
describe('normalizeConfidence — predictable defaults', () => {
  it('null / undefined → null', () => {
    expect(normalizeConfidence(null)).toBeNull();
    expect(normalizeConfidence(undefined)).toBeNull();
  });

  it('non-object → null', () => {
    expect(normalizeConfidence('high')).toBeNull();
    expect(normalizeConfidence(0.9)).toBeNull();
  });

  it('{ level: "low" } → level=low, reasons=[], score=null', () => {
    const c = normalizeConfidence({ level: 'low' });
    expect(c.level).toBe('low');
    expect(c.reasons).toEqual([]);
    expect(c.score).toBeNull();
  });

  it('unknown level → medium (safe default)', () => {
    expect(normalizeConfidence({ level: 'extreme' }).level).toBe('medium');
    expect(normalizeConfidence({}).level).toBe('medium');
  });

  it('passes through a well-formed object intact', () => {
    const c = normalizeConfidence({
      level: 'high', score: 85, reasons: ['r1', 'r2'],
    });
    expect(c).toEqual({ level: 'high', score: 85, reasons: ['r1', 'r2'] });
  });

  it('never throws on malformed input', () => {
    expect(() => normalizeConfidence({ level: 1, score: 'x', reasons: 'oops' })).not.toThrow();
    const c = normalizeConfidence({ level: 1, score: 'x', reasons: 'oops' });
    expect(c.level).toBe('medium');
    expect(c.reasons).toEqual([]);
    expect(c.score).toBeNull();
  });
});

// ─── 4. INTENT CLASSIFICATION ────────────────────────────
describe('isRiskyIntent / hasConflictReason', () => {
  it('isRiskyIntent matches exactly (no substring)', () => {
    expect(isRiskyIntent('plant')).toBe(true);
    expect(isRiskyIntent('Plant')).toBe(true);   // case-insensitive
    expect(isRiskyIntent('scout')).toBe(false);
    expect(isRiskyIntent('plantain')).toBe(false);
    expect(isRiskyIntent('')).toBe(false);
    expect(isRiskyIntent(null)).toBe(false);
  });

  it('covers all risky intents from the spec', () => {
    for (const i of ['plant', 'drain', 'prep', 'clear', 'fertilize', 'spray', 'harvest']) {
      expect(isRiskyIntent(i)).toBe(true);
    }
  });

  it('hasConflictReason tolerates null/undefined/empty/non-array', () => {
    expect(hasConflictReason(null)).toBe(false);
    expect(hasConflictReason(undefined)).toBe(false);
    expect(hasConflictReason([])).toBe(false);
    expect(hasConflictReason('conflict_land_vs_stage')).toBe(false); // not an array
  });

  it('returns true when any allowlisted reason is present', () => {
    expect(hasConflictReason(['irrelevant', 'conflict_land_vs_stage', 'also_ignored']))
      .toBe(true);
  });

  it('returns false when reasons exist but none are allowlisted', () => {
    expect(hasConflictReason(['weather_missing', 'land_missing'])).toBe(false);
  });
});

// ─── 5. SOFT-WHY / STATE-FIRST PREDICATES ────────────────
describe('shouldUseSoftWhy', () => {
  it('true for low + risky', () => {
    expect(shouldUseSoftWhy({ intent: 'plant' }, { level: 'low' })).toBe(true);
  });
  it('true for medium + risky', () => {
    expect(shouldUseSoftWhy({ intent: 'plant' }, { level: 'medium' })).toBe(true);
  });
  it('false for high confidence regardless of intent', () => {
    expect(shouldUseSoftWhy({ intent: 'plant' }, { level: 'high' })).toBe(false);
  });
  it('false for low-risk intents', () => {
    expect(shouldUseSoftWhy({ intent: 'scout' }, { level: 'low' })).toBe(false);
  });
  it('boolean for null inputs', () => {
    expect(shouldUseSoftWhy(null, null)).toBe(false);
    expect(typeof shouldUseSoftWhy(null, null)).toBe('boolean');
  });
});

describe('shouldUseStateFirst', () => {
  it('true for low + risky (flips display to state-first)', () => {
    expect(shouldUseStateFirst({ intent: 'plant' }, { level: 'low' })).toBe(true);
  });
  it('false for low + low-risk observational intent', () => {
    expect(shouldUseStateFirst({ intent: 'scout' }, { level: 'low' })).toBe(false);
  });
  it('false for medium + risky', () => {
    expect(shouldUseStateFirst({ intent: 'plant' }, { level: 'medium' })).toBe(false);
  });
  it('boolean for all inputs', () => {
    for (const input of [[null, null], [{}, {}], [{ intent: 'plant' }, { level: 'high' }]]) {
      expect(typeof shouldUseStateFirst(...input)).toBe('boolean');
    }
  });
});

// ─── 6. NO OVER-SOFTENING OF OBSERVATIONAL TASKS ─────────
describe('applyConfidenceWording — does not soften observational tasks', () => {
  it('low-risk "scout" task keeps its original title at LOW confidence', () => {
    const task = { intent: 'scout', title: 'Check your plants for pests' };
    const out = applyConfidenceWording(task, { level: 'low' });
    expect(out.title).toBe('Check your plants for pests');
  });

  it('low-risk task keeps its titleKey WITHOUT a tier suffix', () => {
    const task = { intent: 'scout', titleKey: 'task.scoutPests' };
    const out = applyConfidenceWording(task, { level: 'low' });
    expect(out.titleKey).toBe('task.scoutPests');
  });

  it('low-risk "water" task is NOT softened at MEDIUM confidence', () => {
    const task = { intent: 'water', title: 'Water your crop today' };
    const out = applyConfidenceWording(task, { level: 'medium' });
    expect(out.title).toBe('Water your crop today');
  });

  it('risky task IS softened at MEDIUM confidence', () => {
    const task = { intent: 'plant', title: 'Plant your seeds now' };
    const out = applyConfidenceWording(task, { level: 'medium' });
    expect(out.title).not.toBe(task.title);
    expect(out.title.toLowerCase()).toMatch(/may|likely|might/);
  });

  it('risky task at LOW confidence WITHOUT a reason is softened BUT not turned into check-first', () => {
    const task = { intent: 'plant', title: 'Plant your seeds now' };
    const out = applyConfidenceWording(task, { level: 'low' });
    expect(out.checkFirst).not.toBe(true);
    // hedgeTitle's low path for "Plant" produces "Check if the soil
    // is ready before planting" — safe, observational framing.
    expect(out.title.toLowerCase()).toMatch(/check|may/);
  });

  it('risky task at LOW confidence WITH a real conflict becomes check-first', () => {
    const task = {
      intent: 'plant', title: 'Plant your seeds now',
      titleKey: 'task.plant',
    };
    const out = applyConfidenceWording(task,
      { level: 'low', reasons: ['conflict_land_vs_stage'] });
    expect(out.checkFirst).toBe(true);
    expect(out.titleKey).toBe('confidence.checkFirst.title');
  });
});

// ─── 7. NO IMPERATIVE LEAK AT LOW CONFIDENCE ─────────────
describe('applyConfidenceWording — LOW confidence never emits imperative copy', () => {
  it('low-confidence plant task does not render "Plant now"', () => {
    const out = applyConfidenceWording({ intent: 'plant', title: 'Plant your seeds now' },
      { level: 'low', reasons: ['conflict_land_vs_stage'] });
    expect(out.title.toLowerCase()).not.toMatch(/\bplant now\b/);
  });

  it('low-confidence clear task does not sound imperative', () => {
    const out = applyConfidenceWording({ intent: 'clear', title: 'Clear your field this week' },
      { level: 'low', reasons: ['conflict_land_vs_stage'] });
    expect(out.title.toLowerCase()).not.toMatch(/\bclear your field this week\b/);
    expect(out.title.toLowerCase()).toMatch(/check/);
  });
});

// ─── 8. HIGH CONFIDENCE PRESERVES DIRECT COPY ────────────
describe('applyConfidenceWording — HIGH confidence is direct', () => {
  it('keeps the imperative title unchanged at HIGH', () => {
    const out = applyConfidenceWording({ intent: 'plant', title: 'Plant your seeds now' },
      { level: 'high' });
    expect(out.title).toBe('Plant your seeds now');
  });

  it('uses the .high tier variant if a key-driven task has one', () => {
    const task = { intent: 'plant', titleKey: 'task.plant' };
    const t = (k) => (k === 'task.plant.high' ? 'Plant today' : k);
    const out = applyConfidenceWording(task, { level: 'high' }, t);
    expect(out.titleKey).toBe('task.plant.high');
    expect(out.title).toBe('Plant today');
  });
});

// ─── 9. PARTIAL INPUT / NO-THROW ─────────────────────────
describe('applyConfidenceWording — partial inputs never throw', () => {
  it('missing task returns undefined/original without throwing', () => {
    expect(() => applyConfidenceWording(null, { level: 'low' })).not.toThrow();
    expect(applyConfidenceWording(null, { level: 'low' })).toBeNull();
  });

  it('missing confidence returns the task unchanged', () => {
    const task = { intent: 'scout', title: 'Check plants' };
    expect(applyConfidenceWording(task, null)).toBe(task);
    expect(applyConfidenceWording(task, undefined)).toBe(task);
  });

  it('handles a confidence object with only { level }', () => {
    const out = applyConfidenceWording({ intent: 'plant', title: 'Plant now' },
      { level: 'low' });
    expect(out).toBeDefined();
    expect(out.confidence.level).toBe('low');
  });
});

// ─── 10. SCORER SIGNAL QUALITY ───────────────────────────
describe('scoreTaskConfidence — signal quality preserved', () => {
  it('photo-only land signal scores lower than question-driven', () => {
    const question = scoreTaskConfidence({
      cropStage: 'clearing',
      landProfile: { blocker: 'wet_soil', source: 'question', moisture: 'wet' },
      weatherNow:  { rainRisk: 'low' },
      taskIntent:  'clear',
    });
    const photo = scoreTaskConfidence({
      cropStage: 'clearing',
      landProfile: { blocker: 'wet_soil', source: 'photo', moisture: 'wet' },
      weatherNow:  { rainRisk: 'low' },
      taskIntent:  'clear',
    });
    expect(question.score).toBeGreaterThan(photo.score);
  });

  it('camera uncertain drops confidence', () => {
    const withCamera = scoreTaskConfidence({
      cropStage: 'growing',
      landProfile: { moisture: 'dry', cleared: true },
      weatherNow:  { rainRisk: 'low' },
      cameraTask:  { type: 'blurry' },
      taskIntent:  'scout',
    });
    expect(withCamera.reasons).toContain('camera_uncertain');
  });

  it('never returns an invalid level', () => {
    for (const ctx of [{}, { taskIntent: 'plant' }, { cropStage: 'unknown' }]) {
      const s = scoreTaskConfidence(ctx);
      expect(['low', 'medium', 'high']).toContain(s.level);
      expect(Array.isArray(s.reasons)).toBe(true);
    }
  });
});

// ─── 11. INTERNAL SHAPE EXPOSED FOR TUNING ───────────────
describe('_internal exposes the tuning surface', () => {
  it('exposes intent sets so dashboards/tooling can render them', () => {
    expect(_internal.RISKY_INTENTS).toBeInstanceOf(Set);
    expect(_internal.LOW_RISK_INTENTS).toBeInstanceOf(Set);
    expect(_internal.CHECK_FIRST_REASONS).toBeInstanceOf(Set);
  });

  it('risky and low-risk sets are mutually exclusive', () => {
    for (const r of _internal.RISKY_INTENTS) {
      expect(_internal.LOW_RISK_INTENTS.has(r)).toBe(false);
    }
    for (const l of _internal.LOW_RISK_INTENTS) {
      expect(_internal.RISKY_INTENTS.has(l)).toBe(false);
    }
  });
});
