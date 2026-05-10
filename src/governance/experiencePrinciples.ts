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
 */

import {
  GARDEN_PRINCIPLES as _GARDEN_PRINCIPLES,
} from '../principles/gardenPrinciples.js';

export interface ExperiencePrinciple {
  /** kebab-case identifier */
  readonly id: string;
  /** 1..10 */
  readonly n: number;
  readonly title: string;
  /** one-line plain-English summary */
  readonly rule: string;
}

export interface FinalPrinciple {
  readonly id: string;
  readonly title: string;
  readonly rule: string;
}

export const FINAL_PRINCIPLE: Readonly<FinalPrinciple> = Object.freeze({
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
 */
export const EXPERIENCE_PRINCIPLES: ReadonlyArray<ExperiencePrinciple> =
  _GARDEN_PRINCIPLES as ReadonlyArray<ExperiencePrinciple>;

/**
 * Lookup helper. Returns the principle object for a given id,
 * or null when the id is unknown. Pure / never throws.
 */
export function getPrinciple(id: string | null | undefined): ExperiencePrinciple | null {
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
