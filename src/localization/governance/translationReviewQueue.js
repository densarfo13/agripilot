/**
 * translationReviewQueue.js — translation governance + review layer.
 *
 *   import {
 *     getReviewSummary, getReviewQueue, getKeyStatus,
 *     flagForReview, clearReviewFlag, REVIEW_STATUS,
 *   } from 'src/localization/governance/translationReviewQueue.js';
 *
 * What this is
 * ────────────
 *   The localization DATA already ships (src/i18n/translations.js —
 *   6,372 keys × 6 languages) and the build GATE already ships
 *   (scripts/check-translations.mjs). What was missing is the
 *   governance view in between: a per-key review STATUS so the team
 *   can see, at any moment, which strings are production-complete
 *   vs. running on an English fallback vs. flagged for a human.
 *
 *   This module is that view. It does NOT duplicate the registry or
 *   the gate — it classifies the existing data and layers an
 *   optional human-review flag on top.
 *
 * Status model (spec §6)
 *   approved       — non-blank value in ALL six launch languages.
 *                    The only status that counts as production-
 *                    complete.
 *   fallback_only  — English present, ≥1 other language missing.
 *                    The key renders, but non-English users see the
 *                    English fallback (never a mixed sentence).
 *   missing        — English itself is blank while some other
 *                    language has text — a genuine anomaly.
 *   needs_review   — explicitly flagged by a reviewer (persisted).
 *   (all-blank placeholder keys, e.g. helpers.generic, are excluded
 *    — they carry no UI text and cannot cause a mismatch.)
 *
 * Strict-rule audit
 *   • Pure classification (modulo the localStorage flag reads).
 *   • SSR-safe, never throws.
 *   • Auto-classification is memoised — the 6k-key walk runs once.
 */

import translations from '../../i18n/translations.js';

export const REVIEW_STATUS = Object.freeze({
  APPROVED:      'approved',
  FALLBACK_ONLY: 'fallback_only',
  MISSING:       'missing',
  NEEDS_REVIEW:  'needs_review',
  PLACEHOLDER:   'placeholder',
});

// English is the source language; the other five must match it for
// a key to be production-complete.
const NON_EN_LANGS = Object.freeze(['fr', 'sw', 'ha', 'tw', 'hi']);

// localStorage key for the human review-flag overrides.
const OVERRIDE_KEY = 'farroway_translation_review_overrides_v1';

const _blank = (v) => typeof v !== 'string' || v.trim() === '';

// ── Auto-classification (memoised) ───────────────────────────

let _autoCache = null;

/** Classify ONE key from its value object alone (no overrides). */
function _classifyValue(valueObj) {
  if (!valueObj || typeof valueObj !== 'object') return REVIEW_STATUS.MISSING;
  const enBlank = _blank(valueObj.en);
  const gaps = NON_EN_LANGS.filter((l) => _blank(valueObj[l]));
  if (enBlank) {
    // All blank → an intentional placeholder, not a real string.
    return gaps.length === NON_EN_LANGS.length
      ? REVIEW_STATUS.PLACEHOLDER
      : REVIEW_STATUS.MISSING;
  }
  return gaps.length === 0 ? REVIEW_STATUS.APPROVED : REVIEW_STATUS.FALLBACK_ONLY;
}

/** Build (once) the { key → autoStatus } map for every key. */
function _autoMap() {
  if (_autoCache) return _autoCache;
  const map = {};
  try {
    for (const key of Object.keys(translations || {})) {
      map[key] = _classifyValue(translations[key]);
    }
  } catch { /* leave map partial — never throw */ }
  _autoCache = map;
  return map;
}

// ── Human review-flag overrides (persisted) ──────────────────

function _readOverrides() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch { return {}; }
}

function _writeOverrides(obj) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(obj || {}));
    return true;
  } catch { return false; }
}

/** Flag a key for human review. Persisted across sessions. */
export function flagForReview(key) {
  if (typeof key !== 'string' || !key) return false;
  const ov = _readOverrides();
  ov[key] = REVIEW_STATUS.NEEDS_REVIEW;
  return _writeOverrides(ov);
}

/** Remove a human review flag (revert to auto-classification). */
export function clearReviewFlag(key) {
  if (typeof key !== 'string' || !key) return false;
  const ov = _readOverrides();
  if (key in ov) { delete ov[key]; return _writeOverrides(ov); }
  return true;
}

// ── Public query API ─────────────────────────────────────────

/** The governance status of one key — a human flag wins over the
 *  auto-classification. */
export function getKeyStatus(key) {
  try {
    const ov = _readOverrides();
    if (ov[key] === REVIEW_STATUS.NEEDS_REVIEW) return REVIEW_STATUS.NEEDS_REVIEW;
    return _autoMap()[key] || REVIEW_STATUS.MISSING;
  } catch {
    return REVIEW_STATUS.MISSING;
  }
}

/**
 * The whole-registry governance summary — the production-completeness
 * picture the spec's final output asks for.
 *
 * @returns {{
 *   totalKeys:number, activeKeys:number,
 *   approved:number, fallbackOnly:number, missing:number,
 *   needsReview:number, placeholder:number, approvedPct:number
 * }}
 */
export function getReviewSummary() {
  try {
    const auto = _autoMap();
    const ov = _readOverrides();
    const counts = {
      approved: 0, fallbackOnly: 0, missing: 0,
      needsReview: 0, placeholder: 0,
    };
    const keys = Object.keys(auto);
    for (const key of keys) {
      const status = (ov[key] === REVIEW_STATUS.NEEDS_REVIEW)
        ? REVIEW_STATUS.NEEDS_REVIEW
        : auto[key];
      if (status === REVIEW_STATUS.APPROVED)           counts.approved += 1;
      else if (status === REVIEW_STATUS.FALLBACK_ONLY) counts.fallbackOnly += 1;
      else if (status === REVIEW_STATUS.MISSING)       counts.missing += 1;
      else if (status === REVIEW_STATUS.NEEDS_REVIEW)  counts.needsReview += 1;
      else if (status === REVIEW_STATUS.PLACEHOLDER)   counts.placeholder += 1;
    }
    const activeKeys = keys.length - counts.placeholder;
    const approvedPct = activeKeys > 0
      ? Math.round((counts.approved / activeKeys) * 1000) / 10
      : 0;
    return {
      totalKeys:   keys.length,
      activeKeys,
      approved:    counts.approved,
      fallbackOnly: counts.fallbackOnly,
      missing:     counts.missing,
      needsReview: counts.needsReview,
      placeholder: counts.placeholder,
      approvedPct,
    };
  } catch {
    return {
      totalKeys: 0, activeKeys: 0, approved: 0, fallbackOnly: 0,
      missing: 0, needsReview: 0, placeholder: 0, approvedPct: 0,
    };
  }
}

/**
 * The list of keys in a given review status — the actual queue a
 * reviewer works through.
 *
 * @param {string} status   one of REVIEW_STATUS
 * @param {number} [limit]  cap the returned list (default 200)
 * @returns {string[]}
 */
export function getReviewQueue(status, limit) {
  try {
    const cap = (typeof limit === 'number' && limit > 0) ? limit : 200;
    const auto = _autoMap();
    const ov = _readOverrides();
    const out = [];
    for (const key of Object.keys(auto)) {
      const s = (ov[key] === REVIEW_STATUS.NEEDS_REVIEW)
        ? REVIEW_STATUS.NEEDS_REVIEW
        : auto[key];
      if (s === status) {
        out.push(key);
        if (out.length >= cap) break;
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Test seam — drop the memoised classification. */
export function _resetReviewQueue() {
  _autoCache = null;
}

const _module = {
  REVIEW_STATUS,
  getKeyStatus,
  getReviewSummary,
  getReviewQueue,
  flagForReview,
  clearReviewFlag,
  _resetReviewQueue,
};
export default _module;
