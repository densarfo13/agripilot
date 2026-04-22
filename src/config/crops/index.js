/**
 * src/config/crops/index.js — barrel export for the Crop Intelligence
 * Layer.
 *
 * One import path for everything:
 *
 *   import {
 *     getCrop,
 *     getCropLabel, getCropImage, getCropLifecycle,
 *     getCropStageLabel, getCropRiskPatterns, getCropSeasonalGuidance,
 *     normalizeCropKey, listRegisteredCrops,
 *   } from '../../config/crops';
 *
 * Keeping UI components away from sub-module paths means we can move
 * internals (merge files, split, add an async loader) without any
 * component refactor.
 */

export {
  getCrop,
  getCropLabel,
  getCropLifecycle,
  getCropStageLabel,
  getCropImage,
  getCropCategory,
  getCropRiskPatterns,
  matchCropRiskPatterns,
  getCropSeasonalGuidance,
  normalizeCropKey,
  isCanonicalCropKey,
  listRegisteredCrops,
} from './cropRegistry.js';

export { CANONICAL_KEYS } from './cropAliases.js';
export { CROP_CATEGORIES } from './cropCategories.js';
export { CROP_RISK_PATTERNS } from './cropRiskPatterns.js';
export { CROP_SEASONAL_GUIDANCE } from './cropSeasonalGuidance.js';
export { CROP_TASK_TEMPLATES, getCropStageTasks } from './cropTaskTemplates.js';
