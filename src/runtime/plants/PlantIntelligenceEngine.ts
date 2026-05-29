/**
 * src/runtime/plants/PlantIntelligenceEngine.ts — composite
 * over the 4 intelligence facades.
 *
 *   import {
 *     plantIntelligence, STARTER_TASKS,
 *     PLANT_INTELLIGENCE_VERSION,
 *   } from 'src/runtime/plants/PlantIntelligenceEngine';
 *
 *   plantIntelligence({ plantId, season, weather, haveInGarden,
 *                       lifecycleStage })
 *
 * What this is
 * ────────────
 *   Single chokepoint over flowerIntelligence + companionPlanting
 *   + pollinatorIntelligence + bloomForecast. Returns one frozen
 *   envelope per plant; PlantProfile reads `intelligence` and
 *   renders the right card per category (flower → bloom +
 *   pollinator, all → companions).
 *
 *   Also exposes STARTER_TASKS — the per-plant starter task list
 *   the spec calls out (rose / tomato / basil / monstera / maize).
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only over the 4 facades.
 *   • No fetch, no LLM.
 *   • Frozen envelopes.
 */

import { flowerIntelligence } from './intelligence/flowerIntelligence';
import { companionPlanting }  from './intelligence/companionPlanting';
import { pollinatorIntelligence } from './intelligence/pollinatorIntelligence';
import { bloomForecast }      from './intelligence/bloomForecast';
import { findPlant }          from '../../data/plants/index.js';

export const PLANT_INTELLIGENCE_VERSION = 'plant-intelligence-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/* Starter tasks — Phase 9 spec list. Each task carries a stable
   kind + i18n key + default copy. Used by PlantTaskEngine to
   seed a newly-created plant. */
export const STARTER_TASKS = Object.freeze({
  rose: [
    { kind: 'water_lightly',     labelKey: 'plant.task.waterLightly',
      labelDefault: 'Water lightly' },
    { kind: 'inspect_aphids',    labelKey: 'plant.task.inspectAphids',
      labelDefault: 'Inspect for aphids' },
    { kind: 'remove_dead_blooms', labelKey: 'plant.task.removeDeadBlooms',
      labelDefault: 'Remove dead blooms' },
  ],
  tomato: [
    { kind: 'water_deeply',      labelKey: 'plant.task.waterDeeply',
      labelDefault: 'Water deeply' },
    { kind: 'inspect_blight',    labelKey: 'plant.task.inspectBlight',
      labelDefault: 'Inspect for blight' },
    { kind: 'support_stems',     labelKey: 'plant.task.supportStems',
      labelDefault: 'Support stems' },
  ],
  basil: [
    { kind: 'harvest_top_leaves', labelKey: 'plant.task.harvestTopLeaves',
      labelDefault: 'Harvest top leaves' },
    { kind: 'check_soil_moisture', labelKey: 'plant.task.checkSoilMoisture',
      labelDefault: 'Check soil moisture' },
    { kind: 'inspect_mildew',     labelKey: 'plant.task.inspectMildew',
      labelDefault: 'Inspect for mildew' },
  ],
  monstera: [
    { kind: 'check_soil_moisture', labelKey: 'plant.task.checkSoilMoisture',
      labelDefault: 'Check soil moisture' },
    { kind: 'rotate_plant',       labelKey: 'plant.task.rotatePlant',
      labelDefault: 'Rotate plant' },
    { kind: 'wipe_leaves',        labelKey: 'plant.task.wipeLeaves',
      labelDefault: 'Wipe leaves' },
  ],
  maize: [
    { kind: 'inspect_leaves',     labelKey: 'plant.task.inspectLeaves',
      labelDefault: 'Inspect leaves' },
    { kind: 'check_soil_moisture', labelKey: 'plant.task.checkSoilMoisture',
      labelDefault: 'Check soil moisture' },
    { kind: 'monitor_pests',      labelKey: 'plant.task.monitorPests',
      labelDefault: 'Monitor pests' },
  ],
});

export function starterTasksFor(plantId: string) {
  const id = _str(plantId);
  const table = STARTER_TASKS as Record<string, ReadonlyArray<any>>;
  if (table[id]) {
    return Object.freeze(table[id].map((t) => Object.freeze({
      ...t,
      priority: 3,
      starter: true,
    })));
  }
  // Sensible fallback for unlisted plants — universal care.
  return Object.freeze([
    Object.freeze({
      kind: 'check_plant', priority: 3,
      labelKey: 'plant.task.checkPlant',
      labelDefault: 'Check on plant — note any changes.',
      starter: true,
    }),
  ]);
}

interface IntelligenceCtx {
  plantId?:        string;
  season?:         string;
  weather?:        any;
  haveInGarden?:   string[];
  lifecycleStage?: string;
  now?:            number;
}

export function plantIntelligence(ctx: IntelligenceCtx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {} as IntelligenceCtx;
    const id    = _str(c.plantId);
    const plant = id ? findPlant(id) : null;
    if (!plant) {
      return Object.freeze({
        runtimeVersion: PLANT_INTELLIGENCE_VERSION,
        ok: false, reason: 'plant_not_in_db',
        plantId: id,
      });
    }
    const category = _str((plant as any).type);

    const companions = companionPlanting({
      plantId: id,
      haveInGarden: _arr(c.haveInGarden).map(_str),
    });
    const pollinator = pollinatorIntelligence({ plantId: id });
    const bloom      = bloomForecast({
      plantId: id, season: _str(c.season),
      lifecycleStage: _str(c.lifecycleStage), weather: c.weather,
    } as any);
    const flowerCare = category === 'flower'
      ? flowerIntelligence({
          plantId: id, weather: c.weather, season: _str(c.season),
          haveInGarden: c.haveInGarden, now: c.now,
        })
      : null;
    const starterTasks = starterTasksFor(id);

    return Object.freeze({
      runtimeVersion: PLANT_INTELLIGENCE_VERSION,
      ok:             true,
      reason:         '',
      plantId:        id,
      category,
      starterTasks,
      companions,
      pollinator,
      bloom,
      flowerCare,
      versions: Object.freeze({
        flower:     flowerCare && (flowerCare as any).runtimeVersion,
        companion:  (companions as any).runtimeVersion,
        pollinator: (pollinator as any).runtimeVersion,
        bloom:      (bloom as any).runtimeVersion,
      }),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_INTELLIGENCE_VERSION,
    ok: false, reason: 'error',
    plantId: '',
  }));
}
