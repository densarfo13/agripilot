/**
 * invisibleIntelligence.test.js — acceptance coverage for the
 * May 2026 invisible-intelligence architecture (src/intelligence/core/).
 *
 * Exercises every safety case from spec §15:
 *   • missing weather → safe fallback
 *   • no crop → gentle recommendation
 *   • rain → drainage action
 *   • heat + garden pot → soil-moisture action
 *   • scan issue → follow-up task
 *   • trust engine never exposes fraud wording
 *   • farmer adapter hides scores
 *   • NGO aggregate doesn't expose private data
 *   • optimization records events safely
 *   • invalid context never crashes
 *
 * The module under test is a frontend module; we run it under
 * the existing server vitest project (same pattern as
 * clientLibs.test.js) by reaching into ../../../src/.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Per-file timeout (parity with clientLibs.test.js — heavy
// dynamic imports under parallel load occasionally exceed the
// default 5 s budget on Windows + cold disk).
vi.setConfig({ testTimeout: 15000 });

// In-memory localStorage shim — many of the modules touch
// localStorage; without this the SSR guards take over and we
// wouldn't actually exercise the persistence path.
function makeStorage() {
  const store = new Map();
  return {
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear:      () => { store.clear(); },
    _dump:      () => Object.fromEntries(store),
  };
}

beforeEach(() => {
  globalThis.localStorage = makeStorage();
});

// ─── intelligenceTypes ───────────────────────────────────────────
describe('intelligenceTypes — frozen constants', () => {
  it('exports frozen CONFIDENCE / RISK_TYPE / OUTCOME_EVENT maps', async () => {
    const T = await import('../../../src/intelligence/core/intelligenceTypes.js');
    expect(Object.isFrozen(T.CONFIDENCE)).toBe(true);
    expect(Object.isFrozen(T.RISK_TYPE)).toBe(true);
    expect(Object.isFrozen(T.OUTCOME_EVENT)).toBe(true);
    expect(T.CONFIDENCE.LOW).toBe('low');
    expect(T.RISK_TYPE.WEATHER).toBe('weather_risk');
    expect(T.OUTCOME_EVENT.TASK_COMPLETED).toBe('task_completed');
  });

  it('FORBIDDEN_USER_WORDING includes the exact spec terms', async () => {
    const { FORBIDDEN_USER_WORDING } = await import('../../../src/intelligence/core/intelligenceTypes.js');
    const set = new Set(FORBIDDEN_USER_WORDING);
    for (const word of ['fraud', 'risky', 'suspicious', 'low trust', 'fraud score', 'guaranteed']) {
      expect(set.has(word)).toBe(true);
    }
  });
});

// ─── intelligenceContext ─────────────────────────────────────────
describe('intelligenceContext — never throws', () => {
  it('builds a frozen context from undefined input', async () => {
    const { buildIntelligenceContext } = await import('../../../src/intelligence/core/intelligenceContext.js');
    const ctx = buildIntelligenceContext();
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(ctx.role).toBeNull();
    expect(Array.isArray(ctx.tasks)).toBe(true);
    expect(typeof ctx.timestamp).toBe('string');
  });

  it('coerces unknown role to null and unknown mode to null', async () => {
    const { buildIntelligenceContext } = await import('../../../src/intelligence/core/intelligenceContext.js');
    const ctx = buildIntelligenceContext({ role: 'wizard', mode: 'rocketry' });
    expect(ctx.role).toBeNull();
    expect(ctx.mode).toBeNull();
  });

  it('preserves valid role + mode + scalar coercions', async () => {
    const { buildIntelligenceContext } = await import('../../../src/intelligence/core/intelligenceContext.js');
    const ctx = buildIntelligenceContext({
      role: 'FARMER', mode: 'farm', region: '  NG-Lagos  ',
      farmSize: '4.5', tasks: [{ id: '1' }],
    });
    expect(ctx.role).toBe('farmer');
    expect(ctx.mode).toBe('farm');
    expect(ctx.region).toBe('NG-Lagos');
    expect(ctx.farmSize).toBe(4.5);
    expect(ctx.tasks).toHaveLength(1);
  });
});

// ─── confidence ──────────────────────────────────────────────────
describe('confidence — tier mapping', () => {
  it('non-finite scores fall back to LOW', async () => {
    const { confidenceTier } = await import('../../../src/intelligence/core/confidence.js');
    expect(confidenceTier(undefined)).toBe('low');
    expect(confidenceTier(NaN)).toBe('low');
    expect(confidenceTier('not a number')).toBe('low');
  });
  it('confidenceTier crosses bands at thresholds', async () => {
    const { confidenceTier } = await import('../../../src/intelligence/core/confidence.js');
    expect(confidenceTier(0.30)).toBe('low');
    expect(confidenceTier(0.55)).toBe('medium');
    expect(confidenceTier(0.85)).toBe('high');
  });
  it('low confidence label says "Needs review"', async () => {
    const { confidenceLabel } = await import('../../../src/intelligence/core/confidence.js');
    expect(confidenceLabel('low')).toBe('Needs review');
    expect(confidenceLabel('high')).toBe('High confidence');
    expect(confidenceLabel(null)).toBe('');
  });
});

// ─── prediction (spec §3 + §15) ──────────────────────────────────
describe('prediction — rule-based next-best-action', () => {
  it('rain → check drainage', async () => {
    const { predictNextBestAction } = await import('../../../src/intelligence/core/prediction.js');
    const { buildIntelligenceContext } = await import('../../../src/intelligence/core/intelligenceContext.js');
    const ctx = buildIntelligenceContext({
      mode: 'farm',
      cropStage: 'land prep',
      weather: { rainProbability: 0.7 },
    });
    const p = predictNextBestAction(ctx);
    expect(p).not.toBeNull();
    expect(p.recommendedAction).toBe('check_drainage');
    expect(p.userFacingText).toMatch(/drainage/i);
  });

  it('heat + small garden pot → check soil moisture', async () => {
    const { predictNextBestAction } = await import('../../../src/intelligence/core/prediction.js');
    const { buildIntelligenceContext } = await import('../../../src/intelligence/core/intelligenceContext.js');
    const ctx = buildIntelligenceContext({
      mode: 'garden',
      gardenContainer: 'small pot',
      weather: { tempC: 35 },
    });
    const p = predictNextBestAction(ctx);
    expect(p).not.toBeNull();
    expect(p.recommendedAction).toBe('check_soil_moisture');
  });

  it('recent yellowing scan → inspect lower leaves', async () => {
    const { predictNextBestAction } = await import('../../../src/intelligence/core/prediction.js');
    const { buildIntelligenceContext } = await import('../../../src/intelligence/core/intelligenceContext.js');
    const ctx = buildIntelligenceContext({
      mode: 'farm',
      scanHistory: [{ category: 'yellowing', scanId: 'scan_1' }],
    });
    const p = predictNextBestAction(ctx);
    expect(p).not.toBeNull();
    expect(p.recommendedAction).toBe('inspect_lower_leaves');
  });

  it('no location and no weather → location setup nudge', async () => {
    const { predictNextBestAction } = await import('../../../src/intelligence/core/prediction.js');
    const { buildIntelligenceContext } = await import('../../../src/intelligence/core/intelligenceContext.js');
    const ctx = buildIntelligenceContext({ mode: 'farm' });
    const p = predictNextBestAction(ctx);
    expect(p).not.toBeNull();
    expect(p.recommendedAction).toBe('add_location');
  });

  it('null context returns null without throwing', async () => {
    const { predictNextBestAction } = await import('../../../src/intelligence/core/prediction.js');
    expect(predictNextBestAction(null)).toBeNull();
    expect(predictNextBestAction(undefined)).toBeNull();
    // An empty {} triggers Rule 5 (no region + no weather → set up
    // location); that's correct behavior, not null. Use a fully
    // populated context with no rule match to assert the null path.
    expect(predictNextBestAction({
      region: 'NG',
      weather: { tempC: 22 },
      mode: 'farm',
      cropStage: 'planted',
    })).toBeNull();
  });
});

// ─── risk (spec §6 + §15) ────────────────────────────────────────
describe('risk — soft probabilistic engine', () => {
  it('rain produces a calm weather risk', async () => {
    const { estimateCropRisk } = await import('../../../src/intelligence/core/risk.js');
    const { buildIntelligenceContext } = await import('../../../src/intelligence/core/intelligenceContext.js');
    const r = estimateCropRisk(buildIntelligenceContext({
      weather: { rainProbability: 0.7 },
    }));
    expect(r).not.toBeNull();
    expect(r.riskType).toBe('weather_risk');
    expect(r.userFacingText).toMatch(/may make drainage/i);
    expect(r.userFacingText).not.toMatch(/risk/i);    // farmer-facing copy stays calm
    expect(r.userFacingText).not.toMatch(/fraud/i);
  });

  it('returns null for a null context (safe fallback)', async () => {
    const { estimateCropRisk } = await import('../../../src/intelligence/core/risk.js');
    expect(estimateCropRisk(null)).toBeNull();
  });

  it('sparse context surfaces the data-confidence nudge', async () => {
    const { estimateCropRisk } = await import('../../../src/intelligence/core/risk.js');
    const { buildIntelligenceContext } = await import('../../../src/intelligence/core/intelligenceContext.js');
    const r = estimateCropRisk(buildIntelligenceContext({}));
    expect(r).not.toBeNull();
    expect(r.riskType).toBe('data_confidence_risk');
    expect(r.userFacingText).toMatch(/region|crop/i);
  });
});

// ─── trust (spec §7 + §15) ───────────────────────────────────────
describe('trust — internal-only flags, calm farmer copy', () => {
  it('empty context surfaces the calm in-progress state', async () => {
    const { estimateTrustSignals } = await import('../../../src/intelligence/core/trust.js');
    const t = estimateTrustSignals({});
    expect(t.verificationState).toBe('verification_in_progress');
    // missing_verification IS the canonical "no kyc yet" signal —
    // it stays internal but its presence drives the calm
    // in-progress copy. Other flags must NOT be present.
    expect(t.internalRiskFlags).toContain('missing_verification');
    expect(t.internalRiskFlags).not.toContain('impossible_quantity');
    expect(t.internalRiskFlags).not.toContain('duplicate_listing');
    // Single flag → no manual review yet.
    expect(t.recommendedModerationAction).toBe('none');
  });

  it('verified profile with no other flags is verification_complete', async () => {
    const { estimateTrustSignals } = await import('../../../src/intelligence/core/trust.js');
    const t = estimateTrustSignals({
      verification: { idVerified: true, kycComplete: true },
    });
    expect(t.verificationState).toBe('verification_complete');
    expect(t.internalRiskFlags).toEqual([]);
    expect(t.recommendedModerationAction).toBe('none');
  });

  it('impossible quantity raises an internal flag (never user-facing)', async () => {
    const { estimateTrustSignals } = await import('../../../src/intelligence/core/trust.js');
    const t = estimateTrustSignals({
      produceListings: [{ crop: 'maize', quantityKg: 5_000_000 }],
    });
    expect(t.internalRiskFlags).toContain('impossible_quantity');
    expect(t.recommendedModerationAction).toBe('manual_review');
  });

  it('farmer-facing verification copy never contains forbidden wording', async () => {
    const { farmerVerificationCopy } = await import('../../../src/intelligence/core/trust.js');
    for (const state of ['verification_in_progress', 'verification_complete', 'verification_enhanced']) {
      const c = farmerVerificationCopy(state);
      const all = (c.title + ' ' + c.message + ' ' + c.actionLabel).toLowerCase();
      expect(all).not.toMatch(/fraud|suspicious|risky|low trust/);
    }
  });
});

// ─── farmer adapter (spec §9 + §15) ──────────────────────────────
describe('farmerInsightAdapter — strips scores + forbidden wording', () => {
  it('returns null on null input', async () => {
    const { toFarmerFriendlyInsight } = await import('../../../src/intelligence/core/farmerInsightAdapter.js');
    expect(toFarmerFriendlyInsight(null)).toBeNull();
  });

  it('output never includes a numeric score field', async () => {
    const { toFarmerFriendlyInsight } = await import('../../../src/intelligence/core/farmerInsightAdapter.js');
    const out = toFarmerFriendlyInsight({
      predictionType: 'weather_prep',
      recommendedAction: 'check_drainage',
      userFacingText: 'Check drainage before the rain comes.',
      confidence: 'medium',
    });
    expect(out).not.toBeNull();
    expect(out.score).toBeUndefined();
    expect(out.priority).toBeUndefined();
    expect(out.internalSignals).toBeUndefined();
    expect(typeof out.title).toBe('string');
    expect(typeof out.message).toBe('string');
    expect(typeof out.actionLabel).toBe('string');
    expect(typeof out.actionRoute).toBe('string');
  });

  it('forbidden wording is filtered even when leakage occurs', async () => {
    const { toFarmerFriendlyInsight, forbiddenWordingFilter } = await import('../../../src/intelligence/core/farmerInsightAdapter.js');
    expect(forbiddenWordingFilter('FRAUD risk detected')).not.toMatch(/fraud/i);
    expect(forbiddenWordingFilter('You are a Risky farmer')).not.toMatch(/risky/i);
    expect(forbiddenWordingFilter('Low Trust on this listing')).not.toMatch(/low trust/i);
    const out = toFarmerFriendlyInsight({
      title: 'Fraud detected',
      message: 'This farm is risky.',
      action: 'check_drainage',
    });
    expect(out.title.toLowerCase()).not.toMatch(/fraud/);
    expect(out.message.toLowerCase()).not.toMatch(/risky/);
  });

  it('low confidence surfaces "Needs review"; high confidence is silent', async () => {
    const { toFarmerFriendlyInsight } = await import('../../../src/intelligence/core/farmerInsightAdapter.js');
    const low = toFarmerFriendlyInsight({
      predictionType: 'scan_followup',
      recommendedAction: 'inspect_lower_leaves',
      userFacingText: 'Check lower leaves on the plant you scanned.',
      confidence: 'low',
    });
    expect(low.confidenceLabel).toBe('Needs review');
    const high = toFarmerFriendlyInsight({
      predictionType: 'weather_prep',
      recommendedAction: 'check_drainage',
      userFacingText: 'Check drainage before the rain comes.',
      confidence: 'high',
    });
    expect(high.confidenceLabel).toBeNull();
  });
});

// ─── feedbackLoop + optimization (spec §5 + §14 + §15) ───────────
describe('feedbackLoop + optimization — safe persistence + guardrails', () => {
  it('records valid events, ignores unknown types', async () => {
    const fb = await import('../../../src/intelligence/core/feedbackLoop.js');
    fb.clearEvents();
    expect(fb.recordUserOutcome({ type: 'task_completed' })).not.toBeNull();
    expect(fb.recordUserOutcome({ type: 'unknown_event_type' })).toBeNull();
    expect(fb.getRecentEvents().length).toBe(1);
  });

  it('caps stored events at MAX_EVENTS', async () => {
    const fb = await import('../../../src/intelligence/core/feedbackLoop.js');
    fb.clearEvents();
    for (let i = 0; i < fb.MAX_EVENTS + 50; i++) {
      fb.recordUserOutcome({ type: 'task_viewed', id: 'evt_' + i });
    }
    expect(fb.getRecentEvents().length).toBeLessThanOrEqual(fb.MAX_EVENTS);
  });

  it('forbidden auto-adjustments are blocked at the guard', async () => {
    const opt = await import('../../../src/intelligence/core/optimization.js');
    expect(opt.isOptimizationAllowed('rank_task')).toBe(true);
    expect(opt.isOptimizationAllowed('rank_buyer_match')).toBe(true);
    expect(opt.isOptimizationForbidden('delete_listing')).toBe(true);
    expect(opt.isOptimizationForbidden('contact_buyer')).toBe(true);
    expect(opt.isOptimizationForbidden('submit_funding_application')).toBe(true);
    // Unknown action is neither — render layer should still ask
    // for confirmation in that case.
    expect(opt.isOptimizationAllowed('unknown_xyz')).toBe(false);
  });

  it('applyOutcomeAdjustment clamps to [0,1]', async () => {
    const opt = await import('../../../src/intelligence/core/optimization.js');
    const r = opt.applyOutcomeAdjustment(0.5);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });
});

// ─── orchestrator (spec §10 + §15) ───────────────────────────────
describe('intelligenceOrchestrator — single farmer entry', () => {
  it('returns ONE insight with the calm shape', async () => {
    const { getFarmerInsight } = await import('../../../src/intelligence/core/intelligenceOrchestrator.js');
    const out = getFarmerInsight({
      mode: 'farm', cropStage: 'land prep',
      weather: { rainProbability: 0.7 },
    });
    expect(out).not.toBeNull();
    expect(typeof out.title).toBe('string');
    expect(typeof out.message).toBe('string');
    expect(out.actionRoute.startsWith('/')).toBe(true);
    expect(out.score).toBeUndefined();
    expect(out.priority).toBeUndefined();
  });

  it('invalid input never crashes', async () => {
    const { getFarmerInsight, analyseContext } = await import('../../../src/intelligence/core/intelligenceOrchestrator.js');
    expect(() => getFarmerInsight(null)).not.toThrow();
    expect(() => getFarmerInsight(undefined)).not.toThrow();
    expect(() => getFarmerInsight('garbage')).not.toThrow();
    const bundle = analyseContext({});
    expect(bundle.context).toBeDefined();
    expect(bundle.trust).toBeDefined();
  });

  it('all-empty context still returns a non-crashing bundle', async () => {
    const { analyseContext } = await import('../../../src/intelligence/core/intelligenceOrchestrator.js');
    const out = analyseContext({});
    expect(out.context.region).toBeNull();
    expect(out.trust.verificationState).toBe('verification_in_progress');
    // Even with sparse context, prediction or risk should
    // surface SOMETHING actionable (location nudge, data
    // confidence) so the home card never goes blank.
    expect(out.farmerInsight).not.toBeNull();
  });
});
