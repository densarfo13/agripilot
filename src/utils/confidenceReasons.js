/**
 * confidenceReasons.js — canonical reason identifiers every
 * confidence scorer emits. Six names, no more — if a scorer
 * needs a new one, it gets added here and the enum ripples out.
 *
 *   conflict_land_vs_stage      — land signal disagrees with
 *                                  the active crop stage
 *   conflict_weather_vs_land    — weather encourages action the
 *                                  land isn't ready for
 *   weak_camera_signal          — camera finding is blurry / low
 *                                  light / unknown
 *   stale_offline_state         — data is stale AND we can't
 *                                  refresh right now
 *   missing_land_data           — no landProfile in context
 *   missing_weather_data        — no weatherNow in context
 *
 * hasConflictReason(reasons) returns true only for the two
 * conflict reasons. This is the SINGLE source of truth for the
 * check-first gate — callers never re-implement the string check.
 */

export const CONFIDENCE_REASONS = Object.freeze({
  CONFLICT_LAND_VS_STAGE:     'conflict_land_vs_stage',
  CONFLICT_WEATHER_VS_LAND:   'conflict_weather_vs_land',
  WEAK_CAMERA_SIGNAL:         'weak_camera_signal',
  STALE_OFFLINE_STATE:        'stale_offline_state',
  MISSING_LAND_DATA:          'missing_land_data',
  MISSING_WEATHER_DATA:       'missing_weather_data',
});

/** Reasons the check-first override is allowed to fire on. */
export const CONFLICT_REASONS = Object.freeze(new Set([
  CONFIDENCE_REASONS.CONFLICT_LAND_VS_STAGE,
  CONFIDENCE_REASONS.CONFLICT_WEATHER_VS_LAND,
]));

/** Reasons that don't imply a conflict but do lower certainty. */
export const UNCERTAINTY_REASONS = Object.freeze(new Set([
  CONFIDENCE_REASONS.WEAK_CAMERA_SIGNAL,
  CONFIDENCE_REASONS.STALE_OFFLINE_STATE,
  CONFIDENCE_REASONS.MISSING_LAND_DATA,
  CONFIDENCE_REASONS.MISSING_WEATHER_DATA,
]));

/**
 * hasConflictReason — true when the reasons array contains at
 * least one of the conflict identifiers. Tolerant of null/
 * undefined/non-array input — always returns a boolean.
 */
export function hasConflictReason(reasons) {
  if (!Array.isArray(reasons)) return false;
  for (const r of reasons) {
    if (r && CONFLICT_REASONS.has(String(r))) return true;
  }
  return false;
}

/**
 * hasUncertaintyReason — true when the reasons array contains
 * at least one non-conflict uncertainty reason.
 */
export function hasUncertaintyReason(reasons) {
  if (!Array.isArray(reasons)) return false;
  for (const r of reasons) {
    if (r && UNCERTAINTY_REASONS.has(String(r))) return true;
  }
  return false;
}

/** Legacy aliases from pre-standardization code. Any scorer that
 *  emits these gets its reason re-keyed on the fly by the
 *  normalizer below. Kept minimal to avoid surprise mappings. */
const LEGACY_ALIASES = Object.freeze({
  conflict_planting_vs_wet_soil: CONFIDENCE_REASONS.CONFLICT_LAND_VS_STAGE,
  camera_uncertain:              CONFIDENCE_REASONS.WEAK_CAMERA_SIGNAL,
  stale_offline:                 CONFIDENCE_REASONS.STALE_OFFLINE_STATE,
  weather_missing:               CONFIDENCE_REASONS.MISSING_WEATHER_DATA,
  land_missing:                  CONFIDENCE_REASONS.MISSING_LAND_DATA,
  land_profile_missing:          CONFIDENCE_REASONS.MISSING_LAND_DATA,
});

/**
 * normalizeReasons — returns a new array with legacy aliases
 * mapped to their standardized names. Unknown reasons pass
 * through unchanged so positive-contribution labels (e.g.
 * 'stage_resolved') are preserved. `hasConflictReason` operates
 * on the normalized array reliably regardless of origin.
 */
export function normalizeReasons(reasons = []) {
  if (!Array.isArray(reasons)) return [];
  const out = [];
  const seen = new Set();
  for (const r of reasons) {
    const alias = LEGACY_ALIASES[String(r)];
    const canonical = alias || r;
    const key = String(canonical);
    if (seen.has(key)) continue;    // dedupe
    seen.add(key);
    out.push(canonical);
  }
  return out;
}

export const _internal = { LEGACY_ALIASES };
