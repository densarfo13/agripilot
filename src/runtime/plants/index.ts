/**
 * src/runtime/plants/index.ts — Universal Plant Runtime barrel
 * + composite + global install.
 *
 *   import {
 *     universalPlantRuntime,
 *     installUniversalPlantRuntimeGlobal,
 *     UNIVERSAL_PLANT_RUNTIME_VERSION,
 *   } from 'src/runtime/plants';
 *
 *   universalPlantRuntime({
 *     plants:  managedList,
 *     events,  weather, season, region,
 *     scanResult, ownerId, location,
 *   });
 *
 * What this is
 * ────────────
 *   Single chokepoint for the Universal Plant Runtime. Combines:
 *     • PlantRuntime         — Plant interface + createManagedPlant
 *     • PlantRegistry        — managed-record store helpers
 *     • PlantHealthEngine    — score + history snapshot
 *     • PlantTaskEngine      — task generation + fold-into-record
 *     • PlantLifecycleEngine — stage transitions + history
 *     • PlantRecommendationEngine — composed suggestions
 *     • PlantMemoryGraph     — per-plant materialized timelines
 *
 *   Pins window.__plantRuntime() so QA can introspect the
 *   composite from the production console.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only over catalog (src/modules/plants/) +
 *     intelligence/runtime engines.
 *   • Wave-5 single-writer preserved.
 *   • No fetch, no LLM, no PII.
 */

import {
  createManagedPlant, updateManagedPlant, freezePlant,
  appendPlantHistory, PLANT_RUNTIME_VERSION, PLANT_SCHEMA_VERSION,
  ManagedPlant,
} from './PlantRuntime';
import {
  registryAddPlant, registryUpdatePlant, registryRemovePlant,
  registryFindPlant, registryListByCategory, registrySummary,
  PLANT_REGISTRY_RUNTIME_VERSION,
} from './PlantRegistry';
import {
  scoreManagedPlant, appendHealthSnapshot,
  PLANT_HEALTH_RUNTIME_VERSION,
  PLANT_HEALTH_BANDS, PLANT_HEALTH_WEIGHTS,
} from './PlantHealthEngine';
import {
  generateTasksForManagedPlant, PLANT_TASK_RUNTIME_VERSION,
} from './PlantTaskEngine';
import {
  advancePlantStage, derivePlantStage, markPlantDormant,
  PLANT_LIFECYCLE_STAGES, PLANT_LIFECYCLE_STAGE_ORDER,
  PLANT_LIFECYCLE_VERSION,
} from './PlantLifecycleEngine';
import {
  recommendForManagedPlant, PLANT_RECOMMENDATION_VERSION,
} from './PlantRecommendationEngine';
import {
  buildPlantMemory, PLANT_MEMORY_VERSION,
} from './PlantMemoryGraph';

export const UNIVERSAL_PLANT_RUNTIME_VERSION = 'universal-plant-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

export function universalPlantRuntime(ctx: any) {
  const c       = _isObj(ctx) ? ctx : {};
  const plants  = _arr(c.plants);
  const summary = _safe(() => registrySummary(plants as any), null);
  const byCat   = _safe(() => registryListByCategory(plants as any), null);

  // Optional: create from scan when caller supplies a scanResult.
  const created = c.scanResult
    ? _safe(() => createManagedPlant(c as any), null)
    : null;

  // Optional: focused-plant signals — health, tasks, recs, memory.
  const focusId  = _isObj(c) ? (c as any).focusPlantId : null;
  const focused  = focusId && registryFindPlant(plants as any, focusId);
  const health   = focused
    ? _safe(() => scoreManagedPlant(focused as any, c as any), null) : null;
  const tasks    = focused
    ? _safe(() => generateTasksForManagedPlant(focused as any, c as any), null)
    : null;
  const recs     = focused
    ? _safe(() => recommendForManagedPlant(focused as any, c as any), null)
    : null;
  const memory   = focused
    ? _safe(() => buildPlantMemory({
        plant: focused as any, events: _arr(c.events),
      }), null)
    : null;

  return Object.freeze({
    runtimeVersion: UNIVERSAL_PLANT_RUNTIME_VERSION,
    generatedAt:    _now(),
    summary,
    byCategory:     byCat,
    created,
    focused,
    health,
    tasks,
    recommendations: recs,
    memory,
    versions: Object.freeze({
      runtime:    PLANT_RUNTIME_VERSION,
      registry:   PLANT_REGISTRY_RUNTIME_VERSION,
      health:     PLANT_HEALTH_RUNTIME_VERSION,
      tasks:      PLANT_TASK_RUNTIME_VERSION,
      lifecycle:  PLANT_LIFECYCLE_VERSION,
      recommend:  PLANT_RECOMMENDATION_VERSION,
      memory:     PLANT_MEMORY_VERSION,
      schema:     PLANT_SCHEMA_VERSION,
    }),
    deferred: Object.freeze({
      persistence:
        'every engine emits immutable records; the wave-5 '
        + 'single-writer (UI + journal store) owns the writes',
      uiSurface:
        'MyPlants.jsx ships the home grid; richer plant-profile '
        + 'pages compose this runtime + the catalog tier',
      crossSession:
        'no cross-session memory beyond the caller-supplied '
        + 'event log + plant.history array',
      llmAssistant:
        'recommendations are deterministic; no LLM',
    }),
  });
}

export function installUniversalPlantRuntimeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__plantRuntime === 'function') return true;
    w.__plantRuntime = function (innerCtx: any) {
      const out = universalPlantRuntime(innerCtx || {});
      try { console.log('[Farroway · Universal Plant Runtime]', out); }
      catch { /* swallow */ }
      return out;
    };
    return true;
  }, false);
}

// Re-exports
export {
  // Runtime
  createManagedPlant, updateManagedPlant, freezePlant,
  appendPlantHistory, PLANT_RUNTIME_VERSION, PLANT_SCHEMA_VERSION,
  // Registry
  registryAddPlant, registryUpdatePlant, registryRemovePlant,
  registryFindPlant, registryListByCategory, registrySummary,
  PLANT_REGISTRY_RUNTIME_VERSION,
  // Health
  scoreManagedPlant, appendHealthSnapshot,
  PLANT_HEALTH_RUNTIME_VERSION,
  PLANT_HEALTH_BANDS, PLANT_HEALTH_WEIGHTS,
  // Tasks
  generateTasksForManagedPlant, PLANT_TASK_RUNTIME_VERSION,
  // Lifecycle
  advancePlantStage, derivePlantStage, markPlantDormant,
  PLANT_LIFECYCLE_STAGES, PLANT_LIFECYCLE_STAGE_ORDER,
  PLANT_LIFECYCLE_VERSION,
  // Recommendations
  recommendForManagedPlant, PLANT_RECOMMENDATION_VERSION,
  // Memory
  buildPlantMemory, PLANT_MEMORY_VERSION,
};
export type { ManagedPlant };
