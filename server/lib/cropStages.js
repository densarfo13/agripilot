/**
 * Shared crop stage constants and labels.
 *
 * Single source of truth for all stage-related logic across
 * the server (routes, task engine, validation).
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

/** Legacy stage values that still exist in older data */
export const LEGACY_STAGES = ['growing'];

/** All accepted values (current + legacy) */
export const ALL_ACCEPTED_STAGES = [...CROP_STAGES, ...LEGACY_STAGES];

/** Map legacy values to their modern equivalent */
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

/** Human-readable labels (English) — i18n keys live in translations.js */
export const STAGE_LABELS = {
  planning: 'Planning',
  land_preparation: 'Land Preparation',
  planting: 'Planting',
  germination: 'Germination',
  vegetative: 'Vegetative',
  flowering: 'Flowering',
  fruiting: 'Fruiting',
  harvest: 'Harvest',
  post_harvest: 'Post-Harvest',
};
