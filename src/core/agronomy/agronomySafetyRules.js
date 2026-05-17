/**
 * agronomySafetyRules.js — separates SAFE general advice from
 * advice that needs a local expert (spec §1).
 *
 *   import { classifyAdvice, partitionAdvice, EXPERT_REQUIRED_NOTE }
 *     from 'src/core/agronomy/agronomySafetyRules.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   `scanResultPolicy.js` REWRITES unsafe wording (exact dosages,
 *   product names → "Follow label instructions."). This module is
 *   complementary: it CLASSIFIES a piece of advice as either
 *   general-safe (watering, inspection, mulching, shade) or
 *   expert-required (anything touching pesticide / chemical /
 *   dosage) so the UI can show the two sets separately and attach
 *   the "consult a local expert" note to the second.
 *
 *   It does not rewrite text and it does not duplicate the
 *   sanitiser — it reads, it does not mutate.
 *
 * Strict-rule audit
 *   • Pure. Never throws. No I/O.
 */

export const EXPERT_REQUIRED_NOTE =
  'Consult a local agricultural expert before applying any chemical or pesticide treatment.';

export const ADVICE_TIER = Object.freeze({
  GENERAL_SAFE:    'general_safe',
  EXPERT_REQUIRED: 'expert_required',
});

// Patterns that mark advice as expert-required. Conservative — a
// false "expert_required" is safe; a false "general_safe" is not.
const EXPERT_PATTERNS = Object.freeze([
  /\b(?:pesticide|herbicide|fungicide|insecticide)s?\b/i,
  /\bchemical(?:s)?\b/i,
  /\bspray(?:ing)?\b/i,
  /\b\d+\s?(?:ml|g|kg|l|litre|liter|tsp|tbsp|oz)\b/i,
  /\bdosage|dose\b/i,
  /\bactive ingredient\b/i,
]);

/**
 * Classify a single piece of advice.
 *
 * @param {string} text
 * @returns {{ tier: string, expertRequired: boolean, note: string }}
 */
export function classifyAdvice(text) {
  const s = String(text || '');
  if (!s.trim()) {
    return { tier: ADVICE_TIER.GENERAL_SAFE, expertRequired: false, note: '' };
  }
  for (const re of EXPERT_PATTERNS) {
    try {
      if (re.test(s)) {
        return {
          tier:           ADVICE_TIER.EXPERT_REQUIRED,
          expertRequired: true,
          note:           EXPERT_REQUIRED_NOTE,
        };
      }
    } catch { /* skip a bad pattern, keep checking */ }
  }
  return { tier: ADVICE_TIER.GENERAL_SAFE, expertRequired: false, note: '' };
}

/**
 * Partition a list of advice bullets into the two tiers.
 *
 * @param {Array<string>} actions
 * @returns {{ safe: string[], expertRequired: string[], note: string }}
 */
export function partitionAdvice(actions) {
  const safe = [];
  const expertRequired = [];
  for (const a of (Array.isArray(actions) ? actions : [])) {
    const text = String(a || '');
    if (!text.trim()) continue;
    if (classifyAdvice(text).expertRequired) expertRequired.push(text);
    else safe.push(text);
  }
  return {
    safe,
    expertRequired,
    note: expertRequired.length > 0 ? EXPERT_REQUIRED_NOTE : '',
  };
}

const _module = {
  ADVICE_TIER,
  EXPERT_REQUIRED_NOTE,
  classifyAdvice,
  partitionAdvice,
};
export default _module;
