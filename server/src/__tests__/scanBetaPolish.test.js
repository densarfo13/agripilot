/**
 * scanBetaPolish.test.js — Scan Beta Polish + Publish Gate Fix.
 *
 * The composer is the single source of truth that downstream
 * surfaces (ScanResultCard, scanHistoryStore writes, scanToTask
 * follow-up creation, [SCAN_RESULT_DEBUG] trace) all consume.
 *
 * Coverage:
 *   1. Preview URL resolution: local > FSM remote > fallback,
 *      NEVER null + NEVER empty string
 *   2. Manual symptom selection overrides the displayed result
 *   3. Confidence flows through resolveScanConfidence + the
 *      composer surfaces every recovery action (spec §6)
 *   4. Guidance copy maps to image-quality issues first
 *   5. Journal entry shape covers the spec §5 fields
 *   6. Follow-up task only generates when followUpChoice is set
 *   7. debug envelope matches the spec [SCAN_RESULT_DEBUG] shape
 *   8. Acceptance — every spec test case has a path through
 *      composeScanResult that closes cleanly
 */

import { describe, it, expect } from 'vitest';
import {
  composeScanResult,
  debugTraceScanResult,
  PREVIEW_FALLBACK,
  FOLLOW_UP_CHOICES,
} from '../../../src/lib/scan/scanResultComposer.js';
import { CONFIDENCE_TIERS } from '../../../src/lib/scan/scanConfidenceEngine.js';

const BASE_FSM_CTX = Object.freeze({
  runId: 'run_abc',
  description: { size: 1_200_000, mime: 'image/jpeg' },
  result: {
    scanId:        'scan_123',
    possibleIssue: 'Possible leaf yellowing',
    confidence:    'medium',
    explanation:   'Yellowing on lower leaves.',
    recommendedActions: ['Inspect lower leaves in good light.'],
    category:      'yellowing',
    scanType:      'crop_health',
    imageUrl:      'https://cdn.test/scan_123.jpg',
    meta:          { source: 'api' },
  },
});

// ─── 1. Preview URL resolution ──────────────────────────────

describe('composeScanResult — preview URL resolution', () => {
  it('local preview URL wins over remote when both are present', () => {
    const env = composeScanResult({
      fsmCtx: BASE_FSM_CTX,
      previewUrl: 'blob:http://localhost/abc-def',
    });
    expect(env.render.previewUrl).toBe('blob:http://localhost/abc-def');
  });

  it('FSM remote URL is used when no local preview', () => {
    const env = composeScanResult({ fsmCtx: BASE_FSM_CTX });
    expect(env.render.previewUrl).toBe('https://cdn.test/scan_123.jpg');
  });

  it('canonical fallback when both local + remote are missing', () => {
    const env = composeScanResult({
      fsmCtx: { ...BASE_FSM_CTX, result: { ...BASE_FSM_CTX.result, imageUrl: null } },
    });
    expect(env.render.previewUrl).toBe(PREVIEW_FALLBACK);
  });

  it('never null, never empty string', () => {
    const env = composeScanResult({});
    expect(env.render.previewUrl).toBeTruthy();
    expect(env.render.previewUrl.length).toBeGreaterThan(0);
  });
});

// ─── 2. Manual symptom selection ────────────────────────────

describe('composeScanResult — manual symptom selection', () => {
  it('manual pick overrides the API result title + flags source', () => {
    const env = composeScanResult({
      fsmCtx: BASE_FSM_CTX,
      manualSelection: 'leaf_yellowing',
    });
    expect(env.render.displayResult.source).toBe('manual_fallback');
    expect(env.render.displayResult.symptomId).toBe('leaf_yellowing');
    expect(env.render.displayResult.title.toLowerCase()).toContain('yellowing leaves');
  });

  it('manual pick is reflected in journal entry', () => {
    const env = composeScanResult({
      fsmCtx: BASE_FSM_CTX,
      manualSelection: 'wilting',
      farmId: 'farm_md',
    });
    expect(env.persist.journalEntry.manualSelection).toBe('wilting');
    expect(env.persist.journalEntry.farmId).toBe('farm_md');
  });

  it('invalid manual id falls through to the API result', () => {
    const env = composeScanResult({
      fsmCtx: BASE_FSM_CTX,
      manualSelection: 'not_a_real_symptom',
    });
    expect(env.render.displayResult.source).toBe('analyzer');
  });

  it('exposes the manual symptom catalog every time', () => {
    const env = composeScanResult({ fsmCtx: BASE_FSM_CTX });
    expect(Array.isArray(env.render.manualSymptoms)).toBe(true);
    expect(env.render.manualSymptoms.length).toBeGreaterThan(0);
    expect(env.render.manualSymptoms[0]).toHaveProperty('id');
    expect(env.render.manualSymptoms[0]).toHaveProperty('label');
  });
});

// ─── 3. Confidence + recovery actions (spec §6) ────────────

describe('composeScanResult — confidence + recovery actions', () => {
  it('high API + clean quality → High tier with all actions allowed', () => {
    const env = composeScanResult({
      fsmCtx: { ...BASE_FSM_CTX, result: { ...BASE_FSM_CTX.result, confidence: 'high' } },
      qualityReport: { issues: [] },
    });
    expect(env.render.confidence).toBe(CONFIDENCE_TIERS.HIGH);
    expect(env.render.allowSave).toBe(true);
    expect(env.render.allowFollowUp).toBe(true);
    expect(env.render.allowManualSelect).toBe(true);
    expect(env.render.allowRetry).toBe(true);
    expect(env.render.promote).toBe('save');
  });

  it('poor quality (3 issues) NEVER allows High', () => {
    const env = composeScanResult({
      fsmCtx: { ...BASE_FSM_CTX, result: { ...BASE_FSM_CTX.result, confidence: 'high' } },
      qualityReport: { issues: ['blurry', 'too_dark', 'tiny_payload'] },
    });
    expect([CONFIDENCE_TIERS.LOW, CONFIDENCE_TIERS.NEEDS_REVIEW]).toContain(env.render.confidence);
  });

  it('Needs review still allows save + retry + manual select (never dead-end)', () => {
    const env = composeScanResult({
      fsmCtx: {
        runId: 'r1',
        result: { confidence: 'needs_closer_photo' },
      },
      qualityReport: { issues: ['blurry', 'too_dark', 'too_small'] },
      retryAttempts: 3,
    });
    expect(env.render.confidence).toBe(CONFIDENCE_TIERS.NEEDS_REVIEW);
    expect(env.render.allowSave).toBe(true);
    expect(env.render.allowFollowUp).toBe(true);
    expect(env.render.allowManualSelect).toBe(true);
    expect(env.render.allowRetry).toBe(true);
    expect(env.render.promote).toBe('manual_select');
  });
});

// ─── 4. Guidance copy ──────────────────────────────────────

describe('composeScanResult — guidance copy', () => {
  it('image-quality issue surfaces FIRST as guidance', () => {
    const env = composeScanResult({
      fsmCtx: BASE_FSM_CTX,
      qualityReport: {
        issues: ['too_dark'],
        guidance: ['Take photo in daylight or move to a brighter spot.'],
      },
    });
    expect(env.render.guidance).toBe('Take photo in daylight or move to a brighter spot.');
  });

  it('no quality issue + high tier → uses first recommendedAction', () => {
    const env = composeScanResult({
      fsmCtx: { ...BASE_FSM_CTX, result: { ...BASE_FSM_CTX.result, confidence: 'high' } },
      qualityReport: { issues: [] },
    });
    expect(env.render.guidance).toBe('Inspect lower leaves in good light.');
  });

  it('no quality issue + Needs review → calm retake copy', () => {
    const env = composeScanResult({
      fsmCtx: {
        runId: 'r1',
        result: { confidence: 'needs_closer_photo' },
      },
    });
    expect(env.render.guidance.toLowerCase()).toContain('retake');
  });

  it('guidance never includes raw scores or jargon', () => {
    const env = composeScanResult({
      fsmCtx: BASE_FSM_CTX,
      qualityReport: { issues: ['blurry'], guidance: ['Hold steady and tap to focus before capturing.'] },
    });
    const blob = JSON.stringify(env.render);
    expect(blob).not.toMatch(/0\.\d{2}/);
    expect(blob.toLowerCase()).not.toContain('inference');
  });
});

// ─── 5. Journal entry shape (spec §5) ───────────────────────

describe('composeScanResult — journal entry shape (spec §5)', () => {
  it('carries every spec-mandated field', () => {
    const env = composeScanResult({
      fsmCtx:  BASE_FSM_CTX,
      farmId:  'farm_md',
      now:     1_700_000_000_000,
    });
    const j = env.persist.journalEntry;
    expect(j.farmId).toBe('farm_md');
    expect(j.imageUrl).toBeTruthy();
    expect(j.scanType).toBe('crop_health');
    expect(j.summary).toBeTruthy();
    expect(j.confidence).toBeTruthy();
    expect(j.recommendedAction).toBe('Inspect lower leaves in good light.');
    expect(j.createdAt).toBeTruthy();
  });

  it('scanHistoryEntry carries the same id + image URL', () => {
    const env = composeScanResult({ fsmCtx: BASE_FSM_CTX, farmId: 'farm_md' });
    expect(env.persist.scanHistoryEntry.id).toBe(env.persist.journalEntry.scanId);
    expect(env.persist.scanHistoryEntry.imageUrl).toBe(env.persist.journalEntry.imageUrl);
  });

  it('qualityIssues array on the journal entry', () => {
    const env = composeScanResult({
      fsmCtx: BASE_FSM_CTX,
      qualityReport: { issues: ['blurry', 'too_dark'] },
    });
    expect(env.persist.journalEntry.qualityIssues).toEqual(['blurry', 'too_dark']);
  });
});

// ─── 6. Follow-up task creation ─────────────────────────────

describe('composeScanResult — follow-up task', () => {
  it('no follow-up choice → followUpTask:null', () => {
    const env = composeScanResult({ fsmCtx: BASE_FSM_CTX });
    expect(env.persist.followUpTask).toBeNull();
    expect(env.debug.followUpCreated).toBe(false);
  });

  it('CHECK_TOMORROW choice → task with "tomorrow" title', () => {
    const env = composeScanResult({
      fsmCtx:        BASE_FSM_CTX,
      followUpChoice: FOLLOW_UP_CHOICES.CHECK_TOMORROW,
      farmId:        'farm_md',
      now:           1_700_000_000_000,
    });
    expect(env.persist.followUpTask).toBeTruthy();
    expect(env.persist.followUpTask.title.toLowerCase()).toContain('tomorrow');
    expect(env.persist.followUpTask.dueAt).toBeTruthy();
    expect(env.persist.followUpTask.farmId).toBe('farm_md');
    expect(env.persist.followUpTask.scanId).toBe('run_abc');
    expect(env.debug.followUpCreated).toBe(true);
  });

  it('RETAKE_IN_DAYLIGHT choice → "daylight" task', () => {
    const env = composeScanResult({
      fsmCtx:         BASE_FSM_CTX,
      followUpChoice: FOLLOW_UP_CHOICES.RETAKE_IN_DAYLIGHT,
    });
    expect(env.persist.followUpTask.title.toLowerCase()).toContain('daylight');
  });

  it('explicit NONE → no task', () => {
    const env = composeScanResult({
      fsmCtx:         BASE_FSM_CTX,
      followUpChoice: FOLLOW_UP_CHOICES.NONE,
    });
    expect(env.persist.followUpTask).toBeNull();
  });
});

// ─── 7. Debug envelope ──────────────────────────────────────

describe('composeScanResult — debug envelope ([SCAN_RESULT_DEBUG])', () => {
  it('carries every spec-mandated field', () => {
    const env = composeScanResult({
      fsmCtx:         BASE_FSM_CTX,
      qualityReport:  { issues: ['blurry'] },
      previewUrl:     'blob:abc',
      manualSelection: null,
      followUpChoice:  FOLLOW_UP_CHOICES.CHECK_TOMORROW,
    });
    const d = env.debug;
    expect(d).toHaveProperty('imagePreviewExists');
    expect(d).toHaveProperty('imageUrl');
    expect(d).toHaveProperty('confidence');
    expect(d).toHaveProperty('qualityFlags');
    expect(d).toHaveProperty('savedToJournal');
    expect(d).toHaveProperty('followUpCreated');
    expect(d.imagePreviewExists).toBe(true);
    expect(d.qualityFlags).toEqual(['blurry']);
    expect(d.followUpCreated).toBe(true);
  });

  it('imagePreviewExists is false when only the fallback is used', () => {
    const env = composeScanResult({
      fsmCtx: { runId: 'r1', result: {} },
    });
    expect(env.debug.imagePreviewExists).toBe(false);
    expect(env.debug.imageUrl).toBe(PREVIEW_FALLBACK);
  });

  it('debugTraceScanResult never throws', () => {
    expect(() => debugTraceScanResult(null)).not.toThrow();
    expect(() => debugTraceScanResult({})).not.toThrow();
    expect(() => debugTraceScanResult('garbage')).not.toThrow();
  });
});

// ─── 8. Safety + frozen output ──────────────────────────────

describe('composeScanResult — safety', () => {
  it('frozen render / persist / debug', () => {
    const env = composeScanResult({ fsmCtx: BASE_FSM_CTX });
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.render)).toBe(true);
    expect(Object.isFrozen(env.persist)).toBe(true);
    expect(Object.isFrozen(env.debug)).toBe(true);
  });

  it('never throws on garbage input', () => {
    expect(() => composeScanResult(null)).not.toThrow();
    expect(() => composeScanResult(undefined)).not.toThrow();
    expect(() => composeScanResult('garbage')).not.toThrow();
    expect(() => composeScanResult({ fsmCtx: 'wrong' })).not.toThrow();
  });

  it('empty input still produces a renderable + safe envelope', () => {
    const env = composeScanResult({});
    expect(env.render.previewUrl).toBeTruthy();
    expect(env.render.confidence).toBe(CONFIDENCE_TIERS.NEEDS_REVIEW);
    expect(env.render.allowSave).toBe(true);
    expect(env.render.allowManualSelect).toBe(true);
    expect(env.render.allowRetry).toBe(true);
  });
});

// ─── 9. Acceptance — spec acceptance tests pass through ─────

describe('Acceptance — spec test cases route through composer', () => {
  it('gallery image with preview - preview persists through render', () => {
    const env = composeScanResult({
      fsmCtx: BASE_FSM_CTX,
      previewUrl: 'blob:gallery-abc',
    });
    expect(env.render.previewUrl).toBe('blob:gallery-abc');
  });

  it('low-quality photo gives useful guidance', () => {
    const env = composeScanResult({
      fsmCtx: BASE_FSM_CTX,
      qualityReport: { issues: ['blurry'], guidance: ['Hold steady and tap to focus before capturing.'] },
    });
    expect(env.render.guidance).toContain('focus');
    expect(env.render.allowRetry).toBe(true);
  });

  it('manual fallback saves journal entry with the symptom', () => {
    const env = composeScanResult({
      fsmCtx: BASE_FSM_CTX,
      manualSelection: 'leaf_spots',
      farmId: 'farm_md',
    });
    expect(env.persist.journalEntry.manualSelection).toBe('leaf_spots');
    expect(env.persist.journalEntry.summary.toLowerCase()).toContain('spots on leaves');
  });

  it('follow-up task creation flows through composer', () => {
    const env = composeScanResult({
      fsmCtx: BASE_FSM_CTX,
      followUpChoice: FOLLOW_UP_CHOICES.CHECK_TOMORROW,
      farmId: 'farm_md',
    });
    expect(env.persist.followUpTask).toBeTruthy();
    expect(env.persist.followUpTask.source).toBe('scan_follow_up');
  });
});
