/**
 * contextRecommendationEngine.test.js — pins the Context Engine +
 * Recommendation Engine + Intelligence Flags contracts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  INTELLIGENCE_FLAGS,
  isIntelligenceFlagOn,
  setIntelligenceFlagOverride,
  getIntelligenceFlagSnapshot,
  _resetIntelligenceFlagOverrides,
} from '../../../src/lib/featureFlags/intelligenceFlags.js';

import {
  getContext,
  CACHE_TTL,
  _resetContextCache,
} from '../../../src/lib/contextEngine.js';

import { recommend } from '../../../src/lib/recommendationEngine.js';

beforeEach(() => {
  _resetIntelligenceFlagOverrides();
  _resetContextCache();
});

// ─── Intelligence flags ───────────────────────────────────────

describe('intelligenceFlags — named registry + override precedence', () => {
  it('exposes exactly the 5 spec flags', () => {
    expect(Object.keys(INTELLIGENCE_FLAGS).sort()).toEqual([
      'FEATURE_PREDICTIVE_ALERTS',
      'FEATURE_SATELLITE_CONTEXT',
      'FEATURE_SCAN_MEMORY',
      'FEATURE_SIMPLE_MODE',
      'FEATURE_SOIL_CONTEXT',
    ]);
  });

  it('registry is frozen', () => {
    expect(Object.isFrozen(INTELLIGENCE_FLAGS)).toBe(true);
  });

  it('defaults to ON for every spec flag', () => {
    for (const flag of Object.values(INTELLIGENCE_FLAGS)) {
      expect(isIntelligenceFlagOn(flag)).toBe(true);
    }
  });

  it('unknown flag → false (never throws)', () => {
    expect(isIntelligenceFlagOn('NOT_A_FLAG')).toBe(false);
    expect(isIntelligenceFlagOn(null)).toBe(false);
    expect(isIntelligenceFlagOn('')).toBe(false);
  });

  it('in-process override takes precedence over defaults', () => {
    setIntelligenceFlagOverride('FEATURE_SOIL_CONTEXT', false);
    expect(isIntelligenceFlagOn('FEATURE_SOIL_CONTEXT')).toBe(false);
    setIntelligenceFlagOverride('FEATURE_SOIL_CONTEXT', null);
    expect(isIntelligenceFlagOn('FEATURE_SOIL_CONTEXT')).toBe(true);
  });

  it('setIntelligenceFlagOverride rejects unknown flags silently', () => {
    expect(() => setIntelligenceFlagOverride('NOT_A_FLAG', false)).not.toThrow();
    expect(isIntelligenceFlagOn('NOT_A_FLAG')).toBe(false);
  });

  it('getIntelligenceFlagSnapshot reports every flag', () => {
    const snap = getIntelligenceFlagSnapshot();
    expect(Object.keys(snap).sort()).toEqual([
      'FEATURE_PREDICTIVE_ALERTS',
      'FEATURE_SATELLITE_CONTEXT',
      'FEATURE_SCAN_MEMORY',
      'FEATURE_SIMPLE_MODE',
      'FEATURE_SOIL_CONTEXT',
    ]);
  });
});

// ─── ContextEngine — fetching + caching ──────────────────────

describe('contextEngine.getContext — graceful + cached', () => {
  it('returns a frozen object with the canonical fields', async () => {
    const ctx = await getContext({});
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(ctx).toHaveProperty('weather');
    expect(ctx).toHaveProperty('soil');
    expect(ctx).toHaveProperty('satellite');
    expect(ctx).toHaveProperty('scanHistory');
    expect(ctx).toHaveProperty('tasks');
    expect(ctx).toHaveProperty('sources');
    expect(ctx).toHaveProperty('readAt');
  });

  it('null fetchers + no flags off → every source is null/[]', async () => {
    const ctx = await getContext({ farmId: 'f1' });
    expect(ctx.weather).toBeNull();
    expect(ctx.soil).toBeNull();
    expect(ctx.satellite).toBeNull();
    expect(ctx.scanHistory).toEqual([]);
    expect(ctx.tasks).toEqual([]);
  });

  it('successful fetchers populate the context', async () => {
    const ctx = await getContext({
      farmId: 'f1',
      fetchers: {
        weather:   async () => ({ summary: 'Partly cloudy' }),
        soil:      async () => ({ soilType: 'Loam' }),
        satellite: async () => ({ stressLevel: 'low' }),
        scanHistory: async () => [{ id: 's1' }],
        tasks:     async () => [{ id: 't1' }],
      },
    });
    expect(ctx.weather.summary).toBe('Partly cloudy');
    expect(ctx.soil.soilType).toBe('Loam');
    expect(ctx.scanHistory).toHaveLength(1);
    expect(ctx.sources).toEqual(expect.arrayContaining([
      'weather', 'soil', 'satellite', 'scan_history', 'tasks',
    ]));
  });

  it('a failing fetcher contributes null silently', async () => {
    const ctx = await getContext({
      farmId: 'f1',
      fetchers: {
        weather: () => Promise.reject(new Error('weather API down')),
        soil:    async () => ({ soilType: 'Loam' }),
      },
    });
    expect(ctx.weather).toBeNull();
    expect(ctx.soil.soilType).toBe('Loam');
  });

  it('FEATURE_SOIL_CONTEXT off → soil is null even if fetcher works', async () => {
    setIntelligenceFlagOverride('FEATURE_SOIL_CONTEXT', false);
    const ctx = await getContext({
      farmId: 'f1',
      fetchers: { soil: async () => ({ soilType: 'Loam' }) },
    });
    expect(ctx.soil).toBeNull();
  });

  it('FEATURE_SATELLITE_CONTEXT off → satellite is null', async () => {
    setIntelligenceFlagOverride('FEATURE_SATELLITE_CONTEXT', false);
    const ctx = await getContext({
      farmId: 'f1',
      fetchers: { satellite: async () => ({ stressLevel: 'high' }) },
    });
    expect(ctx.satellite).toBeNull();
  });

  it('FEATURE_SCAN_MEMORY off → scanHistory is empty regardless of fetcher', async () => {
    setIntelligenceFlagOverride('FEATURE_SCAN_MEMORY', false);
    const ctx = await getContext({
      farmId: 'f1',
      fetchers: { scanHistory: async () => [{ id: 's1' }] },
    });
    expect(ctx.scanHistory).toEqual([]);
  });

  it('cache: second call inside TTL skips the fetcher', async () => {
    const fetcher = vi.fn(async () => ({ summary: 'Sunny' }));
    const t0 = 1_000_000;
    await getContext({ farmId: 'f1', fetchers: { weather: fetcher }, nowMs: t0 });
    await getContext({
      farmId: 'f1',
      fetchers: { weather: fetcher },
      nowMs: t0 + (CACHE_TTL.weather - 1),
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('cache miss after TTL hits the fetcher again', async () => {
    const fetcher = vi.fn(async () => ({ summary: 'Sunny' }));
    const t0 = 1_000_000;
    await getContext({ farmId: 'f1', fetchers: { weather: fetcher }, nowMs: t0 });
    await getContext({
      farmId: 'f1',
      fetchers: { weather: fetcher },
      nowMs: t0 + CACHE_TTL.weather + 1,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('cache is keyed per farmId', async () => {
    const fetcher = vi.fn(async () => ({ summary: 'Sunny' }));
    await getContext({ farmId: 'f1', fetchers: { weather: fetcher } });
    await getContext({ farmId: 'f2', fetchers: { weather: fetcher } });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('CACHE_TTL exposes the spec values', () => {
    expect(CACHE_TTL.weather).toBe(45 * 60 * 1000);
    expect(CACHE_TTL.soil).toBe(6 * 60 * 60 * 1000);
    expect(CACHE_TTL.satellite).toBe(18 * 60 * 60 * 1000);
    expect(CACHE_TTL.recommendation).toBe(5 * 60 * 1000);
  });

  it('NEVER throws on null / garbage input', async () => {
    await expect(getContext(null)).resolves.toBeDefined();
    await expect(getContext('not an object')).resolves.toBeDefined();
    await expect(getContext({ fetchers: 'no' })).resolves.toBeDefined();
  });

  it('forwards farmId / location / cropName / userMode / language / growthStage', async () => {
    const ctx = await getContext({
      farmId: 'f1',
      lat: 5.6, lng: -0.18,
      cropName: 'tomato',
      experience: 'farmer',
      userMode: 'smallholder_farmer',
      language: 'en',
      growthStage: 'flowering',
    });
    expect(ctx.farmId).toBe('f1');
    expect(ctx.location).toEqual({ lat: 5.6, lng: -0.18 });
    expect(ctx.cropName).toBe('tomato');
    expect(ctx.userMode).toBe('smallholder_farmer');
    expect(ctx.language).toBe('en');
    expect(ctx.growthStage).toBe('flowering');
  });
});

// ─── RecommendationEngine — 9-field shape + Simple Mode ──────

describe('recommendationEngine.recommend — spec 9-field shape', () => {
  it('returns the EXACT 9 spec fields', () => {
    const r = recommend({});
    expect(Object.keys(r).sort()).toEqual([
      'action', 'bestTime', 'confidenceTone', 'ctaLabel', 'ctaRoute',
      'reason', 'sourceSignals', 'title', 'urgency',
    ]);
  });

  it('result is frozen', () => {
    const r = recommend({});
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.sourceSignals)).toBe(true);
  });

  it('empty context → calm walk-the-field fallback', () => {
    const r = recommend({});
    expect(r.urgency).toBe('low');
    expect(r.confidenceTone).toBe('Looks stable');
    expect(r.sourceSignals).toContain('routine');
  });

  it('NEVER returns null (always emits a recommendation)', () => {
    const r = recommend(null);
    expect(r).not.toBeNull();
    expect(typeof r.title).toBe('string');
  });

  it('crop-health risk context surfaces with high urgency + scan route', () => {
    const r = recommend({
      regionalDiseaseIntelligence: {
        signal: 'fungal_pressure_rising', urgency: 'high', confidence: 'medium',
        farmerMessage: 'Fungal risk rising for tomato',
        recommendedAction: 'Check lower leaves',
        source: 'regionalDiseaseIntelligence',
        visibleToUser: true,
      },
    });
    expect(r.urgency).toBe('high');
    expect(r.ctaRoute).toBe('/scan');
    expect(r.sourceSignals).toContain('scan');
  });

  it('severe weather → /today route + weather sourceSignal', () => {
    const r = recommend({
      risks: [{ kind: 'drought', level: 'high', headline: '7 days no rain', action: 'Water at dawn' }],
    });
    expect(r.urgency).toBe('high');
    expect(r.ctaRoute).toBe('/today');
    expect(r.sourceSignals).toContain('weather');
  });

  it('overdue high-urgency task surfaces with task source', () => {
    const NOW = Date.now();
    const r = recommend({
      tasks: [{ urgency: 'high', completed: false, dueAt: new Date(NOW - 3600_000).toISOString(), title: 'Spray copper' }],
    });
    expect(r.title.toLowerCase()).toContain('spray');
    expect(r.sourceSignals).toContain('tasks');
  });

  it('confidenceTone never contains a percentage', () => {
    const r = recommend({
      regionalDiseaseIntelligence: {
        signal: 'fungal_pressure_rising', urgency: 'high', confidence: 'medium',
        farmerMessage: 'risk', recommendedAction: 'a',
        source: 'regionalDiseaseIntelligence', visibleToUser: true,
      },
    });
    expect(r.confidenceTone).not.toMatch(/\d+\s*%/);
    expect(r.confidenceTone).not.toMatch(/\d/);
  });

  it('confidenceTone uses one of the 5 canonical phrases', () => {
    const canonical = new Set([
      'May need attention', 'Looks stable', 'Check again tomorrow',
      'Good time to act', 'Conditions changed', 'Calm signal',
      'Possible — worth watching', 'Likely — multiple signals agree',
      'Possible', 'Likely', 'Strong — multiple signs together',
      'Possible — your last rescan looked worse',
      'Possible — follow-up on your last scan',
    ]);
    const r = recommend({});
    expect(canonical.has(r.confidenceTone)).toBe(true);
  });

  it('soil context tags sourceSignals with "soil"', () => {
    const r = recommend({
      soil: { soilType: 'Loam', moistureRisk: 'low' },
      regionalDiseaseIntelligence: {
        signal: 'x', urgency: 'medium', confidence: 'medium',
        farmerMessage: 'msg', recommendedAction: 'a',
        source: 'regionalDiseaseIntelligence', visibleToUser: true,
      },
    });
    expect(r.sourceSignals).toContain('soil');
  });

  it('NEVER throws on null context', () => {
    expect(() => recommend(null)).not.toThrow();
    expect(() => recommend('not an object')).not.toThrow();
  });

  it('ctaRoute is always a known router path or null', () => {
    const validRoutes = new Set(['/', '/today', '/scan', '/sell', null]);
    for (const ctx of [{}, null, { risks: [{ kind: 'fungal', level: 'high', headline: 'h', action: 'a' }] }]) {
      const r = recommend(ctx);
      expect(validRoutes.has(r.ctaRoute)).toBe(true);
    }
  });
});

// ─── Integration: ContextEngine → RecommendationEngine ───────

describe('integration: getContext → recommend produces a coherent action', () => {
  it('end-to-end: weather drought signal flows through', async () => {
    const ctx = await getContext({
      farmId: 'f1',
      cropName: 'maize',
      fetchers: {
        weather: async () => ({
          risks: [{ kind: 'drought', level: 'high', headline: 'No rain in 10 days', action: 'Water at dawn' }],
        }),
      },
    });
    const rec = recommend({ ...ctx, risks: ctx.weather.risks });
    expect(rec.urgency).toBe('high');
    expect(rec.sourceSignals).toContain('weather');
  });

  it('context with soil + recommendation tags soil in sourceSignals', async () => {
    const ctx = await getContext({
      farmId: 'f1',
      fetchers: {
        soil:    async () => ({ soilType: 'Sandy', moistureRisk: 'high' }),
        weather: async () => ({
          risks: [{ kind: 'drought', level: 'medium', headline: '5 dry days', action: 'Water briefly' }],
        }),
      },
    });
    const rec = recommend({ ...ctx, risks: ctx.weather.risks });
    expect(rec.sourceSignals).toContain('soil');
  });

  it('context with all sources failing still produces a recommendation', async () => {
    const ctx = await getContext({
      farmId: 'f1',
      fetchers: {
        weather:   () => Promise.reject(new Error('down')),
        soil:      () => Promise.reject(new Error('down')),
        satellite: () => Promise.reject(new Error('down')),
        scanHistory: () => Promise.reject(new Error('down')),
        tasks:     () => Promise.reject(new Error('down')),
      },
    });
    const rec = recommend(ctx);
    expect(rec).not.toBeNull();
    expect(rec.confidenceTone).toBe('Looks stable');
    expect(rec.urgency).toBe('low');
  });
});
