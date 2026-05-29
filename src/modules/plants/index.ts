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
// Platform-tier engines (PascalCase per spec)
import {
  plantRegistry, registerPlantFromScan, lookupPlant,
  PLANT_REGISTRY_VERSION,
} from './PlantRegistry';
import {
  generatePlantTasks, PLANT_TASK_ENGINE_VERSION,
} from './PlantTaskEngine';
import {
  computePlantHealthScore, PLANT_HEALTH_BANDS, PLANT_HEALTH_WEIGHTS,
  PLANT_HEALTH_VERSION,
} from './PlantHealthEngine';
import {
  getPlantKnowledge, answerPlantQuestion, PLANT_KNOWLEDGE_VERSION,
} from './PlantKnowledgeEngine';
import {
  plantProfileEngine, PLANT_PROFILE_ENGINE_VERSION,
} from './PlantProfileEngine';

export const GLOBAL_PLANT_INTELLIGENCE_VERSION = 'global-plant-intelligence-v1';
export const GLOBAL_PLANT_PLATFORM_VERSION = 'global-plant-platform-v1';

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

/**
 * Global Plant Platform composite — the spec's higher-tier
 * surface. Combines library + search + profile WITH the platform
 * engines (registry + task generation + health score + knowledge)
 * so the UI gets one frozen envelope it can render straight onto
 * a plant page.
 */
export function globalPlantPlatform(ctx: any) {
  const c       = _isObj(ctx) ? ctx : {};
  const base    = globalPlantIntelligence(c);
  const registry = _safe(() => plantRegistry(), null);
  const tasks    = c.plantId
    ? _safe(() => generatePlantTasks(c as any), null) : null;
  const health   = c.plantId
    ? _safe(() => computePlantHealthScore(c as any), null) : null;
  const knowledge = c.plantId
    ? _safe(() => getPlantKnowledge(c as any), null) : null;
  const profileFull = c.plantId
    ? _safe(() => plantProfileEngine(c as any), null) : null;
  const registration = c.scanResult
    ? _safe(() => registerPlantFromScan(c as any), null) : null;
  const knowledgeAnswer = c.question
    ? _safe(() => answerPlantQuestion(c as any), null) : null;
  return Object.freeze({
    runtimeVersion: GLOBAL_PLANT_PLATFORM_VERSION,
    generatedAt:    _now(),
    base,
    registry,
    tasks,
    health,
    knowledge,
    profileFull,
    registration,
    knowledgeAnswer,
    versions: Object.freeze({
      categories: PLANT_CATEGORIES_VERSION,
      library:    PLANT_LIBRARY_VERSION,
      search:     PLANT_SEARCH_VERSION,
      profile:    PLANT_PROFILE_VERSION,
      registry:   PLANT_REGISTRY_VERSION,
      taskEngine: PLANT_TASK_ENGINE_VERSION,
      health:     PLANT_HEALTH_VERSION,
      knowledge:  PLANT_KNOWLEDGE_VERSION,
      profileEngine: PLANT_PROFILE_ENGINE_VERSION,
    }),
    deferred: Object.freeze({
      datasetVolume:
        'spec target is 1,500+ rows; content-team backlog',
      autoAddPersistence:
        'registry.registerPlantFromScan emits a caller-ready '
        + 'payload; persistence stays with the wave-5 single-writer',
      llmAssistant:
        'knowledge Q&A uses deterministic intent routing; no LLM',
      satelliteSignals:
        'satellite intelligence stays gated until backend ships',
    }),
  });
}

export function installGlobalPlantIntelligenceGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__plantLibrary === 'function'
        && typeof w.__plantPlatform === 'function') return true;
    w.__plantLibrary = function (innerCtx: any) {
      const out = globalPlantIntelligence(innerCtx || {});
      try { console.log('[Farroway · Global Plant Intelligence]', out); }
      catch { /* swallow */ }
      return out;
    };
    w.__plantPlatform = function (innerCtx: any) {
      const out = globalPlantPlatform(innerCtx || {});
      try { console.log('[Farroway · Global Plant Platform]', out); }
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
  plantRegistry, registerPlantFromScan, lookupPlant,
  PLANT_REGISTRY_VERSION,
  generatePlantTasks, PLANT_TASK_ENGINE_VERSION,
  computePlantHealthScore, PLANT_HEALTH_BANDS, PLANT_HEALTH_WEIGHTS,
  PLANT_HEALTH_VERSION,
  getPlantKnowledge, answerPlantQuestion, PLANT_KNOWLEDGE_VERSION,
  plantProfileEngine, PLANT_PROFILE_ENGINE_VERSION,
};
