/**
 * fastIssueClassifier.test.js — Fast Crop/Leaf Issue Identification
 * Fix. Verifies subject detection, issue mapping, confidence
 * calibration, context boost, low-confidence fallback, and the
 * journal/task loop output.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyScan,
  SUBJECT_TYPE, ISSUE_CATEGORY,
  MANUAL_SYMPTOMS, SCAN_PROGRESS,
  SCAN_FLOW_OBS,
  recordScanFlowObservation, getScanFlowCounts, resetScanFlowCounts,
} from '../../../src/core/scan/fastIssueClassifier.js';

// ─── Subject detection ────────────────────────────────────

describe('classifyScan — subject detection', () => {
  it('honours an explicit subjectHint', () => {
    expect(classifyScan({ scanSignals: { subjectHint: 'leaf' } }).subjectType)
      .toBe(SUBJECT_TYPE.LEAF);
    expect(classifyScan({ scanSignals: { subjectHint: 'fruit' } }).subjectType)
      .toBe(SUBJECT_TYPE.FRUIT);
  });

  it('derives subject from named signals', () => {
    expect(classifyScan({ scanSignals: { spots: true } }).subjectType).toBe(SUBJECT_TYPE.LEAF);
    expect(classifyScan({ scanSignals: { fruitRot: true } }).subjectType).toBe(SUBJECT_TYPE.FRUIT);
    expect(classifyScan({ scanSignals: { soilDry: true } }).subjectType).toBe(SUBJECT_TYPE.SOIL);
    expect(classifyScan({ scanSignals: { holes: true } }).subjectType).toBe(SUBJECT_TYPE.PEST);
  });

  it('falls back to CROP when only context hints exist', () => {
    expect(classifyScan({ snapshot: { crop: 'maize' } }).subjectType).toBe(SUBJECT_TYPE.CROP);
  });

  it('falls back to UNKNOWN with no signals at all', () => {
    expect(classifyScan({}).subjectType).toBe(SUBJECT_TYPE.UNKNOWN);
  });
});

// ─── Issue mapping ────────────────────────────────────────

describe('classifyScan — issue mapping per category', () => {
  it('spots → LEAF_SPOT', () => {
    const r = classifyScan({ scanSignals: { spots: true }, crop: 'tomato' });
    expect(r.issueCategory).toBe(ISSUE_CATEGORY.LEAF_SPOT);
    expect(r.whatWeNoticed.fallback).toMatch(/leaf spots/i);
  });

  it('mold → FUNGAL_RISK with base-water action', () => {
    const r = classifyScan({ scanSignals: { mold: true } });
    expect(r.issueCategory).toBe(ISSUE_CATEGORY.FUNGAL_RISK);
    const actions = r.recommendedAction.map((a) => a.fallback).join(' | ');
    expect(actions).toMatch(/at the base/i);
  });

  it('fruitRot → FRUIT_ROT', () => {
    const r = classifyScan({ scanSignals: { fruitRot: true } });
    expect(r.issueCategory).toBe(ISSUE_CATEGORY.FRUIT_ROT);
  });

  it('holes → PEST_DAMAGE', () => {
    const r = classifyScan({ scanSignals: { holes: true, insects: true } });
    expect(r.issueCategory).toBe(ISSUE_CATEGORY.PEST_DAMAGE);
    expect(r.evidence).toContain('insect_visible');
  });

  it('wilting + high heat → SUNBURN', () => {
    const r = classifyScan({
      scanSignals: { wilting: true },
      snapshot: { weather: { temperatureC: 36 } },
    });
    expect(r.issueCategory).toBe(ISSUE_CATEGORY.SUNBURN);
  });

  it('wilting + long dry spell → WATER_STRESS', () => {
    const r = classifyScan({
      scanSignals: { wilting: true },
      snapshot: { weather: { daysSinceRain: 8 } },
    });
    expect(r.issueCategory).toBe(ISSUE_CATEGORY.WATER_STRESS);
  });

  it('yellowing + wet soil / humidity → OVERWATERING', () => {
    const r = classifyScan({
      scanSignals: { yellowing: true, soilWet: true },
    });
    expect(r.issueCategory).toBe(ISSUE_CATEGORY.OVERWATERING);
  });

  it('yellowing alone → NUTRIENT_STRESS', () => {
    const r = classifyScan({ scanSignals: { yellowing: true } });
    expect(r.issueCategory).toBe(ISSUE_CATEGORY.NUTRIENT_STRESS);
  });

  it('no signals → UNKNOWN_NEEDS_CLEARER_PHOTO + low confidence', () => {
    const r = classifyScan({ scanSignals: {} });
    expect(r.issueCategory).toBe(ISSUE_CATEGORY.UNKNOWN_NEEDS_CLEARER_PHOTO);
    expect(r.isLowConfidence).toBe(true);
  });
});

// ─── Confidence — always hedged, never overclaims ────────

describe('classifyScan — confidence wording', () => {
  it('confidence word is one of the permitted hedged words', () => {
    const r = classifyScan({ scanSignals: { spots: true, yellowing: true, holes: true } });
    expect(['likely', 'possible', 'needs review']).toContain(r.confidence);
  });

  it('never claims "confirmed" anywhere in the result', () => {
    const r = classifyScan({ scanSignals: { spots: true, yellowing: true, holes: true } });
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/\bconfirmed (disease|diagnosis)\b/i);
  });

  it('upstream low confidence FLOORS our calibration (never inflated)', () => {
    const r = classifyScan({
      scanSignals: { spots: true, yellowing: true, holes: true, confidence: 0.2 },
    });
    expect(r.confidenceTier).toBe('low');
    expect(r.confidence).toBe('needs review');
  });

  it('multiple agreeing signals reach the medium tier', () => {
    const r = classifyScan({ scanSignals: { spots: true, yellowing: true } });
    expect(['medium', 'high']).toContain(r.confidenceTier);
  });
});

// ─── Low-confidence fallback ──────────────────────────────

describe('classifyScan — low-confidence path', () => {
  it('returns the full manual-symptom picker', () => {
    const r = classifyScan({ scanSignals: {} });
    expect(r.isLowConfidence).toBe(true);
    expect(r.manualOptions.length).toBe(MANUAL_SYMPTOMS.length);
    expect(r.retakeGuidance.fallback).toMatch(/another photo/i);
  });

  it('manual symptoms list ships translation keys', () => {
    for (const s of MANUAL_SYMPTOMS) {
      expect(typeof s.id).toBe('string');
      expect(s.key).toMatch(/^scan\.symptom\./);
      expect(typeof s.fallback).toBe('string');
    }
  });
});

// ─── Journal + task loop ─────────────────────────────────

describe('classifyScan — journal + follow-up task', () => {
  it('emits a short, plain journal summary', () => {
    const r = classifyScan({ scanSignals: { spots: true }, crop: 'maize' });
    expect(typeof r.journalSummary).toBe('string');
    expect(r.journalSummary).toMatch(/maize/);
    expect(r.journalSummary.length).toBeLessThanOrEqual(120);
  });

  it('emits a follow-up task with a localizable title', () => {
    const r = classifyScan({ scanSignals: { spots: true }, crop: 'maize' });
    expect(r.followUpTask.isFollowUp).toBe(true);
    expect(typeof r.followUpTask.titleKey).toBe('string');
    expect(r.followUpTask.titleKey).toMatch(/^scan\.followup\./);
    expect(typeof r.followUpTask.titleFallback).toBe('string');
  });
});

// ─── Progress steps ──────────────────────────────────────

describe('SCAN_PROGRESS — staged progress for the 3–8 s window', () => {
  it('ships the four documented steps in order', () => {
    expect(SCAN_PROGRESS.map((s) => s.key)).toEqual([
      'scan.progress.preparing',
      'scan.progress.checking_subject',
      'scan.progress.looking_for_stress',
      'scan.progress.preparing_guidance',
    ]);
  });

  it('every progress step has a translation key + fallback', () => {
    for (const s of SCAN_PROGRESS) {
      expect(typeof s.key).toBe('string');
      expect(typeof s.fallback).toBe('string');
    }
  });
});

// ─── Robustness ──────────────────────────────────────────

describe('classifyScan — never throws', () => {
  it('garbage input returns the safe fallback shape', () => {
    expect(() => classifyScan(null)).not.toThrow();
    const r = classifyScan(null);
    expect(r.issueCategory).toBe(ISSUE_CATEGORY.UNKNOWN_NEEDS_CLEARER_PHOTO);
    expect(r.isLowConfidence).toBe(true);
  });
});

// ─── v2 spec contract — added fields ──────────────────────

describe('classifyScan — extended result contract', () => {
  it('possibleIssue is now a localizable label envelope (not the enum)', () => {
    const r = classifyScan({ scanSignals: { spots: true }, crop: 'tomato' });
    expect(typeof r.possibleIssue).toBe('object');
    expect(r.possibleIssue.key).toMatch(/^scan\.issue_label\./);
    expect(typeof r.possibleIssue.fallback).toBe('string');
  });

  it('confidenceLabel is one of high|medium|low|needs_review', () => {
    const known = ['high', 'medium', 'low', 'needs_review'];
    expect(known).toContain(classifyScan({ scanSignals: { spots: true } }).confidenceLabel);
    expect(classifyScan({ scanSignals: {} }).confidenceLabel).toBe('needs_review');
  });

  it('safetyNote appears for chemical-risk categories ONLY', () => {
    expect(classifyScan({ scanSignals: { mold: true } }).safetyNote).not.toBe(null);
    expect(classifyScan({ scanSignals: { spots: true } }).safetyNote).not.toBe(null);
    expect(classifyScan({ scanSignals: { holes: true } }).safetyNote).not.toBe(null);
    expect(classifyScan({
      scanSignals: { wilting: true },
      snapshot: { weather: { temperatureC: 36 } },
    }).safetyNote).toBe(null);
    expect(classifyScan({ scanSignals: { yellowing: true } }).safetyNote).toBe(null);
  });

  it('safetyNote uses the "consult a local expert" wording', () => {
    const r = classifyScan({ scanSignals: { mold: true } });
    expect(r.safetyNote.fallback).toMatch(/local agricultural expert/i);
  });

  it('nextBestAction is the first recommendedAction (single envelope)', () => {
    const r = classifyScan({ scanSignals: { spots: true }, crop: 'tomato' });
    expect(r.nextBestAction).toBe(r.recommendedAction[0]);
    expect(typeof r.nextBestAction.fallback).toBe('string');
  });

  it('garbage input safe fallback also has the v2 fields filled', () => {
    const r = classifyScan(null);
    expect(r.confidenceLabel).toBe('needs_review');
    expect(r.safetyNote).toBe(null);
    expect(r.nextBestAction).toBeTruthy();
    expect(typeof r.possibleIssue.key).toBe('string');
  });
});

// ─── §10 — observability adapter ─────────────────────────

describe('recordScanFlowObservation — counts + forwards failures', () => {
  beforeEach(() => resetScanFlowCounts());

  it('exposes the documented event names', () => {
    for (const name of [
      'scan_started', 'scan_subject_detected', 'scan_issue_detected',
      'scan_low_confidence', 'scan_manual_fallback_used',
      'scan_journal_saved', 'scan_follow_up_created',
      'scan_failed', 'scan_completed',
    ]) {
      expect(Object.values(SCAN_FLOW_OBS)).toContain(name);
    }
  });

  it('counts events in-memory', () => {
    recordScanFlowObservation(SCAN_FLOW_OBS.SCAN_STARTED);
    recordScanFlowObservation(SCAN_FLOW_OBS.SCAN_COMPLETED);
    recordScanFlowObservation(SCAN_FLOW_OBS.SCAN_FAILED);
    const c = getScanFlowCounts();
    expect(c[SCAN_FLOW_OBS.SCAN_STARTED]).toBe(1);
    expect(c[SCAN_FLOW_OBS.SCAN_COMPLETED]).toBe(1);
    expect(c[SCAN_FLOW_OBS.SCAN_FAILED]).toBe(1);
  });

  it('never throws on bogus input', () => {
    expect(() => recordScanFlowObservation(null)).not.toThrow();
    expect(recordScanFlowObservation(undefined)).toBe(false);
  });
});
