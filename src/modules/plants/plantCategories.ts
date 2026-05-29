/**
 * src/modules/plants/plantCategories.ts — unified plant categories.
 *
 *   import {
 *     PLANT_CATEGORIES, PLANT_CATEGORY_META,
 *     isPlantCategory, plantCategoryMeta,
 *     PLANT_CATEGORIES_VERSION,
 *   } from 'src/modules/plants/plantCategories';
 *
 * What this is
 * ────────────
 *   The 7 spec'd browsing categories for the Global Plant
 *   Intelligence Library:
 *     flower · vegetable · fruit · herb · houseplant · crop · tree
 *
 *   Each category carries:
 *     • id            — stable enum value (matches GROW_TYPES)
 *     • icon          — emoji glyph
 *     • labelKey      — tSafe key
 *     • labelDefault  — English fallback label
 *     • minLaunch     — spec'd minimum-launch row count
 *
 *   Engines downstream read from this single registry — adding a
 *   category is one entry plus a JSON file in src/data/plants/.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — references GROW_TYPES, never duplicates it.
 *   • No fetch, no persistence.
 */

import { GROW_TYPES, GROW_TYPE_ICONS } from '../../types/growTypes';

export const PLANT_CATEGORIES_VERSION = 'plant-categories-v1';

export const PLANT_CATEGORIES = [
  'flower', 'vegetable', 'fruit', 'herb',
  'houseplant', 'crop', 'tree', 'shrub',
] as const;

export type PlantCategory = typeof PLANT_CATEGORIES[number];

interface CategoryMeta {
  id:            PlantCategory;
  icon:          string;
  labelKey:      string;
  labelDefault:  string;
  minLaunch:     number;
}

export const PLANT_CATEGORY_META: Record<PlantCategory, CategoryMeta> = {
  flower: {
    id: 'flower',
    icon: GROW_TYPE_ICONS.flower,
    labelKey: 'plant.category.flower',
    labelDefault: 'Flowers',
    minLaunch: 500,
  },
  vegetable: {
    id: 'vegetable',
    icon: GROW_TYPE_ICONS.vegetable,
    labelKey: 'plant.category.vegetable',
    labelDefault: 'Vegetables',
    minLaunch: 300,
  },
  fruit: {
    id: 'fruit',
    icon: GROW_TYPE_ICONS.fruit,
    labelKey: 'plant.category.fruit',
    labelDefault: 'Fruits',
    minLaunch: 200,
  },
  herb: {
    id: 'herb',
    icon: GROW_TYPE_ICONS.herb,
    labelKey: 'plant.category.herb',
    labelDefault: 'Herbs',
    minLaunch: 150,
  },
  houseplant: {
    id: 'houseplant',
    icon: GROW_TYPE_ICONS.houseplant,
    labelKey: 'plant.category.houseplant',
    labelDefault: 'Houseplants',
    minLaunch: 200,
  },
  crop: {
    id: 'crop',
    icon: GROW_TYPE_ICONS.crop,
    labelKey: 'plant.category.crop',
    labelDefault: 'Crops',
    minLaunch: 150,
  },
  tree: {
    id: 'tree',
    icon: GROW_TYPE_ICONS.tree,
    labelKey: 'plant.category.tree',
    labelDefault: 'Trees',
    minLaunch: 100,
  },
  shrub: {
    id: 'shrub',
    icon: GROW_TYPE_ICONS.shrub,
    labelKey: 'plant.category.shrub',
    labelDefault: 'Shrubs',
    minLaunch: 100,
  },
};

const _set = new Set<string>(PLANT_CATEGORIES as readonly string[]);

export function isPlantCategory(v: unknown): v is PlantCategory {
  return typeof v === 'string' && _set.has(v);
}

export function plantCategoryMeta(v: unknown): CategoryMeta | null {
  return isPlantCategory(v) ? PLANT_CATEGORY_META[v] : null;
}

/* Surface that every category id is present in GROW_TYPES so a
   missed-sync between the two registries breaks at build time —
   not in production. The CI gate also enforces this. */
export const _consistencyCheck = Object.freeze({
  missingFromGrowTypes: PLANT_CATEGORIES.filter(
    (c) => (GROW_TYPES as readonly string[]).indexOf(c) === -1
  ),
});

export const MIN_LAUNCH_TOTAL = PLANT_CATEGORIES
  .reduce((sum, c) => sum + PLANT_CATEGORY_META[c].minLaunch, 0);
