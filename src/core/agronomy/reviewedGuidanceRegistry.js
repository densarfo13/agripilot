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

const _module = {
  getReviewStatus,
  isExpertReviewed,
  REVIEWED_CATEGORIES,
};
export default _module;
