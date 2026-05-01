/**
 * regionUXEngine.js — region → experience resolver.
 *
 * Spec port: the design doc specifies TypeScript types
 * (`RegionExperience`, `RegionUXState`). The codebase is JS,
 * so types are documented via JSDoc. Runtime contract is
 * identical to the spec.
 *
 * Why this layer
 * ──────────────
 * `regionConfig.js` carries country data. `backyardExperience.js`
 * and `farmExperience.js` carry the daily-plan generators.
 * The piece missing was the **decision layer**: given a farm's
 * detected country + region + farmType, which experience should
 * the app use, and what banner / status should the UI show?
 *
 * Pure / side-effect-free. Returns a plain object every render-
 * path can consume. UI code (RegionBanner, BottomTabNav) reads
 * the resolved state; engines (dailyIntelligenceEngine) call the
 * resolver directly.
 *
 * Coexists with — does NOT replace — `shouldUseBackyardExperience`,
 * `getRegionExperience`, `isRegionActive`. Those remain valid; the
 * resolver consolidates them into a single "what UX should the
 * user see right now" answer.
 *
 * Strict-rule audit
 *   • No I/O, no React, no global state.
 *   • Unknown country → status: 'fallback', experience: 'generic'.
 *     Never throws; never returns undefined.
 *   • Banner message text is structural only — final localization
 *     is the consumer's job (RegionBanner runs it through tStrict).
 */

import { getRegionConfig } from '../config/regionConfig.js';

/**
 * @typedef {'farm' | 'backyard' | 'generic'} RegionExperience
 *
 * @typedef {Object} RegionUXState
 * @property {string|undefined} country
 * @property {string|undefined} region
 * @property {RegionExperience} experience
 * @property {boolean}          isSupported  active or beta
 * @property {boolean}          isOptimized  active only
 * @property {'active'|'beta'|'planned'|'fallback'} status
 * @property {string|undefined} message      i18n key suggestion
 *                                            (consumer translates)
 */

const BACKYARD_FARM_TYPES = new Set(['backyard', 'home_garden']);

/**
 * @param {object} args
 * @param {string} [args.detectedCountry]
 * @param {string} [args.detectedRegion]
 * @param {string} [args.farmType]
 * @returns {RegionUXState}
 */
export function resolveRegionUX({
  detectedCountry,
  detectedRegion,
  farmType,
} = {}) {
  // Defensive: never throw. The default config is shipped by
  // regionConfig with `country: 'Default'` so the lookup is safe
  // for any string (including undefined / null).
  let config;
  try { config = getRegionConfig(detectedCountry); }
  catch { config = null; }
  if (!config) config = { country: 'Default', status: 'fallback', experience: 'farm', enableBackyardMode: false };

  const isKnownRegion = Boolean(detectedCountry && config.country !== 'Default');
  const status = isKnownRegion ? config.status : 'fallback';
  const isSupported = status === 'active' || status === 'beta';
  const isOptimized = status === 'active';

  let experience = 'generic';
  if (
    config.enableBackyardMode &&
    farmType && BACKYARD_FARM_TYPES.has(String(farmType).toLowerCase())
  ) {
    experience = 'backyard';
  } else if (config.experience === 'farm' || config.experience === 'mixed') {
    // 'mixed' regions default to farm unless the farmType pushed
    // us to backyard above (e.g. U.S. backyard gardener).
    experience = 'farm';
  }

  // Banner message: i18n key suggestion. The RegionBanner consumer
  // runs the key through the strict translator so non-English UIs
  // never leak English. Caller may pass `message: undefined` to
  // suppress the banner entirely.
  let message;
  if (!isKnownRegion) {
    message = 'regionUx.banner.unknown';
  } else if (status === 'planned') {
    message = 'regionUx.banner.planned';
  } else if (status === 'beta') {
    message = 'regionUx.banner.beta';
  }

  return {
    country: detectedCountry,
    region: detectedRegion,
    experience,
    isSupported,
    isOptimized,
    status,
    message,
  };
}

/**
 * getExperienceLabels — short copy hints for surfaces that vary
 * by experience type. Returns i18n key suggestions; consumer is
 * expected to run them through tStrict with the inline fallback
 * as the rendered text.
 *
 * @param {RegionExperience} experience
 */
export function getExperienceLabels(experience) {
  if (experience === 'backyard') {
    return {
      farmLabelKey:    'regionUx.label.garden',
      farmLabel:       'Garden',
      cropLabelKey:    'regionUx.label.plant',
      cropLabel:       'Plant',
      myFarmLabelKey:  'regionUx.label.myGarden',
      myFarmLabel:     'My Garden',
      scanLabelKey:    'regionUx.label.takePlantPhoto',
      scanLabel:       'Take plant photo',
      planLabelKey:    'regionUx.label.gardenPlan',
      planLabel:       'Garden Plan',
      primaryObject:   'plants',
    };
  }
  if (experience === 'farm') {
    return {
      farmLabelKey:    'regionUx.label.farm',
      farmLabel:       'Farm',
      cropLabelKey:    'regionUx.label.crop',
      cropLabel:       'Crop',
      myFarmLabelKey:  'regionUx.label.myFarm',
      myFarmLabel:     'My Farm',
      scanLabelKey:    'regionUx.label.scanCrop',
      scanLabel:       'Scan crop',
      planLabelKey:    'regionUx.label.todaysPlan',
      planLabel:       'Today\u2019s Plan',
      primaryObject:   'crops',
    };
  }
  // generic
  return {
    farmLabelKey:    'regionUx.label.farmOrGarden',
    farmLabel:       'Farm / Garden',
    cropLabelKey:    'regionUx.label.plantOrCrop',
    cropLabel:       'Plant / Crop',
    myFarmLabelKey:  'regionUx.label.myFarm',
    myFarmLabel:     'My Farm',
    scanLabelKey:    'regionUx.label.takePhoto',
    scanLabel:       'Take photo',
    planLabelKey:    'regionUx.label.todaysPlan',
    planLabel:       'Today\u2019s Plan',
    primaryObject:   'plants',
  };
}

export default { resolveRegionUX, getExperienceLabels };
