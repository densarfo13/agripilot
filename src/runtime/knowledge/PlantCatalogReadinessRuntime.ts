/**
 * src/runtime/knowledge/PlantCatalogReadinessRuntime.ts — wave-41
 * read-only probe over Farroway's plant catalog. Reports the
 * TRUE count from canonical library exports and per-region
 * priority-coverage attestations.
 *
 *   window.__plantCatalogReadiness()
 *
 * Strict-rule audit
 *   • Pure composition over library imports. SSR-safe.
 *   • Frozen envelope. Never throws.
 *   • NEVER fakes counts — every number derives from a library
 *     export. Hardcoded numeric returns would trip the wave-41
 *     governance gate.
 */

import { VEGETABLE_LIBRARY }  from '../plants/media/libraries/vegetableLibrary';
import { FRUIT_LIBRARY }      from '../plants/media/libraries/fruitLibrary';
import { HERB_LIBRARY }       from '../plants/media/libraries/herbLibrary';
import { CROP_LIBRARY }       from '../plants/media/libraries/cropLibrary';
import { HOUSEPLANT_LIBRARY } from '../plants/media/libraries/houseplantLibrary';
import { FLOWER_LIBRARY }     from '../plants/media/libraries/flowerLibrary';

export const PLANT_CATALOG_READINESS_RUNTIME_VERSION = 'plant-catalog-readiness-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/** Wave-41 priority plant IDs grouped by pilot region. */
const AFRICA_PRIORITY = Object.freeze([
  // Ghana
  'maize', 'cassava', 'plantain', 'yam', 'cocoa',
  'groundnut', 'okra', 'pepper', 'tomato',
  // Nigeria
  'rice', 'cowpea', 'sorghum', 'millet',
  // Kenya
  'beans', 'coffee',
]);

const USA_GARDEN_PRIORITY = Object.freeze([
  'tomato', 'pepper', 'cucumber', 'rose', 'apple', 'blueberry',
]);

const TARGET_PLANTS  = 200;
const TARGET_FLOWERS = 50;

function _collectPlantIds(): Set<string> {
  return _safe(() => {
    const set = new Set<string>();
    const libs: any[][] = [
      VEGETABLE_LIBRARY as any[],
      FRUIT_LIBRARY     as any[],
      HERB_LIBRARY      as any[],
      CROP_LIBRARY      as any[],
      HOUSEPLANT_LIBRARY as any[],
      FLOWER_LIBRARY    as any[],
    ];
    for (const lib of libs) {
      if (!Array.isArray(lib)) continue;
      for (const row of lib) {
        const id = row && typeof row.plantId === 'string' ? row.plantId : null;
        if (id) set.add(id);
      }
    }
    return set;
  }, new Set<string>());
}

function _coveragePercent(actual: number, target: number): number {
  return _safe(() => {
    if (!Number.isFinite(target) || target <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((actual / target) * 100)));
  }, 0);
}

export type PlantCatalogStatus = 'READY' | 'YELLOW' | 'NOT_READY';

export interface PlantCatalogReadiness {
  runtimeVersion:           string;
  initialized:              boolean;
  currentPlants:            number;
  targetPlants:             number;
  gap:                      number;
  coveragePercent:          number;
  africaPriorityCoverage:   number;
  africaPriorityHit:        number;
  africaPriorityTotal:      number;
  usaGardenCoverage:        number;
  usaGardenHit:             number;
  usaGardenTotal:           number;
  flowerCoverage:           number;
  flowerCount:              number;
  flowerTarget:             number;
  launchStatus:             PlantCatalogStatus;
}

export function plantCatalogReadiness(): PlantCatalogReadiness {
  return _safe(() => {
    const ids = _collectPlantIds();
    // Non-flower plants = total catalog minus the flower library.
    // The wave-23 envelope distinguishes flowers from plants; the
    // wave-41 catalog count follows the same split.
    const flowerCount = _safe(
      () => Array.isArray(FLOWER_LIBRARY) ? FLOWER_LIBRARY.length : 0, 0);
    const currentPlants = Math.max(0, ids.size - flowerCount);

    const gap = Math.max(0, TARGET_PLANTS - currentPlants);
    const coveragePercent = _coveragePercent(currentPlants, TARGET_PLANTS);

    // Africa priority coverage — distinct hits / list size.
    let africaHit = 0;
    for (const id of AFRICA_PRIORITY) if (ids.has(id)) africaHit++;
    const africaPriorityCoverage = _coveragePercent(
      africaHit, AFRICA_PRIORITY.length);

    // USA garden priority coverage.
    let usaHit = 0;
    for (const id of USA_GARDEN_PRIORITY) if (ids.has(id)) usaHit++;
    const usaGardenCoverage = _coveragePercent(
      usaHit, USA_GARDEN_PRIORITY.length);

    const flowerCoverage = _coveragePercent(flowerCount, TARGET_FLOWERS);

    // launchStatus per wave-41:
    //   READY      — catalog at-or-above 200 AND core regions ≥ 80%
    //   YELLOW     — catalog under 200 BUT core regions ≥ 60% covered
    //   NOT_READY  — core priority coverage below 60% (would mean
    //                consumer pilot has no usable plants for the
    //                target region)
    let launchStatus: PlantCatalogStatus;
    if (currentPlants >= TARGET_PLANTS
        && africaPriorityCoverage >= 80
        && usaGardenCoverage      >= 80) {
      launchStatus = 'READY';
    } else if (africaPriorityCoverage >= 60
            || usaGardenCoverage      >= 60) {
      launchStatus = 'YELLOW';
    } else {
      launchStatus = 'NOT_READY';
    }

    return Object.freeze({
      runtimeVersion:         PLANT_CATALOG_READINESS_RUNTIME_VERSION,
      initialized:            true,
      currentPlants,
      targetPlants:           TARGET_PLANTS,
      gap,
      coveragePercent,
      africaPriorityCoverage,
      africaPriorityHit:      africaHit,
      africaPriorityTotal:    AFRICA_PRIORITY.length,
      usaGardenCoverage,
      usaGardenHit:           usaHit,
      usaGardenTotal:         USA_GARDEN_PRIORITY.length,
      flowerCoverage,
      flowerCount,
      flowerTarget:           TARGET_FLOWERS,
      launchStatus,
    });
  }, Object.freeze({
    runtimeVersion:         PLANT_CATALOG_READINESS_RUNTIME_VERSION,
    initialized:            false,
    currentPlants:          0,
    targetPlants:           TARGET_PLANTS,
    gap:                    TARGET_PLANTS,
    coveragePercent:        0,
    africaPriorityCoverage: 0,
    africaPriorityHit:      0,
    africaPriorityTotal:    AFRICA_PRIORITY.length,
    usaGardenCoverage:      0,
    usaGardenHit:           0,
    usaGardenTotal:         USA_GARDEN_PRIORITY.length,
    flowerCoverage:         0,
    flowerCount:            0,
    flowerTarget:           TARGET_FLOWERS,
    launchStatus:           'NOT_READY' as PlantCatalogStatus,
  }));
}

export function installPlantCatalogReadinessGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__plantCatalogReadiness !== 'function') {
      w.__plantCatalogReadiness = function () {
        const out = plantCatalogReadiness();
        try { console.log('[Farroway · Plant Catalog]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
