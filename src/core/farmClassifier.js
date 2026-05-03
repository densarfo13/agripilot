/**
 * farmClassifier.js — derive `autoFarmClass` from
 * (activeExperience, sizeInAcres, growingSetup). Spec: "Fix
 * Farroway Data Model Properly", §2.
 *
 *   import { classifyGrowingContext } from '../core/farmClassifier.js';
 *
 *   classifyGrowingContext({ activeExperience: 'farm',  sizeInAcres: 0.5  }) → 'small_farm'
 *   classifyGrowingContext({ activeExperience: 'farm',  sizeInAcres: 4    }) → 'small_farm'
 *   classifyGrowingContext({ activeExperience: 'farm',  sizeInAcres: 25   }) → 'medium_farm'
 *   classifyGrowingContext({ activeExperience: 'farm',  sizeInAcres: 100  }) → 'large_farm'
 *   classifyGrowingContext({ activeExperience: 'farm',  sizeInAcres: null }) → 'unknown_farm'
 *   classifyGrowingContext({ activeExperience: 'garden' })                   → 'garden'
 *
 * Why the engine reads autoFarmClass and NOT `farmType`
 * ─────────────────────────────────────────────────────
 * Spec §7: "Decision logic must use autoFarmClass, not manual
 * farmType." Manual farm-type strings have drifted across the
 * codebase ('backyard', 'small_farm', 'home', 'lt1', '1to5', etc.)
 * and a user can pick the wrong tier. The classifier is the SINGLE
 * place the engine consults, derived from numeric size, so a 100-
 * acre row tagged "small farm" by a confused user still drives the
 * large-farm task plan.
 *
 * Strict-rule audit
 *   • Pure function. No I/O, no side effects.
 *   • Never throws. Bad input collapses to 'unknown_farm' for
 *     activeExperience='farm' or to 'garden' for explicit garden.
 *   • Idempotent. Same input → same output, no random tiebreaks.
 */

/**
 * Canonical class strings the rest of the codebase reads.
 * Keep in sync with:
 *   • src/core/contextValidation.js — drives the warning copy
 *   • src/core/dailyPlanEngine.js   — maps to small/medium/large
 *     task rule keys
 *   • src/store/farrowayLocal.js    — written onto every farm row
 */
export const FARM_CLASSES = Object.freeze([
  'garden',
  'small_farm',
  'medium_farm',
  'large_farm',
  'unknown_farm',
]);

/**
 * Spec §2 thresholds (all in acres):
 *
 *   < 1           → small_farm     (sub-acre commercial / community)
 *   >= 1 && <= 5  → small_farm     (typical smallholder)
 *   > 5  && <= 50 → medium_farm
 *   > 50          → large_farm
 *
 * Garden short-circuits early — gardens never get a farm class
 * regardless of size. (A garden that grew to 2 acres should
 * have been re-classified as a farm at the validation layer; the
 * classifier respects the activeExperience the caller passes in.)
 */
export const FARM_CLASS_THRESHOLDS = Object.freeze({
  smallMaxAcres:  5,
  mediumMaxAcres: 50,
});

/**
 * classifyGrowingContext({ activeExperience, sizeInAcres, growingSetup }) → string
 *
 * @param {object} input
 * @param {string} input.activeExperience  'garden' | 'farm' (any other value
 *                                          is treated as 'farm' — the safer
 *                                          fallback per spec §7).
 * @param {number} [input.sizeInAcres]      pre-converted size in acres (use
 *                                          unitUtils.normalizeSizeInput first).
 * @param {string} [input.growingSetup]     reserved for future garden-class
 *                                          variants; currently advisory only.
 * @returns {'garden'|'small_farm'|'medium_farm'|'large_farm'|'unknown_farm'}
 *
 * Spec rule: if activeExperience === 'farm' but the row's farmType
 * is 'backyard', the caller MUST already have rewritten farmType
 * before this point (contextValidation.autoCorrectFarmType handles
 * that). The classifier itself only reads activeExperience + size.
 */
export function classifyGrowingContext(input = {}) {
  const exp = String(input.activeExperience || '').toLowerCase();
  if (exp === 'garden') return 'garden';

  // Anything other than 'garden' rolls up to the farm tier. Default
  // 'unknown_farm' on missing/invalid size so the engine takes the
  // safe-general-guidance path (spec §8).
  const acres = Number(input.sizeInAcres);
  if (!Number.isFinite(acres) || acres <= 0) return 'unknown_farm';

  if (acres <= FARM_CLASS_THRESHOLDS.smallMaxAcres)  return 'small_farm';
  if (acres <= FARM_CLASS_THRESHOLDS.mediumMaxAcres) return 'medium_farm';
  return 'large_farm';
}

/**
 * autoFarmClassToEngineKey(cls) → 'small'|'medium'|'large'|'unknown'
 *
 * Tiny adapter for the legacy daily-plan engine which keys its
 * FARM_SIZE_RULES by the bare 'small/medium/large' words. Keeps the
 * rule table stable — we don't have to rewrite the engine just to
 * thread the spec-shaped class through. Garden short-circuits to
 * 'unknown' because garden plans don't read farm-size rules.
 */
export function autoFarmClassToEngineKey(cls) {
  switch (String(cls || '').toLowerCase()) {
    case 'small_farm':   return 'small';
    case 'medium_farm':  return 'medium';
    case 'large_farm':   return 'large';
    case 'unknown_farm': return 'unknown';
    case 'garden':       return 'unknown';
    default:             return 'unknown';
  }
}

export default {
  FARM_CLASSES,
  FARM_CLASS_THRESHOLDS,
  classifyGrowingContext,
  autoFarmClassToEngineKey,
};
