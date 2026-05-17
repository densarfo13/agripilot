/**
 * confidenceLanguage.js — the safe-wording layer for scan/agronomy
 * confidence (spec §1).
 *
 *   import { confidenceWord, describeConfidence, overclaimsCertainty }
 *     from 'src/core/agronomy/confidenceLanguage.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A thin, pure module that maps a confidence value to the ONLY
 *   phrasing Farroway permits: "likely" / "possible" / "needs
 *   review". It does NOT rewrite engine text — `scanResultPolicy.js`
 *   already strips forbidden phrases ("confirmed disease" → "possible
 *   issue"). This module is the positive side of the same rule: it
 *   tells callers what they ARE allowed to say, so a result screen
 *   never has to invent its own wording.
 *
 * The hard ceiling
 *   Even at the highest confidence tier the strongest word is
 *   "likely". Farroway NEVER says "confirmed", "definitely",
 *   "guaranteed", or "certain" — `overclaimsCertainty()` is the
 *   guard a caller can assert against.
 *
 * Strict-rule audit
 *   • Pure. Never throws. No I/O. Reuses normalizeConfidence from
 *     scanResultPolicy — no duplicate confidence tiering.
 */

import { normalizeConfidence } from '../scanResultPolicy.js';

// confidence tier → the strongest phrasing we permit.
const TIER_LANGUAGE = Object.freeze({
  high:   {
    word:     'likely',
    sentence: 'This looks like a likely issue — check to be sure before acting.',
  },
  medium: {
    word:     'possible',
    sentence: 'This is a possible issue worth a closer look.',
  },
  low:    {
    word:     'needs review',
    sentence: 'This needs a closer look — the photo was not clear enough to say.',
  },
});

// The complete set of permitted confidence words.
export const CONFIDENCE_WORDS = Object.freeze(['likely', 'possible', 'needs review']);

/** Normalised tier — 'low' | 'medium' | 'high'. */
export function confidenceTier(value) {
  return normalizeConfidence(value);
}

/** The single permitted word for a confidence value. */
export function confidenceWord(value) {
  return TIER_LANGUAGE[normalizeConfidence(value)].word;
}

/** A full, farmer-safe sentence describing the confidence. */
export function describeConfidence(value) {
  return TIER_LANGUAGE[normalizeConfidence(value)].sentence;
}

// Absolute-certainty words that must NEVER reach the farmer.
const BANNED_CERTAINTY = /\b(confirmed|definitely|guaranteed|certain(?:ly)?|100\s?%)\b/i;

/**
 * Whether `text` overclaims certainty. A result screen can assert
 * `!overclaimsCertainty(text)` before render as a cheap guard.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function overclaimsCertainty(text) {
  try {
    return BANNED_CERTAINTY.test(String(text || ''));
  } catch {
    return false;
  }
}

const _module = {
  CONFIDENCE_WORDS,
  confidenceTier,
  confidenceWord,
  describeConfidence,
  overclaimsCertainty,
};
export default _module;
