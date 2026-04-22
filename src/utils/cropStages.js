/**
 * Shared crop stage constants for the frontend.
 *
 * Single source of truth — import from here instead of defining
 * stage arrays in individual components.
 *
 * Matches server/lib/cropStages.js exactly.
 */

import { getCropLifecycle } from '../config/crops/index.js';

/** All valid crop stages in lifecycle order */
export const CROP_STAGES = [
  'planning',
  'land_preparation',
  'planting',
  'germination',
  'vegetative',
  'flowering',
  'fruiting',
  'harvest',
  'post_harvest',
];

/** Stage data with icons for UI rendering */
export const STAGES = [
  { value: 'planning', icon: '\u{1F4CB}' },        // 📋
  { value: 'land_preparation', icon: '\u{1F69C}' }, // 🚜
  { value: 'planting', icon: '\u{1F331}' },         // 🌱
  { value: 'germination', icon: '\u{1F33F}' },      // 🌿
  { value: 'vegetative', icon: '\u{1F33E}' },       // 🌾
  { value: 'flowering', icon: '\u{1F338}' },        // 🌸
  { value: 'fruiting', icon: '\u{1F345}' },         // 🍅
  { value: 'harvest', icon: '\u{1F9FA}' },          // 🧺
  { value: 'post_harvest', icon: '\u{1F4E6}' },     // 📦
];

/** i18n translation keys for each stage */
export const STAGE_KEYS = {
  planning: 'cropStage.planning',
  land_preparation: 'cropStage.landPreparation',
  planting: 'cropStage.planting',
  germination: 'cropStage.germination',
  vegetative: 'cropStage.vegetative',
  flowering: 'cropStage.flowering',
  fruiting: 'cropStage.fruiting',
  harvest: 'cropStage.harvest',
  post_harvest: 'cropStage.postHarvest',
};

/** Emoji icons indexed by stage value */
export const STAGE_EMOJIS = Object.fromEntries(
  STAGES.map((s) => [s.value, s.icon])
);

/** Map legacy stage values to their modern equivalents */
export const LEGACY_STAGE_MAP = {
  growing: 'vegetative',
};

/**
 * Resolve a stage value, mapping legacy to modern.
 * Returns 'planning' if unknown.
 */
export function resolveStage(raw) {
  if (!raw) return 'planning';
  const lower = String(raw).toLowerCase().trim();
  if (CROP_STAGES.includes(lower)) return lower;
  if (LEGACY_STAGE_MAP[lower]) return LEGACY_STAGE_MAP[lower];
  return 'planning';
}

/**
 * getStagesForCrop(cropCode) — crop-specific stage list.
 *
 * Wraps the Crop Intelligence Layer (src/config/crops) to return the
 * per-crop lifecycle stages for the stage dropdown. Cassava returns
 * planting/establishment/vegetative/bulking/maturation/harvest; maize
 * returns planting/germination/vegetative/tasseling/grain_fill/
 * harvest; tomato returns seedling/transplant/.../fruiting/harvest;
 * etc.
 *
 * For unknown crops (or when the registry lookup fails) we fall back
 * to the generic CROP_STAGES list so the form never crashes.
 *
 * Stage values remain canonical snake_case so server validation +
 * the existing server-side cropStages list keep working. UI icons
 * come from STAGE_EMOJIS by stage value.
 *
 * Shape:
 *   [{ value: 'planting', icon: '🌱', labelKey: 'cropStage.planting' }, ...]
 */
export function getStagesForCrop(cropCode) {
  if (!cropCode) return STAGES.map((s) => decorateStage(s.value));
  const lifecycle = getCropLifecycle(cropCode);
  if (!lifecycle || !Array.isArray(lifecycle) || lifecycle.length === 0) {
    return STAGES.map((s) => decorateStage(s.value));
  }
  return lifecycle.map((stage) => decorateStage(stage.key));
}

function decorateStage(value) {
  return {
    value,
    icon: STAGE_EMOJIS[value] || '\u{1F331}',
    labelKey: STAGE_KEYS[value] || `cropStage.${value}`,
  };
}
