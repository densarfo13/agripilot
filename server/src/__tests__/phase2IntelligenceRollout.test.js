/**
 * phase2IntelligenceRollout.test.js — verifies the Phase 2
 * intelligence rollout: feature flags, supplier/marketplace
 * facades, marketplace buyer + pricing engines, soil facades,
 * satellite orchestrator + landHealth + weatherFusion +
 * fieldAnomaly engines, yield prediction + confidence + factors
 * engines, and NGO metrics + analytics + cohort + risk-aggregation
 * engines.
 */

// localStorage / window shim for offlineStore-backed feature flags.
const _s = new Map();
const _ls = {
  getItem:    (k) => (_s.has(k) ? _s.get(k) : null),
  setItem:    (k, v) => { _s.set(k, String(v)); },
  removeItem: (k) => { _s.delete(k); },
  clear:      () => { _s.clear(); },
};
if (typeof globalThis.window === 'undefined') globalThis.window = { localStorage: _ls };
else if (!globalThis.window.localStorage) globalThis.window.localStorage = _ls;

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FEATURE, isFeatureEnabled, setFeatureOverride, getFeatureFlags,
} from '../../../src/config/featureFlags.js';
// Suppliers facade
import {
  trustLabelFor as _trustViaFacade,
  TRUST_LABEL,
} from '../../../src/core/suppliers/supplierTrustEngine.js';
// Marketplace
import {
  computeMarketReadiness as _mrViaFacade,
} from '../../../src/core/marketplace/marketReadinessEngine.js';
import {
  computeListingTrustSignals as _ltViaFacade,
} from '../../../src/core/marketplace/listingTrustEngine.js';
import {
  computeBuyerSignals, BUYER_INTEREST,
} from '../../../src/core/marketplace/buyerSignalEngine.js';
import {
  pricingInsightFor, PRICING_TIER,
} from '../../../src/core/marketplace/pricingInsightEngine.js';
// Soil facades
import {
  computeSoilRisks, SOIL_RISK,
} from '../../../src/core/soil/soilRiskEngine.js';
import {
  soilRecommendationsFor,
} from '../../../src/core/soil/soilRecommendationEngine.js';
// Satellite
import {
  orchestrateSatellite, SATELLITE_STATUS,
} from '../../../src/core/satellite/satelliteOrchestrator.js';
import {
  computeLandHealth, LAND_HEALTH_LABEL,
} from '../../../src/core/satellite/landHealthEngine.js';
import {
  fuseWeather,
} from '../../../src/core/satellite/weatherFusionEngine.js';
import {
  detectFieldAnomalies, ANOMALY_KIND,
} from '../../../src/core/satellite/fieldAnomalyEngine.js';
// Yield
import {
  predictYield,
} from '../../../src/core/yield/yieldPredictionEngine.js';
import {
  confidenceBandFor, CONFIDENCE_BAND,
} from '../../../src/core/yield/yieldConfidenceEngine.js';
import {
  yieldFactorsFor,
} from '../../../src/core/yield/yieldFactorsEngine.js';
// NGO
import {
  computeNgoMetrics,
} from '../../../src/core/ngo/ngoMetricsEngine.js';
import {
  computeProgramAnalytics,
} from '../../../src/core/ngo/programAnalyticsEngine.js';
import {
  buildFarmerCohorts, COHORT,
} from '../../../src/core/ngo/farmerCohortEngine.js';
import {
  aggregateRegionalRisks, REGIONAL_RISK_LEVEL,
} from '../../../src/core/ngo/riskAggregationEngine.js';

const NOW = Date.UTC(2026, 4, 24);
const DAY = 86400000;

// ─── §1 feature flags ────────────────────────────────────

describe('featureFlags', () => {
  beforeEach(() => _s.clear());

  it('every Phase 2 flag defaults to OFF', () => {
    for (const flag of Object.values(FEATURE)) {
      expect(isFeatureEnabled(flag)).toBe(false);
    }
  });

  it('localStorage override flips a single flag', () => {
    setFeatureOverride(FEATURE.SOIL_INTELLIGENCE, true);
    expect(isFeatureEnabled(FEATURE.SOIL_INTELLIGENCE)).toBe(true);
    expect(isFeatureEnabled(FEATURE.SATELLITE_INTELLIGENCE)).toBe(false);
  });

  it('clearing an override falls back to the default', () => {
    setFeatureOverride(FEATURE.SOIL_INTELLIGENCE, true);
    setFeatureOverride(FEATURE.SOIL_INTELLIGENCE, null);
    expect(isFeatureEnabled(FEATURE.SOIL_INTELLIGENCE)).toBe(false);
  });

  it('getFeatureFlags snapshots every flag', () => {
    const snap = getFeatureFlags();
    for (const flag of Object.values(FEATURE)) {
      expect(Object.prototype.hasOwnProperty.call(snap, flag)).toBe(true);
    }
  });

  it('never throws on garbage input', () => {
    expect(() => isFeatureEnabled(null)).not.toThrow();
    expect(isFeatureEnabled(null)).toBe(false);
  });
});

// ─── §2 supplier facade ──────────────────────────────────

describe('supplierTrustEngine (facade)', () => {
  it('verified status → verified label tier', () => {
    expect(_trustViaFacade({ verifiedStatus: 'verified' }).tier).toBe(TRUST_LABEL.VERIFIED);
  });
});

// ─── §3 marketplace ──────────────────────────────────────

describe('marketReadiness + listingTrust facades exist', () => {
  it('marketReadinessEngine facade re-exports compute', () => {
    expect(typeof _mrViaFacade).toBe('function');
  });
  it('listingTrustEngine facade re-exports computeListingTrustSignals', () => {
    expect(typeof _ltViaFacade).toBe('function');
  });
});

describe('buyerSignalEngine', () => {
  it('no events → cold', () => {
    const s = computeBuyerSignals({ interestEvents: [], nowMs: NOW });
    expect(s.interestLevel).toBe(BUYER_INTEREST.COLD);
    expect(s.confidence).toBe('low');
  });

  it('2 contacts in last 7d → hot', () => {
    const s = computeBuyerSignals({
      interestEvents: [
        { type: 'contact', at: NOW - 1 * DAY },
        { type: 'contact', at: NOW - 2 * DAY },
      ],
      nowMs: NOW,
    });
    expect(s.interestLevel).toBe(BUYER_INTEREST.HOT);
  });

  it('3 views → warm', () => {
    const s = computeBuyerSignals({
      interestEvents: [
        { type: 'view', at: NOW - 1 * DAY },
        { type: 'view', at: NOW - 1 * DAY },
        { type: 'view', at: NOW - 2 * DAY },
      ],
      nowMs: NOW,
    });
    expect(s.interestLevel).toBe(BUYER_INTEREST.WARM);
  });

  it('every output carries a disclaimer envelope', () => {
    const s = computeBuyerSignals({ interestEvents: [], nowMs: NOW });
    expect(s.disclaimer.fallback).toMatch(/estimate|guarantee/i);
  });

  it('never throws on garbage input', () => {
    expect(() => computeBuyerSignals(null)).not.toThrow();
  });
});

describe('pricingInsightEngine', () => {
  it('returns not_enough_data with < 3 observations', () => {
    const p = pricingInsightFor({ recentLocalPrices: [3.0, 4.0] });
    expect(p.ok).toBe(false);
    expect(p.reason).toBe('not_enough_data');
    expect(p.fallback.fallback).toMatch(/local/i);
  });

  it('produces a range when ≥ 3 prices are given', () => {
    const p = pricingInsightFor({ recentLocalPrices: [3.0, 3.5, 4.0, 4.2, 3.8] });
    expect(p.ok).toBe(true);
    expect(p.range.max).toBeGreaterThanOrEqual(p.range.min);
    expect(p.range.mid).toBeGreaterThan(0);
    expect(p.confidence).not.toBe('high');
  });

  it('user price above range → upper tier', () => {
    const p = pricingInsightFor({
      recentLocalPrices: [3.0, 3.5, 4.0],
      proposedPrice: 99,
    });
    expect(p.tier).toBe(PRICING_TIER.UPPER);
  });

  it('disclaimer always present', () => {
    const p = pricingInsightFor({ recentLocalPrices: [3.0, 3.5, 4.0] });
    expect(p.disclaimer.fallback).toMatch(/estimate/i);
  });

  it('never throws on garbage input', () => {
    expect(() => pricingInsightFor(null)).not.toThrow();
  });
});

// ─── §4 soil facades ─────────────────────────────────────

describe('soilRiskEngine facade', () => {
  it('empty input → all risks UNKNOWN', () => {
    const r = computeSoilRisks({});
    expect(r.soilRisk).toBe(SOIL_RISK.UNKNOWN);
    expect(r.confidence).not.toBe('high');
  });

  it('scan water_stress → moisture risk HIGH', () => {
    const r = computeSoilRisks({ scan: { issueCategory: 'water_stress' } });
    expect(r.moistureRisk).toBe(SOIL_RISK.HIGH);
  });
});

describe('soilRecommendationEngine facade', () => {
  it('returns guidance + disclaimer', () => {
    const r = soilRecommendationsFor({ stage: 'planting' });
    expect(Array.isArray(r.guidance)).toBe(true);
    expect(r.disclaimer).toBeTruthy();
    expect(r.confidence).not.toBe('high');
  });
});

// ─── §5 satellite ────────────────────────────────────────

describe('satelliteOrchestrator', () => {
  it('default: no provider → status no_provider, ndvi null, anomalies empty', () => {
    const s = orchestrateSatellite({ fieldId: 'f1' });
    expect(s.status).toBe(SATELLITE_STATUS.NO_PROVIDER);
    expect(s.ndvi).toBe(null);
    expect(Array.isArray(s.anomalies)).toBe(true);
  });

  it('weather fusion still works without satellite imagery', () => {
    const s = orchestrateSatellite({
      weather: { temperatureC: 30, rainProbability24hPct: 60 },
    });
    expect(s.weatherFused).toBeTruthy();
    expect(s.weatherFused.temperatureC).toBe(30);
  });

  it('never throws on garbage input', () => {
    expect(() => orchestrateSatellite(null)).not.toThrow();
  });
});

describe('landHealthEngine', () => {
  it('returns null when ndvi is null (honest gap)', () => {
    expect(computeLandHealth({ ndvi: null })).toBe(null);
  });
  it('healthy ndvi + long dry spell → stress_possible', () => {
    const h = computeLandHealth({ ndvi: 0.6, weather: { daysSinceRain: 12 } });
    expect(h.label).toBe(LAND_HEALTH_LABEL.STRESS_POSSIBLE);
    expect(h.confidence).not.toBe('high');
  });
});

describe('weatherFusionEngine', () => {
  it('returns null when both ground + satellite are missing', () => {
    expect(fuseWeather({})).toBe(null);
  });
  it('weights ground 70/30 with satellite when both present', () => {
    const w = fuseWeather({
      weather:   { temperatureC: 30 },
      satellite: { surfaceTempC: 32 },
    });
    expect(w.temperatureC).toBeCloseTo(30 * 0.7 + 32 * 0.3, 1);
  });
  it('rejects outlier satellite temps (> 10 °C off ground)', () => {
    const w = fuseWeather({
      weather:   { temperatureC: 30 },
      satellite: { surfaceTempC: 50 },
    });
    expect(w.temperatureC).toBe(30);
  });
  it('takes MAX rain probability between sources', () => {
    const w = fuseWeather({
      weather:   { rainProbability24hPct: 30 },
      satellite: { rainProbability24hPct: 70 },
    });
    expect(w.rainProbability24hPct).toBe(70);
  });
});

describe('fieldAnomalyEngine', () => {
  it('empty signals → no anomalies', () => {
    expect(detectFieldAnomalies({})).toEqual([]);
  });
  it('long dry spell flags water stress', () => {
    const r = detectFieldAnomalies({ weather: { daysSinceRain: 12 } });
    expect(r.find((x) => x.kind === ANOMALY_KIND.WATER_STRESS)).toBeTruthy();
  });
  it('NDVI drop vs previous → rapid_change anomaly', () => {
    const r = detectFieldAnomalies({ ndvi: 0.40, prevNdvi: 0.65 });
    expect(r.find((x) => x.kind === ANOMALY_KIND.RAPID_CHANGE)).toBeTruthy();
  });
  it('every anomaly has a hedged message envelope', () => {
    const r = detectFieldAnomalies({ ndvi: 0.15, weather: { daysSinceRain: 15, temperatureC: 38 } });
    for (const a of r) {
      expect(a.message).toBeTruthy();
      expect(a.confidence).not.toBe('high');
    }
  });
});

// ─── §6 yield ────────────────────────────────────────────

describe('yieldPredictionEngine (facade)', () => {
  it('predictYield is exported and behaves like estimateYield', () => {
    const r = predictYield({ crop: 'tomato', plantCount: 10 });
    expect(r.confidenceLabel).toBe('low');
  });
});

describe('yieldConfidenceEngine', () => {
  it('thin signals → low band', () => {
    expect(confidenceBandFor({}).band).toBe(CONFIDENCE_BAND.LOW);
  });

  it('many signals → medium band (NEVER high)', () => {
    const b = confidenceBandFor({
      hasPlantCount: true, hasPlantingDate: true,
      hasScanHistory: true, taskCompletionRate: 0.8,
      daysSincePlanting: 60,
    });
    expect(b.band).toBe(CONFIDENCE_BAND.MEDIUM);
  });

  it('bandReason envelope is localized', () => {
    const b = confidenceBandFor({});
    expect(b.bandReason.key).toBeTruthy();
    expect(typeof b.bandReason.fallback).toBe('string');
  });

  it('never throws on garbage input', () => {
    expect(() => confidenceBandFor(null)).not.toThrow();
  });
});

describe('yieldFactorsEngine', () => {
  it('water stress in scan → negative factor', () => {
    const f = yieldFactorsFor({
      scanHistory: [{ issueCategory: 'water_stress' }],
    });
    expect(f.negatives.length).toBeGreaterThan(0);
  });

  it('healthy scans + high task completion → positive factors', () => {
    const f = yieldFactorsFor({
      scanHistory: [{ issueCategory: 'healthy' }],
      taskCompletionRate: 0.9,
    });
    expect(f.positives.length).toBeGreaterThan(0);
  });

  it('every factor uses hedged language', () => {
    const f = yieldFactorsFor({
      weather: { daysSinceRain: 12, temperatureC: 36 },
      scanHistory: [{ issueCategory: 'fungal_risk' }],
      taskCompletionRate: 0.2,
    });
    const all = [...f.positives, ...f.negatives].map((m) => m.fallback).join(' ');
    expect(all.toLowerCase()).not.toMatch(/guaranteed|definitely|will reduce by/);
  });

  it('never throws on garbage input', () => {
    expect(() => yieldFactorsFor(null)).not.toThrow();
  });
});

// ─── §7 NGO ──────────────────────────────────────────────

describe('ngoMetricsEngine', () => {
  it('empty cohort → ok=true with zeroes', () => {
    const m = computeNgoMetrics({ farmers: [], nowMs: NOW });
    expect(m.ok).toBe(true);
    expect(m.total).toBe(0);
    expect(m.activePct).toBe(0);
  });

  it('active vs inactive split based on 14-day cutoff', () => {
    const m = computeNgoMetrics({
      farmers: [
        { id: 'a', lastActiveAt: NOW - 5 * DAY,  crop: 'tomato' },
        { id: 'b', lastActiveAt: NOW - 20 * DAY, crop: 'maize' },
      ],
      nowMs: NOW,
    });
    expect(m.active).toBe(1);
    expect(m.inactive).toBe(1);
    expect(m.cropDistribution.tomato).toBe(1);
  });

  it('disclaimer envelope present', () => {
    expect(computeNgoMetrics({}).disclaimer.fallback).toMatch(/PII|cohort|metrics/i);
  });
});

describe('programAnalyticsEngine', () => {
  it('aggregates scan / task / notification events', () => {
    const p = computeProgramAnalytics({
      events: [
        { type: 'scan_succeeded',     at: NOW - 1 * DAY },
        { type: 'scan_failed',        at: NOW - 2 * DAY },
        { type: 'task_completed',     at: NOW - 1 * DAY },
        { type: 'notification_opened',at: NOW - 1 * DAY },
        { type: 'harvest_logged',     at: NOW - 5 * DAY },
      ],
      farmers: [{ id: 'a' }, { id: 'b' }],
      nowMs: NOW,
    });
    expect(p.scans.succeeded30).toBe(1);
    expect(p.scans.failed30).toBe(1);
    expect(p.scans.successPct).toBe(50);
    expect(p.tasks.completed30).toBe(1);
    expect(p.cohortSize).toBe(2);
  });

  it('never throws on garbage input', () => {
    expect(() => computeProgramAnalytics(null)).not.toThrow();
  });
});

describe('farmerCohortEngine', () => {
  it('returns 5 cohorts', () => {
    const c = buildFarmerCohorts({
      farmers: [
        { id: 'a', lastActiveAt: NOW - 5 * DAY,  createdAt: NOW - 3 * DAY,  taskCompletionRate: 0.8 },
        { id: 'b', lastActiveAt: NOW - 30 * DAY, createdAt: NOW - 30 * DAY, taskCompletionRate: 0.2 },
        { id: 'c', lastActiveAt: NOW - 1 * DAY,  estimatedHarvestAt: NOW + 5 * DAY },
        { id: 'd', lastActiveAt: NOW - 2 * DAY,  recentRisks: [{ type: 'fungal' }] },
      ],
      nowMs: NOW,
    });
    expect(c.cohorts[COHORT.ACTIVE].length).toBe(3);
    expect(c.cohorts[COHORT.INACTIVE].length).toBe(1);
    expect(c.cohorts[COHORT.NEWCOMERS]).toContain('a');
    expect(c.cohorts[COHORT.HARVEST_SOON]).toContain('c');
    expect(c.cohorts[COHORT.AT_RISK]).toContain('d');
  });

  it('cohorts carry IDs only (no PII)', () => {
    const c = buildFarmerCohorts({
      farmers: [{ id: 'a', lastActiveAt: NOW, fullName: 'Should Not Leak' }],
      nowMs: NOW,
    });
    const allValues = JSON.stringify(c.cohorts);
    expect(allValues).not.toContain('Should Not Leak');
  });
});

describe('riskAggregationEngine', () => {
  it('aggregates risks per region with hotspot levels', () => {
    const r = aggregateRegionalRisks({
      farmers: [
        { id: 'a', region: 'r1', recentRisks: [{ type: 'fungal',  severity: 'high' }] },
        { id: 'b', region: 'r1', recentRisks: [{ type: 'fungal',  severity: 'high' }] },
        { id: 'c', region: 'r1', recentRisks: [{ type: 'drought', severity: 'high' }] },
        { id: 'd', region: 'r1' },
        { id: 'e', region: 'r2', recentRisks: [{ type: 'heat',    severity: 'low' }] },
      ],
      nowMs: NOW,
    });
    const r1 = r.regions.find((x) => x.region === 'r1');
    expect(r1).toBeTruthy();
    expect(r1.highCount).toBe(3);
    // 3 high of 4 = 75% → HOTSPOT
    expect(r1.hotspotLevel).toBe(REGIONAL_RISK_LEVEL.HOTSPOT);
  });

  it('never throws on garbage input', () => {
    expect(() => aggregateRegionalRisks(null)).not.toThrow();
  });
});
