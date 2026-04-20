/**
 * recomputeIntent.js — describe what downstream systems should
 * re-run after a farm edit, driven entirely by the change-type
 * flags produced by classifyFarmChanges().
 *
 * This module is PURE and has no dependency on React, contexts,
 * or the network. It produces a plan; callers decide how to
 * execute it.
 *
 * Why a descriptor instead of direct calls?
 *   • Most recomputation in Farroway is already reactive via
 *     ProfileContext → re-renders → hooks re-run. The descriptor
 *     documents that contract so tests can verify it.
 *   • When a downstream system ISN'T reactive (e.g. an analytics
 *     batch or a one-shot task re-seed), the caller can inspect
 *     the descriptor and fire a specific command.
 *   • Dev assertions use the descriptor to decide whether a
 *     recompute was actually triggered.
 *
 * Contract (from §7 + §8):
 *
 *   shouldRefreshFarms           — always true after any edit save
 *   shouldRefreshHomeExperience  — true if crop/location/stage/plantedAt changed
 *   shouldRefreshTaskEngine      — true if crop/stage/plantedAt changed
 *   shouldRefreshRegionProfile   — true if country changed
 *   shouldRefreshWeather         — true if country/location changed
 *   shouldLogAnalyticsOnly       — true if ONLY size/name changed
 *   rule                         — short string identifier, for logs
 */

export function buildRecomputeIntent(changes = {}) {
  const c = changes || {};
  const crop     = !!c.cropChanged;
  const location = !!c.locationChanged;
  const size     = !!c.sizeChanged;
  const stage    = !!c.stageChanged;
  const name     = !!c.nameChanged;
  const planted  = !!c.plantedAtChanged;
  const countryChanged = !!(c.types && c.types.includes('location'));

  const shouldRefreshFarms          = crop || location || size || stage || name || planted;
  const shouldRefreshHomeExperience = crop || location || stage || planted;
  const shouldRefreshTaskEngine     = crop || stage || planted;
  const shouldRefreshRegionProfile  = countryChanged;
  const shouldRefreshWeather        = location;
  const shouldLogAnalyticsOnly      = shouldRefreshFarms
    && !crop && !location && !stage && !planted;

  let rule = 'noop';
  if (crop && location) rule = 'crop_and_location';
  else if (crop)        rule = 'crop_only';
  else if (location)    rule = 'location_only';
  else if (stage)       rule = 'stage_only';
  else if (planted)     rule = 'planted_date_only';
  else if (size || name) rule = 'metadata_only';

  return Object.freeze({
    shouldRefreshFarms,
    shouldRefreshHomeExperience,
    shouldRefreshTaskEngine,
    shouldRefreshRegionProfile,
    shouldRefreshWeather,
    shouldLogAnalyticsOnly,
    rule,
  });
}

/**
 * analyticsPayloadForChanges — produce the structured payload
 * we send to safeTrackEvent so observability captures WHAT
 * changed (not just "an edit happened").
 */
export function analyticsPayloadForChanges(changes = {}, patch = {}) {
  const c = changes || {};
  const p = patch || {};
  return {
    types: Array.isArray(c.types) ? [...c.types] : [],
    cropChanged:      !!c.cropChanged,
    locationChanged:  !!c.locationChanged,
    sizeChanged:      !!c.sizeChanged,
    stageChanged:     !!c.stageChanged,
    nameChanged:      !!c.nameChanged,
    plantedAtChanged: !!c.plantedAtChanged,
    fieldsInPatch:    Object.keys(p || {}),
  };
}
