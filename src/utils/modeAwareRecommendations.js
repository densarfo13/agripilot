/**
 * modeAwareRecommendations.js — filter + re-rank crop recommendations
 * for Backyard vs Farm mode.
 *
 *   getBackyardCropPool()
 *     Curated set of backyard-friendly crops: short-cycle, small-
 *     footprint, container / raised-bed tolerant. The recommendation
 *     view for backyard users is drawn from this set first.
 *
 *   getFarmCropPool()
 *     Everything-else pool. For backyard mode we subtract this from
 *     what the scoring engine returns so broad-acre crops never lead.
 *
 *   getModeAwareRecommendations(buckets, mode)
 *     Takes the {bestMatch, alsoConsider, notRecommendedNow} shape
 *     the scoring engine emits and, in backyard mode:
 *       - demotes crops not in BACKYARD_POOL out of bestMatch
 *       - pushes commercial-heavy crops straight to notRecommendedNow
 *       - caps bestMatch at 4 so the UI stays uncluttered
 *     Farm mode passes through unchanged.
 *
 * Pure — no I/O, no hooks. Tests import directly.
 */

export const BACKYARD_POOL = new Set([
  'tomato', 'pepper', 'lettuce', 'spinach', 'herbs',
  'onion', 'potato', 'cucumber', 'okra', 'beans',
  'bush_beans', 'carrot', 'radish', 'kale', 'zucchini',
  'squash', 'eggplant', 'sweet_potato', 'green_onion',
  'collards', 'swiss_chard', 'strawberry', 'peas',
]);

// Broad-acre / commercial-first crops — suppressed as top
// recommendations for backyard growers.
export const COMMERCIAL_ONLY = new Set([
  'cotton', 'sorghum', 'maize', 'corn', 'soybean', 'wheat',
  'rice', 'barley', 'oats', 'sunflower', 'alfalfa',
  'cassava', 'cocoa', 'coffee', 'sugarcane',
  'almonds', 'pecan',
]);

const BACKYARD_CAP = 4;

export function getBackyardCropPool() {
  return new Set(BACKYARD_POOL);
}

export function getFarmCropPool() {
  // Farm mode uses everything the scoring engine knows about — no
  // subtraction. Exported as a predicate-friendly identity so
  // callers that want to diff against it have one API.
  return null;
}

export function isBackyardCrop(cropKey) {
  return BACKYARD_POOL.has(String(cropKey || '').toLowerCase());
}

export function isCommercialOnlyCrop(cropKey) {
  return COMMERCIAL_ONLY.has(String(cropKey || '').toLowerCase());
}

/**
 * Applies the mode filter to a {bestMatch, alsoConsider,
 * notRecommendedNow} payload from scoreAllCrops.
 *
 * @param {Object} buckets
 * @param {'backyard'|'farm'} mode
 * @returns {Object} same shape, re-bucketed
 */
export function getModeAwareRecommendations(buckets = {}, mode = 'farm') {
  const { bestMatch = [], alsoConsider = [], notRecommendedNow = [] } = buckets;
  if (mode !== 'backyard') {
    return { bestMatch, alsoConsider, notRecommendedNow };
  }

  const demoteReason = 'recommendation.warning.notBackyardFriendly';
  const bestOut = [];
  const alsoOut = [];
  const notOut = [...notRecommendedNow];

  const visit = (c, sourceBucket) => {
    if (!c) return;
    const key = String(c.crop || '').toLowerCase();
    // Commercial-only crops are always pushed to notRecommended.
    if (COMMERCIAL_ONLY.has(key)) {
      notOut.push({ ...c, modeDemoted: true, modeDemoteReasonKey: demoteReason });
      return;
    }
    // Backyard-friendly crops stay in their origin bucket.
    if (BACKYARD_POOL.has(key)) {
      if (sourceBucket === 'bestMatch')   bestOut.push(c);
      else                                alsoOut.push(c);
      return;
    }
    // Everything else falls out of bestMatch to alsoConsider, and
    // out of alsoConsider stays where it is (still visible).
    if (sourceBucket === 'bestMatch') alsoOut.push({ ...c, modeDemoted: true });
    else                              alsoOut.push(c);
  };

  for (const c of bestMatch)    visit(c, 'bestMatch');
  for (const c of alsoConsider) visit(c, 'alsoConsider');

  return {
    bestMatch:         bestOut.slice(0, BACKYARD_CAP),
    alsoConsider:      alsoOut.slice(0, 6),
    notRecommendedNow: notOut.slice(0, 6),
  };
}

export const _internal = { BACKYARD_CAP };
