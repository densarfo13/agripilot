/**
 * experiencePrinciples — the canonical product-philosophy table.
 *
 * Core permanent rule (FINAL_PRINCIPLE):
 *   "The app should become more intelligent internally while
 *    appearing simpler and calmer externally."
 *
 * The 10 numbered principles below are the locked product spec.
 * Every governance module in `src/governance/` enforces a slice
 * of these; each rule entry is tagged with the principle id it
 * derives from so audits can group violations by intent.
 *
 * Strict-rule audit
 *   • Pure data. Frozen. No I/O. No React.
 *   • Re-exports the existing `gardenPrinciples.js` constants for
 *     back-compat with the CI guard (scripts/ci/check-garden-
 *     principles.mjs) until that path is migrated to read from
 *     this directory directly.
 *
 * @typedef {object} ExperiencePrinciple
 * @property {string} id        kebab-case identifier
 * @property {number} n         1..10
 * @property {string} title
 * @property {string} rule      one-line plain-English summary
 */

import {
  GARDEN_PRINCIPLES as _GARDEN_PRINCIPLES,
} from '../principles/gardenPrinciples.js';

export const FINAL_PRINCIPLE = Object.freeze({
  id:    'intelligence-internal-simplicity-external',
  title: 'Intelligence inside, simplicity outside',
  rule:  'The app should become more intelligent internally while '
       + 'appearing simpler and calmer externally.',
});

/**
 * The full 10-principle list. Sourced from the existing
 * gardenPrinciples module so there is exactly ONE definition of
 * the spec; this file presents it under a governance-shaped name
 * + adds the FINAL_PRINCIPLE that the spec mandates.
 *
 * @type {ReadonlyArray<ExperiencePrinciple>}
 */
export const EXPERIENCE_PRINCIPLES = _GARDEN_PRINCIPLES;

/**
 * Lookup helper. Returns the principle object for a given id,
 * or null when the id is unknown. Pure / never throws.
 */
export function getPrinciple(id) {
  if (!id) return null;
  for (const p of EXPERIENCE_PRINCIPLES) {
    if (p.id === id) return p;
  }
  return null;
}

export default Object.freeze({
  EXPERIENCE_PRINCIPLES,
  FINAL_PRINCIPLE,
  getPrinciple,
});
