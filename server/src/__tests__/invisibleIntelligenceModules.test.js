/**
 * invisibleIntelligenceModules.test.js — pins the Invisible
 * Intelligence Architecture contract across the 10 new modules
 * under src/intelligence/invisible/.
 *
 * The CRITICAL invariants:
 *   • Every module returns the canonical 7-field shape.
 *   • visibleToUser:false when no real backing data exists
 *     ("Trust + Safety: never show fake X" rule).
 *   • Orchestrator emits ONE recommendation in the documented
 *     priority order.
 *   • UX mode gating prevents commercial/admin signals leaking to
 *     beginners/gardeners.
 */

import { describe, it, expect } from 'vitest';

import { makeActiveSignal, makeQuietFallback }      from '../../../src/intelligence/invisible/moduleShape.js';
import { computeMarketIntelligence }                from '../../../src/intelligence/invisible/marketIntelligence.js';
import { computeBuyerEcosystem }                    from '../../../src/intelligence/invisible/buyerEcosystem.js';
import { computeFinancialLayer }                    from '../../../src/intelligence/invisible/financialLayer.js';
import { computeCooperativeWorkflows }              from '../../../src/intelligence/invisible/cooperativeWorkflows.js';
import { computeSatelliteAutomation }               from '../../../src/intelligence/invisible/satelliteAutomation.js';
import { computeYieldForecasting }                  from '../../../src/intelligence/invisible/yieldForecasting.js';
import { computeRegionalDiseaseIntelligence }       from '../../../src/intelligence/invisible/regionalDiseaseIntelligence.js';
import { orchestrateNextBestAction }                from '../../../src/intelligence/invisible/nextBestActionOrchestrator.js';
import { resolveUserExperienceMode, canSurface, isBeginnerMode, EXPERIENCE_MODES }
  from '../../../src/intelligence/invisible/userExperienceMode.js';

const NOW = Date.parse('2026-05-12T12:00:00Z');
const HOUR = 60 * 60 * 1000;

const CANONICAL_KEYS = ['confidence', 'farmerMessage', 'recommendedAction', 'signal',
                        'source', 'urgency', 'visibleToUser'];

function expectCanonicalShape(r) {
  expect(r).toBeTruthy();
  expect(Object.keys(r).sort()).toEqual(CANONICAL_KEYS);
}

// ─── moduleShape ────────────────────────────────────────────────

describe('moduleShape — factory invariants', () => {
  it('quiet fallback returns visibleToUser:false', () => {
    const r = makeQuietFallback('test', 'hi');
    expectCanonicalShape(r);
    expect(r.visibleToUser).toBe(false);
    expect(r.signal).toBeNull();
  });

  it('active signal requires non-empty farmerMessage to be visible', () => {
    const r = makeActiveSignal({
      signal: 'x', source: 'test', visibleToUser: true,
    });
    expect(r.visibleToUser).toBe(false);
  });
});

// ─── marketIntelligence ────────────────────────────────────────

describe('marketIntelligence — no fake prices', () => {
  it('quiet fallback without price feed', () => {
    const r = computeMarketIntelligence({ cropType: 'tomato', region: 'GH' });
    expectCanonicalShape(r);
    expect(r.visibleToUser).toBe(false);
    expect(r.farmerMessage).toMatch(/Market insights will improve/);
  });

  it('quiet fallback when only some inputs present', () => {
    expect(computeMarketIntelligence({
      cropType: 'tomato',
      priceFeed: [{ observedAt: '2026-05-12', priceLow: 1 }],
    }).visibleToUser).toBe(false);
    expect(computeMarketIntelligence({
      region: 'GH',
      priceFeed: [{ observedAt: '2026-05-12', priceLow: 1 }],
    }).visibleToUser).toBe(false);
  });

  it('never throws on garbage input', () => {
    expect(() => computeMarketIntelligence(null)).not.toThrow();
    expect(() => computeMarketIntelligence('x')).not.toThrow();
  });
});

// ─── buyerEcosystem ────────────────────────────────────────────

describe('buyerEcosystem — no fake buyers', () => {
  it('listing-ready signal when farmer has draft listing', () => {
    const r = computeBuyerEcosystem({ crop: 'tomato', quantity: 50, listingStatus: 'draft' });
    expectCanonicalShape(r);
    expect(r.visibleToUser).toBe(true);
    expect(r.signal).toBe('listing_ready');
  });

  it('active-listing acknowledgement contains no fake buyer count', () => {
    const r = computeBuyerEcosystem({ crop: 'tomato', quantity: 50, listingStatus: 'active' });
    expect(r.signal).toBe('listing_active');
    expect(r.farmerMessage).not.toMatch(/\d+/);
  });

  it('quiet fallback when nothing actionable', () => {
    expect(computeBuyerEcosystem({}).visibleToUser).toBe(false);
  });
});

// ─── financialLayer ────────────────────────────────────────────

describe('financialLayer — no fake revenue', () => {
  it('quiet fallback for brand-new user', () => {
    expect(computeFinancialLayer({}).visibleToUser).toBe(false);
  });

  it('surfaces "track inputs" when activity is sparse', () => {
    const r = computeFinancialLayer({ completedTaskCount: 1 });
    expect(r.signal).toBe('inputs_needed');
    expect(r.farmerMessage).toMatch(/track input costs/);
  });

  it('surfaces "record improving" when activity is building up', () => {
    const r = computeFinancialLayer({ completedTaskCount: 5 });
    expect(r.signal).toBe('record_improving');
  });

  it('never emits numeric revenue claim', () => {
    const r = computeFinancialLayer({ completedTaskCount: 5 });
    expect(r.farmerMessage).not.toMatch(/\$|USD|GHS|NGN/);
  });
});

// ─── cooperativeWorkflows ──────────────────────────────────────

describe('cooperativeWorkflows — no fake groups', () => {
  it('quiet fallback by default', () => {
    expect(computeCooperativeWorkflows({}).visibleToUser).toBe(false);
  });

  it('group opportunity when real cluster data present', () => {
    const r = computeCooperativeWorkflows({
      cropCluster: { farmCount: 5, cropName: 'tomato' },
    });
    expect(r.visibleToUser).toBe(true);
    expect(r.signal).toBe('group_market_opportunity');
  });

  it('quiet fallback when cluster has no cropName', () => {
    expect(computeCooperativeWorkflows({
      cropCluster: { farmCount: 5 },
    }).visibleToUser).toBe(false);
  });
});

// ─── satelliteAutomation ───────────────────────────────────────

describe('satelliteAutomation — no raw NDVI', () => {
  it('quiet fallback when no coords', () => {
    expect(computeSatelliteAutomation({
      satelliteSnapshot: { stressLevel: 'high' },
    }).visibleToUser).toBe(false);
  });

  it('quiet fallback when no snapshot', () => {
    expect(computeSatelliteAutomation({
      coordinates: { lat: 5.6, lng: -0.18 },
    }).visibleToUser).toBe(false);
  });

  it('surfaces "needs attention" on high stress', () => {
    const r = computeSatelliteAutomation({
      coordinates: { lat: 5.6, lng: -0.18 },
      satelliteSnapshot: { stressLevel: 'high' },
    });
    expect(r.visibleToUser).toBe(true);
    expect(r.urgency).toBe('high');
  });

  it('never echoes raw NDVI in farmerMessage', () => {
    const r = computeSatelliteAutomation({
      coordinates: { lat: 5.6, lng: -0.18 },
      satelliteSnapshot: { stressLevel: 'high', ndvi: 0.42 },
    });
    expect(r.farmerMessage).not.toMatch(/NDVI|0\.\d+/);
  });
});

// ─── yieldForecasting ──────────────────────────────────────────

describe('yieldForecasting — no exact yield promises', () => {
  it('quiet fallback without a crop', () => {
    expect(computeYieldForecasting({}).visibleToUser).toBe(false);
  });

  it('flags at_risk when high-level weather risk fires', () => {
    const r = computeYieldForecasting({
      crop: 'maize',
      weatherRisks: [{ kind: 'fungal', level: 'high' }],
    });
    expect(r.signal).toBe('at_risk');
    expect(r.urgency).toBe('high');
  });

  it('flags improving when engagement is high + no risks', () => {
    const r = computeYieldForecasting({
      crop: 'maize',
      completedTaskCount: 5,
      scanSeverity: 'low',
    });
    expect(r.signal).toBe('improving');
  });

  it('defaults to stable with low confidence', () => {
    const r = computeYieldForecasting({ crop: 'maize' });
    expect(r.signal).toBe('stable');
    expect(r.confidence).toBe('low');
  });

  it('never emits a numeric yield estimate', () => {
    const r = computeYieldForecasting({ crop: 'maize', completedTaskCount: 5 });
    expect(r.farmerMessage).not.toMatch(/\d+\s*(kg|ton|tonne|bushel|%)/i);
  });
});

// ─── regionalDiseaseIntelligence ───────────────────────────────

describe('regionalDiseaseIntelligence — local + weather only', () => {
  it('quiet fallback when no signals', () => {
    expect(computeRegionalDiseaseIntelligence({}).visibleToUser).toBe(false);
  });

  it('surfaces fungal pressure when weather agrees', () => {
    const r = computeRegionalDiseaseIntelligence({
      weatherRisks: [{ kind: 'fungal', level: 'high', headline: 'h', action: 'a' }],
      cropType: 'tomato',
    });
    expect(r.visibleToUser).toBe(true);
    expect(r.signal).toBe('fungal_pressure_rising');
    expect(r.farmerMessage.toLowerCase()).toContain('tomato');
  });

  it('surfaces recurrence when scan pattern fires 3+x', () => {
    const r = computeRegionalDiseaseIntelligence({
      scanPattern: { recurrence: { count: 4, issue: 'leaf rust' } },
    });
    expect(r.signal).toBe('local_pattern_recurrence');
  });

  it('never fabricates "X nearby farms reported" claim', () => {
    const r = computeRegionalDiseaseIntelligence({
      weatherRisks: [{ kind: 'fungal', level: 'high', headline: 'h', action: 'a' }],
    });
    expect(r.farmerMessage.toLowerCase()).not.toMatch(/nearby farms? reported/);
  });
});

// ─── nextBestActionOrchestrator ────────────────────────────────

describe('nextBestActionOrchestrator — priority order', () => {
  it('crop health risk wins over everything', () => {
    const r = orchestrateNextBestAction({
      nowMs: NOW,
      regionalDiseaseIntelligence: makeActiveSignal({
        signal: 'fungal_pressure_rising',
        urgency: 'high', confidence: 'medium',
        farmerMessage: 'Fungal risk rising',
        recommendedAction: 'check lower leaves',
        source: 'regionalDiseaseIntelligence',
        visibleToUser: true,
      }),
      weatherRisks: [{ kind: 'drought', level: 'high', headline: 'dry', action: 'a' }],
      scanTasks: [{ urgency: 'high', completed: false, dueAt: new Date(NOW - HOUR).toISOString(), title: 'overdue' }],
    });
    expect(r.kind).toBe('crop_health');
  });

  it('severe weather wins when no disease signal', () => {
    const r = orchestrateNextBestAction({
      nowMs: NOW,
      weatherRisks: [{ kind: 'drought', level: 'high', headline: 'dry', action: 'a' }],
      scanTasks: [{ urgency: 'high', completed: false, dueAt: new Date(NOW - HOUR).toISOString(), title: 'overdue' }],
    });
    expect(r.kind).toBe('severe_weather');
  });

  it('urgent task wins after weather + before scan-followup', () => {
    const r = orchestrateNextBestAction({
      nowMs: NOW,
      scanTasks: [{ urgency: 'high', completed: false, dueAt: new Date(NOW - HOUR).toISOString(), title: 'overdue' }],
      scanPattern: { trend: 'worsening', previous: { daysAgo: 3 } },
    });
    expect(r.kind).toBe('urgent_task');
  });

  it('scan_followup surfaces when nothing higher fires', () => {
    const r = orchestrateNextBestAction({
      nowMs: NOW,
      scanPattern: { trend: 'worsening', previous: { daysAgo: 3 } },
    });
    expect(r.kind).toBe('scan_followup');
  });

  it('yield_risk surfaces above market/buyer/funding', () => {
    const r = orchestrateNextBestAction({
      nowMs: NOW,
      userMode: 'smallholder_farmer',
      yieldForecasting: makeActiveSignal({
        signal: 'at_risk', urgency: 'high', confidence: 'medium',
        farmerMessage: 'Disease may reduce harvest',
        recommendedAction: 'open today plan',
        source: 'yieldForecasting',
        visibleToUser: true,
      }),
      buyerEcosystem: makeActiveSignal({
        signal: 'listing_ready', urgency: 'low', confidence: 'medium',
        farmerMessage: 'List your tomato',
        recommendedAction: 'Create listing',
        source: 'buyerEcosystem',
        visibleToUser: true,
      }),
    });
    expect(r.kind).toBe('yield_risk');
  });

  it('market opportunity surfaces ONLY for commercial-allowed modes', () => {
    const market = makeActiveSignal({
      signal: 'sell_now', urgency: 'medium', confidence: 'medium',
      farmerMessage: 'Demand strong',
      recommendedAction: 'List now',
      source: 'marketIntelligence',
      visibleToUser: true,
    });
    expect(orchestrateNextBestAction({
      nowMs: NOW, userMode: 'new_gardener', marketIntelligence: market,
    }).kind).toBe('encouragement');
    expect(orchestrateNextBestAction({
      nowMs: NOW, userMode: 'smallholder_farmer', marketIntelligence: market,
    }).kind).toBe('market_opportunity');
  });

  it('returns encouragement fallback when nothing fires', () => {
    expect(orchestrateNextBestAction({ nowMs: NOW }).kind).toBe('encouragement');
  });

  it('returns canonical NBA shape that existing card consumes', () => {
    const r = orchestrateNextBestAction({ nowMs: NOW });
    expect(typeof r.kind).toBe('string');
    expect(typeof r.title).toBe('string');
    expect(typeof r.reason).toBe('string');
    expect(['high', 'medium', 'low']).toContain(r.urgency);
    expect(['high', 'medium', 'low']).toContain(r.confidence);
    expect(typeof r.dedupeKey).toBe('string');
  });
});

// ─── userExperienceMode ────────────────────────────────────────

describe('userExperienceMode — detection + gating', () => {
  it('detects NGO from role', () => {
    expect(resolveUserExperienceMode({ role: 'ngo' })).toBe(EXPERIENCE_MODES.NGO_MANAGER);
    expect(resolveUserExperienceMode({ role: 'admin' })).toBe(EXPERIENCE_MODES.NGO_MANAGER);
  });

  it('detects new_gardener (sparse history, garden experience)', () => {
    expect(resolveUserExperienceMode({
      experience: 'backyard', scanCount: 0, accountAgeDays: 3,
    })).toBe(EXPERIENCE_MODES.NEW_GARDENER);
  });

  it('detects experienced_gardener', () => {
    expect(resolveUserExperienceMode({
      experience: 'backyard', scanCount: 8, accountAgeDays: 60,
    })).toBe(EXPERIENCE_MODES.EXPERIENCED_GARDENER);
  });

  it('detects commercial_farmer by farm size', () => {
    expect(resolveUserExperienceMode({ farmSize: 12 })).toBe(EXPERIENCE_MODES.COMMERCIAL_FARMER);
  });

  it('defaults to smallholder_farmer for ambiguous input', () => {
    expect(resolveUserExperienceMode({})).toBe(EXPERIENCE_MODES.SMALLHOLDER_FARMER);
  });

  it('canSurface blocks commercial signals for gardeners', () => {
    expect(canSurface('buyer_opportunity',  EXPERIENCE_MODES.NEW_GARDENER)).toBe(false);
    expect(canSurface('market_opportunity', EXPERIENCE_MODES.EXPERIENCED_GARDENER)).toBe(false);
    expect(canSurface('funding_opportunity', EXPERIENCE_MODES.NEW_GARDENER)).toBe(false);
  });

  it('canSurface allows commercial signals for farmers + NGO', () => {
    expect(canSurface('buyer_opportunity', EXPERIENCE_MODES.SMALLHOLDER_FARMER)).toBe(true);
    expect(canSurface('market_opportunity', EXPERIENCE_MODES.COMMERCIAL_FARMER)).toBe(true);
    expect(canSurface('funding_opportunity', EXPERIENCE_MODES.NGO_MANAGER)).toBe(true);
  });

  it('canSurface allows operational signals for every mode', () => {
    for (const m of Object.values(EXPERIENCE_MODES)) {
      expect(canSurface('crop_health',    m)).toBe(true);
      expect(canSurface('severe_weather', m)).toBe(true);
      expect(canSurface('urgent_task',    m)).toBe(true);
      expect(canSurface('scan_followup',  m)).toBe(true);
      expect(canSurface('yield_risk',     m)).toBe(true);
      expect(canSurface('encouragement',  m)).toBe(true);
    }
  });

  it('canSurface admin_aggregate is NGO-only', () => {
    expect(canSurface('admin_aggregate', EXPERIENCE_MODES.NGO_MANAGER)).toBe(true);
    expect(canSurface('admin_aggregate', EXPERIENCE_MODES.COMMERCIAL_FARMER)).toBe(false);
  });

  it('isBeginnerMode is only true for new_gardener', () => {
    expect(isBeginnerMode(EXPERIENCE_MODES.NEW_GARDENER)).toBe(true);
    expect(isBeginnerMode(EXPERIENCE_MODES.EXPERIENCED_GARDENER)).toBe(false);
    expect(isBeginnerMode(EXPERIENCE_MODES.SMALLHOLDER_FARMER)).toBe(false);
  });
});
