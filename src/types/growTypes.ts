/**
 * src/types/growTypes.ts — Phase 1 grow-type registry.
 *
 *   import { GROW_TYPES, GROW_TYPE_ICONS, isGrowType }
 *     from 'src/types/growTypes';
 *
 *   isGrowType('flower') // true
 *   GROW_TYPE_ICONS.flower // '🌹'
 *
 * What this is
 * ────────────
 *   The canonical list of grow types Farroway supports. Adding
 *   a new type here is the single-step way to expand the
 *   platform's scope — engines downstream read from this list,
 *   never from a hardcoded subset.
 *
 *   Two extras beyond the spec list:
 *     • 'garden'     — composite type for mixed home gardens.
 *     • 'greenhouse' — covered grow environment.
 *   These satisfy Phase 15 (multi-garden) without forking the
 *   model.
 */

export const GROW_TYPES = [
  'crop',
  'vegetable',
  'fruit',
  'flower',
  'herb',
  'houseplant',
  'tree',
  'shrub',
  'garden',
  'greenhouse',
] as const;

export type GrowType = typeof GROW_TYPES[number];

export const GROW_TYPE_ICONS: Record<GrowType, string> = {
  crop:       '🌾',
  vegetable:  '🥬',
  fruit:      '🍎',
  flower:     '🌹',
  herb:       '🌿',
  houseplant: '🪴',
  tree:       '🌳',
  shrub:      '🌿',
  garden:     '🏡',
  greenhouse: '🏠',
};

export const GROW_TYPE_LABEL_KEY: Record<GrowType, string> = {
  crop:       'grow.type.crop',
  vegetable:  'grow.type.vegetable',
  fruit:      'grow.type.fruit',
  flower:     'grow.type.flower',
  herb:       'grow.type.herb',
  houseplant: 'grow.type.houseplant',
  tree:       'grow.type.tree',
  shrub:      'grow.type.shrub',
  garden:     'grow.type.garden',
  greenhouse: 'grow.type.greenhouse',
};

export const GROW_TYPE_LABEL_DEFAULT: Record<GrowType, string> = {
  crop:       'Farm Crops',
  vegetable:  'Vegetables',
  fruit:      'Fruits',
  flower:     'Flowers',
  herb:       'Herbs',
  houseplant: 'Indoor Plants',
  tree:       'Trees',
  shrub:      'Shrubs',
  garden:     'Home Garden',
  greenhouse: 'Greenhouse',
};

const _set = new Set<string>(GROW_TYPES as readonly string[]);
export function isGrowType(v: unknown): v is GrowType {
  return typeof v === 'string' && _set.has(v);
}

export const GROW_TYPES_VERSION = 'grow-types-v1';
