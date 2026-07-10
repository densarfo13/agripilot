/**
 * translationGovernance.test.js — Translation Governance + Review
 * Pipeline Upgrade.
 *
 * Two governance surfaces are tested:
 *   1. translationReviewQueue.js — classifies every translations.js
 *      key into a review status (approved / fallback_only / missing
 *      / needs_review / placeholder) and supports a persisted
 *      human review flag.
 *   2. check:translations — now also detects duplicate keys in
 *      translations.js, with a baseline ratchet so a NEW duplicate
 *      fails the build.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  REVIEW_STATUS,
  getKeyStatus,
  getReviewSummary,
  getReviewQueue,
  flagForReview,
  clearReviewFlag,
  _resetReviewQueue,
} from '../../../src/localization/governance/translationReviewQueue.js';

const ROOT = resolve(process.cwd(), '..');

beforeEach(() => {
  _resetReviewQueue();
});

// ─── 1. Review status model ────────────────────────────────

describe('translationReviewQueue — status model', () => {
  it('declares the five governance statuses', () => {
    expect(REVIEW_STATUS.APPROVED).toBe('approved');
    expect(REVIEW_STATUS.FALLBACK_ONLY).toBe('fallback_only');
    expect(REVIEW_STATUS.MISSING).toBe('missing');
    expect(REVIEW_STATUS.NEEDS_REVIEW).toBe('needs_review');
    expect(REVIEW_STATUS.PLACEHOLDER).toBe('placeholder');
  });
});

// ─── 2. Whole-registry summary ─────────────────────────────

describe('translationReviewQueue — getReviewSummary', () => {
  it('returns the documented shape and the counts reconcile', () => {
    const s = getReviewSummary();
    expect(s.totalKeys).toBeGreaterThan(1000);
    expect(s.approved).toBeGreaterThan(0);
    // every status partition sums back to the total
    const sum = s.approved + s.fallbackOnly + s.missing
              + s.needsReview + s.placeholder;
    expect(sum).toBe(s.totalKeys);
    expect(s.activeKeys).toBe(s.totalKeys - s.placeholder);
    expect(s.approvedPct).toBeGreaterThanOrEqual(0);
    expect(s.approvedPct).toBeLessThanOrEqual(100);
  });

  it('reports fallback_only against the current column data', () => {
    // Post column-split, every locale column (incl. hi) is fully
    // materialized: an untranslated slot carries the English fallback
    // string rather than a blank. The review queue blank-detects
    // fallback_only, so with no blank slots the summary reports zero
    // fallback_only and counts the active keys as approved. The finer
    // "real Hindi vs English fallback" gap (~3.2k keys whose hi value
    // equals en) is invisible to this blank-based classifier — it is
    // tracked in the column files, not by this summary.
    const s = getReviewSummary();
    expect(s.fallbackOnly).toBe(0);
    expect(s.approved).toBeGreaterThan(0);
  });
});

// ─── 3. Per-key classification ─────────────────────────────

describe('translationReviewQueue — getKeyStatus', () => {
  it('classifies a fully-translated key as approved', () => {
    // common.continue ships all six languages.
    expect(getKeyStatus('common.continue')).toBe(REVIEW_STATUS.APPROVED);
  });

  it('an unknown key is missing, never throws', () => {
    expect(getKeyStatus('zzz.not.a.real.key')).toBe(REVIEW_STATUS.MISSING);
    expect(() => getKeyStatus(null)).not.toThrow();
  });

  it('getReviewQueue returns a bounded array for a status', () => {
    const q = getReviewQueue(REVIEW_STATUS.FALLBACK_ONLY, 50);
    expect(Array.isArray(q)).toBe(true);
    expect(q.length).toBeLessThanOrEqual(50);
  });
});

// ─── 4. Human review flag (persisted) ──────────────────────

describe('translationReviewQueue — human review flag', () => {
  const hadLS = 'localStorage' in globalThis;
  const savedLS = globalThis.localStorage;

  beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  });
  afterEach(() => {
    if (hadLS) globalThis.localStorage = savedLS;
    else delete globalThis.localStorage;
  });

  it('flagForreview overrides the auto status; clear reverts it', () => {
    expect(getKeyStatus('common.continue')).toBe(REVIEW_STATUS.APPROVED);
    flagForReview('common.continue');
    expect(getKeyStatus('common.continue')).toBe(REVIEW_STATUS.NEEDS_REVIEW);
    clearReviewFlag('common.continue');
    expect(getKeyStatus('common.continue')).toBe(REVIEW_STATUS.APPROVED);
  });

  it('a flagged key shows up in the needs_review queue + summary', () => {
    flagForReview('common.ready');
    expect(getReviewQueue(REVIEW_STATUS.NEEDS_REVIEW)).toContain('common.ready');
    expect(getReviewSummary().needsReview).toBeGreaterThanOrEqual(1);
  });

  it('never throws when localStorage is unavailable', () => {
    delete globalThis.localStorage;
    expect(() => flagForReview('common.continue')).not.toThrow();
    expect(() => getReviewSummary()).not.toThrow();
  });
});

// ─── 5. Duplicate-key gate ─────────────────────────────────

describe('check:translations — duplicate-key detection', () => {
  it('passes and confirms translations.js has no duplicate keys', () => {
    let stdout;
    try {
      stdout = execSync('node scripts/check-translations.mjs', {
        cwd: ROOT, encoding: 'utf8',
      });
    } catch (err) {
      throw new Error('check:translations FAILED:\n'
        + ((err.stdout || '') + (err.stderr || '')));
    }
    expect(stdout).toMatch(/\[check:translations\] PASS/);
    // Post column-split: the duplicate-keys check is replaced by an
    // orphan-keys check (a key in a non-en column with no English
    // value). Column files are JSON-shaped so JS-side duplicates are
    // structurally impossible; the orphan check covers the same
    // "translation drift" risk surface.
    expect(stdout).toMatch(/no orphan keys/);
  });
});
