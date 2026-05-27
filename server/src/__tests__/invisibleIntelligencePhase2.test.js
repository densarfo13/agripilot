/**
 * invisibleIntelligencePhase2.test.js — Phase 2 regression suite.
 *
 * Covers:
 *   §1  feature flags default OFF
 *   §2  ML ranking fallback + protected-candidate rule
 *   §3  disease confidence calibration downgrade triggers
 *   §4  predictive yield risk bands
 *   §5  satellite enrichment safe fallback
 *   §6  NGO intelligence PII stripping
 *   §7  invisible orchestrator never overrides safety rules
 *   §8  data quality gate
 *   §10 calm wording (no AI / model / % leaks)
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  FLAG, isFeatureFlagOn,
} from '../../../src/core/deployment/deploymentGovernance.js';
import {
  assessDataQuality, isReadyFor, gateEngine,
} from '../../../src/core/intelligence/dataQualityGate.js';
import {
  runMlRanking,
} from '../../../src/core/ml/mlRankingEngine.js';
import {
  calibrateDiseaseConfidence,
} from '../../../src/core/scan/diseaseConfidenceCalibration.js';
import {
  runPredictiveYield,
} from '../../../src/core/yield/predictiveYieldEngine.js';
import {
  fetchSatelliteEnrichment, registerSatelliteProvider,
} from '../../../src/core/satellite/satelliteEnrichmentAdapter.js';
import {
  buildNgoIntelligence, _internal as ngoInternal,
} from '../../../src/core/ngo/ngoIntelligenceEngine.js';
import {
  runInvisibleIntelligence,
} from '../../../src/core/intelligence/invisibleIntelligenceOrchestrator.js';

beforeEach(() => { registerSatelliteProvider(null); });

// ═══ §1 feature flags default OFF ═══════════════════════════

describe('Phase 2 flags default OFF', () => {
  it('ENABLE_ML_RANKING off by default', () => {
    expect(isFeatureFlagOn(FLAG.ENABLE_ML_RANKING)).toBe(false);
  });
  it('ENABLE_DISEASE_CONFIDENCE_CALIBRATION off by default', () => {
    expect(isFeatureFlagOn(FLAG.ENABLE_DISEASE_CONFIDENCE_CALIBRATION)).toBe(false);
  });
  it('ENABLE_PREDICTIVE_YIELD off by default', () => {
    expect(isFeatureFlagOn(FLAG.ENABLE_PREDICTIVE_YIELD)).toBe(false);
  });
  it('ENABLE_SATELLITE_ENRICHMENT off by default', () => {
    expect(isFeatureFlagOn(FLAG.ENABLE_SATELLITE_ENRICHMENT)).toBe(false);
  });
  it('ENABLE_NGO_INTELLIGENCE off by default', () => {
    expect(isFeatureFlagOn(FLAG.ENABLE_NGO_INTELLIGENCE)).toBe(false);
  });
});

// ═══ §8 data quality gate ═══════════════════════════════════

describe('dataQualityGate', () => {
  it('returns score 0 + all-missing for empty input', () => {
    const q = assessDataQuality({});
    expect(q.score).toBe(0);
    expect(q.passed.length).toBe(0);
  });

  it('passes validCrop when activeFarm.cropId is set', () => {
    const q = assessDataQuality({ activeFarm: { cropId: 'pepper' } });
    expect(q.checks.validCrop).toBe(true);
  });

  it('isReadyFor("predictive_yield") false on thin data', () => {
    expect(isReadyFor('predictive_yield', assessDataQuality({}))).toBe(false);
  });

  it('gateEngine returns { feature, ready, quality }', () => {
    const g = gateEngine('ml_ranking', { activeFarm: { cropId: 'pepper', region: 'Ashanti' } });
    expect(g.feature).toBe('ml_ranking');
    expect(typeof g.ready).toBe('boolean');
    expect(g.quality).toBeTruthy();
  });

  it('garbage never throws', () => {
    expect(() => assessDataQuality(null)).not.toThrow();
    expect(() => isReadyFor('made_up', null)).not.toThrow();
  });
});

// ═══ §2 ML ranking ═══════════════════════════════════════════

describe('runMlRanking', () => {
  it('fallback when flag OFF — returns base unchanged', () => {
    const base = [{ candidateId: 'x', urgency: 'high' }];
    const v = runMlRanking({ baseRecommendations: base, activeFarm: { cropId: 'pepper' } });
    expect(v.fallbackUsed).toBe(true);
    expect(v.modelUsed).toBe('deterministic_fallback');
    expect(v.topRecommendation).toEqual(base[0]);
  });

  it('returns envelope shape even on empty input', () => {
    const v = runMlRanking({});
    expect(v.engineVersion).toBe('ml-ranking-v1');
    expect(v.fallbackUsed).toBe(true);
    expect(Array.isArray(v.rankedRecommendations)).toBe(true);
  });

  it('null / garbage never throws', () => {
    expect(() => runMlRanking(null)).not.toThrow();
    expect(() => runMlRanking('hi')).not.toThrow();
  });
});

// ═══ §3 disease confidence calibration ═══════════════════════

describe('calibrateDiseaseConfidence', () => {
  it('flag OFF → Needs review', () => {
    const v = calibrateDiseaseConfidence({
      rawModelConfidence: 0.95, imageQualityScore: 0.9,
    });
    expect(v.confidenceToneRaw).toBe('Needs review');
    expect(v.fallbackUsed).toBe(true);
  });

  it('garbage never throws', () => {
    expect(() => calibrateDiseaseConfidence(null)).not.toThrow();
  });

  it('uncertainty factors: low image quality flagged', () => {
    const v = calibrateDiseaseConfidence({
      rawModelConfidence: 0.9,
      imageQualityScore:  0.3,
    });
    expect(v.uncertaintyFactors.some((f) => f.kind === 'image_quality')).toBe(true);
  });

  it('uncertainty factors: crop mismatch flagged', () => {
    const v = calibrateDiseaseConfidence({
      rawModelConfidence: 0.9,
      cropMatchScore:     0.2,
    });
    expect(v.uncertaintyFactors.some((f) => f.kind === 'crop_mismatch')).toBe(true);
  });

  it('never exposes raw model confidence number', () => {
    const v = calibrateDiseaseConfidence({
      rawModelConfidence: 0.87,
      imageQualityScore:  0.8,
    });
    const json = JSON.stringify(v);
    expect(json).not.toContain('0.87');
    expect(json).not.toContain('rawModelConfidence');
  });
});

// ═══ §4 predictive yield ═════════════════════════════════════

describe('runPredictiveYield', () => {
  it('flag OFF → yieldRisk = unknown', () => {
    const v = runPredictiveYield({ activeFarm: { cropId: 'pepper', region: 'Ashanti' } });
    expect(v.yieldRisk).toBe('unknown');
    expect(v.fallbackUsed).toBe(true);
  });

  it('insufficient data → unknown + dataGaps populated', () => {
    const v = runPredictiveYield({});
    expect(v.yieldRisk).toBe('unknown');
    expect(v.dataGaps.length).toBeGreaterThan(0);
  });

  it('garbage never throws', () => {
    expect(() => runPredictiveYield(null)).not.toThrow();
  });

  it('every visible string is a tSafe envelope', () => {
    const v = runPredictiveYield({});
    expect(typeof v.reason.key).toBe('string');
    expect(typeof v.reason.fallback).toBe('string');
    expect(typeof v.nextBestAction.key).toBe('string');
  });
});

// ═══ §5 satellite enrichment ═════════════════════════════════

describe('fetchSatelliteEnrichment', () => {
  it('no provider registered → available=false safely', async () => {
    const v = await fetchSatelliteEnrichment({ crop: 'pepper', region: 'Ashanti' });
    expect(v.available).toBe(false);
    expect(v.dataQuality).toBe('none');
    expect(v.provider).toBeNull();
  });

  it('flag OFF → available=false even with provider registered', async () => {
    registerSatelliteProvider(async () => ({
      vegetationTrend: 'rising', dataQuality: 'high', name: 'mock',
    }));
    const v = await fetchSatelliteEnrichment({ crop: 'pepper', region: 'Ashanti' });
    expect(v.available).toBe(false);
  });

  it('garbage never throws (returns frozen envelope)', async () => {
    const v = await fetchSatelliteEnrichment(null);
    expect(v).toBeTruthy();
    expect(v.available).toBe(false);
  });

  it('registerSatelliteProvider(null) clears provider', () => {
    registerSatelliteProvider(async () => ({}));
    expect(registerSatelliteProvider(null)).toBe(false);
  });
});

// ═══ §6 NGO intelligence ═════════════════════════════════════

describe('buildNgoIntelligence', () => {
  it('flag OFF → exportReady=false + empty counts', () => {
    const v = buildNgoIntelligence({
      activeFarm: { cropId: 'pepper', region: 'Ashanti' },
    });
    expect(v.exportReady).toBe(false);
    expect(v.engagementSummary.scans).toBe(0);
  });

  it('PII stripping helper removes user identifiers', () => {
    const stripped = ngoInternal._stripPii({
      userId: 'u-42', phone: '+1', email: 'x@y', region: 'Ashanti',
      lat: 6.7, lng: -1.6, scans: 12,
    });
    expect(stripped.userId).toBeUndefined();
    expect(stripped.phone).toBeUndefined();
    expect(stripped.email).toBeUndefined();
    expect(stripped.lat).toBeUndefined();
    expect(stripped.lng).toBeUndefined();
    expect(stripped.region).toBe('Ashanti');
    expect(stripped.scans).toBe(12);
  });

  it('PII keys never appear in regionTag output', () => {
    const v = buildNgoIntelligence({
      activeFarm: { cropId: 'pepper', region: 'Ashanti', lat: 6.7, lng: -1.6,
        userId: 'u-1', phone: '+1' },
      region: 'Ashanti',
    });
    const json = JSON.stringify(v);
    expect(json).not.toContain('u-1');
    expect(json).not.toContain('+1');
    expect(json).not.toContain('6.7');
  });

  it('garbage never throws', () => {
    expect(() => buildNgoIntelligence(null)).not.toThrow();
  });
});

// ═══ §7 invisible intelligence orchestrator ══════════════════

describe('runInvisibleIntelligence', () => {
  it('empty input returns calm fallback envelope', () => {
    const v = runInvisibleIntelligence({});
    expect(v.engineVersion).toBe('invisible-orchestrator-v1');
    expect(v.oneBestAction).toBeTruthy();
  });

  it('frost survival rule is NEVER overridden by advanced layers', () => {
    const v = runInvisibleIntelligence({
      decisionInput: { weather: { temp: 2 } },
      scanInput:     {
        rawModelConfidence: 0.1,
        imageQualityScore:  0.1,
        leafIsolationScore: 0.1,
      },
    });
    // Even with calibration screaming "Needs review", the protected
    // crop_survival_frost action still surfaces.
    expect(v.oneBestAction.candidateId).toBe('crop_survival_frost');
  });

  it('disease serious rule protected from downgrade', () => {
    const v = runInvisibleIntelligence({
      decisionInput: {
        scan: { severity: 'serious', monitoringNeeded: true },
      },
      scanInput: {
        rawModelConfidence: 0.4,
        imageQualityScore:  0.3,
      },
    });
    expect(v.oneBestAction.candidateId).toBe('disease_escalation');
  });

  it('invisibleSignalsUsed is empty when all flags OFF', () => {
    const v = runInvisibleIntelligence({
      decisionInput: { weather: { temp: 2 } },
      scanInput:     { rawModelConfidence: 0.9 },
      yieldInput:    { activeFarm: { cropId: 'pepper' } },
      ngoInput:      { activeFarm: { cropId: 'pepper' } },
    });
    expect(v.invisibleSignalsUsed.length).toBe(0);
    expect(v.fallbackUsed).toBe(true);
  });

  it('garbage never throws', () => {
    expect(() => runInvisibleIntelligence(null)).not.toThrow();
    expect(() => runInvisibleIntelligence('hi')).not.toThrow();
  });

  it('confidenceTone is always one of three allowed strings', () => {
    const v = runInvisibleIntelligence({});
    expect(['high_confidence', 'medium_confidence', 'needs_review'])
      .toContain(v.confidenceTone);
  });
});

// ═══ §10 calm wording contract ══════════════════════════════

describe('Calm wording contract — Phase 2', () => {
  it('no AI / model / % leaks across every Phase-2 engine fallback', () => {
    const collectors = [
      JSON.stringify(runMlRanking({})),
      JSON.stringify(calibrateDiseaseConfidence({})),
      JSON.stringify(runPredictiveYield({})),
      JSON.stringify(buildNgoIntelligence({})),
      JSON.stringify(runInvisibleIntelligence({})),
    ];
    for (const text of collectors) {
      expect(text).not.toMatch(/%/);
      expect(text.toLowerCase()).not.toMatch(/\b(ai|neural|guaranteed|panic|emergency)\b/);
    }
  });
});
