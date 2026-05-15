/**
 * scanPreviewConfidence.test.js — Scan Preview + Confidence
 * Improvement Fix.
 *
 * Coverage:
 *   1. scanImageQuality — tiny-payload detection, SSR safety,
 *      issue catalog, guidance copy mapping, classifyByQualityIssues
 *      downgrade ladder
 *   2. scanPreviewLifecycle — attach, getUrl, release, idempotent
 *      teardown, SSR safety
 *   3. scanConfidenceEngine — High/Moderate/Low/NeedsReview
 *      categorisation + the spec §6 "never dead-end" guarantee
 *      (every tier ALLOWS every recovery action)
 *   4. Acceptance — poor image NEVER claims High; even Needs
 *      review allows save + retry + manual select
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  analyzeImageQuality,
  buildQualityGuidance,
  classifyByQualityIssues,
  QUALITY_SCORES,
  QUALITY_ISSUES,
} from '../../../src/lib/scan/scanImageQuality.js';
import {
  createPreviewSession,
} from '../../../src/lib/scan/scanPreviewLifecycle.js';
import {
  resolveScanConfidence,
  CONFIDENCE_TIERS,
} from '../../../src/lib/scan/scanConfidenceEngine.js';

// ─── 1. scanImageQuality ─────────────────────────────────────

describe('scanImageQuality.analyzeImageQuality (SSR / Node path)', () => {
  it('returns score:unknown when no canvas / createImageBitmap available', async () => {
    const out = await analyzeImageQuality({ size: 1_500_000, type: 'image/jpeg' });
    expect(out.score).toBe(QUALITY_SCORES.UNKNOWN);
    expect(out.issues).toEqual([]);
  });

  it('flags tiny_payload when file size is under 30KB', async () => {
    const out = await analyzeImageQuality({ size: 10_000, type: 'image/jpeg' });
    expect(out.issues).toContain(QUALITY_ISSUES.TINY_PAYLOAD);
    expect(out.guidance.length).toBeGreaterThan(0);
    expect(out.guidance[0].toLowerCase()).toContain('retake');
  });

  it('never throws on null / malformed input', async () => {
    await expect(analyzeImageQuality(null)).resolves.toBeTruthy();
    await expect(analyzeImageQuality(undefined)).resolves.toBeTruthy();
    await expect(analyzeImageQuality({})).resolves.toBeTruthy();
    await expect(analyzeImageQuality('not-a-blob')).resolves.toBeTruthy();
  });

  it('frozen output (no in-place mutation)', async () => {
    const out = await analyzeImageQuality({ size: 1_500_000 });
    expect(Object.isFrozen(out)).toBe(true);
    expect(Object.isFrozen(out.issues)).toBe(true);
    expect(Object.isFrozen(out.metrics)).toBe(true);
  });

  it('issue catalog covers every spec-mandated kind', () => {
    expect(QUALITY_ISSUES.TOO_DARK).toBeTruthy();
    expect(QUALITY_ISSUES.TOO_BRIGHT).toBeTruthy();
    expect(QUALITY_ISSUES.BLURRY).toBeTruthy();
    expect(QUALITY_ISSUES.TOO_SMALL).toBeTruthy();
    expect(QUALITY_ISSUES.TINY_PAYLOAD).toBeTruthy();
    expect(QUALITY_ISSUES.MULTIPLE_LEAVES).toBeTruthy();
    expect(QUALITY_ISSUES.SHADOW_DETECTED).toBeTruthy();
  });
});

describe('scanImageQuality.buildQualityGuidance', () => {
  it('returns the top guidance sentence for the first issue', () => {
    const report = {
      issues:   ['too_dark', 'blurry'],
      guidance: ['Take photo in daylight.', 'Hold steady and tap to focus.'],
    };
    expect(buildQualityGuidance(report)).toBe('Take photo in daylight.');
  });

  it('returns null when there are no issues', () => {
    expect(buildQualityGuidance({ issues: [], guidance: [] })).toBeNull();
    expect(buildQualityGuidance(null)).toBeNull();
  });
});

describe('scanImageQuality.classifyByQualityIssues — downgrade ladder', () => {
  it('no issues → preserves base label', () => {
    const r = { issues: [] };
    expect(classifyByQualityIssues('high',   r)).toBe('High');
    expect(classifyByQualityIssues('medium', r)).toBe('Moderate');
    expect(classifyByQualityIssues('low',    r)).toBe('Low');
  });

  it('one issue downgrades High → Moderate', () => {
    const r = { issues: ['too_dark'] };
    expect(classifyByQualityIssues('high', r)).toBe('Moderate');
  });

  it('two issues NEVER allow High; downgrade everything', () => {
    const r = { issues: ['too_dark', 'blurry'] };
    expect(classifyByQualityIssues('high',   r)).toBe('Low');
    expect(classifyByQualityIssues('medium', r)).toBe('Low');
    expect(classifyByQualityIssues('low',    r)).toBe('Needs review');
  });
});

// ─── 2. scanPreviewLifecycle ────────────────────────────────

describe('scanPreviewLifecycle.createPreviewSession (SSR path)', () => {
  it('attach returns null when URL.createObjectURL is unavailable', () => {
    const s = createPreviewSession();
    expect(s.attach({ size: 100 })).toBeNull();
  });

  it('getUrl returns null on a fresh / unsupported session', () => {
    const s = createPreviewSession();
    expect(s.getUrl()).toBeNull();
  });

  it('release is idempotent + flips isReleased to true', () => {
    const s = createPreviewSession();
    s.release();
    s.release();
    expect(s.isReleased()).toBe(true);
    expect(s.getUrl()).toBeNull();
    expect(s.attach({ size: 100 })).toBeNull();
  });
});

describe('scanPreviewLifecycle.createPreviewSession (browser-shim path)', () => {
  let revoked;
  let createCalls;

  beforeEach(() => {
    revoked = [];
    createCalls = 0;
    globalThis.URL = {
      createObjectURL: () => {
        createCalls += 1;
        return `blob:fake-${createCalls}`;
      },
      revokeObjectURL: (u) => { revoked.push(u); },
    };
  });

  it('attach returns a blob URL + re-attach revokes the previous one', () => {
    const s = createPreviewSession();
    const a = s.attach({ size: 100, type: 'image/jpeg' });
    expect(a).toBe('blob:fake-1');
    const b = s.attach({ size: 200, type: 'image/jpeg' });
    expect(b).toBe('blob:fake-2');
    expect(revoked).toContain('blob:fake-1');
  });

  it('getUrl returns the most recent URL', () => {
    const s = createPreviewSession();
    s.attach({ size: 100 });
    expect(s.getUrl()).toBe('blob:fake-1');
  });

  it('release revokes the held URL exactly once', () => {
    const s = createPreviewSession();
    s.attach({ size: 100 });
    s.release();
    expect(revoked).toEqual(['blob:fake-1']);
    s.release(); // idempotent — no second revoke
    expect(revoked.length).toBe(1);
  });

  it('adoptRemote with an empty/null remote keeps the blob URL', async () => {
    const s = createPreviewSession();
    s.attach({ size: 100 });
    const out = await s.adoptRemote(null);
    expect(out).toBe('blob:fake-1');
  });

  it('adoptRemote without an Image global still adopts cleanly', async () => {
    delete globalThis.Image; // simulate Node-no-Image
    const s = createPreviewSession();
    s.attach({ size: 100 });
    const out = await s.adoptRemote('https://cdn.test/img.jpg');
    expect(out).toBe('https://cdn.test/img.jpg');
    expect(revoked).toContain('blob:fake-1');
  });
});

// ─── 3. scanConfidenceEngine ────────────────────────────────

describe('scanConfidenceEngine.resolveScanConfidence — base mapping', () => {
  it.each([
    ['high',               'High'],
    ['high_likelihood',    'High'],
    ['very_high',          'High'],
    ['medium',             'Moderate'],
    ['moderate',           'Moderate'],
    ['likely',             'Moderate'],
    ['low',                'Low'],
    ['possible',           'Low'],
    ['needs_closer_photo', 'Needs review'],
    ['',                   'Needs review'],
    [undefined,            'Needs review'],
  ])('apiConfidence "%s" → %s', (apiConfidence, expectedTier) => {
    const out = resolveScanConfidence({ apiConfidence });
    expect(out.tier).toBe(expectedTier);
  });
});

describe('scanConfidenceEngine — image-quality downgrades', () => {
  it('High + one severe quality issue → Moderate', () => {
    const out = resolveScanConfidence({
      apiConfidence: 'high',
      qualityReport: { issues: ['blurry'] },
    });
    expect(out.tier).toBe(CONFIDENCE_TIERS.MODERATE);
  });

  it('High + 2 issues → Low (never claims High when quality is poor)', () => {
    const out = resolveScanConfidence({
      apiConfidence: 'high',
      qualityReport: { issues: ['blurry', 'too_dark'] },
    });
    expect(out.tier).toBe(CONFIDENCE_TIERS.LOW);
  });

  it('Low + 3 issues → Needs review', () => {
    const out = resolveScanConfidence({
      apiConfidence: 'low',
      qualityReport: { issues: ['blurry', 'too_dark', 'tiny_payload'] },
    });
    expect(out.tier).toBe(CONFIDENCE_TIERS.NEEDS_REVIEW);
  });

  it('Low + 2 retries → Needs review', () => {
    const out = resolveScanConfidence({
      apiConfidence: 'low',
      qualityReport: { issues: [] },
      retryAttempts: 2,
    });
    expect(out.tier).toBe(CONFIDENCE_TIERS.NEEDS_REVIEW);
  });
});

describe('scanConfidenceEngine — spec §6 never dead-end', () => {
  it('every tier allows save + follow-up + manual select + retry', () => {
    for (const apiC of ['high', 'medium', 'low', 'needs_closer_photo']) {
      const out = resolveScanConfidence({ apiConfidence: apiC });
      expect(out.allowSave).toBe(true);
      expect(out.allowFollowUp).toBe(true);
      expect(out.allowManualSelect).toBe(true);
      expect(out.allowRetry).toBe(true);
    }
  });

  it('promote action shifts based on tier', () => {
    expect(resolveScanConfidence({ apiConfidence: 'high' }).promote).toBe('save');
    expect(resolveScanConfidence({ apiConfidence: 'medium' }).promote).toBe('save');
    expect(resolveScanConfidence({ apiConfidence: 'low' }).promote).toBe('retry');
    expect(resolveScanConfidence({ apiConfidence: 'needs_closer_photo' }).promote).toBe('manual_select');
  });

  it('reason copy is calm + farmer-friendly (no jargon)', () => {
    const out = resolveScanConfidence({
      apiConfidence: 'low',
      qualityReport: { issues: ['blurry', 'too_dark'] },
    });
    const r = out.reason.toLowerCase();
    expect(r).not.toContain('inference');
    expect(r).not.toContain('confidence interval');
    expect(r).not.toMatch(/0\.\d/);
  });
});

describe('scanConfidenceEngine — safety', () => {
  it('frozen envelope', () => {
    const out = resolveScanConfidence({ apiConfidence: 'high' });
    expect(Object.isFrozen(out)).toBe(true);
  });

  it('never throws on garbage input', () => {
    expect(() => resolveScanConfidence(null)).not.toThrow();
    expect(() => resolveScanConfidence(undefined)).not.toThrow();
    expect(() => resolveScanConfidence('garbage')).not.toThrow();
    expect(() => resolveScanConfidence({ apiConfidence: 42 })).not.toThrow();
  });
});

// ─── 4. Acceptance — end-to-end "never dead-end" ────────────

describe('Acceptance — even Needs review lets the user save + retry', () => {
  it('apiConfidence "needs_closer_photo" + 3 quality issues → Needs review with all paths open', () => {
    const out = resolveScanConfidence({
      apiConfidence:  'needs_closer_photo',
      qualityReport:  { issues: ['blurry', 'too_dark', 'too_small'] },
      retryAttempts:  3,
    });
    expect(out.tier).toBe(CONFIDENCE_TIERS.NEEDS_REVIEW);
    expect(out.allowSave).toBe(true);
    expect(out.allowFollowUp).toBe(true);
    expect(out.allowManualSelect).toBe(true);
    expect(out.allowRetry).toBe(true);
    expect(out.promote).toBe('manual_select');
  });

  it('a clean photo + high api confidence → High with promote:save', () => {
    const out = resolveScanConfidence({
      apiConfidence: 'high',
      qualityReport: { issues: [] },
      retryAttempts: 0,
    });
    expect(out.tier).toBe(CONFIDENCE_TIERS.HIGH);
    expect(out.promote).toBe('save');
  });
});
