/**
 * src/config/crops/index.js — barrel export for the Crop Intelligence
 * Engine.
 *
 * One import path for everything:
 *
 *   import {
 *     getCrop,
 *     getCropLabel, getCropImage, getCropLifecycle,
 *     getCropStageLabel, getCropRiskPatterns, getCropSeasonalGuidance,
 *     getStageDuration, getTasksForCropStage,
 *     getRiskPatternsForCropStage, getYieldProfile, getHarvestProfile,
 *     getCropsForRegion,
 *     normalizeCropKey, normalizeCropId,
 *     listRegisteredCrops,
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
  // Spec §3 / §6 / §7 / §8 / §9 / §10 / §11 helpers.
  normalizeCropKey,
  normalizeCropId,
  getStageDuration,
  getTasksForCropStage,
  getRiskPatternsForCropStage,
  getYieldProfile,
  getHarvestProfile,
  getCropsForRegion,
  getCropRegions,
  getRegionForCountry,
  cropIsRelevantToRegion,
  getCropHarvestProfile,
  hasCropHarvestProfile,
  GENERIC_HARVEST_PROFILE,
  getCropIntelligenceProfile,
  CROP_INTELLIGENCE_PROFILES,
  isCanonicalCropKey,
  listRegisteredCrops,
} from './cropRegistry.js';

export { CANONICAL_KEYS } from './cropAliases.js';
export { CROP_CATEGORIES } from './cropCategories.js';
export { CROP_RISK_PATTERNS } from './cropRiskPatterns.js';
export { CROP_SEASONAL_GUIDANCE } from './cropSeasonalGuidance.js';
export { CROP_TASK_TEMPLATES, getCropStageTasks } from './cropTaskTemplates.js';
export { CROP_REGIONS, COUNTRY_REGIONS, REGION_IDS } from './cropRegions.js';
