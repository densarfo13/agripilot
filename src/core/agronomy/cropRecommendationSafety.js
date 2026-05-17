/**
 * cropRecommendationSafety.js — keeps crop-choice guidance honest
 * (Final Readiness §1).
 *
 *   import { validateCropRecommendation, softenCropClaim }
 *     from 'src/core/agronomy/cropRecommendationSafety.js';
 *
 * What it is
 * ──────────
 *   A pure guard for crop / planting recommendations. Farroway may
 *   suggest a crop "could suit" a context — it must NEVER promise a
 *   yield, a profit, or that a crop is "the best". This module
 *   detects those overclaims and rewrites them to safe wording.
 *
 * Strict-rule audit
 *   • Pure. Never throws. No I/O.
 */

export const CROP_REC_DISCLAIMER =
  'Crop suggestions are guidance based on your context — not a guarantee of yield or income. Local conditions vary.';

// Overclaim phrase → safe replacement. Order: longest first.
const UNSAFE_CROP_CLAIMS = Object.freeze([
  [/\bguaranteed (?:yield|harvest|profit|income|return)\b/gi, 'possible result'],
  [/\bwill (?:increase|boost|double|maximi[sz]e) (?:your )?(?:yield|harvest|income|profit)\b/gi,
                                                             'may help your harvest'],
  [/\bbest crop (?:for you|choice|option)\b/gi,              'a crop worth considering'],
  [/\bhighest[\- ]yield(?:ing)? crop\b/gi,                   'a crop worth considering'],
  [/\bguarantees? (?:a )?(?:good|high|big) (?:harvest|yield)\b/gi, 'may give a good harvest'],
  [/\bcertain (?:to|profit)\b/gi,                            'may'],
  [/\bsure (?:profit|money|income)\b/gi,                     'possible income'],
  [/\bdefinitely (?:grow|thrive|succeed)\b/gi,               'may grow well'],
]);

// Detection-only patterns — anything that signals an overclaim.
const UNSAFE_DETECT = /\b(guaranteed|will increase your yield|best crop for you|highest[\- ]yield|sure profit|definitely (?:grow|thrive))\b/i;

/**
 * Rewrite a crop recommendation to safe wording. Pure; '' for
 * non-string input.
 */
export function softenCropClaim(text) {
  if (typeof text !== 'string' || !text) return '';
  let out = text;
  for (const [re, repl] of UNSAFE_CROP_CLAIMS) {
    try { out = out.replace(re, repl); } catch { /* swallow */ }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Validate a crop recommendation.
 *
 * @param {string} text
 * @returns {{ safe:boolean, violations:string[], safeText:string }}
 */
export function validateCropRecommendation(text) {
  const s = String(text || '');
  const violations = [];
  try {
    if (UNSAFE_DETECT.test(s)) violations.push('yield/profit guarantee or "best crop" overclaim');
  } catch { /* swallow */ }
  const safeText = softenCropClaim(s);
  return {
    safe: violations.length === 0,
    violations,
    safeText,
  };
}

const _module = {
  CROP_REC_DISCLAIMER,
  softenCropClaim,
  validateCropRecommendation,
};
export default _module;
