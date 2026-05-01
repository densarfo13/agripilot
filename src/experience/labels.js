/**
 * labels.js — getExperienceLabels(experience) helper.
 *
 *   import { getExperienceLabels } from '.../experience/labels.js';
 *   const L = getExperienceLabels('backyard');
 *   L.myFarm           // 'My Garden'
 *   L.scanCrop         // 'Scan plant'
 *   L.sellHidden       // true
 *
 * Centralises the backyard ↔ farm copy split so a single source
 * of truth feeds Home, Onboarding, My Farm / My Garden, Tasks,
 * Scan, Progress, nav and empty states. Coexists with
 * `backyardExperience.getBackyardLabel(key)` — that helper is a
 * per-key lookup; this one is a flat label bag for components
 * that want every label up front.
 *
 * Strict-rule audit
 *   * Pure functions; no I/O.
 *   * Defensive on bad input — non-string `experience` falls
 *     back to farm labels.
 *   * Both English-default keys and i18n keys are exposed so
 *     callers can pick whichever fits their existing render
 *     pattern.
 */

import { tStrict } from '../i18n/strictT.js';

const FARM_LABELS = Object.freeze({
  experience:    'farm',
  isBackyard:    false,
  // Field nouns
  farm:          'Farm',
  crop:          'Crop',
  myFarm:        'My Farm',
  // CTAs
  addNewFarm:    'Add New Farm',
  scanCrop:      'Scan Crop',
  harvest:       'Harvest',
  // Visibility
  sellHidden:    false,
  fundingHidden: false,
  // i18n key map — callers that want translated copy use these
  i18n: Object.freeze({
    farm:          'common.farm',
    crop:          'common.crop',
    myFarm:        'nav.myFarm',
    addNewFarm:    'newFarm.title',
    scanCrop:      'photo.scanCrop',
    harvest:       'common.harvest',
  }),
});

const BACKYARD_LABELS = Object.freeze({
  experience:    'backyard',
  isBackyard:    true,
  farm:          'Garden',
  crop:          'Plant',
  myFarm:        'My Garden',
  addNewFarm:    'Set up your garden',
  scanCrop:      'Take Plant Photo',
  harvest:       'Ready to pick',
  sellHidden:    true,
  fundingHidden: true,
  i18n: Object.freeze({
    farm:          'experience.garden',
    crop:          'experience.plant',
    myFarm:        'nav.myGarden',
    addNewFarm:    'gardenSetup.title',
    scanCrop:      'experience.scanPlant',
    harvest:       'experience.readyToPick',
  }),
});

/**
 * getExperienceLabels(experience: 'backyard' | 'garden' | 'farm' | string)
 *
 * Returns a frozen labels bag. Unknown / falsy `experience`
 * falls back to FARM_LABELS so the existing farm UI never
 * suddenly shifts copy on a misclassified call site.
 */
export function getExperienceLabels(experience) {
  const e = String(experience || '').toLowerCase();
  if (e === 'backyard' || e === 'garden' || e === 'home_garden' || e === 'home') {
    return BACKYARD_LABELS;
  }
  return FARM_LABELS;
}

/**
 * tLabel(experience, labelKey) — convenience for templates that
 * want the translated string in one call. Falls back to the
 * English default when no translation exists.
 */
export function tLabel(experience, labelKey) {
  const labels = getExperienceLabels(experience);
  const i18nKey = labels.i18n && labels.i18n[labelKey];
  const fallback = labels[labelKey] != null ? String(labels[labelKey]) : '';
  if (!i18nKey) return fallback;
  try { return tStrict(i18nKey, fallback); }
  catch { return fallback; }
}

export default getExperienceLabels;
export { FARM_LABELS, BACKYARD_LABELS };
