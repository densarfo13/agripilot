/**
 * src/runtime/plants/PlantTaskEngine.ts — runtime-tier task
 * generator (composes catalog tasks + folds into Plant record).
 *
 *   import {
 *     generateTasksForManagedPlant,
 *     PLANT_TASK_RUNTIME_VERSION,
 *   } from 'src/runtime/plants/PlantTaskEngine';
 *
 *   const next = generateTasksForManagedPlant(plant, ctx);
 *
 * What this is
 * ────────────
 *   Calls the catalog `generatePlantTasks` for the actual task
 *   composition, then folds the result back into the managed
 *   Plant record (replacing .tasks + appending a history entry).
 *
 *   Composition-only — does NOT modify the catalog engine. The
 *   catalog engine handles weather adjustment, stage tasks,
 *   per-category routing (flower/houseplant/tree/crop/etc).
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only.
 *   • No persistence writes.
 *   • Frozen envelopes.
 */

import {
  generatePlantTasks,
} from '../../modules/plants/PlantTaskEngine';
import {
  ManagedPlant, freezePlant, appendPlantHistory,
} from './PlantRuntime';

export const PLANT_TASK_RUNTIME_VERSION = 'plant-task-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface TaskCtx {
  plantId?:         string;     // catalog id; defaults to plant.commonName slug
  weather?:         any;
  weatherForecast?: any;
  season?:          string;
  growthStage?:     { stage?: string };
  plantedAt?:       string;
  lastWateredAt?:   string;
  lastFertilizedAt?: string;
  lastRepottedAt?:  string;
  ambient?:         any;
  now?:             number;
}

function _resolveCatalogId(plant: ManagedPlant, ctx: TaskCtx): string {
  if (_str(ctx.plantId)) return _str(ctx.plantId);
  // Most managed-plant IDs are 'plant_<hash>'. The catalog id
  // lives in the embedded scanResult or commonName — caller
  // should pass plantId explicitly for accuracy. Fall back to
  // the lower-cased common name as a heuristic.
  return _str(plant.commonName).toLowerCase().replace(/\s+/g, '_');
}

export function generateTasksForManagedPlant(plant: ManagedPlant,
                                                ctx: TaskCtx) {
  return _safe(() => {
    if (!_isObj(plant)) return Object.freeze({
      runtimeVersion: PLANT_TASK_RUNTIME_VERSION,
      ok: false, reason: 'no_plant',
      plant, tasks: Object.freeze([]),
    });
    const c     = _isObj(ctx) ? ctx : {} as TaskCtx;
    const pid   = _resolveCatalogId(plant, c);
    const env   = generatePlantTasks({
      plantId:          pid,
      growType:         _str(plant.growType),
      weather:          c.weather,
      weatherForecast:  c.weatherForecast,
      season:           c.season,
      growthStage:      { stage: _str(plant.growthStage) },
      plantedAt:        c.plantedAt || _str(plant.createdAt),
      lastWateredAt:    c.lastWateredAt,
      lastFertilizedAt: c.lastFertilizedAt,
      lastRepottedAt:   c.lastRepottedAt,
      ambient:          c.ambient,
      now:              c.now,
    } as any);
    const tasks = Object.freeze(_arr((env as any).tasks).slice());
    const stamped = appendPlantHistory(plant, {
      kind: 'tasks_generated',
      ...({ count: tasks.length,
            stage: _str((env as any).stage) } as any),
    });
    const next = freezePlant({
      ...stamped,
      tasks,
    }) as ManagedPlant;
    return Object.freeze({
      runtimeVersion: PLANT_TASK_RUNTIME_VERSION,
      ok: true, reason: '',
      plant: next,
      taskEnvelope: env,
    });
  }, Object.freeze({
    runtimeVersion: PLANT_TASK_RUNTIME_VERSION,
    ok: false, reason: 'error',
    plant, tasks: Object.freeze([]),
  }));
}
