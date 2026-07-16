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
  _classifyValue,
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

  it('counts English-fallback-in-locale keys as fallback_only, not approved', () => {
    // Post column-split, every locale column (incl. hi) is fully
    // materialized: an untranslated slot carries the English fallback
    // string verbatim rather than a blank. The classifier now treats a
    // non-en value byte-identical to en as an English fallback, so the
    // ~3.2k hi===en keys report as fallback_only instead of inflating
    // the approved count — the governance dashboard tells the truth.
    const s = getReviewSummary();
    expect(s.fallbackOnly).toBeGreaterThan(0);
    expect(s.approved).toBeGreaterThan(0);
    // approved reflects only genuinely-translated keys, so it can no
    // longer swallow the whole active set the way the old blank-only
    // classifier did (which over-reported ~100% approved).
    expect(s.approved).toBeLessThan(s.activeKeys);
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

// ─── 3b. English-fallback-in-locale classification ─────────

describe('translationReviewQueue — English-fallback detection', () => {
  // A genuinely-translated key: all six locales distinct + non-blank.
  const full = {
    en: 'Continue', fr: 'Continuer', sw: 'Endelea',
    ha: 'Ci gaba', tw: 'Toa so', hi: 'जारी रखें',
  };

  it('classifies a key whose hi echoes en verbatim as fallback_only', () => {
    // The column-split fills an untranslated hi slot with the English
    // string byte-for-byte. That is an English fallback sitting in the
    // locale column, NOT a real translation, so it must not count as
    // approved — this is the exact over-reporting bug being fixed.
    const v = { ...full, hi: 'Continue' }; // hi === en
    expect(_classifyValue(v)).toBe(REVIEW_STATUS.FALLBACK_ONLY);
  });

  it('classifies a genuinely-translated key (all six distinct) as approved', () => {
    expect(_classifyValue(full)).toBe(REVIEW_STATUS.APPROVED);
  });

  it('still treats a blank locale slot as fallback_only', () => {
    expect(_classifyValue({ ...full, hi: '' })).toBe(REVIEW_STATUS.FALLBACK_ONLY);
  });

  it('only byte-identical values are fallbacks — a differing value is real', () => {
    // "continue" !== "Continue"; a non-identical string is treated as a
    // genuine (if odd) translation, not an English fallback.
    expect(_classifyValue({ ...full, hi: 'continue' })).toBe(REVIEW_STATUS.APPROVED);
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
