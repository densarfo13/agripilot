/**
 * Shared crop stage constants for the frontend.
 *
 * Single source of truth — import from here instead of defining
 * stage arrays in individual components.
 *
 * Matches server/lib/cropStages.js exactly.
 */

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
