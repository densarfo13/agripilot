import { describe, it, expect } from 'vitest';

/**
 * Decision Engine v2 — priority ladder + safe-fallback unit tests.
 * Covers:
 *   • Priority 1: scan_issue overrides every other signal
 *   • Priority 2: severe weather (rain / heat) inherits from v1
 *   • Priority 3: soil_dry overrides v1 stage default
 *   • Priority 4: region pest/disease override
 *   • Priority 5: satellite stress override
 *   • Priority 7: last-action dedupe (recently_watered)
 *   • Priority 8: general fallback when crop is missing
 *   • Missing-data resilience — null/undefined inputs never throw
 *   • SourceSignals + confidence shape contract
 *   • soil/satellite/region service helpers — pure transforms
 */

import { decideToday, _internal as engineInternal } from '../modules/decisionV2/engine.js';
import { _internal as soilInternal } from '../modules/soil/service.js';
import { _internal as satInternal }  from '../modules/satellite/service.js';
import { _internal as regionInternal } from '../modules/region/service.js';

// ─── Priority ladder ────────────────────────────────────────
describe('decideToday — priority ladder', () => {
  it('returns scan_issue when recent scan = needs_attention', () => {
    const out = decideToday({
      userType: 'farmer',
      cropOrPlant: 'tomato',
      growthStage: 'vegetative',
      scan: { lastStatus: 'needs_attention', lastIssueType: 'leaf_spot' },
    });
    expect(out.priority).toBe(engineInternal.PRIORITY.SCAN_ISSUE);
    expect(out.ruleId).toBe('scan_followup');
    expect(out.confidence).toBe('high');
    expect(out.sourceSignals).toContain('recent_scan');
    expect(out.sourceSignals).toContain('scan_leaf_spot');
  });

  it('falls through to severe weather when no scan flag', () => {
    const out = decideToday({
      userType: 'farmer',
      cropOrPlant: 'maize',
      growthStage: 'vegetative',
      weather: { rainfallMm: 30 },
    });
    expect(out.priority).toBe(engineInternal.PRIORITY.SEVERE_WEATHER);
    expect(out.sourceSignals).toContain('rain');
    // Severe weather with a real number → high confidence.
    expect(out.confidence).toBe('high');
  });

  it('returns soil_dry override when moisture is low', () => {
    const out = decideToday({
      userType: 'backyard',
      cropOrPlant: 'tomato',
      growthStage: 'vegetative',
      soil: { moistureLevel: 'low', source: 'manual' },
    });
    expect(out.priority).toBe(engineInternal.PRIORITY.SOIL_RISK);
    expect(out.ruleId).toBe('soil_dry');
    expect(out.sourceSignals).toContain('soil_dry');
    // Manual readings → medium confidence.
    expect(out.confidence).toBe('medium');
  });

  it('flags weather_hot when soil_dry coincides with hot day', () => {
    const out = decideToday({
      userType: 'farmer',
      cropOrPlant: 'maize',
      growthStage: 'vegetative',
      soil:    { moistureLevel: 'low', source: 'sensor' },
      weather: { temperature: 32 },
    });
    expect(out.priority).toBe(engineInternal.PRIORITY.SOIL_RISK);
    expect(out.sourceSignals).toContain('soil_dry');
    expect(out.sourceSignals).toContain('weather_hot');
    // Sensor source → high.
    expect(out.confidence).toBe('high');
  });

  it('returns region pest_risk override when region.pestRisk = high', () => {
    const out = decideToday({
      userType: 'farmer',
      cropOrPlant: 'cocoa',
      growthStage: 'flowering',
      region: { pestRisk: 'high', diseaseRisk: 'low', droughtRisk: 'low' },
    });
    expect(out.priority).toBe(engineInternal.PRIORITY.REGION_RISK);
    expect(out.ruleId).toBe('region_pest_risk');
    expect(out.sourceSignals).toContain('region_pest_risk');
  });

  it('returns region disease_risk when pest is low and disease is high', () => {
    const out = decideToday({
      userType: 'backyard',
      cropOrPlant: 'lettuce',
      growthStage: 'vegetative',
      region: { pestRisk: 'low', diseaseRisk: 'high' },
    });
    expect(out.priority).toBe(engineInternal.PRIORITY.REGION_RISK);
    expect(out.ruleId).toBe('region_disease_risk');
  });

  it('returns satellite_stress override when satellite.stressLevel = high', () => {
    const out = decideToday({
      userType: 'farmer',
      cropOrPlant: 'rice',
      growthStage: 'vegetative',
      satellite: { stressLevel: 'high' },
    });
    expect(out.priority).toBe(engineInternal.PRIORITY.SATELLITE_RISK);
    expect(out.ruleId).toBe('satellite_stress');
    // User-facing wording must NEVER claim "NDVI anomaly".
    expect(out.reason).not.toMatch(/NDVI/i);
    expect(out.reason).toMatch(/stress/i);
  });

  it('suppresses watering with last-action dedupe', () => {
    const out = decideToday({
      userType: 'farmer',
      cropOrPlant: 'maize',
      growthStage: 'vegetative',
      weather: { temperature: 36 },             // would trigger heat_stress_warning
      lastActions: { lastWateredAt: new Date().toISOString() },
    });
    expect(out.priority).toBe(engineInternal.PRIORITY.LAST_ACTION);
    expect(out.ruleId).toBe('recently_watered');
    expect(out.sourceSignals).toContain('recently_watered');
    expect(out.primaryAction).toMatch(/skip/i);
  });

  it('falls through to general fallback when crop is missing', () => {
    const out = decideToday({ userType: 'farmer' });
    expect(out.priority).toBe(engineInternal.PRIORITY.GENERAL);
    expect(out.fallback).toBe(true);
    expect(out.confidence).toBe('low');
  });
});

// ─── Resilience ─────────────────────────────────────────────
describe('decideToday — missing-data resilience', () => {
  it('does not throw on null', () => {
    expect(() => decideToday(null)).not.toThrow();
    const out = decideToday(null);
    expect(out.priority).toBe(engineInternal.PRIORITY.GENERAL);
  });

  it('does not throw on undefined', () => {
    expect(() => decideToday(undefined)).not.toThrow();
  });

  it('does not throw on garbage input', () => {
    expect(() => decideToday('hello')).not.toThrow();
    expect(() => decideToday(42)).not.toThrow();
    expect(() => decideToday([])).not.toThrow();
  });

  it('always returns sourceSignals as an array', () => {
    const out = decideToday({ userType: 'farmer' });
    expect(Array.isArray(out.sourceSignals)).toBe(true);
  });

  it('always returns a generatedAt ISO string', () => {
    const out = decideToday({ userType: 'farmer' });
    expect(typeof out.generatedAt).toBe('string');
    expect(() => new Date(out.generatedAt)).not.toThrow();
  });
});

// ─── Soil service transforms ────────────────────────────────
describe('soil/service — moisture mapping', () => {
  it('maps dry → low, moist → normal, wet → high, unknown → null', () => {
    expect(soilInternal.MOISTURE_LABEL_TO_LEVEL.dry).toBe('low');
    expect(soilInternal.MOISTURE_LABEL_TO_LEVEL.moist).toBe('normal');
    expect(soilInternal.MOISTURE_LABEL_TO_LEVEL.wet).toBe('high');
    expect(soilInternal.MOISTURE_LABEL_TO_LEVEL.unknown).toBeNull();
  });

  it('derives risk = high when moisture is low', () => {
    expect(soilInternal._deriveRiskLevel('low')).toBe('high');
    expect(soilInternal._deriveRiskLevel('high')).toBe('medium');
    expect(soilInternal._deriveRiskLevel('normal')).toBe('low');
    expect(soilInternal._deriveRiskLevel(null)).toBe('low');
  });

  it('honours an explicit recordedRisk override', () => {
    expect(soilInternal._deriveRiskLevel('low', 'medium')).toBe('medium');
  });

  it('_toSnapshot returns null on garbage', () => {
    expect(soilInternal._toSnapshot(null)).toBeNull();
    expect(soilInternal._toSnapshot('hello')).toBeNull();
  });

  it('_toSnapshot defaults source to manual', () => {
    const snap = soilInternal._toSnapshot({ moistureLevel: 'low' }, new Date());
    expect(snap.source).toBe('manual');
    expect(snap.moistureLevel).toBe('low');
    expect(snap.riskLevel).toBe('high');
  });
});

// ─── Satellite service transforms ───────────────────────────
describe('satellite/service — snapshot transforms', () => {
  it('clamps stressLevel to allowed enum, default low', () => {
    const snap = satInternal._toSnapshot({ stressLevel: 'extreme' }, new Date());
    expect(snap.stressLevel).toBe('low');
  });

  it('preserves a valid vegetationIndex', () => {
    const snap = satInternal._toSnapshot({
      stressLevel: 'medium', vegetationIndex: 0.42,
    }, new Date());
    expect(snap.vegetationIndex).toBe(0.42);
  });

  it('rejects vegetationIndex outside 0..1', () => {
    const snap = satInternal._toSnapshot({
      stressLevel: 'low', vegetationIndex: 1.7,
    }, new Date());
    expect(snap.vegetationIndex).toBeNull();
  });

  it('default source is placeholder', () => {
    const snap = satInternal._toSnapshot({ stressLevel: 'low' }, new Date());
    expect(snap.source).toBe('placeholder');
  });
});

// ─── Region service transforms ──────────────────────────────
describe('region/service — risk band derivation', () => {
  it('returns high band when ratio >= HIGH_RISK_RATIO', () => {
    expect(regionInternal._bandFor(4, 10)).toBe('high');   // 0.4
    expect(regionInternal._bandFor(5, 10)).toBe('high');
  });

  it('returns medium band when ratio between MEDIUM and HIGH', () => {
    expect(regionInternal._bandFor(2, 10)).toBe('medium'); // 0.2
    expect(regionInternal._bandFor(3, 10)).toBe('medium'); // 0.3
  });

  it('returns low band when ratio < MEDIUM_RISK_RATIO', () => {
    expect(regionInternal._bandFor(1, 10)).toBe('low');    // 0.1
    expect(regionInternal._bandFor(0, 10)).toBe('low');
  });

  it('returns low when sample is empty', () => {
    expect(regionInternal._bandFor(0, 0)).toBe('low');
  });

  it('recommendation prefers pest > disease > drought', () => {
    expect(regionInternal._recommendationFor({
      pestRisk: 'high', diseaseRisk: 'high', droughtRisk: 'high',
    })).toMatch(/pest/i);
    expect(regionInternal._recommendationFor({
      pestRisk: 'low', diseaseRisk: 'high', droughtRisk: 'high',
    })).toMatch(/disease/i);
    expect(regionInternal._recommendationFor({
      pestRisk: 'low', diseaseRisk: 'low', droughtRisk: 'high',
    })).toMatch(/water/i);
    expect(regionInternal._recommendationFor({
      pestRisk: 'low', diseaseRisk: 'low', droughtRisk: 'low',
    })).toBeNull();
  });
});

// ─── Envelope shape contract ────────────────────────────────
describe('decideToday — envelope contract', () => {
  it('always exposes the v2 fields plus v1 pass-through', () => {
    const out = decideToday({
      userType: 'farmer',
      cropOrPlant: 'maize',
      growthStage: 'vegetative',
    });
    // v2 fields
    expect(typeof out.primaryAction).toBe('string');
    expect(typeof out.primaryCta).toBe('string');
    expect(typeof out.reason).toBe('string');
    expect(typeof out.priority).toBe('number');
    expect(['low', 'medium', 'high']).toContain(out.confidence);
    expect(Array.isArray(out.sourceSignals)).toBe(true);
    expect(typeof out.tomorrowHook).toBe('string');
    // v1 pass-through (kept so the existing TodayTaskCard works).
    expect(typeof out.estimatedTime === 'string'
        || typeof out.estimatedTime === 'undefined').toBe(true);
    expect(typeof out.localizedText === 'object'
        || typeof out.localizedText === 'undefined').toBe(true);
  });
});
