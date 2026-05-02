/**
 * confidenceTiers.js — bridge between numeric ML scores and the
 * three-tier output policy (spec §1).
 *
 *   numeric  ≥ 0.85   → 'high'    (allowSpecificName)
 *   numeric  ≥ 0.60   → 'medium'  (allowTop3)
 *   numeric  <  0.60  → 'low'     (allowCategoryOnly)
 *
 * Also exposes a `downgrade(tier)` helper used by the
 * verification step (spec §2): when a verification check
 * mismatches the predicted issue, drop the tier by one level.
 *
 * Strict-rule audit
 *   * Pure functions. No I/O. Never throws.
 *   * Tolerant of mixed inputs — accepts a numeric score, a
 *     tier string ('low'|'medium'|'high'), or null.
 *   * Idempotent: downgrade('low') is still 'low'.
 */

export const TIER_HIGH   = 'high';
export const TIER_MEDIUM = 'medium';
export const TIER_LOW    = 'low';

export const THRESHOLDS = Object.freeze({
  HIGH:   0.85,
  MEDIUM: 0.60,
});

const TIER_ORDER = [TIER_LOW, TIER_MEDIUM, TIER_HIGH];

/**
 * tierFromScore(numericOrTier) → 'low' | 'medium' | 'high'
 *
 * Accepts:
 *   • Number 0..1            → bucket via thresholds
 *   • String 'low'|'medium'|'high' → pass through
 *   • Anything else / null   → 'low' (safe default)
 */
export function tierFromScore(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    if (input >= THRESHOLDS.HIGH)   return TIER_HIGH;
    if (input >= THRESHOLDS.MEDIUM) return TIER_MEDIUM;
    return TIER_LOW;
  }
  const s = String(input || '').toLowerCase();
  if (s === 'high' || s === 'medium' || s === 'low') return s;
  return TIER_LOW;
}

/** scoreFromTier — reverse mapping for clients that want a score. */
export function scoreFromTier(tier) {
  if (tier === TIER_HIGH)   return 0.90;
  if (tier === TIER_MEDIUM) return 0.70;
  return 0.40;
}

/**
 * downgrade(tier, [steps=1]) — drop the tier by N levels.
 * Bounded — downgrade('low') stays 'low'.
 */
export function downgrade(tier, steps = 1) {
  const idx = TIER_ORDER.indexOf(tierFromScore(tier));
  if (idx < 0) return TIER_LOW;
  const next = Math.max(0, idx - Math.max(0, Number(steps) || 0));
  return TIER_ORDER[next];
}

/**
 * tierPolicy(tier) → output-rule flags for the analyzer (spec §3).
 *
 *   high   → { allowSpecificName: true,  allowTop3: false, categoryOnly: false }
 *   medium → { allowSpecificName: false, allowTop3: true,  categoryOnly: false }
 *   low    → { allowSpecificName: false, allowTop3: false, categoryOnly: true }
 */
export function tierPolicy(tier) {
  const t = tierFromScore(tier);
  if (t === TIER_HIGH) {
    return {
      tier: TIER_HIGH,
      allowSpecificName: true,
      allowTop3:         false,
      categoryOnly:      false,
    };
  }
  if (t === TIER_MEDIUM) {
    return {
      tier: TIER_MEDIUM,
      allowSpecificName: false,
      allowTop3:         true,
      categoryOnly:      false,
    };
  }
  return {
    tier: TIER_LOW,
    allowSpecificName: false,
    allowTop3:         false,
    categoryOnly:      true,
  };
}

export const _internal = Object.freeze({ TIER_ORDER });
export default tierFromScore;
