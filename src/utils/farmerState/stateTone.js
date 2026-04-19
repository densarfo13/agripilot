/**
 * stateTone.js — lightweight tone adapter driven by the
 * farmer's regionBucket (mapCountryToAgRegion output).
 *
 *   applyStateToneByRegion(state, regionBucket) → state
 *
 * The adapter only tweaks wording keys — it doesn't touch logic.
 * Each state may have a per-region key suffix (e.g.
 * state.harvest_complete.title.tropical_manual). If a localized
 * variant doesn't exist, the caller falls back to the base key,
 * so adding region-specific copy is incremental.
 *
 * Five buckets (matching src/utils/mapCountryToAgRegion.js):
 *   tropical_manual     — simple, direct, practical
 *   tropical_mixed      — neutral default
 *   monsoon_mixed       — rain-aware
 *   temperate_mechanized — operational, field-focused
 *   arid_irrigated      — water-aware
 *
 * The adapter also sets a `regionBucket` on the state so the
 * component layer can switch imagery / spacing if it wants to.
 */

const KNOWN_BUCKETS = new Set([
  'tropical_manual', 'tropical_mixed', 'monsoon_mixed',
  'temperate_mechanized', 'arid_irrigated', 'unknown',
]);

/**
 * applyStateToneByRegion — return a new state with region-flavored
 * wording-key suffixes. The caller's `t()` tries the suffixed
 * key first and falls back to the base key when it's missing.
 */
export function applyStateToneByRegion(state = {}, regionBucket = 'unknown') {
  if (!state || typeof state !== 'object') return state;
  const bucket = KNOWN_BUCKETS.has(regionBucket) ? regionBucket : 'unknown';
  const baseTitle    = state.titleKey    || null;
  const baseSubtitle = state.subtitleKey || null;
  const baseWhy      = state.whyKey      || null;
  const baseNext     = state.nextKey     || null;

  return {
    ...state,
    regionBucket: bucket,
    // Caller uses these to attempt a region-suffixed lookup first.
    toneKeys: {
      title:    baseTitle    ? `${baseTitle}.${bucket}`    : null,
      subtitle: baseSubtitle ? `${baseSubtitle}.${bucket}` : null,
      why:      baseWhy      ? `${baseWhy}.${bucket}`      : null,
      next:     baseNext     ? `${baseNext}.${bucket}`     : null,
    },
  };
}

/**
 * resolveRegionBucket — small helper that translates a country
 * code into a bucket when the caller didn't precompute one.
 * Keeps this module standalone so tests don't need the full
 * mapCountryToAgRegion table imported everywhere.
 */
export function resolveRegionBucket(regionBucketOrCountry) {
  if (!regionBucketOrCountry) return 'unknown';
  const v = String(regionBucketOrCountry).toLowerCase();
  if (KNOWN_BUCKETS.has(v)) return v;
  // Allow a few ISO codes as a shortcut so tests can pass
  // 'gh' / 'in' / 'us' without importing the whole table.
  const shortcut = {
    gh: 'tropical_manual', tw: 'tropical_mixed', ng: 'tropical_mixed',
    ke: 'tropical_mixed',  ph: 'monsoon_mixed',  in: 'monsoon_mixed',
    us: 'temperate_mechanized', ca: 'temperate_mechanized',
    eg: 'arid_irrigated',
  };
  return shortcut[v] || 'unknown';
}

export const _internal = { KNOWN_BUCKETS };
