/**
 * confidenceAwareWording.js — picks the i18n key the UI should
 * use for the recommendation header based on optimization
 * eligibility AND confidence level.
 *
 * Two gates matter:
 *
 *   1. Is the optimization ELIGIBLE to have nudged the ranking
 *      at all? If no family cleared threshold, we're on base
 *      rules — we must NOT pitch "Best crops".
 *
 *   2. What's the CONFIDENCE tier of the underlying base scoring?
 *      High → "Best crops for your area"
 *      Medium → "Suggested crops for your area"
 *      Low (or low-support region) → "Recommendations are limited"
 *
 * Output shape:
 *   {
 *     headerKey,          // the i18n key the caller passes to t()
 *     subheaderKey,
 *     tier,               // 'high' | 'medium' | 'low'
 *     fallbackHeader,     // English fallback
 *     fallbackSubheader,  // English fallback
 *     isLowSignal,        // true when optimization couldn't fire
 *   }
 *
 * The keys align with the `confidenceTranslations.js` overlay
 * already in the codebase so no new translation work is needed.
 */

const HIGH_HEADER = {
  headerKey:    'recommendations.header.high',
  subheaderKey: 'recommendations.sub.high',
  tier:         'high',
  fallbackHeader:    'Best crops for your area',
  fallbackSubheader: 'Picked from crops that do well where you are',
};
const MEDIUM_HEADER = {
  headerKey:    'recommendations.header.medium',
  subheaderKey: 'recommendations.sub.medium',
  tier:         'medium',
  fallbackHeader:    'Suggested crops for your area',
  fallbackSubheader: 'A starting shortlist \u2014 adjust to your plot',
};
const LOW_HEADER = {
  headerKey:    'recommendations.header.low',
  subheaderKey: 'recommendations.sub.low',
  tier:         'low',
  fallbackHeader:    'Recommendations are limited in your region',
  fallbackSubheader: 'We only have partial data for your region \u2014 please review carefully',
};

/**
 * getConfidenceAwareWording — combine eligibility + confidence
 * tier into a wording pick.
 *
 * @param {object} input
 * @param {object} [input.eligibility]   — output of getOptimizationEligibility
 * @param {'high'|'medium'|'low'} [input.confidenceLevel]
 * @param {'full'|'partial'|'limited'} [input.supportTier]
 */
export function getConfidenceAwareWording({
  eligibility = null,
  confidenceLevel = null,
  supportTier = null,
} = {}) {
  const lowSignal = isLowSignal(eligibility);
  const limited   = String(supportTier || '').toLowerCase() === 'limited';

  // Any of these collapse to the conservative copy. We never
  // promise "Best crops" when our evidence is thin.
  if (lowSignal || limited) {
    return { ...LOW_HEADER, isLowSignal: true };
  }

  switch (String(confidenceLevel || '').toLowerCase()) {
    case 'high':   return { ...HIGH_HEADER,   isLowSignal: false };
    case 'medium': return { ...MEDIUM_HEADER, isLowSignal: false };
    default:       return { ...LOW_HEADER,    isLowSignal: true };
  }
}

/**
 * isLowSignal — true when the eligibility record reports no
 * family cleared its threshold. Returns true for a null input
 * too, so callers don't need a separate null check.
 */
export function isLowSignal(eligibility) {
  if (!eligibility) return true;
  return !(eligibility.recommendation
        || eligibility.harvest
        || eligibility.task
        || eligibility.listing);
}

/**
 * resolveWording — small helper that takes the wording pick +
 * a translation function and returns rendered strings. If t()
 * echoes the key back (missing translation), we fall back to
 * the English default we ship.
 */
export function resolveWording(pick, t = null) {
  if (!pick) return null;
  const header = lookup(t, pick.headerKey, pick.fallbackHeader);
  const sub    = lookup(t, pick.subheaderKey, pick.fallbackSubheader);
  return { header, subheader: sub, tier: pick.tier, isLowSignal: !!pick.isLowSignal };
}

function lookup(t, key, fallback) {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  if (!v || v === key) return fallback;
  return v;
}

export const _internal = { HIGH_HEADER, MEDIUM_HEADER, LOW_HEADER };
