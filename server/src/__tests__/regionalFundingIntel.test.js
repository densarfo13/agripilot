/**
 * regionalFundingIntel.test.js — acceptance coverage for the
 * May 2026 regional funding intelligence upgrade.
 *
 * Spec §16 cases:
 *   • 12-category taxonomy present (financial / training /
 *     extension / inputs_seeds / weather_prep / equipment /
 *     insurance / market_access / buyer_coordination /
 *     emergency_relief / ngo_assistance / government_program)
 *   • legacy categories normalise to canonical
 *   • drought signal boosts insurance/emergency_relief/weather_prep
 *   • harvest signal boosts market_access/buyer_coordination
 *   • disease signal boosts emergency_relief/extension
 *   • verified-host gate enforced inside the scorer
 *   • opportunity with no URL scores 0
 *   • below-threshold matches are filtered out
 *   • orchestrator picks the highest-relevance match
 *   • output never carries farmer-facing scores
 */

import { describe, it, expect, vi } from 'vitest';
vi.setConfig({ testTimeout: 15000 });

// ─── Taxonomy ────────────────────────────────────────────────────
describe('supportCategories — canonical taxonomy', () => {
  it('exposes the 12 spec-mandated categories', async () => {
    const { SUPPORT_CATEGORY, SUPPORT_CATEGORY_LIST } =
      await import('../../../src/intelligence/funding/supportCategories.js');
    const required = [
      'financial', 'training', 'extension', 'inputs_seeds',
      'weather_prep', 'equipment', 'insurance', 'market_access',
      'buyer_coordination', 'emergency_relief', 'ngo_assistance',
      'government_program',
    ];
    for (const v of required) {
      expect(SUPPORT_CATEGORY_LIST).toContain(v);
    }
    expect(Object.isFrozen(SUPPORT_CATEGORY)).toBe(true);
  });

  it('normalises legacy category strings to canonical', async () => {
    const { normaliseCategory, SUPPORT_CATEGORY } =
      await import('../../../src/intelligence/funding/supportCategories.js');
    expect(normaliseCategory('cooperative')).toBe(SUPPORT_CATEGORY.NGO_ASSISTANCE);
    expect(normaliseCategory('input_support')).toBe(SUPPORT_CATEGORY.INPUTS_SEEDS);
    expect(normaliseCategory('climate_smart')).toBe(SUPPORT_CATEGORY.WEATHER_PREP);
    expect(normaliseCategory('buyer_market')).toBe(SUPPORT_CATEGORY.MARKET_ACCESS);
    expect(normaliseCategory('government')).toBe(SUPPORT_CATEGORY.GOVERNMENT_PROGRAM);
    expect(normaliseCategory('food_security')).toBe(SUPPORT_CATEGORY.EMERGENCY_RELIEF);
    expect(normaliseCategory('partnership')).toBe(SUPPORT_CATEGORY.NGO_ASSISTANCE);
    // Unknown → safe default.
    expect(normaliseCategory('garbage_xyz')).toBe(SUPPORT_CATEGORY.FINANCIAL);
    expect(normaliseCategory(null)).toBe(SUPPORT_CATEGORY.FINANCIAL);
  });

  it('every canonical category has farmer-facing copy', async () => {
    const { SUPPORT_CATEGORY_LIST, categoryLabel } =
      await import('../../../src/intelligence/funding/supportCategories.js');
    for (const cat of SUPPORT_CATEGORY_LIST) {
      const lbl = categoryLabel(cat);
      expect(typeof lbl.key).toBe('string');
      expect(typeof lbl.fb).toBe('string');
      expect(lbl.key.startsWith('support.cat.')).toBe(true);
      expect(lbl.fb.length).toBeGreaterThan(0);
      // Calm wording — no money-bag or scary verbs.
      expect(lbl.fb.toLowerCase()).not.toMatch(/fraud|risky|guaranteed|100%/);
    }
  });
});

// ─── Context detection ───────────────────────────────────────────
describe('regionalRelevance — context signals', () => {
  it('drought signal: hot + low rain probability', async () => {
    const { detectContextSignals } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    const sigs = detectContextSignals({
      weather: { tempC: 35, rainProbability: 0.05 },
    });
    expect(sigs.has('drought')).toBe(true);
  });

  it('harvest signal: cropStage includes harvest/mature', async () => {
    const { detectContextSignals } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    expect(detectContextSignals({ cropStage: 'harvest' }).has('harvest')).toBe(true);
    expect(detectContextSignals({ cropStage: 'mature growth' }).has('harvest')).toBe(true);
    expect(detectContextSignals({ cropStage: 'planted' }).has('harvest')).toBe(false);
  });

  it('disease signal: most-recent scan flagged', async () => {
    const { detectContextSignals } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    expect(detectContextSignals({
      scanHistory: [{ category: 'yellowing' }],
    }).has('disease')).toBe(true);
    expect(detectContextSignals({
      scanHistory: [{ category: 'healthy' }],
    }).has('disease')).toBe(false);
  });

  it('newFarmer signal: profile flag present', async () => {
    const { detectContextSignals } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    expect(detectContextSignals({
      profile: { experienceLevel: 'new' },
    }).has('newFarmer')).toBe(true);
  });

  it('null/undefined context returns empty signal set (no crash)', async () => {
    const { detectContextSignals } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    expect(detectContextSignals(null).size).toBe(0);
    expect(detectContextSignals(undefined).size).toBe(0);
    expect(detectContextSignals({}).size).toBe(0);
  });

  // ─── May 2026 engine-fix bug coverage ─────────────────────────
  it('scaling signal is windowed (lifetime tasks no longer trigger)', async () => {
    const { detectContextSignals } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    const oldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const ctxOld = {
      tasks: Array.from({ length: 50 }).map((_, i) => ({
        id: 't' + i, completed: true, completedAt: oldDate,
      })),
    };
    expect(detectContextSignals(ctxOld).has('scaling')).toBe(false);

    const recent = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const ctxRecent = {
      tasks: Array.from({ length: 6 }).map((_, i) => ({
        id: 't' + i, completed: true, completedAt: recent,
      })),
    };
    expect(detectContextSignals(ctxRecent).has('scaling')).toBe(true);
  });

  it('newFarmer signal fires from a canonical context (post-fix)', async () => {
    const { buildIntelligenceContext } =
      await import('../../../src/intelligence/core/intelligenceContext.js');
    const { detectContextSignals } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    // Build through the canonical context — the FIX is that
    // buildIntelligenceContext now passes profile.{experienceLevel,
    // farmerType} through unchanged. Before the fix, this signal
    // could never fire from production input.
    const ctx = buildIntelligenceContext({
      profile: { experienceLevel: 'new', farmerType: 'beginner' },
    });
    expect(detectContextSignals(ctx).has('newFarmer')).toBe(true);
  });

  it('canonical context exposes country (post-fix)', async () => {
    const { buildIntelligenceContext } =
      await import('../../../src/intelligence/core/intelligenceContext.js');
    const ctx = buildIntelligenceContext({ country: 'us', region: 'MD' });
    expect(ctx.country).toBe('us');
    expect(ctx.region).toBe('MD');
  });
});

// ─── Per-opportunity scoring ────────────────────────────────────
describe('scoreSupportRelevance', () => {
  it('verified-host gate blocks unsafe URL', async () => {
    const { scoreSupportRelevance } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    const r = scoreSupportRelevance(
      { id: 'evil', url: 'https://evil.example.tk/grant' },
      { region: 'NG' },
    );
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe('unverified_url');
    expect(r.score).toBe(0);
  });

  it('opportunity with no URL scores 0', async () => {
    const { scoreSupportRelevance } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    const r = scoreSupportRelevance({ id: 'no_url' }, { region: 'NG' });
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe('no_url');
  });

  it('drought boosts insurance category', async () => {
    const { scoreSupportRelevance } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    const opp = {
      id: 'ins_1',
      url: 'https://www.usda.gov/topics/insurance',
      category: 'insurance',
      country: 'us',
      regions: ['MD'],
      crops: ['pepper'],
      verified: true,
      active: true,
    };
    const ctxNormal = {
      region: 'MD', country: 'us', crop: 'pepper',
      weather: { tempC: 22, rainProbability: 0.4 },
    };
    const ctxDrought = {
      region: 'MD', country: 'us', crop: 'pepper',
      weather: { tempC: 35, rainProbability: 0.05 },
    };
    const r1 = scoreSupportRelevance(opp, ctxNormal);
    const r2 = scoreSupportRelevance(opp, ctxDrought);
    expect(r2.boost).toBeGreaterThan(r1.boost);
    expect(r2.score).toBeGreaterThan(r1.score);
    expect(r2.signals).toContain('drought');
  });

  it('harvest boosts market_access category', async () => {
    const { scoreSupportRelevance } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    const opp = {
      id: 'mkt_1',
      url: 'https://www.usda.gov/topics/urban',
      category: 'market_access',
      regions: ['MD'],
      verified: true, active: true,
    };
    const r = scoreSupportRelevance(opp, {
      region: 'MD', cropStage: 'harvest',
      weather: { tempC: 22, rainProbability: 0.3 },
    });
    expect(r.signals).toContain('harvest');
    expect(r.boost).toBeGreaterThan(0);
  });

  it('country-to-country comparison (no longer compares country to region)', async () => {
    const { scoreSupportRelevance } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    const opp = {
      id: 'us_only',
      url: 'https://www.usda.gov/topics/urban',
      country: 'us',
      verified: true, active: true,
    };
    // ctx with only region (no country) → no country bonus.
    const noCountry = scoreSupportRelevance(opp, { region: 'MD' });
    // ctx with country code → +30 country bonus.
    const withCountry = scoreSupportRelevance(opp, { country: 'us', region: 'MD' });
    expect(withCountry.baseScore).toBeGreaterThan(noCountry.baseScore);
    expect(withCountry.baseScore - noCountry.baseScore).toBe(30);
  });

  it('farmSize within band gets the +5 bonus', async () => {
    const { scoreSupportRelevance } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    const opp = {
      id: 'small_farm',
      url: 'https://www.usda.gov/topics/urban',
      country: 'us', regions: ['MD'],
      minFarmSizeAcres: 1, maxFarmSizeAcres: 10,
      verified: true, active: true,
    };
    const inside  = scoreSupportRelevance(opp, { country: 'us', region: 'MD', farmSize: 5 });
    const outside = scoreSupportRelevance(opp, { country: 'us', region: 'MD', farmSize: 50 });
    expect(inside.baseScore - outside.baseScore).toBe(5);
  });

  it('cropStage match gets the +5 bonus', async () => {
    const { scoreSupportRelevance } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    const opp = {
      id: 'harvest_only',
      url: 'https://www.usda.gov/topics/urban',
      country: 'us', regions: ['MD'],
      stages: ['harvest'],
      verified: true, active: true,
    };
    const matched = scoreSupportRelevance(opp, { country: 'us', region: 'MD', cropStage: 'harvest' });
    const mismatched = scoreSupportRelevance(opp, { country: 'us', region: 'MD', cropStage: 'planted' });
    expect(matched.baseScore - mismatched.baseScore).toBe(5);
  });

  it('disease boosts emergency_relief category', async () => {
    const { scoreSupportRelevance } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    const opp = {
      id: 'er_1',
      url: 'https://www.fao.org/in-action/all-programmes/en/',
      category: 'emergency_relief',
      verified: true, active: true,
    };
    const r = scoreSupportRelevance(opp, {
      scanHistory: [{ category: 'yellowing' }],
    });
    expect(r.signals).toContain('disease');
    expect(r.boost).toBeGreaterThan(0);
  });
});

// ─── Ranking ─────────────────────────────────────────────────────
describe('prioritiseNearbySupport — ranking + threshold', () => {
  it('filters out below-threshold matches', async () => {
    const { prioritiseNearbySupport } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    // Sparse context (no region, no crop) → below threshold.
    const ranked = prioritiseNearbySupport([
      { id: 'a', url: 'https://www.usda.gov/topics/urban', category: 'training' },
    ], {});
    expect(ranked).toEqual([]);
  });

  it('returns highest-relevance match first', async () => {
    const { prioritiseNearbySupport } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    const opps = [
      // Less relevant — wrong category for harvest signal.
      { id: 'low', url: 'https://www.usda.gov/topics/urban',
        category: 'training', regions: ['MD'], country: 'us',
        crops: ['pepper'], verified: true, active: true },
      // More relevant — market_access boosted by harvest signal.
      { id: 'top', url: 'https://www.nifa.usda.gov/grants/programs/beginning-farmer-rancher-development-program',
        category: 'market_access', regions: ['MD'], country: 'us',
        crops: ['pepper'], verified: true, active: true },
    ];
    const ranked = prioritiseNearbySupport(opps, {
      region: 'MD', country: 'us', crop: 'pepper',
      cropStage: 'harvest',
    });
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].opportunity.id).toBe('top');
  });

  it('null / empty list returns []', async () => {
    const { prioritiseNearbySupport } =
      await import('../../../src/intelligence/funding/regionalRelevance.js');
    expect(prioritiseNearbySupport(null, {})).toEqual([]);
    expect(prioritiseNearbySupport([], {})).toEqual([]);
  });
});

// ─── Orchestrator wiring ────────────────────────────────────────
describe('orchestrator — picks highest-relevance verified match', () => {
  it('drought + insurance match wins over generic verified match', async () => {
    const { getNextBestRecommendation } =
      await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } =
      await import('../../../src/orchestration/memory.js');
    forgetAll();
    // We use the explicit `weather.alert: 'drought'` flag here
    // INSTEAD of tempC ≥ 32 + low rainProb. The latter would
    // also trigger the orchestrator's weather rung (#1) which
    // correctly outranks funding. The explicit alert hits
    // detectContextSignals' drought path WITHOUT crossing the
    // orchestrator's weather thresholds (rainProb≥0.6 or
    // tempC≥32).
    const rec = getNextBestRecommendation({
      region: 'MD', country: 'us', crop: 'pepper',
      weather: { tempC: 22, rainProbability: 0.3, alert: 'drought' },
      // First match is generic; second matches drought-boost
      // categories. The relevance scorer should pick the
      // second one.
      fundingMatches: [
        { id: 'generic',
          url: 'https://www.fao.org/in-action/all-programmes/en/',
          category: 'training',
          regions: ['MD'], country: 'us', verified: true, active: true },
        { id: 'best',
          url: 'https://www.nifa.usda.gov/grants/programs/beginning-farmer-rancher-development-program',
          category: 'insurance',
          regions: ['MD'], country: 'us', crops: ['pepper'],
          verified: true, active: true },
      ],
      tasks: [],
    });
    expect(rec.titleKey).toBe('orch.fundingMatch');
    expect(rec.actionRoute).toBe('/funding');
    // sourceSignals exposes the picked id (INTERNAL).
    expect(rec.sourceSignals.fundingId).toBe('best');
    expect(rec.sourceSignals.boostSignals).toContain('drought');
  });

  it('orchestrator no longer surfaces unrelated verified matches (engine fix)', async () => {
    const { getNextBestRecommendation } =
      await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } =
      await import('../../../src/orchestration/memory.js');
    forgetAll();
    // The previous fallback path surfaced ANY verified match
    // even with zero context fit. The May 2026 engine fix
    // removes that path — sparse context now falls through to
    // the spec §11 fallback rather than surfacing irrelevant
    // funding. The verified URL is real (usda.gov), but the
    // farmer's context has no country/region/crop overlap, so
    // the relevance scorer correctly drops it below threshold.
    const rec = getNextBestRecommendation({
      // No country / region / crop / farmSize / stage.
      weather: { rainProbability: 0.1, tempC: 22 },
      tasks:   [],
      fundingMatches: [{
        id: 'unrelated', url: 'https://www.usda.gov/topics/urban',
        // No country, no regions[], no crops[], no verified flag.
      }],
    });
    expect(rec.titleKey).not.toBe('orch.fundingMatch');
    // Falls through to spec §11 calm fallback.
    expect(rec.titleKey).toBe('home.goodQuickCheck');
  });

  it('orchestrator output never carries a numeric score', async () => {
    const { getNextBestRecommendation } =
      await import('../../../src/orchestration/orchestrator.js');
    const { forgetAll } =
      await import('../../../src/orchestration/memory.js');
    forgetAll();
    const rec = getNextBestRecommendation({
      region: 'MD', country: 'us', crop: 'pepper',
      weather: { tempC: 22, rainProbability: 0.3 },
      fundingMatches: [
        { id: 'm1', url: 'https://www.usda.gov/topics/urban',
          category: 'extension', regions: ['MD'], verified: true, active: true },
      ],
      tasks: [],
    });
    expect(rec.score).toBeUndefined();
    expect(rec.relevanceScore).toBeUndefined();
    expect(rec.boost).toBeUndefined();
  });
});
