/**
 * recommendationEngine.js — rules-based crop recommendation keyed on
 * a regionProfile (see src/lib/location/regionProfile.js).
 *
 *   getBestCrops({ regionProfile }) → {
 *     best:         'maize' | 'cassava' | 'wheat' | 'sorghum' | … ,
 *     alternatives: string[],
 *     reason:       string,           // i18n key OR short English
 *     reasonKey:    string,           // stable i18n key
 *     source:       'climate' | 'season' | 'fallback',
 *   }
 *
 * Rules (spec §2):
 *   • tropical  → cassava, maize, plantain
 *   • temperate → wheat, corn, potato (we store 'maize' for 'corn'
 *                 to match the crop catalog)
 *   • arid      → sorghum, millet
 *   • dry season  → prefer drought-resistant (sorghum, millet, cassava)
 *   • wet season  → prefer water-tolerant   (rice, maize, cassava)
 *
 * Pure. Frozen output.
 */

const TROPICAL = Object.freeze(['cassava', 'maize', 'plantain']);
const TEMPERATE = Object.freeze(['wheat', 'maize', 'potato']);
const ARID      = Object.freeze(['sorghum', 'millet']);

const DROUGHT_RESISTANT = Object.freeze(['sorghum', 'millet', 'cassava']);
const WATER_TOLERANT    = Object.freeze(['rice', 'maize', 'cassava']);

const SAFE_FALLBACK = Object.freeze(['maize', 'beans']);

/**
 * Small union + uniqueness helper — keeps the list order stable
 * (first occurrence wins) so recommendation output is deterministic.
 */
function uniq(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item) continue;
    const k = String(item).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/**
 * Season biases the base climate list toward hardier or thirstier
 * crops. Dry season promotes drought-resistant choices to the front;
 * wet season promotes water-tolerant ones. Other seasons pass through.
 */
function reorderForSeason(base, season) {
  if (season === 'dry') {
    return uniq([...DROUGHT_RESISTANT, ...base]);
  }
  if (season === 'wet') {
    return uniq([...WATER_TOLERANT, ...base]);
  }
  return uniq(base);
}

/**
 * getBestCrops — main entry. The caller passes the output of
 * getRegionProfile. Missing profile → safe fallback.
 */
export function getBestCrops({ regionProfile } = {}) {
  if (!regionProfile) {
    return Object.freeze({
      best:         SAFE_FALLBACK[0],
      alternatives: Object.freeze(SAFE_FALLBACK.slice(1)),
      reason:       'No region profile — using safe defaults.',
      reasonKey:    'crops.reason.fallback',
      source:       'fallback',
    });
  }

  const { climate, season } = regionProfile;

  let base;
  let source = 'climate';
  let reasonKey;
  if (climate === 'tropical') {
    base = TROPICAL;
    reasonKey = 'crops.reason.tropical';
  } else if (climate === 'arid') {
    base = ARID;
    reasonKey = 'crops.reason.arid';
  } else if (climate === 'temperate') {
    base = TEMPERATE;
    reasonKey = 'crops.reason.temperate';
  } else {
    base = SAFE_FALLBACK;
    source = 'fallback';
    reasonKey = 'crops.reason.fallback';
  }

  const ordered = reorderForSeason(base, season);
  // Season bias only counts as the primary reason when it actually
  // changed the top pick.
  let finalSource = source;
  let finalReasonKey = reasonKey;
  if (ordered[0] !== base[0]) {
    finalSource = 'season';
    finalReasonKey = season === 'dry'
      ? 'crops.reason.dry_season'
      : 'crops.reason.wet_season';
  }

  const best = ordered[0];
  const alternatives = ordered.slice(1, 4);

  const reason =
      finalReasonKey === 'crops.reason.tropical'   ? 'Tropical climate — cassava, maize, plantain thrive.'
    : finalReasonKey === 'crops.reason.temperate'  ? 'Temperate climate — wheat, maize, potato suit well.'
    : finalReasonKey === 'crops.reason.arid'       ? 'Arid climate — sorghum and millet cope with low rainfall.'
    : finalReasonKey === 'crops.reason.dry_season' ? 'Dry season — prefer drought-resistant crops.'
    : finalReasonKey === 'crops.reason.wet_season' ? 'Wet season — prefer water-tolerant crops.'
    :                                                 'Safe default crop mix.';

  return Object.freeze({
    best,
    alternatives: Object.freeze(alternatives),
    reason,
    reasonKey: finalReasonKey,
    source: finalSource,
  });
}

export const _internal = Object.freeze({
  TROPICAL, TEMPERATE, ARID, DROUGHT_RESISTANT, WATER_TOLERANT, SAFE_FALLBACK,
  reorderForSeason, uniq,
});
