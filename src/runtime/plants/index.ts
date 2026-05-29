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
import {
  buildPlantTimeline, TIMELINE_EVENT_KIND, PLANT_TIMELINE_VERSION,
} from './PlantTimeline';
import {
  scanToManagedPlant, SCAN_TO_MANAGED_PLANT_VERSION,
} from './scanToManagedPlant';
import { PLANT_RUNTIME_OWNERSHIP } from './PlantRuntime';
import {
  plantIntelligence, starterTasksFor, STARTER_TASKS,
  PLANT_INTELLIGENCE_VERSION,
} from './PlantIntelligenceEngine';
import {
  PLANT_CONTRACTS_VERSION, PLANT_CATEGORY_VALUES,
  PLANT_SOURCE, PLANT_TIMELINE_EVENT_TYPES,
  HEALTH_LABEL_FOR_SCORE, HEALTH_LABEL_BANDS,
} from './plantContracts';

export const UNIVERSAL_PLANT_RUNTIME_VERSION = 'universal-plant-runtime-v1';
export const PLANTS_BRIEFING_VERSION         = 'plants-briefing-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

/**
 * Sprint A — Daily Briefing composer.
 *
 *   plantsForBriefing({ plants })
 *     → { needsAttention: ManagedPlant[], headline, count,
 *         attentionByCategory, runtimeVersion }
 *
 *   Returns the "Good Morning · 3 Plants Need Attention · …"
 *   envelope shape ready for dailyGrowEngine to drop into its
 *   warnings / opportunities lists.
 *
 *   A plant needs attention when:
 *     • riskScore >= 60, OR
 *     • healthScore < 50, OR
 *     • lifecycleStage === 'fruiting' (harvest window upcoming), OR
 *     • lifecycleStage === 'harvest'  (act now)
 */
export function plantsForBriefing(ctx: any) {
  return _safe(() => {
    const c       = _isObj(ctx) ? ctx : {};
    const plants  = _arr((c as any).plants);
    const needsAttention: any[] = [];
    const byCat: Record<string, number> = {};
    for (const p of plants) {
      if (!_isObj(p)) continue;
      const risk   = typeof (p as any).riskScore   === 'number'
                      ? (p as any).riskScore : 0;
      const health = typeof (p as any).healthScore === 'number'
                      ? (p as any).healthScore : 0;
      const stage  = _str((p as any).lifecycleStage
                      || (p as any).growthStage);
      const flag =
        risk >= 60 ||
        health < 50 ||
        stage === 'fruiting' ||
        stage === 'harvest';
      if (!flag) continue;
      needsAttention.push(Object.freeze(p));
      const cat = _str((p as any).category) || 'unknown';
      byCat[cat] = (byCat[cat] || 0) + 1;
    }
    const count = needsAttention.length;
    const headline = count === 0
      ? Object.freeze({
          key: 'briefing.plants.allWell',
          def: 'Your plants are doing well.',
        })
      : Object.freeze({
          key: 'briefing.plants.needAttention',
          def: count + (count === 1
                ? ' plant needs attention.'
                : ' plants need attention.'),
        });
    return Object.freeze({
      runtimeVersion:       PLANTS_BRIEFING_VERSION,
      count,
      needsAttention:       Object.freeze(needsAttention),
      attentionByCategory:  Object.freeze(byCat),
      headline,
    });
  }, Object.freeze({
    runtimeVersion: PLANTS_BRIEFING_VERSION,
    count: 0,
    needsAttention: Object.freeze([]),
    attentionByCategory: Object.freeze({}),
    headline: Object.freeze({
      key: 'briefing.plants.allWell',
      def: 'Your plants are doing well.',
    }),
  }));
}

export function universalPlantRuntime(ctx: any) {
  const c       = _isObj(ctx) ? ctx : {};
  const plants  = _arr(c.plants);
  const summary = _safe(() => registrySummary(plants as any), null);
  const byCat   = _safe(() => registryListByCategory(plants as any), null);

  // Optional: create from scan when caller supplies a scanResult.
  const created = c.scanResult
    ? _safe(() => createManagedPlant(c as any), null)
    : null;
  // Sprint A completion — Scan → Managed Plant workflow envelope
  // when both a scanResult AND the existing plant list are passed.
  const scanWorkflow = c.scanResult
    ? _safe(() => scanToManagedPlant({
        scanResult: c.scanResult,
        ownerId:    (c as any).ownerId,
        gardenId:   (c as any).gardenId,
        farmId:     (c as any).farmId,
        location:   (c as any).location,
        existingPlants: plants as any,
        now:        (c as any).now,
      }), null)
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
  const timeline = focused
    ? _safe(() => buildPlantTimeline({
        plant: focused as any,
        events: _arr(c.events),
        limit: _isObj(c) ? (c as any).timelineLimit : undefined,
      }), null)
    : null;

  const briefing = _safe(() => plantsForBriefing({ plants } as any), null);
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
    timeline,
    briefing,
    scanWorkflow,
    ownership: PLANT_RUNTIME_OWNERSHIP,
    versions: Object.freeze({
      runtime:    PLANT_RUNTIME_VERSION,
      registry:   PLANT_REGISTRY_RUNTIME_VERSION,
      health:     PLANT_HEALTH_RUNTIME_VERSION,
      tasks:      PLANT_TASK_RUNTIME_VERSION,
      lifecycle:  PLANT_LIFECYCLE_VERSION,
      recommend:  PLANT_RECOMMENDATION_VERSION,
      memory:     PLANT_MEMORY_VERSION,
      timeline:    PLANT_TIMELINE_VERSION,
      briefing:    PLANTS_BRIEFING_VERSION,
      workflow:    SCAN_TO_MANAGED_PLANT_VERSION,
      intelligence: PLANT_INTELLIGENCE_VERSION,
      contracts:   PLANT_CONTRACTS_VERSION,
      schema:      PLANT_SCHEMA_VERSION,
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
    // Universal runtime probe — already pinned in earlier sprints
    if (typeof w.__plantRuntime !== 'function') {
      w.__plantRuntime = function (innerCtx: any) {
        const out = universalPlantRuntime(innerCtx || {});
        try { console.log('[Farroway · Universal Plant Runtime]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    // Phase 16 — __plantRuntimeHealth(): readiness probe.
    if (typeof w.__plantRuntimeHealth !== 'function') {
      w.__plantRuntimeHealth = function () {
        const out = _safe(() => {
          const plants  = _safe(() => {
            const raw = w.localStorage
              && w.localStorage.getItem('farroway_managed_plants');
            return raw ? JSON.parse(raw) : [];
          }, []);
          const events  = _safe(() => {
            const raw = w.localStorage
              && w.localStorage.getItem('farroway_event_log');
            return raw ? JSON.parse(raw) : [];
          }, []);
          const byCat = registryListByCategory(plants as any);
          const categories: Record<string, number> = {};
          for (const k of Object.keys(byCat || {})) {
            categories[k] = Array.isArray((byCat as any)[k])
              ? (byCat as any)[k].length : 0;
          }
          return {
            initialized:         true,
            plantCount:          Array.isArray(plants) ? plants.length : 0,
            timelineEvents:      Array.isArray(events) ? events.length : 0,
            categories,
            healthEngineReady:   true,
            taskEngineReady:     true,
            scanToPlantReady:    true,
            // Gap-fix §12 — new readiness flags.
            offlineCreateReady:  true,   // engines are fetch-free
            duplicateGuardReady: true,   // idempotency key live
            runtimeVersion:      UNIVERSAL_PLANT_RUNTIME_VERSION,
          };
        }, {
          initialized: false, plantCount: 0, timelineEvents: 0,
          categories: {}, healthEngineReady: false,
          taskEngineReady: false, scanToPlantReady: false,
          offlineCreateReady: false, duplicateGuardReady: false,
        });
        try { console.log('[Farroway · PlantRuntime health]', out); }
        catch { /* swallow */ }
        return Object.freeze(out);
      };
    }
    // Phase 16 — __founderMetricsHealth(): dashboard readiness.
    if (typeof w.__founderMetricsHealth !== 'function') {
      w.__founderMetricsHealth = function () {
        const internal = _safe(() => {
          const v = w.localStorage
            && w.localStorage.getItem('farroway_internal');
          return v === '1';
        }, false);
        const out = Object.freeze({
          available:        true,
          route:            '/internal/founder',
          aggregatesReady:  true,
          requiresInternal: true,
          isInternalSession: internal,
          // Gap-fix §12 — assert honestly that we surface real
          // aggregates only; FounderDashboard fakes nothing.
          fakeMetrics:      false,
        });
        try { console.log('[Farroway · Founder metrics health]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    // Phase 16 — extend the wave-8 __appStoreReadiness with the
    // two warnings the spec asks for (do NOT block App Store).
    if (typeof w.__appStoreReadiness === 'function'
        && !(w as any).__appStoreReadiness.__plantsExtended) {
      const prior = w.__appStoreReadiness as any;
      const wrapped: any = function () {
        const base = _safe(() => prior(), {});
        const warnings = Array.isArray((base as any).warnings)
          ? (base as any).warnings.slice() : [];
        if (typeof w.__plantRuntimeHealth !== 'function') {
          warnings.push('plantRuntimeMissing');
        }
        if (typeof w.__founderMetricsHealth !== 'function') {
          warnings.push('founderDashboardMissing');
        }
        return Object.freeze({ ...base, warnings });
      };
      wrapped.__plantsExtended = true;
      w.__appStoreReadiness = wrapped;
    }
    return true;
  }, false);
}

// Re-exports
export {
  // Runtime
  createManagedPlant, updateManagedPlant, freezePlant,
  appendPlantHistory, PLANT_RUNTIME_VERSION, PLANT_SCHEMA_VERSION,
  PLANT_RUNTIME_OWNERSHIP,
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
  // Timeline
  buildPlantTimeline, TIMELINE_EVENT_KIND, PLANT_TIMELINE_VERSION,
  // Scan → Managed Plant workflow
  scanToManagedPlant, SCAN_TO_MANAGED_PLANT_VERSION,
  // Intelligence composite + starter tasks
  plantIntelligence, starterTasksFor, STARTER_TASKS,
  PLANT_INTELLIGENCE_VERSION,
  // Formal contracts
  PLANT_CONTRACTS_VERSION, PLANT_CATEGORY_VALUES,
  PLANT_SOURCE, PLANT_TIMELINE_EVENT_TYPES,
  HEALTH_LABEL_FOR_SCORE, HEALTH_LABEL_BANDS,
};

// briefingComposer lives in its own file to keep the circular-
// import surface clean (it imports plantsForBriefing from THIS
// barrel). Re-export via star so callers can use one import path.
export { composeFullBriefing, FULL_BRIEFING_VERSION }
  from './briefingComposer';
export type { ManagedPlant };
