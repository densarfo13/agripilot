/**
 * src/modules/plants/PlantTaskEngine.ts — per-plant today-task
 * generator.
 *
 *   import {
 *     generatePlantTasks, PLANT_TASK_ENGINE_VERSION,
 *   } from 'src/modules/plants/PlantTaskEngine';
 *
 *   generatePlantTasks({
 *     plantId, weather, weatherForecast, season,
 *     growthStage, lastWateredAt, lastFertilizedAt,
 *     lastRepottedAt, ambient,
 *   });
 *
 * What this is
 * ────────────
 *   The single chokepoint that turns a registered plant into the
 *   list of things the user should do TODAY. Composes existing
 *   engines per category:
 *
 *     flower / herb  → flowerAdvisor.todayTasks
 *     houseplant     → composeIndoorCare.tasks
 *     tree           → stage-derived tasks (long perennial lifecycle)
 *     crop/veg/fruit → stage-derived + flowerAdvisor fallback
 *
 *   Then the weather-task-adjuster cancels watering on rain
 *   forecast / adds drainage inspection / adds stake-check on
 *   high wind, etc. The output is the same {kept, cancelled,
 *   added} envelope dailyGrowEngine already uses, plus a
 *   simplified `tasks` field (kept ∪ added, priority-sorted).
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — does NOT modify flowerAdvisor /
 *     composeIndoorCare / weatherTaskAdjuster.
 *   • All copy via tSafe envelopes.
 *   • Honest empty list when input is thin.
 */

import { findPlant } from '../../data/plants/index.js';
import { flowerAdvisor }    from '../../runtime/grow/flowerAdvisor';
import { composeIndoorCare } from '../../runtime/grow/indoorPlantCare.js';
import { deriveGrowthStage, stageTasks }
  from '../../intelligence/growthStageEngine';
import { adjustTasksForWeather }
  from '../../intelligence/weatherTaskAdjuster';

export const PLANT_TASK_ENGINE_VERSION = 'plant-task-engine-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface PlantTaskCtx {
  plantId?:         string;
  growType?:        string;
  weather?:         any;
  weatherForecast?: any;
  season?:          string;
  growthStage?:     { stage?: string };
  plantedAt?:       string;
  lastWateredAt?:   string;
  lastFertilizedAt?: string;
  lastRepottedAt?:  string;
  ambient?:         { humidity?: number; lightLevel?: string };
  now?:             number;
}

function _baseTasksForPlant(plant: any, c: PlantTaskCtx): any[] {
  const cat = _str(plant.type);
  const growType = _str(c.growType) || cat;

  if (cat === 'flower' || cat === 'herb'
      || growType === 'flower' || growType === 'herb') {
    const adv = flowerAdvisor({
      plantId: _str(plant.id),
      weather: c.weather, season: _str(c.season),
      lastWateredAt: c.lastWateredAt,
      lastFertilizedAt: c.lastFertilizedAt,
      now: c.now,
    } as any);
    return _arr((adv as any).todayTasks).slice();
  }

  if (cat === 'houseplant' || growType === 'houseplant') {
    const care = composeIndoorCare({
      plantId: _str(plant.id),
      lastWateredAt: c.lastWateredAt,
      lastRepottedAt: c.lastRepottedAt,
      ambient: c.ambient,
      now: c.now,
    } as any);
    return _arr((care as any).tasks).slice();
  }

  // Tree, crop, vegetable, fruit — start with a base "inspect"
  // task; stage-derived tasks layer on below.
  return [
    Object.freeze({
      kind: 'inspect_plant', priority: 3,
      labelKey: 'plant.task.inspect',
      labelDefault: 'Check on the plant — note any changes.',
    }),
  ];
}

export function generatePlantTasks(ctx: PlantTaskCtx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {} as PlantTaskCtx;
    const plant = _str(c.plantId) ? findPlant(c.plantId) : null;
    if (!plant) {
      return Object.freeze({
        runtimeVersion: PLANT_TASK_ENGINE_VERSION,
        plantId: _str(c.plantId),
        found:   false,
        tasks:        Object.freeze([]),
        cancelled:    Object.freeze([]),
        added:        Object.freeze([]),
        stage:        '',
      });
    }

    // 1. Per-category base tasks
    let base = _baseTasksForPlant(plant, c);

    // 2. Stage-derived tasks
    const stage = deriveGrowthStage({
      plantedAt: c.plantedAt,
      growthDays: _num(plant.growthDays) || undefined,
      growType: _str(plant.type),
      wave10Stage: c.growthStage as any,
      now: c.now,
    } as any);
    const sTasks = stageTasks(_str((stage as any).stage));
    base = base.concat(_arr(sTasks));

    // 3. Weather adjust (cancel watering on rain, add drainage
    //    inspection, add cover-plants on frost, etc.)
    const adj = adjustTasksForWeather({
      tasks: base,
      weatherForecast: c.weatherForecast || c.weather,
      growType: _str(plant.type),
    } as any);

    // 4. Final list — kept ∪ added, priority-sorted, capped at 8
    const finalTasks = _arr((adj as any).kept)
      .concat(_arr((adj as any).added))
      .filter(_isObj)
      .sort((a: any, b: any) =>
        ((_num(a.priority) || 9) - (_num(b.priority) || 9)))
      .slice(0, 8);

    return Object.freeze({
      runtimeVersion: PLANT_TASK_ENGINE_VERSION,
      plantId:        _str(plant.id),
      found:          true,
      stage:          _str((stage as any).stage),
      tasks:          Object.freeze(finalTasks),
      cancelled:      _arr((adj as any).cancelled),
      added:          _arr((adj as any).added),
      weatherSignals: (adj as any).signals,
    });
  }, Object.freeze({
    runtimeVersion: PLANT_TASK_ENGINE_VERSION,
    plantId: '', found: false, stage: '',
    tasks: Object.freeze([]),
    cancelled: Object.freeze([]),
    added:     Object.freeze([]),
    weatherSignals: Object.freeze({}),
  }));
}
