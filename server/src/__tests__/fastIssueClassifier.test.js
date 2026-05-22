/**
 * fastIssueClassifier.test.js — Fast Crop/Leaf Issue Identification
 * Fix. Verifies subject detection, issue mapping, confidence
 * calibration, context boost, low-confidence fallback, and the
 * journal/task loop output.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyScan,
  SUBJECT_TYPE, ISSUE_CATEGORY,
  MANUAL_SYMPTOMS, SCAN_PROGRESS,
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
    expect(r.possibleIssue).toBe(ISSUE_CATEGORY.LEAF_SPOT);
    expect(r.whatWeNoticed.fallback).toMatch(/leaf spots/i);
  });

  it('mold → FUNGAL_RISK with base-water action', () => {
    const r = classifyScan({ scanSignals: { mold: true } });
    expect(r.possibleIssue).toBe(ISSUE_CATEGORY.FUNGAL_RISK);
    const actions = r.recommendedAction.map((a) => a.fallback).join(' | ');
    expect(actions).toMatch(/at the base/i);
  });

  it('fruitRot → FRUIT_ROT', () => {
    const r = classifyScan({ scanSignals: { fruitRot: true } });
    expect(r.possibleIssue).toBe(ISSUE_CATEGORY.FRUIT_ROT);
  });

  it('holes → PEST_DAMAGE', () => {
    const r = classifyScan({ scanSignals: { holes: true, insects: true } });
    expect(r.possibleIssue).toBe(ISSUE_CATEGORY.PEST_DAMAGE);
    expect(r.evidence).toContain('insect_visible');
  });

  it('wilting + high heat → SUNBURN', () => {
    const r = classifyScan({
      scanSignals: { wilting: true },
      snapshot: { weather: { temperatureC: 36 } },
    });
    expect(r.possibleIssue).toBe(ISSUE_CATEGORY.SUNBURN);
  });

  it('wilting + long dry spell → WATER_STRESS', () => {
    const r = classifyScan({
      scanSignals: { wilting: true },
      snapshot: { weather: { daysSinceRain: 8 } },
    });
    expect(r.possibleIssue).toBe(ISSUE_CATEGORY.WATER_STRESS);
  });

  it('yellowing + wet soil / humidity → OVERWATERING', () => {
    const r = classifyScan({
      scanSignals: { yellowing: true, soilWet: true },
    });
    expect(r.possibleIssue).toBe(ISSUE_CATEGORY.OVERWATERING);
  });

  it('yellowing alone → NUTRIENT_STRESS', () => {
    const r = classifyScan({ scanSignals: { yellowing: true } });
    expect(r.possibleIssue).toBe(ISSUE_CATEGORY.NUTRIENT_STRESS);
  });

  it('no signals → UNKNOWN_NEEDS_CLEARER_PHOTO + low confidence', () => {
    const r = classifyScan({ scanSignals: {} });
    expect(r.possibleIssue).toBe(ISSUE_CATEGORY.UNKNOWN_NEEDS_CLEARER_PHOTO);
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
    expect(r.possibleIssue).toBe(ISSUE_CATEGORY.UNKNOWN_NEEDS_CLEARER_PHOTO);
    expect(r.isLowConfidence).toBe(true);
  });
});
