/**
 * src/modules/plants/index.ts — Global Plant Intelligence Library
 * barrel + composite.
 *
 *   import {
 *     globalPlantIntelligence,
 *     installGlobalPlantIntelligenceGlobal,
 *     GLOBAL_PLANT_INTELLIGENCE_VERSION,
 *   } from 'src/modules/plants';
 *
 *   globalPlantIntelligence({
 *     category, filters, query, sort, favorites, plantId,
 *     weather, season, haveInGarden,
 *   });
 *
 * What this is
 * ────────────
 *   Single chokepoint over the unified library. Combines:
 *     • plantLibrary    — browse / filter / sort / paginate
 *     • plantSearch     — multi-field ranked search
 *     • plantProfiles   — rich detail-page envelope
 *     • plantCategories — 7-category registry
 *
 *   Pins window.__plantLibrary() so QA can introspect the
 *   composite from the console.
 *
 * Connections (auto-participating — no changes needed downstream)
 *   • Scan          — tagScanWithGrowType reads findPlant by id
 *   • Tasks         — flowerAdvisor / composeIndoorCare read DB rows
 *   • Weather       — diseaseForecast + pestRiskEngine read .diseases
 *   • Daily Briefing — dailyGrowEngine composes plant from DB
 *   • Farm Health   — wave-10 farmHealthScore composes existing engines
 *   • Garden Health — gardenHealth composes diseaseForecast
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — no existing module modified.
 *   • Wave-5 single-writer invariant preserved.
 */

import {
  plantLibrary, PLANT_LIBRARY_VERSION,
  PLANT_LIBRARY_FILTERS, PLANT_LIBRARY_SORT,
} from './plantLibrary';
import { plantSearch, PLANT_SEARCH_VERSION } from './plantSearch';
import { plantProfile, PLANT_PROFILE_VERSION } from './plantProfiles';
import {
  PLANT_CATEGORIES, PLANT_CATEGORY_META, MIN_LAUNCH_TOTAL,
  isPlantCategory, plantCategoryMeta, PLANT_CATEGORIES_VERSION,
} from './plantCategories';

export const GLOBAL_PLANT_INTELLIGENCE_VERSION = 'global-plant-intelligence-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

export function globalPlantIntelligence(ctx: any) {
  const c = _isObj(ctx) ? ctx : {};
  const library = _safe(() => plantLibrary(c), null);
  const search  = c.query ? _safe(() => plantSearch(c), null) : null;
  const profile = c.plantId ? _safe(() => plantProfile(c), null) : null;
  return Object.freeze({
    runtimeVersion: GLOBAL_PLANT_INTELLIGENCE_VERSION,
    generatedAt:    _now(),
    library,
    search,
    profile,
    categories: Object.freeze(PLANT_CATEGORIES.slice()),
    versions: Object.freeze({
      categories: PLANT_CATEGORIES_VERSION,
      library:    PLANT_LIBRARY_VERSION,
      search:     PLANT_SEARCH_VERSION,
      profile:    PLANT_PROFILE_VERSION,
    }),
    minLaunchTotal: MIN_LAUNCH_TOTAL,
    deferred: Object.freeze({
      datasetVolume:
        'spec target is 1,500+ rows across 7 categories — '
        + 'content-team backlog',
      treesDataset:
        'starter trees.json ships 10 entries; expansion via '
        + 'content-team pipeline',
      autoAddPersistence:
        'plantProfile.autoAddSuggestion is a caller-ready payload; '
        + 'persistence stays with the wave-5 single-writer',
      favoritesPersistence:
        'favorites is caller-supplied; no localStorage writes from '
        + 'engines',
    }),
  });
}

export function installGlobalPlantIntelligenceGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__plantLibrary === 'function') return true;
    w.__plantLibrary = function (innerCtx: any) {
      const out = globalPlantIntelligence(innerCtx || {});
      try { console.log('[Farroway · Global Plant Intelligence]', out); }
      catch { /* swallow */ }
      return out;
    };
    return true;
  }, false);
}

// Re-exports
export {
  plantLibrary, PLANT_LIBRARY_VERSION,
  PLANT_LIBRARY_FILTERS, PLANT_LIBRARY_SORT,
  plantSearch, PLANT_SEARCH_VERSION,
  plantProfile, PLANT_PROFILE_VERSION,
  PLANT_CATEGORIES, PLANT_CATEGORY_META, MIN_LAUNCH_TOTAL,
  isPlantCategory, plantCategoryMeta, PLANT_CATEGORIES_VERSION,
};
