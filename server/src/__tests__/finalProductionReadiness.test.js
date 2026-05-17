/**
 * finalProductionReadiness.test.js — Final Production Readiness
 * Gap Closure. Covers crop-recommendation safety + treatment
 * safety (§1), recommendation ranking (§4), observability (§8),
 * and the core/impact facade (§7).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateCropRecommendation, softenCropClaim, CROP_REC_DISCLAIMER,
} from '../../../src/core/agronomy/cropRecommendationSafety.js';
import {
  validateTreatment, TREATMENT_RULES,
} from '../../../src/core/agronomy/treatmentSafetyRules.js';
import {
  rankRecommendations, pickPrimaryRecommendation,
} from '../../../src/core/recommendations/recommendationRankingEngine.js';
import {
  OBSERVABILITY, recordObservation, getObservabilitySnapshot, resetObservability,
} from '../../../src/core/observability/observabilityTracker.js';
import { getPilotImpactReport } from '../../../src/core/impact/impactMetrics.js';

// ─── §1 — crop recommendation safety ───────────────────────

describe('cropRecommendationSafety — no yield/profit guarantees', () => {
  it('flags and rewrites a guaranteed-yield overclaim', () => {
    const r = validateCropRecommendation('This crop gives a guaranteed yield and sure profit.');
    expect(r.safe).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.safeText).not.toMatch(/guaranteed yield/i);
    expect(r.safeText).not.toMatch(/sure profit/i);
  });

  it('passes honest, hedged guidance', () => {
    const r = validateCropRecommendation('Maize may suit your region this season.');
    expect(r.safe).toBe(true);
  });

  it('softenCropClaim is pure and failure-safe', () => {
    expect(softenCropClaim(null)).toBe('');
    expect(typeof CROP_REC_DISCLAIMER).toBe('string');
  });
});

// ─── §1 — treatment safety rules ───────────────────────────

describe('treatmentSafetyRules — no guaranteed cures or exact doses', () => {
  it('flags a guaranteed-cure overclaim', () => {
    const r = validateTreatment('This is a guaranteed cure for the disease.');
    expect(r.safe).toBe(false);
    expect(r.certaintyOverclaim).toBe(true);
  });

  it('flags an exact chemical dose', () => {
    const r = validateTreatment('Apply 20 ml of the solution to each plant.');
    expect(r.exactDose).toBe(true);
    expect(r.safe).toBe(false);
  });

  it('routes chemical treatment to a local expert', () => {
    const r = validateTreatment('Spray a fungicide on the affected leaves.');
    expect(r.requiresExpert).toBe(true);
    expect(r.note).toMatch(/local agricultural expert/i);
  });

  it('passes safe, hedged treatment advice', () => {
    const r = validateTreatment('Remove affected leaves and monitor the plant.');
    expect(r.safe).toBe(true);
    expect(Array.isArray(TREATMENT_RULES)).toBe(true);
  });
});

// ─── §4 — recommendation ranking ───────────────────────────

describe('recommendationRankingEngine — priority + dedupe', () => {
  it('ranks by the spec priority order', () => {
    const ranked = rankRecommendations([
      { type: 'market_opportunity', id: 'm1' },
      { type: 'routine_check', id: 'r1' },
      { type: 'urgent_scan_followup', id: 's1' },
      { type: 'weather_risk', id: 'w1' },
    ]);
    expect(ranked[0].type).toBe('urgent_scan_followup');
    expect(ranked[1].type).toBe('weather_risk');
    expect(ranked[ranked.length - 1].type).toBe('market_opportunity');
  });

  it('suppresses duplicate recommendations', () => {
    const ranked = rankRecommendations([
      { type: 'overdue_task', id: 't1' },
      { type: 'overdue_task', id: 't1' },
    ]);
    expect(ranked.length).toBe(1);
  });

  it('pickPrimaryRecommendation returns one, or null when empty', () => {
    expect(pickPrimaryRecommendation([{ type: 'weather_risk', id: 'w' }]).type).toBe('weather_risk');
    expect(pickPrimaryRecommendation([])).toBe(null);
    expect(() => rankRecommendations(null)).not.toThrow();
  });
});

// ─── §8 — observability ────────────────────────────────────

describe('observabilityTracker — never breaks the app', () => {
  beforeEach(() => resetObservability());

  it('records and snapshots operational signals', () => {
    recordObservation(OBSERVABILITY.SCAN_FAILURE);
    recordObservation(OBSERVABILITY.SCAN_FAILURE);
    recordObservation(OBSERVABILITY.API_500);
    const snap = getObservabilitySnapshot();
    expect(snap.counts[OBSERVABILITY.SCAN_FAILURE]).toBe(2);
    expect(snap.counts[OBSERVABILITY.API_500]).toBe(1);
    expect(snap.total).toBe(3);
  });

  it('accepts unknown categories without throwing', () => {
    expect(() => recordObservation('bogus_category')).not.toThrow();
    expect(recordObservation(undefined)).toBe(true);
  });
});

// ─── §7 — core/impact facade ───────────────────────────────

describe('core/impact facade — combined pilot impact report', () => {
  it('returns engagement + retention + cohorts, never throws', () => {
    const r = getPilotImpactReport({ events: [], farms: [] });
    expect(r).toBeTruthy();
    expect('engagement' in r).toBe(true);
    expect('retention' in r).toBe(true);
    expect('cohorts' in r).toBe(true);
    expect(r.note).toMatch(/not a guarantee/i);
    expect(() => getPilotImpactReport()).not.toThrow();
  });
});
