/**
 * treatmentSafetyRules.js — treatment-recommendation safety
 * (Final Readiness §1).
 *
 *   import { validateTreatment, TREATMENT_RULES }
 *     from 'src/core/agronomy/treatmentSafetyRules.js';
 *
 * What it is
 * ──────────
 *   A focused validator for TREATMENT advice. It builds on
 *   `agronomySafetyRules.classifyAdvice` (which decides general-
 *   safe vs expert-required) and adds a CERTAINTY check: a
 *   treatment must never be presented as a guaranteed cure or with
 *   an exact prescription. Chemical treatment always routes the
 *   farmer to a local expert.
 *
 * Strict-rule audit
 *   • Pure. Never throws. No I/O. Builds on agronomySafetyRules —
 *     does not duplicate its classifier.
 */

import { classifyAdvice, EXPERT_REQUIRED_NOTE } from './agronomySafetyRules.js';

/** Human-readable rules — for docs / admin display. */
export const TREATMENT_RULES = Object.freeze([
  'Never present a treatment as a guaranteed cure.',
  'Never give an exact chemical dose — say "follow the label".',
  'Chemical / pesticide treatment must route to a local expert.',
  'Prefer "may help", "can reduce", "monitor after applying".',
]);

// Certainty overclaims specific to treatment advice.
const CERTAINTY_PATTERNS = Object.freeze([
  /\bguaranteed (?:cure|treatment|fix)\b/i,
  /\bwill (?:cure|eliminate|completely (?:stop|remove))\b/i,
  /\bcertain(?:ly)? (?:cure|fix|eliminate)s?\b/i,
  /\b100\s?%\s?(?:effective|cure)\b/i,
  /\bproven cure\b/i,
]);

// Exact-prescription patterns (a number + unit applied to a plant).
const EXACT_DOSE = /\b(?:apply|use|mix)\s+\d+\s?(?:ml|g|kg|l|tsp|tbsp|oz)\b/i;

/**
 * Validate a treatment recommendation.
 *
 * @param {string} text
 * @returns {{ safe:boolean, requiresExpert:boolean,
 *             certaintyOverclaim:boolean, exactDose:boolean,
 *             violations:string[], note:string }}
 */
export function validateTreatment(text) {
  const s = String(text || '');
  const violations = [];

  let certaintyOverclaim = false;
  for (const re of CERTAINTY_PATTERNS) {
    try {
      if (re.test(s)) { certaintyOverclaim = true; break; }
    } catch { /* skip */ }
  }
  if (certaintyOverclaim) violations.push('treatment presented as a guaranteed cure');

  let exactDose = false;
  try { exactDose = EXACT_DOSE.test(s); } catch { exactDose = false; }
  if (exactDose) violations.push('exact chemical dose — should say "follow the label"');

  const requiresExpert = classifyAdvice(s).expertRequired;

  return {
    safe: violations.length === 0,
    requiresExpert,
    certaintyOverclaim,
    exactDose,
    violations,
    note: requiresExpert ? EXPERT_REQUIRED_NOTE : '',
  };
}

const _module = { TREATMENT_RULES, validateTreatment };
export default _module;
