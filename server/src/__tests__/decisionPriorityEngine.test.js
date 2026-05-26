/**
 * decisionPriorityEngine.test.js — Decision Priority Engine v1.
 * Tests the 9-rank priority cascade + suppression contract.
 */

import { describe, it, expect } from 'vitest';

import {
  runDecisionEngine, RANK, _internal,
} from '../../../src/core/intelligence/decisionPriorityEngine.js';

// ─── Envelope shape ─────────────────────────────────

describe('runDecisionEngine — envelope shape', () => {
  it('empty input returns the calm fallback envelope', () => {
    const v = runDecisionEngine({});
    expect(v.engineVersion).toBe('decision-priority-v1');
    expect(v.urgency).toBe('low');
    expect(v.oneBestAction).toBeTruthy();
    expect(v.suppressedActions).toEqual([]);
  });

  it('null / undefined / garbage input never throws', () => {
    expect(() => runDecisionEngine(null)).not.toThrow();
    expect(() => runDecisionEngine(undefined)).not.toThrow();
    expect(() => runDecisionEngine('string')).not.toThrow();
    expect(() => runDecisionEngine(42)).not.toThrow();
  });

  it('every visible string is an envelope', () => {
    const v = runDecisionEngine({});
    expect(typeof v.oneBestAction.key).toBe('string');
    expect(typeof v.oneBestAction.fallback).toBe('string');
    expect(typeof v.reason.key).toBe('string');
    expect(typeof v.reason.fallback).toBe('string');
  });
});

// ─── Priority cascade ──────────────────────────────

describe('runDecisionEngine — priority cascade', () => {
  it('crop survival wins over disease escalation', () => {
    const v = runDecisionEngine({
      weather: { temp: 2, rainProbability24hPct: 5 },          // frost
      scan: { severity: 'serious', monitoringNeeded: true },   // disease
    });
    expect(v.oneBestAction.rank).toBe(RANK.CROP_SURVIVAL);
    expect(v.suppressedActions.length).toBeGreaterThan(0);
    expect(v.suppressedActions.some((s) => s.rank === RANK.DISEASE_ESCAL)).toBe(true);
  });

  it('disease wins over weather protection', () => {
    const v = runDecisionEngine({
      scan: { severity: 'moderate', monitoringNeeded: true },
      weather: { rainProbability24hPct: 70 },
    });
    expect(v.oneBestAction.rank).toBe(RANK.DISEASE_ESCAL);
    expect(v.suppressedActions.some((s) => s.rank === RANK.WEATHER_PROTECT)).toBe(true);
  });

  it('weather wins over watering stress', () => {
    // Use heat (not rain) so watering CAN fire alongside. The
    // watering-stress branch is gated on "no rain expected"
    // because there's no point telling a farmer to water when
    // rain is on the way.
    const v = runDecisionEngine({
      weather: { temp: 34, rainProbability24hPct: 10 },
      wateringHistory: { daysSinceLastWatering: 3 },
    });
    expect(v.oneBestAction.rank).toBe(RANK.WEATHER_PROTECT);
    expect(v.suppressedActions.some((s) => s.rank === RANK.WATERING_STRESS)).toBe(true);
  });

  it('lifecycle wins over harvest when not yet at harvest', () => {
    const v = runDecisionEngine({
      cropLifecycle: {
        currentStage: 'flowering',
        criticalTaskOverdueDays: 3,
      },
    });
    expect(v.oneBestAction.rank).toBe(RANK.LIFECYCLE_CRIT);
  });

  it('harvest wins when ready + no higher-rank signal', () => {
    const v = runDecisionEngine({
      cropLifecycle: { currentStage: 'harvest', harvestReady: true },
    });
    expect(v.oneBestAction.rank).toBe(RANK.HARVEST_TIMING);
  });

  it('marketplace wins over supplier wins over NGO (low-priority cascade)', () => {
    const v = runDecisionEngine({
      marketplace: { hasActiveListing: true, buyerMatchCount: 3 },
      supplier:    { lowStockOnInput: 'fertiliser' },
      ngo:         { eligiblePrograms: ['program-1'] },
    });
    expect(v.oneBestAction.rank).toBe(RANK.MARKETPLACE);
    expect(v.suppressedActions.some((s) => s.rank === RANK.SUPPLIER)).toBe(true);
    expect(v.suppressedActions.some((s) => s.rank === RANK.NGO_FUNDING)).toBe(true);
  });
});

// ─── Garden-mode filtering ─────────────────────────

describe('runDecisionEngine — garden mode filtering', () => {
  it('hides marketplace + supplier + NGO ranks in garden mode', () => {
    const v = runDecisionEngine({
      mode: 'garden',
      marketplace: { hasActiveListing: true, buyerMatchCount: 3 },
      supplier:    { lowStockOnInput: 'seeds' },
      ngo:         { eligiblePrograms: ['p1'] },
    });
    expect(v.oneBestAction.candidateId).toBeNull();
    expect(v.suppressedActions).toEqual([]);
  });

  it('garden mode still surfaces crop survival', () => {
    const v = runDecisionEngine({
      mode: 'garden',
      weather: { temp: 2 },
    });
    expect(v.oneBestAction.rank).toBe(RANK.CROP_SURVIVAL);
  });
});

// ─── Crop survival branch ──────────────────────────

describe('crop survival candidates', () => {
  it('fires on frost (temp ≤ 4°C)', () => {
    const c = _internal._makeCropSurvivalCandidate({ weather: { temp: 3 } });
    expect(c).toBeTruthy();
    expect(c.candidateId).toBe('crop_survival_frost');
    expect(c.urgency).toBe('high');
  });

  it('fires on severe wind (≥ 50 km/h)', () => {
    const c = _internal._makeCropSurvivalCandidate({ weather: { windSpeedKph: 55 } });
    expect(c).toBeTruthy();
    expect(c.candidateId).toBe('crop_survival_wind');
  });

  it('fires on flood risk (rain≥85% AND soil-risk=high)', () => {
    const c = _internal._makeCropSurvivalCandidate({
      weather: { rainProbability24hPct: 90 },
      soil: { risk: 'high' },
    });
    expect(c).toBeTruthy();
    expect(c.candidateId).toBe('crop_survival_flood');
  });

  it('does not fire when soil risk is low even at 90% rain', () => {
    const c = _internal._makeCropSurvivalCandidate({
      weather: { rainProbability24hPct: 90 },
      soil: { risk: 'low' },
    });
    expect(c).toBeNull();
  });
});

// ─── Disease escalation branch ─────────────────────

describe('disease escalation candidate', () => {
  it('fires on serious severity', () => {
    const c = _internal._makeDiseaseEscalationCandidate({
      scan: { severity: 'serious' },
    });
    expect(c).toBeTruthy();
    expect(c.urgency).toBe('high');
  });

  it('fires on moderate severity (urgency=medium)', () => {
    const c = _internal._makeDiseaseEscalationCandidate({
      scan: { severity: 'moderate' },
    });
    expect(c).toBeTruthy();
    expect(c.urgency).toBe('medium');
  });

  it('fires on recurring memory flag even when severity is missing', () => {
    const c = _internal._makeDiseaseEscalationCandidate({
      scan: { severity: 'mild' },
      farmMemory: { activeFlags: { hasRecurringIssue: true } },
    });
    expect(c).toBeTruthy();
  });

  it('does not fire on mild + no memory signals', () => {
    const c = _internal._makeDiseaseEscalationCandidate({
      scan: { severity: 'mild' },
    });
    expect(c).toBeNull();
  });

  it('uses scan.escalationRecommendation when present', () => {
    const c = _internal._makeDiseaseEscalationCandidate({
      scan: {
        severity: 'serious',
        escalationRecommendation: {
          key: 'custom.action', fallback: 'Call an agronomist today.',
        },
      },
    });
    expect(c.action.key).toBe('custom.action');
  });

  it('attaches re-scan follow-up when scan provides followUpWindowDays', () => {
    const c = _internal._makeDiseaseEscalationCandidate({
      scan: { severity: 'moderate', monitoringNeeded: true, followUpWindowDays: 5 },
    });
    expect(c.followUp).toBeTruthy();
    expect(c.followUp.params.days).toBe(5);
  });
});

// ─── Weather protection branch ─────────────────────

describe('weather protection candidates', () => {
  it('fires on rain ≥ 60%', () => {
    const c = _internal._makeWeatherProtectCandidate({
      weather: { rainProbability24hPct: 65 },
    });
    expect(c).toBeTruthy();
    expect(c.candidateId).toBe('weather_protect_rain');
  });

  it('fires on heat ≥ 32°C', () => {
    const c = _internal._makeWeatherProtectCandidate({
      weather: { temp: 34 },
    });
    expect(c).toBeTruthy();
    expect(c.candidateId).toBe('weather_protect_heat');
  });

  it('fires on wind 25-49 km/h (severe handled by crop_survival)', () => {
    const c = _internal._makeWeatherProtectCandidate({
      weather: { windSpeedKph: 30 },
    });
    expect(c).toBeTruthy();
    expect(c.candidateId).toBe('weather_protect_wind');
  });
});

// ─── Watering stress branch ───────────────────────

describe('watering stress candidate', () => {
  it('fires when last watering > 2 days AND no rain expected', () => {
    const c = _internal._makeWateringStressCandidate({
      wateringHistory: { daysSinceLastWatering: 3 },
      weather: { rainProbability24hPct: 10 },
    });
    expect(c).toBeTruthy();
    expect(c.urgency).toBe('medium');
  });

  it('escalates to urgency=high after 4 days', () => {
    const c = _internal._makeWateringStressCandidate({
      wateringHistory: { daysSinceLastWatering: 5 },
    });
    expect(c.urgency).toBe('high');
  });

  it('does not fire when rain is likely', () => {
    const c = _internal._makeWateringStressCandidate({
      wateringHistory: { daysSinceLastWatering: 5 },
      weather: { rainProbability24hPct: 50 },
    });
    expect(c).toBeNull();
  });
});

// ─── Marketplace / supplier / NGO branches ─────────

describe('low-priority candidates', () => {
  it('marketplace fires when active listing + buyer matches', () => {
    const c = _internal._makeMarketplaceCandidate({
      marketplace: { hasActiveListing: true, buyerMatchCount: 2 },
    });
    expect(c).toBeTruthy();
    expect(c.urgency).toBe('low');
  });

  it('marketplace does not fire without buyer matches', () => {
    const c = _internal._makeMarketplaceCandidate({
      marketplace: { hasActiveListing: true, buyerMatchCount: 0 },
    });
    expect(c).toBeNull();
  });

  it('supplier fires on low stock', () => {
    const c = _internal._makeSupplierCandidate({
      supplier: { lowStockOnInput: 'fertiliser' },
    });
    expect(c).toBeTruthy();
  });

  it('ngo fires on eligible programs', () => {
    const c = _internal._makeNgoFundingCandidate({
      ngo: { eligiblePrograms: ['p1', 'p2'] },
    });
    expect(c).toBeTruthy();
    expect(c.action.params.count).toBe(2);
  });
});

// ─── Suppression contract ──────────────────────────

describe('suppression contract', () => {
  it('returns at most 1 oneBestAction regardless of candidate count', () => {
    const v = runDecisionEngine({
      weather: { temp: 2, rainProbability24hPct: 70, windSpeedKph: 30 },
      scan: { severity: 'serious' },
      wateringHistory: { daysSinceLastWatering: 5 },
      cropLifecycle: { currentStage: 'flowering', criticalTaskOverdueDays: 3, harvestReady: true },
      marketplace: { hasActiveListing: true, buyerMatchCount: 2 },
      supplier: { lowStockOnInput: 'seeds' },
      ngo: { eligiblePrograms: ['p1'] },
    });
    expect(v.oneBestAction.rank).toBe(RANK.CROP_SURVIVAL);
    expect(v.suppressedActions.length).toBeGreaterThan(0);
  });

  it('every suppressed action carries a reason envelope', () => {
    const v = runDecisionEngine({
      scan: { severity: 'serious' },
      marketplace: { hasActiveListing: true, buyerMatchCount: 5 },
    });
    expect(v.suppressedActions.length).toBeGreaterThan(0);
    for (const s of v.suppressedActions) {
      expect(typeof s.suppressedReason.key).toBe('string');
      expect(typeof s.suppressedReason.fallback).toBe('string');
    }
  });
});
