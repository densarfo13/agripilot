/**
 * reviewedGuidanceRegistry.js — the agronomist-review SEAM (spec §1).
 *
 *   import { getReviewStatus, isExpertReviewed }
 *     from 'src/core/agronomy/reviewedGuidanceRegistry.js';
 *
 * What it is
 * ──────────
 *   A registry that records which scan-issue categories have been
 *   reviewed by a qualified agronomist.
 *
 * HONEST DEFAULT (do not "fix" this by faking reviews)
 *   In the pilot, NOTHING is formally expert-reviewed — every
 *   category's guidance is community / pattern based. So every
 *   entry is `reviewed: false, source: 'community-pattern'`. This
 *   module is the SEAM: when an agronomist signs off on a category,
 *   flip that entry to `reviewed: true` with the reviewer + date,
 *   and the result UI can then show an honest "reviewed" badge.
 *   Until then the UI must keep using "possible / likely / needs
 *   review" wording (see confidenceLanguage.js).
 *
 * Strict-rule audit
 *   • Pure. Never throws. Frozen data. No I/O.
 */

// category → { reviewed, source, reviewer?, reviewedAt? }
// Categories mirror scanResultPolicy.js CATEGORY taxonomy.
const REGISTRY = Object.freeze({
  fungal:     Object.freeze({ reviewed: false, source: 'community-pattern' }),
  pest:       Object.freeze({ reviewed: false, source: 'community-pattern' }),
  water:      Object.freeze({ reviewed: false, source: 'community-pattern' }),
  heat:       Object.freeze({ reviewed: false, source: 'community-pattern' }),
  nutrient:   Object.freeze({ reviewed: false, source: 'community-pattern' }),
  transplant: Object.freeze({ reviewed: false, source: 'community-pattern' }),
  healthy:    Object.freeze({ reviewed: false, source: 'community-pattern' }),
  unknown:    Object.freeze({ reviewed: false, source: 'community-pattern' }),
});

const UNKNOWN_ENTRY = Object.freeze({ reviewed: false, source: 'community-pattern' });

/**
 * Review status for an issue category. Unknown categories return a
 * safe unreviewed entry — the guard never assumes a review exists.
 *
 * @param {string} category
 * @returns {{ reviewed: boolean, source: string }}
 */
export function getReviewStatus(category) {
  const key = String(category || '').toLowerCase();
  return REGISTRY[key] || UNKNOWN_ENTRY;
}

/** Whether a category's guidance has been formally agronomist-reviewed. */
export function isExpertReviewed(category) {
  return getReviewStatus(category).reviewed === true;
}

/** The list of categories that ARE reviewed (currently empty — honest). */
export const REVIEWED_CATEGORIES = Object.freeze(
  Object.keys(REGISTRY).filter((k) => REGISTRY[k].reviewed === true),
);

// ── Reviewed guidance content (v2 §1) ─────────────────────────
//
// Confidence-aware, conservative guidance per category. Every
// entry is community/pattern-based (see REGISTRY above) — none is
// formally agronomist-signed-off yet, so each carries
// `reviewStatus: 'expert_review_recommended'`. The wording never
// claims a guaranteed diagnosis and never names a pesticide or
// dosage — chemical decisions are explicitly deferred to a local
// expert (see agronomySafetyRules.js).
const GUIDANCE = Object.freeze({
  fungal: Object.freeze({
    summary:  'A fungal stress pattern is possible. Treat this as a guide, not a final diagnosis.',
    watering: 'Avoid wetting the leaves; water at the base, earlier in the day.',
    nutrient: 'Do not over-feed a stressed plant — keep feeding steady, not heavy.',
    stress:   'Improve airflow and remove badly affected leaves to slow any spread.',
  }),
  pest: Object.freeze({
    summary:  'Possible pest damage. Confirm by checking under leaves before acting.',
    watering: 'Keep watering normal — water stress can mask or worsen pest signs.',
    nutrient: 'Maintain steady feeding so the plant can recover from any damage.',
    stress:   'Remove visibly infested leaves; check nearby plants over 2–3 days.',
  }),
  water: Object.freeze({
    summary:  'Possible water stress. Check the soil before changing your routine.',
    watering: 'Water deeply but less often; let the top layer dry between waterings.',
    nutrient: 'Hold off on feeding until the watering pattern is stable again.',
    stress:   'Add mulch or light shade to reduce moisture loss in hot weather.',
  }),
  heat: Object.freeze({
    summary:  'Possible heat stress. Wilting in the afternoon alone is often normal.',
    watering: 'Water early morning or evening; midday water is mostly lost to heat.',
    nutrient: 'Avoid heavy feeding during a heat spell — it adds stress.',
    stress:   'Provide afternoon shade for young or recently moved plants.',
  }),
  nutrient: Object.freeze({
    summary:  'Possible nutrient deficiency. The leaf pattern is a clue, not proof.',
    watering: 'Keep watering even — uneven watering mimics nutrient problems.',
    nutrient: 'Feed lightly and consistently; note which leaves change first.',
    stress:   'Recheck in a week — improvement confirms the cause more than guessing.',
  }),
  transplant: Object.freeze({
    summary:  'Possible transplant shock. This is common and usually temporary.',
    watering: 'Keep the soil evenly moist while roots settle — do not flood it.',
    nutrient: 'Wait until new growth appears before feeding.',
    stress:   'Shield from strong sun and wind for the first few days.',
  }),
  healthy: Object.freeze({
    summary:  'Looks healthy. Keep up the current routine.',
    watering: 'Continue your normal watering schedule.',
    nutrient: 'Continue steady, moderate feeding.',
    stress:   'No action needed — keep monitoring as the season changes.',
  }),
  unknown: Object.freeze({
    summary:  'Needs a closer look — the photo was not clear enough to say.',
    watering: 'Keep your normal watering routine while you observe.',
    nutrient: 'Keep feeding steady; do not change things on a guess.',
    stress:   'Take another photo in good light tomorrow and compare.',
  }),
});

const UNKNOWN_GUIDANCE = GUIDANCE.unknown;

/**
 * Reviewed guidance for an issue category. Always returns a safe,
 * confidence-aware object; unknown categories fall through to the
 * "needs a closer look" set. The `reviewStatus` is honest —
 * 'expert_review_recommended' until an agronomist signs off.
 *
 * @param {string} category
 * @returns {{ summary:string, watering:string, nutrient:string,
 *             stress:string, reviewStatus:string }}
 */
export function getReviewedGuidance(category) {
  const key = String(category || '').toLowerCase();
  const g = GUIDANCE[key] || UNKNOWN_GUIDANCE;
  return {
    summary:      g.summary,
    watering:     g.watering,
    nutrient:     g.nutrient,
    stress:       g.stress,
    reviewStatus: isExpertReviewed(key) ? 'expert_reviewed' : 'expert_review_recommended',
  };
}

/** Categories that have reviewed guidance content available. */
export const GUIDANCE_CATEGORIES = Object.freeze(Object.keys(GUIDANCE));

const _module = {
  getReviewStatus,
  isExpertReviewed,
  getReviewedGuidance,
  REVIEWED_CATEGORIES,
  GUIDANCE_CATEGORIES,
};
export default _module;
