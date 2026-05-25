/**
 * treatmentSafetyLayer.js — gating rules for any treatment
 * suggestion that touches chemicals.
 *
 *   import {
 *     classifyTreatment, gateTreatmentSuggestion, TREATMENT_CLASS,
 *   } from 'src/core/agronomy/treatmentSafetyLayer.js';
 *
 *   const g = gateTreatmentSuggestion({
 *     suggestion: 'apply copper fungicide',
 *     verifiedSource: false,
 *   });
 *   // g.allowed → false (chemical, unverified)
 *   // g.requiresExpertReview → true
 *   // g.publicMessage → { key, fallback }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A read-only safety filter every "what to do" envelope passes
 *   through before reaching the surface. The rules:
 *
 *     1. Cultural / operational hygiene → ALWAYS allowed
 *        (watering timing, mulch, pruning, airflow, hand-picking
 *        pests, soil testing).
 *     2. Organic / OMRI-listed inputs → allowed with the
 *        "follow label" disclaimer.
 *     3. Chemical / pesticide / fungicide / herbicide → BLOCKED
 *        unless the suggestion came from a verifiedSource AND
 *        the region's regulations have been wired into a
 *        per-region allowlist (none today). Until then, every
 *        chemical suggestion routes to the "consult a local
 *        agricultural expert" envelope.
 *
 *   It is NOT a treatment recommender — it filters someone else's
 *   suggestion. The wider Farroway agronomy posture is "we don't
 *   prescribe chemicals" which this layer enforces in code.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Default-fail-safe: an unknown input falls into the chemical
 *     branch and is blocked.
 */

export const TREATMENT_CLASS = Object.freeze({
  CULTURAL:   'cultural',
  ORGANIC:    'organic',
  CHEMICAL:   'chemical',
  UNKNOWN:    'unknown',
});

// Match order: organic check runs BEFORE chemical so "neem oil"
// isn't misclassified by a generic verb like "apply". Cultural
// runs last and uses longer-form keywords (no 3-letter
// substrings that catch arbitrary words).
const _CULTURAL_KEYWORDS = [
  'watering', 'irrigation', 'mulch', 'compost', 'manure',
  'pruning', 'airflow', 'spacing', 'thinning',
  'hand-pick', 'handpick', 'sanitation', 'rotation',
  'cover crop', 'soil test', 'soil testing', 'wind break',
  'stake', 'trellis', 'avoid overhead', 'base of the plant',
  'monitor', 'inspect', 'observe', 'walk the row',
];

const _ORGANIC_KEYWORDS = [
  'neem', 'compost tea', 'kaolin', 'spinosad', 'bacillus thuringiensis',
  ' bt ', 'soap spray', 'horticultural soap', 'biological control',
  'beneficial insects', 'predator', 'omri',
];

const _CHEMICAL_KEYWORDS = [
  'pesticide', 'insecticide', 'fungicide', 'herbicide', 'miticide',
  'copper', 'mancozeb', 'chlorothalonil', 'imidacloprid', 'glyphosate',
  'lambda-cyhalothrin', 'paraquat', 'malathion', 'spray with',
  'chemical', 'fertilizer', 'fertiliser', 'urea', 'ammonium',
];

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

function _matches(text, list) {
  const lower = String(text || '').toLowerCase();
  for (const kw of list) if (lower.includes(kw)) return kw;
  return null;
}

/**
 * Classify a free-text suggestion. Order: chemical (most restrictive)
 * → organic → cultural. An unmatched suggestion is UNKNOWN and
 * treated as chemical by `gateTreatmentSuggestion` (fail-safe).
 *
 * @param {string} suggestion
 * @returns {{ class: string, matched: string|null }}
 */
export function classifyTreatment(suggestion) {
  try {
    if (!suggestion || typeof suggestion !== 'string') {
      return { class: TREATMENT_CLASS.UNKNOWN, matched: null };
    }
    // Order: organic-specific names like "neem" win over generic
    // chemical-list words like "spray with"; chemical wins over
    // cultural (cultural runs last so its longer-form keywords
    // don't shadow more specific matches).
    const org = _matches(suggestion, _ORGANIC_KEYWORDS);
    if (org) return { class: TREATMENT_CLASS.ORGANIC, matched: org };
    const chem = _matches(suggestion, _CHEMICAL_KEYWORDS);
    if (chem) return { class: TREATMENT_CLASS.CHEMICAL, matched: chem };
    const cul = _matches(suggestion, _CULTURAL_KEYWORDS);
    if (cul) return { class: TREATMENT_CLASS.CULTURAL, matched: cul };
    return { class: TREATMENT_CLASS.UNKNOWN, matched: null };
  } catch { return { class: TREATMENT_CLASS.UNKNOWN, matched: null }; }
}

/**
 * Gate a suggestion. Returns:
 *   {
 *     allowed: boolean,                       // safe to surface as-is
 *     class: TREATMENT_CLASS,
 *     requiresExpertReview: boolean,
 *     localRegulationWarning: boolean,
 *     publicMessage: { key, fallback }        // the surface always renders THIS
 *   }
 *
 * @param {{ suggestion: string, verifiedSource?: boolean, region?: string }} input
 */
export function gateTreatmentSuggestion(input) {
  try {
    const c = (input && typeof input === 'object') ? input : {};
    const verified = !!c.verifiedSource;
    const { class: cls, matched } = classifyTreatment(c.suggestion);

    if (cls === TREATMENT_CLASS.CULTURAL) {
      return {
        allowed:                true,
        class:                  cls,
        requiresExpertReview:   false,
        localRegulationWarning: false,
        publicMessage: _msg('agronomy.safe.cultural',
          'Cultural / operational step — safe to do today.'),
      };
    }
    if (cls === TREATMENT_CLASS.ORGANIC) {
      return {
        allowed:                true,
        class:                  cls,
        requiresExpertReview:   false,
        localRegulationWarning: true,
        publicMessage: _msg('agronomy.organic.followLabel',
          'Organic input — follow product label and check local regulations.'),
      };
    }
    // CHEMICAL or UNKNOWN — block unless verified.
    if (cls === TREATMENT_CLASS.CHEMICAL || cls === TREATMENT_CLASS.UNKNOWN) {
      if (verified) {
        return {
          allowed:                true,
          class:                  cls,
          requiresExpertReview:   true,
          localRegulationWarning: true,
          publicMessage: _msg('agronomy.chemical.verifiedConsult',
            'Verified guidance — confirm with a local expert and follow label + local rules.'),
          matchedKeyword:         matched,
        };
      }
      return {
        allowed:                false,
        class:                  cls,
        requiresExpertReview:   true,
        localRegulationWarning: true,
        publicMessage: _msg('agronomy.chemical.consultExpert',
          'Consult a local agricultural expert before applying chemical treatments.'),
        matchedKeyword:         matched,
      };
    }
    return {
      allowed: false,
      class:   TREATMENT_CLASS.UNKNOWN,
      requiresExpertReview: true,
      localRegulationWarning: true,
      publicMessage: _msg('agronomy.chemical.consultExpert',
        'Consult a local agricultural expert before applying chemical treatments.'),
    };
  } catch {
    return {
      allowed: false,
      class:   TREATMENT_CLASS.UNKNOWN,
      requiresExpertReview: true,
      localRegulationWarning: true,
      publicMessage: _msg('agronomy.chemical.consultExpert',
        'Consult a local agricultural expert before applying chemical treatments.'),
    };
  }
}

const _module = { TREATMENT_CLASS, classifyTreatment, gateTreatmentSuggestion };
export default _module;
