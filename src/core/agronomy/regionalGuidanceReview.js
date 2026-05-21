/**
 * regionalGuidanceReview.js — region-aware reviewed-status seam.
 *
 *   import { getRegionalReviewStatus, isRegionExpertReviewed }
 *     from 'src/core/agronomy/regionalGuidanceReview.js';
 *
 * What it is
 * ──────────
 *   The category-only `reviewedGuidanceRegistry` says "is this
 *   issue category formally reviewed?". This module narrows the
 *   answer by REGION. A category may be community-pattern in one
 *   region and expert-reviewed in another once an agronomist signs
 *   off locally.
 *
 *   HONEST DEFAULT (do not "fix" this by faking reviews): no
 *   region has signed off yet. Every entry returns `reviewed:
 *   false, source: 'community-pattern'`. This is the SEAM —
 *   flipping a region's category to `reviewed: true` is a real
 *   editorial action.
 *
 * Strict-rule audit
 *   • Pure. Never throws. Frozen data. No I/O.
 */

import { getReviewStatus } from './reviewedGuidanceRegistry.js';

// region → category → { reviewed, source, reviewer?, reviewedAt? }
// Add a real entry when an agronomist signs off:
//   east_africa: { fungal: { reviewed: true, reviewer: 'Dr X', reviewedAt: '...' } }
const REGIONAL_REGISTRY = Object.freeze({
  west_africa:  Object.freeze({}),
  east_africa:  Object.freeze({}),
  central_africa: Object.freeze({}),
  southern_africa: Object.freeze({}),
  north_africa: Object.freeze({}),
  south_asia:   Object.freeze({}),
  southeast_asia: Object.freeze({}),
  unknown:      Object.freeze({}),
});

const UNREVIEWED = Object.freeze({ reviewed: false, source: 'community-pattern' });

/** Normalise a region name to one of the known keys (best-effort). */
function _regionKey(region) {
  const r = String(region || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (REGIONAL_REGISTRY[r]) return r;
  // Light synonyms — broad regional buckets.
  if (/ghana|nigeria|senegal|cote|togo|benin|burkina|mali|liberia|sierra/.test(r)) return 'west_africa';
  if (/kenya|uganda|tanzania|rwanda|burundi|ethiopia|somalia|sudan/.test(r))      return 'east_africa';
  if (/cameroon|gabon|congo|chad|car|equatorial/.test(r))                          return 'central_africa';
  if (/south_africa|botswana|namibia|zimbabwe|zambia|mozambique|angola|malawi/.test(r)) return 'southern_africa';
  if (/morocco|algeria|tunisia|libya|egypt/.test(r))                               return 'north_africa';
  if (/india|pakistan|bangladesh|sri_lanka|nepal/.test(r))                          return 'south_asia';
  if (/indonesia|philippines|vietnam|thailand|malaysia|myanmar/.test(r))            return 'southeast_asia';
  return 'unknown';
}

/**
 * Review status for an issue category in a given region. Falls
 * back to the global registry when the region has no entry, and
 * finally to a safe unreviewed default — the guard never assumes
 * a review exists.
 *
 * @param {string} region
 * @param {string} category
 * @returns {{ reviewed:boolean, source:string, region:string }}
 */
export function getRegionalReviewStatus(region, category) {
  try {
    const r = _regionKey(region);
    const cat = String(category || '').toLowerCase();
    const regionMap = REGIONAL_REGISTRY[r] || REGIONAL_REGISTRY.unknown;
    const regionEntry = regionMap && regionMap[cat];
    if (regionEntry && regionEntry.reviewed === true) {
      return { ...regionEntry, region: r };
    }
    // Fall back to the category-only global registry.
    const global = getReviewStatus(cat);
    return { ...(global || UNREVIEWED), region: r };
  } catch {
    return { ...UNREVIEWED, region: 'unknown' };
  }
}

/** Whether the guidance has been formally reviewed in this region. */
export function isRegionExpertReviewed(region, category) {
  return getRegionalReviewStatus(region, category).reviewed === true;
}

/** The list of known region keys (for admin UI). */
export const REGION_KEYS = Object.freeze(Object.keys(REGIONAL_REGISTRY));

const _module = {
  REGION_KEYS,
  getRegionalReviewStatus,
  isRegionExpertReviewed,
};
export default _module;
