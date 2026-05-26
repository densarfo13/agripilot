/**
 * contextDiagnosisEngine.test.js — Phase 12.
 * Tests both the orchestrator (runContextDiagnosis) and the
 * outcome tracker (scanOutcomeTracker).
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  runContextDiagnosis, _internal,
} from '../../../src/core/scan/contextDiagnosisEngine.js';

import {
  recordScanOutcome, getScanOutcomes, getOutcomeFor,
  aggregateOutcomes, clearScanOutcomes, OUTCOME,
} from '../../../src/core/scan/scanOutcomeTracker.js';

function _stubLocalStorage() {
  if (typeof globalThis.localStorage === 'undefined') {
    const _store = new Map();
    globalThis.localStorage = {
      getItem: (k) => _store.has(k) ? _store.get(k) : null,
      setItem: (k, v) => _store.set(k, String(v)),
      removeItem: (k) => _store.delete(k),
      clear: () => _store.clear(),
      get length() { return _store.size; },
      key: (i) => Array.from(_store.keys())[i] || null,
    };
  } else {
    try { globalThis.localStorage.clear(); } catch { /* swallow */ }
  }
}

// ─── Orchestrator envelope shape ──────────────────────

describe('runContextDiagnosis — envelope shape', () => {
  it('returns every documented field', () => {
    const v = runContextDiagnosis({
      scanResult: { possibleIssue: 'leaf_spots', confidence: 'medium' },
      crop:       'tomato',
      cropStage:  'flowering',
      region:     'Ashanti',
      country:    'Ghana',
      weather:    { humidityPct: 78, rainProbability24hPct: 55 },
      scanHistory: [],
      activeExperience: 'farm',
    });
    expect(typeof v.engineVersion).toBe('string');
    expect(typeof v.likelyIssue).toBe('object');
    expect(Array.isArray(v.alternativePossibilities)).toBe(true);
    expect(['high', 'medium', 'low']).toContain(v.confidence);
    expect(typeof v.confidenceScore).toBe('number');
    expect(['mild', 'moderate', 'serious']).toContain(v.severity);
    expect(['high', 'medium', 'low']).toContain(v.urgency);
    expect(typeof v.treatmentPlan).toBe('object');
    expect(typeof v.preventionPlan).toBe('object');
    expect(typeof v.followUpWindowDays).toBe('number');
    expect(typeof v.monitoringNeeded).toBe('boolean');
    // escalationRecommendation can be null
    expect(typeof v.whatFarrowayNoticed).toBe('object');
    expect(Array.isArray(v.whyWeThinkThis)).toBe(true);
    expect(typeof v.contextLayers).toBe('object');
    expect(typeof v.reconciliation).toBe('object');
  });

  it('returns alternative possibilities capped at 3', () => {
    const v = runContextDiagnosis({
      scanResult: { possibleIssue: 'leaf_spots' },
      crop:       'tomato',
      weather:    { humidityPct: 90 },
    });
    expect(v.alternativePossibilities.length).toBeLessThanOrEqual(3);
  });

  it('never throws on garbage input', () => {
    expect(() => runContextDiagnosis(null)).not.toThrow();
    expect(() => runContextDiagnosis(undefined)).not.toThrow();
    expect(() => runContextDiagnosis('string')).not.toThrow();
    expect(() => runContextDiagnosis(42)).not.toThrow();
  });

  it('returns failure envelope shape on garbage input', () => {
    const v = runContextDiagnosis(null);
    expect(v.engineVersion).toBeTruthy();
    expect(v.confidence).toBe('low');
    expect(v.severity).toBe('mild');
  });

  it('every visible string is an envelope, not a bare string', () => {
    const v = runContextDiagnosis({
      scanResult: { possibleIssue: 'leaf_spots' },
      crop: 'tomato',
    });
    expect(v.likelyIssue.key).toBeTruthy();
    expect(v.likelyIssue.fallback).toBeTruthy();
    expect(v.whatFarrowayNoticed.key).toBeTruthy();
    expect(v.whatFarrowayNoticed.fallback).toBeTruthy();
    for (const row of v.whyWeThinkThis) {
      expect(typeof row.key).toBe('string');
      expect(typeof row.fallback).toBe('string');
    }
  });
});

// ─── Severity scale ───────────────────────────────────

describe('runContextDiagnosis — severity', () => {
  it('escalates to serious when urgency=high + outbreak + recurring', () => {
    const sev = _internal._deriveSeverity({
      hybrid: { urgency: 'high' },
      regionalPressure: 'outbreak',
      recurring: true,
      recoveryTrend: 'worsening',
      focus: null,
    });
    expect(sev).toBe('serious');
  });

  it('stays mild when urgency=low + no context signals', () => {
    const sev = _internal._deriveSeverity({
      hybrid: { urgency: 'low' },
      regionalPressure: 'normal',
      recurring: false,
      recoveryTrend: null,
      focus: null,
    });
    expect(sev).toBe('mild');
  });

  it('escalates when lesion covers >30% of leaf area', () => {
    const sev = _internal._deriveSeverity({
      hybrid: { urgency: 'low' },
      regionalPressure: 'normal',
      recurring: false,
      recoveryTrend: null,
      focus: {
        metrics: {
          lesionBBox:        { minX: 0, minY: 0, maxX: 100, maxY: 100 },
          dominantLeafBBox:  { minX: 0, minY: 0, maxX: 150, maxY: 150 },
        },
      },
    });
    expect(['moderate', 'serious']).toContain(sev);
  });
});

// ─── Follow-up window ─────────────────────────────────

describe('runContextDiagnosis — follow-up window', () => {
  it('serious → 2 days', () => {
    expect(_internal._followUpWindowDays('serious', 'vegetative')).toBe(2);
  });

  it('moderate → 4 days', () => {
    expect(_internal._followUpWindowDays('moderate', 'vegetative')).toBe(4);
  });

  it('mild → 7 days', () => {
    expect(_internal._followUpWindowDays('mild', 'vegetative')).toBe(7);
  });

  it('tightens by 1 day during flowering', () => {
    expect(_internal._followUpWindowDays('moderate', 'flowering')).toBe(3);
  });

  it('tightens by 1 day during fruiting', () => {
    expect(_internal._followUpWindowDays('mild', 'fruiting')).toBe(6);
  });

  it('floor stays at 2 days even with stage tightening', () => {
    expect(_internal._followUpWindowDays('serious', 'flowering')).toBe(2);
  });
});

// ─── Monitoring + escalation ─────────────────────────

describe('runContextDiagnosis — monitoring + escalation', () => {
  it('monitoring is needed for serious cases', () => {
    expect(_internal._monitoringNeeded('serious', false, null)).toBe(true);
  });

  it('monitoring is needed for recurring cases regardless of severity', () => {
    expect(_internal._monitoringNeeded('mild', true, null)).toBe(true);
  });

  it('monitoring is needed when recovery is worsening', () => {
    expect(_internal._monitoringNeeded('mild', false, 'worsening')).toBe(true);
  });

  it('escalates when severity=serious AND confidence<0.55', () => {
    const e = _internal._escalationRecommendation({
      severity: 'serious', confidenceScore: 0.40, regionalPressure: 'normal',
    });
    expect(e).toBeTruthy();
    expect(e.reason).toBe('serious_low_confidence');
  });

  it('escalates for regional outbreak when severity≥moderate', () => {
    const e = _internal._escalationRecommendation({
      severity: 'moderate', confidenceScore: 0.80, regionalPressure: 'outbreak',
    });
    expect(e).toBeTruthy();
    expect(e.reason).toBe('regional_outbreak');
  });

  it('no escalation for mild + high confidence + normal pressure', () => {
    const e = _internal._escalationRecommendation({
      severity: 'mild', confidenceScore: 0.85, regionalPressure: 'normal',
    });
    expect(e).toBeNull();
  });
});

// ─── Treatment / prevention split ────────────────────

describe('runContextDiagnosis — treatment / prevention split', () => {
  it('routes "Apply / Spray" verbs to treatment', () => {
    const { treatment, prevention } = _internal._splitTreatmentPrevention([
      'Apply copper spray', 'Spray with neem oil',
    ]);
    expect(treatment.length).toBe(2);
    expect(prevention.length).toBe(0);
  });

  it('routes "Inspect / Monitor / Rotate" verbs to prevention', () => {
    const { treatment, prevention } = _internal._splitTreatmentPrevention([
      'Inspect neighbouring plants', 'Rotate crops next season',
      'Improve airflow between plants',
    ]);
    expect(prevention.length).toBe(3);
    expect(treatment.length).toBe(0);
  });

  it('returns empty arrays on garbage input', () => {
    const { treatment, prevention } = _internal._splitTreatmentPrevention(null);
    expect(treatment).toEqual([]);
    expect(prevention).toEqual([]);
  });
});

// ─── Confidence reconciliation ───────────────────────

describe('runContextDiagnosis — confidence reconciliation', () => {
  it('returns finite numbers in [0..1]', () => {
    const r = _internal._reconcileConfidence({
      visualLabel: 'medium',
      hybrid: { confidence: 'medium' },
      contextSignals: { raising: ['a'], lowering: [] },
      history: { recurring: false, recoveryTrend: null },
    });
    expect(r.visual).toBeGreaterThan(0);
    expect(r.visual).toBeLessThanOrEqual(1);
    expect(r.blended).toBeGreaterThan(0);
    expect(r.blended).toBeLessThanOrEqual(1);
  });

  it('high visual + context-raising → higher blended', () => {
    const high = _internal._reconcileConfidence({
      visualLabel: 'high',
      contextSignals: { raising: ['a', 'b'], lowering: [] },
      history: { recurring: true },
    });
    const low = _internal._reconcileConfidence({
      visualLabel: 'low',
      contextSignals: { raising: [], lowering: ['a'] },
      history: { recurring: false },
    });
    expect(high.blended).toBeGreaterThan(low.blended);
  });
});

// ─── Confidence label round-trip ─────────────────────

describe('runContextDiagnosis — confidence label round-trip', () => {
  it('high → 0.85 → high', () => {
    expect(_internal._scoreToConfidence(_internal._confidenceToScore('high'))).toBe('high');
  });
  it('medium → 0.55 → medium', () => {
    expect(_internal._scoreToConfidence(_internal._confidenceToScore('medium'))).toBe('medium');
  });
  it('low → 0.30 → low', () => {
    expect(_internal._scoreToConfidence(_internal._confidenceToScore('low'))).toBe('low');
  });
  it('unknown → 0.40 → low', () => {
    expect(_internal._scoreToConfidence(_internal._confidenceToScore('garbage'))).toBe('low');
  });
});

// ─── scanOutcomeTracker ──────────────────────────────

describe('scanOutcomeTracker', () => {
  beforeEach(() => { _stubLocalStorage(); clearScanOutcomes(); });

  it('exports the documented OUTCOME constants', () => {
    expect(OUTCOME.RESOLVED).toBe('resolved');
    expect(OUTCOME.IMPROVED).toBe('improved');
    expect(OUTCOME.NO_CHANGE).toBe('no_change');
    expect(OUTCOME.WORSENED).toBe('worsened');
    expect(OUTCOME.ESCALATED).toBe('escalated');
    expect(OUTCOME.WRONG).toBe('wrong_diagnosis');
  });

  it('records + reads back', () => {
    const row = recordScanOutcome('scan_1', OUTCOME.RESOLVED, {
      issueCategory: 'leaf_spots', crop: 'tomato', region: 'Ashanti',
    });
    expect(row).toBeTruthy();
    expect(row.scanId).toBe('scan_1');
    expect(row.outcome).toBe('resolved');
    expect(getOutcomeFor('scan_1').outcome).toBe('resolved');
  });

  it('upserts on the same scanId', () => {
    recordScanOutcome('scan_1', OUTCOME.NO_CHANGE, {});
    recordScanOutcome('scan_1', OUTCOME.RESOLVED, {});
    expect(getScanOutcomes()).toHaveLength(1);
    expect(getOutcomeFor('scan_1').outcome).toBe('resolved');
  });

  it('rejects invalid outcome values', () => {
    expect(recordScanOutcome('scan_1', 'not_a_real_outcome', {})).toBeNull();
    expect(recordScanOutcome('scan_1', null, {})).toBeNull();
    expect(recordScanOutcome(null, OUTCOME.RESOLVED, {})).toBeNull();
  });

  it('truncates long userNotes to 240 chars', () => {
    const long = 'x'.repeat(300);
    recordScanOutcome('scan_1', OUTCOME.RESOLVED, { userNotes: long });
    expect(getOutcomeFor('scan_1').userNotes.length).toBe(240);
  });

  it('aggregateOutcomes groups by (issue, crop, region)', () => {
    recordScanOutcome('s1', OUTCOME.RESOLVED, {
      issueCategory: 'leaf_spots', crop: 'tomato', region: 'Ashanti',
    });
    recordScanOutcome('s2', OUTCOME.WORSENED, {
      issueCategory: 'leaf_spots', crop: 'tomato', region: 'Ashanti',
    });
    recordScanOutcome('s3', OUTCOME.RESOLVED, {
      issueCategory: 'pest_damage', crop: 'maize', region: 'Volta',
    });
    const agg = aggregateOutcomes();
    expect(agg['leaf_spots|tomato|Ashanti'].resolved).toBe(1);
    expect(agg['leaf_spots|tomato|Ashanti'].worsened).toBe(1);
    expect(agg['leaf_spots|tomato|Ashanti']._total).toBe(2);
    expect(agg['pest_damage|maize|Volta'].resolved).toBe(1);
  });

  it('clearScanOutcomes wipes the log', () => {
    recordScanOutcome('scan_1', OUTCOME.RESOLVED, {});
    clearScanOutcomes();
    expect(getScanOutcomes()).toEqual([]);
  });

  it('never throws on garbage input', () => {
    expect(() => recordScanOutcome(null, null, null)).not.toThrow();
    expect(() => getOutcomeFor(undefined)).not.toThrow();
    expect(() => aggregateOutcomes()).not.toThrow();
  });
});
