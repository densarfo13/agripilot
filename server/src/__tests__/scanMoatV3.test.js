/**
 * scanMoatV3.test.js — verifies the Scan Moat v3 additions:
 *   • contextAwareDiagnosis.js     (multi-signal + "why this result?")
 *   • treatmentSafetyLayer.js      (chemical-gating)
 *   • regionalRiskSignals.js       (privacy-safe outbreak aggregator)
 *   • scanProgressTracker.js       (outcome marking + action history)
 *   • scanCaptureChecklist.js      (pre-capture quality hints)
 */

// localStorage shim for tests that touch persistence.
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
  composeContextAwareDiagnosis,
} from '../../../src/core/scan/contextAwareDiagnosis.js';
import {
  classifyTreatment, gateTreatmentSuggestion, TREATMENT_CLASS,
} from '../../../src/core/agronomy/treatmentSafetyLayer.js';
import {
  aggregateRegionalScans, REGIONAL_PRESSURE,
} from '../../../src/core/scan/regionalRiskSignals.js';
import {
  markScanOutcome, buildScanProgressReport, OUTCOME,
  _resetScanProgressForTests,
} from '../../../src/core/scan/scanProgressTracker.js';
import {
  captureChecklistFor, CHECKLIST_ITEM,
} from '../../../src/core/scan/scanCaptureChecklist.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 5, 1);

// ─── contextAwareDiagnosis ────────────────────────────────

describe('composeContextAwareDiagnosis', () => {
  it('healthy classifier + cool weather → ok:true, healthy issue', () => {
    const d = composeContextAwareDiagnosis({
      classifierResult: { issueCategory: 'healthy', confidenceLabel: 'high' },
      weather:          { humidityPct: 50, temperatureC: 22 },
    });
    expect(d.ok).toBe(true);
    expect(d.possibleIssue.fallback).toMatch(/healthy/i);
    expect(d.confidenceTone.fallback).toMatch(/high/i);
  });

  it('fungal + humid + recurring history → raised-risk context items', () => {
    const d = composeContextAwareDiagnosis({
      classifierResult: { issueCategory: 'fungal_risk', confidenceLabel: 'medium' },
      weather:          { humidityPct: 88, rainProbability24hPct: 70 },
      scanHistory:      [{ issueCategory: 'fungal_risk', createdAt: NOW - 30 * DAY }],
    });
    expect(d.contextRaisingRisk.length).toBeGreaterThanOrEqual(2);
    const text = d.contextRaisingRisk.map((m) => m.fallback).join(' ');
    expect(text).toMatch(/humidity|fungal|spread/i);
    expect(text.toLowerCase()).toMatch(/repeat|seen here before|recurring/);
  });

  it('water_stress + recent rain → at least one lowering signal', () => {
    const d = composeContextAwareDiagnosis({
      classifierResult: { issueCategory: 'water_stress', confidenceLabel: 'medium' },
      weather:          { daysSinceRain: 1, temperatureC: 24 },
    });
    const text = d.contextLoweringRisk.map((m) => m.fallback).join(' ');
    expect(text).toMatch(/rain/i);
  });

  it('needs_review → ok:false with "choose a clearer photo" wording', () => {
    const d = composeContextAwareDiagnosis({
      classifierResult: { issueCategory: 'unknown_needs_clearer_photo', confidenceLabel: 'needs_review' },
    });
    expect(d.ok).toBe(false);
    expect(d.suppressed.reason).toBe('image_invalid');
    expect(d.whatToCheckNext.fallback).toMatch(/closer|good light/i);
    expect(d.whatToDoNow.fallback).toMatch(/new photo|before/i);
  });

  it('every visible string is a localizable envelope', () => {
    const d = composeContextAwareDiagnosis({
      classifierResult: { issueCategory: 'pest_damage', confidenceLabel: 'high' },
    });
    for (const e of [d.possibleIssue, d.confidenceTone, d.whatWeNoticed,
                     d.whatToCheckNext, d.whatToDoNow, d.disclaimer]) {
      expect(e.key).toBeTruthy();
      expect(typeof e.fallback).toBe('string');
    }
  });

  it('hedged wording — no "confirmed" / "guaranteed" anywhere', () => {
    const samples = [
      composeContextAwareDiagnosis({ classifierResult: { issueCategory: 'fungal_risk', confidenceLabel: 'high' } }),
      composeContextAwareDiagnosis({ classifierResult: { issueCategory: 'pest_damage', confidenceLabel: 'medium' } }),
      composeContextAwareDiagnosis({ classifierResult: { issueCategory: 'nutrient_stress', confidenceLabel: 'low' } }),
    ];
    for (const d of samples) {
      const blob = JSON.stringify(d);
      expect(blob.toLowerCase()).not.toMatch(/confirmed disease|guaranteed|definitely/);
    }
  });

  it('never throws on garbage input', () => {
    expect(() => composeContextAwareDiagnosis(null)).not.toThrow();
    expect(composeContextAwareDiagnosis(null).ok).toBe(false);
  });
});

// ─── treatmentSafetyLayer ─────────────────────────────────

describe('classifyTreatment', () => {
  it('cultural keywords → CULTURAL', () => {
    expect(classifyTreatment('water deeply at the base of the plant').class)
      .toBe(TREATMENT_CLASS.CULTURAL);
    expect(classifyTreatment('improve airflow and add mulch around the bed').class)
      .toBe(TREATMENT_CLASS.CULTURAL);
  });
  it('organic keywords → ORGANIC', () => {
    expect(classifyTreatment('apply neem oil per label').class)
      .toBe(TREATMENT_CLASS.ORGANIC);
  });
  it('chemical keywords → CHEMICAL', () => {
    expect(classifyTreatment('apply copper fungicide').class)
      .toBe(TREATMENT_CLASS.CHEMICAL);
    expect(classifyTreatment('spray with chlorothalonil').class)
      .toBe(TREATMENT_CLASS.CHEMICAL);
  });
  it('empty / unknown → UNKNOWN', () => {
    expect(classifyTreatment('').class).toBe(TREATMENT_CLASS.UNKNOWN);
    expect(classifyTreatment('do the thing').class).toBe(TREATMENT_CLASS.UNKNOWN);
  });
});

describe('gateTreatmentSuggestion', () => {
  it('cultural → allowed, no expert review needed', () => {
    const g = gateTreatmentSuggestion({ suggestion: 'add mulch and improve airflow between plants' });
    expect(g.allowed).toBe(true);
    expect(g.class).toBe(TREATMENT_CLASS.CULTURAL);
    expect(g.requiresExpertReview).toBe(false);
  });

  it('organic → allowed but follow-label warning', () => {
    const g = gateTreatmentSuggestion({ suggestion: 'neem oil weekly' });
    expect(g.allowed).toBe(true);
    expect(g.localRegulationWarning).toBe(true);
    expect(g.publicMessage.fallback).toMatch(/label|regulation/i);
  });

  it('chemical without verifiedSource → BLOCKED, expert envelope', () => {
    const g = gateTreatmentSuggestion({ suggestion: 'apply copper fungicide' });
    expect(g.allowed).toBe(false);
    expect(g.requiresExpertReview).toBe(true);
    expect(g.publicMessage.fallback).toMatch(/consult.*expert/i);
  });

  it('chemical WITH verifiedSource → allowed but still flags review + regulation', () => {
    const g = gateTreatmentSuggestion({
      suggestion: 'apply copper fungicide',
      verifiedSource: true,
    });
    expect(g.allowed).toBe(true);
    expect(g.requiresExpertReview).toBe(true);
    expect(g.localRegulationWarning).toBe(true);
  });

  it('unknown suggestion → fail-safe BLOCKED', () => {
    const g = gateTreatmentSuggestion({ suggestion: 'do the thing' });
    expect(g.allowed).toBe(false);
  });

  it('never throws on garbage input', () => {
    expect(() => gateTreatmentSuggestion(null)).not.toThrow();
    expect(gateTreatmentSuggestion(null).allowed).toBe(false);
  });
});

// ─── regionalRiskSignals ──────────────────────────────────

describe('aggregateRegionalScans', () => {
  it('groups by (region, crop) and picks the top non-healthy issue', () => {
    const r = aggregateRegionalScans({
      scans: [
        { region: 'ashanti', crop: 'tomato', issueCategory: 'fungal_risk', atMs: NOW - 1 * DAY },
        { region: 'ashanti', crop: 'tomato', issueCategory: 'fungal_risk', atMs: NOW - 2 * DAY },
        { region: 'ashanti', crop: 'tomato', issueCategory: 'healthy',     atMs: NOW - 3 * DAY },
        { region: 'ashanti', crop: 'tomato', issueCategory: 'fungal_risk', atMs: NOW - 4 * DAY },
        { region: 'ashanti', crop: 'tomato', issueCategory: 'pest_damage', atMs: NOW - 5 * DAY },
      ],
      nowMs: NOW, minSampleSize: 5, windowDays: 30,
    });
    const slot = r.byRegion.find((x) => x.region === 'ashanti' && x.crop === 'tomato');
    expect(slot.topIssue).toBe('fungal_risk');
    expect(slot.topIssueCount).toBe(3);
  });

  it('respects minSampleSize — small sample → CALM regardless of %', () => {
    const r = aggregateRegionalScans({
      scans: [
        { region: 'r', crop: 'tomato', issueCategory: 'fungal_risk', atMs: NOW },
      ],
      nowMs: NOW, minSampleSize: 5,
    });
    expect(r.byRegion[0].pressure).toBe(REGIONAL_PRESSURE.CALM);
  });

  it('40%+ → HOTSPOT', () => {
    // 6 scans, 3 fungal → 50% → HOTSPOT
    const scans = [];
    for (let i = 0; i < 3; i += 1) scans.push({ region: 'r', crop: 'tomato', issueCategory: 'fungal_risk', atMs: NOW - i*DAY });
    for (let i = 0; i < 3; i += 1) scans.push({ region: 'r', crop: 'tomato', issueCategory: 'healthy',     atMs: NOW - (i+3)*DAY });
    const r = aggregateRegionalScans({ scans, nowMs: NOW, minSampleSize: 5 });
    expect(r.byRegion[0].pressure).toBe(REGIONAL_PRESSURE.HOTSPOT);
  });

  it('window cutoff drops old scans', () => {
    const r = aggregateRegionalScans({
      scans: [
        { region: 'r', crop: 'tomato', issueCategory: 'fungal_risk', atMs: NOW - 100 * DAY },
      ],
      windowDays: 14, nowMs: NOW,
    });
    expect(r.byRegion.length).toBe(0);
  });

  it('PRIVACY: drops scans without region/crop/issue + ignores any user id field', () => {
    const r = aggregateRegionalScans({
      scans: [
        { region: 'r', crop: 'tomato', issueCategory: 'fungal_risk',
          atMs: NOW, userId: 'should-not-leak', farmerId: 'should-not-leak' },
      ],
      nowMs: NOW, minSampleSize: 1,
    });
    const blob = JSON.stringify(r);
    expect(blob).not.toContain('should-not-leak');
  });

  it('never throws on garbage input', () => {
    expect(() => aggregateRegionalScans(null)).not.toThrow();
  });
});

// ─── scanProgressTracker ──────────────────────────────────

describe('scanProgressTracker', () => {
  beforeEach(() => { _resetScanProgressForTests(); _s.clear(); });

  it('markScanOutcome persists IMPROVED + action note (truncated)', () => {
    markScanOutcome({
      scanId:      'scan-1',
      outcome:     OUTCOME.IMPROVED,
      actionTaken: 'pruned the lower leaves and improved airflow between rows of plants',
      atMs:        NOW,
    });
    const report = buildScanProgressReport({ scanHistory: [{ id: 'scan-1' }] });
    expect(report.summary.improved).toBe(1);
    expect(report.actionsLog[0].actionTaken.length).toBeLessThanOrEqual(120);
  });

  it('mixed outcomes flow into the summary', () => {
    markScanOutcome({ scanId: 'a', outcome: OUTCOME.IMPROVED,  atMs: NOW });
    markScanOutcome({ scanId: 'b', outcome: OUTCOME.UNCHANGED, atMs: NOW });
    markScanOutcome({ scanId: 'c', outcome: OUTCOME.WORSE,     atMs: NOW });
    markScanOutcome({ scanId: 'd', outcome: OUTCOME.IGNORED,   atMs: NOW });
    const r = buildScanProgressReport({ scanHistory: [
      { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' },
    ]});
    expect(r.summary).toEqual({ total: 4, improved: 1, unchanged: 1, worse: 1, ignored: 1 });
  });

  it('markScanOutcome rejects invalid outcome', () => {
    expect(markScanOutcome({ scanId: 'x', outcome: 'bogus' })).toBe(false);
    expect(markScanOutcome({ outcome: OUTCOME.IMPROVED })).toBe(false);
    expect(markScanOutcome(null)).toBe(false);
  });

  it('buildScanProgressReport carries a disclaimer envelope', () => {
    const r = buildScanProgressReport({ scanHistory: [] });
    expect(r.disclaimer.key).toBeTruthy();
    expect(r.disclaimer.fallback).toMatch(/observations|progress/i);
  });
});

// ─── scanCaptureChecklist ─────────────────────────────────

describe('captureChecklistFor', () => {
  it('returns ≥ 4 base hints by default', () => {
    const items = captureChecklistFor({});
    expect(items.length).toBeGreaterThanOrEqual(4);
    for (const e of items) {
      expect(e.key).toBeTruthy();
      expect(typeof e.fallback).toBe('string');
    }
  });

  it('pest suspected → adds the underside tip', () => {
    const items = captureChecklistFor({ suspectedKind: 'pest' });
    expect(items.some((m) => /underside/i.test(m.fallback))).toBe(true);
  });

  it('high brightness → adds the shade tip', () => {
    const items = captureChecklistFor({ brightness: 0.92 });
    expect(items.some((m) => /shade|wash/i.test(m.fallback))).toBe(true);
  });

  it('never throws on garbage input', () => {
    expect(() => captureChecklistFor(null)).not.toThrow();
  });
});
