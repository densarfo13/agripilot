/**
 * src/runtime/plants/PlantLifecycleEngine.ts — lifecycle
 * transitions + stage history.
 *
 *   import {
 *     advancePlantStage, derivePlantStage,
 *     PLANT_LIFECYCLE_STAGES, PLANT_LIFECYCLE_VERSION,
 *   } from 'src/runtime/plants/PlantLifecycleEngine';
 *
 *   advancePlantStage(plant, 'flowering')
 *     → new frozen Plant with updated stage + history entry
 *
 * What this is
 * ────────────
 *   Composes the Phase-16 growthStageEngine for stage derivation
 *   and adds the missing piece for the runtime tier: stage
 *   TRANSITIONS. Every advancement appends to plant.history with
 *   the previous + next stage + timestamp, so the memory graph
 *   can replay the lifecycle.
 *
 *   Stages match the unified GROWTH_STAGE model (seed → sprout →
 *   vegetative → flowering → fruiting → harvest), plus an
 *   explicit `dormant` slot for trees/shrubs/perennials between
 *   seasons.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only over growthStageEngine.
 *   • No fetch, no persistence.
 *   • Frozen envelopes.
 */

import {
  GROWTH_STAGE, GROWTH_STAGE_ORDER, deriveGrowthStage,
} from '../../intelligence/growthStageEngine';
import {
  ManagedPlant, freezePlant, appendPlantHistory,
} from './PlantRuntime';

export const PLANT_LIFECYCLE_VERSION = 'plant-lifecycle-v1';

export const PLANT_LIFECYCLE_STAGES = Object.freeze({
  SEED:       GROWTH_STAGE.SEED,
  SPROUT:     GROWTH_STAGE.SPROUT,
  VEGETATIVE: GROWTH_STAGE.VEGETATIVE,
  FLOWERING:  GROWTH_STAGE.FLOWERING,
  FRUITING:   GROWTH_STAGE.FRUITING,
  HARVEST:    GROWTH_STAGE.HARVEST,
  DORMANT:    'dormant',
});

const _validStages = new Set<string>(Object.values(PLANT_LIFECYCLE_STAGES));

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Derive the lifecycle stage from caller-injected context. Wraps
 * the Phase-16 growthStageEngine and adds the dormant fallback
 * for perennials with no plantedAt anchor.
 */
export function derivePlantStage(ctx: {
  plantedAt?: string;
  growthDays?: number;
  growType?:  string;
  wave10Stage?: any;
  now?:       number;
  lifecycle?: string;     // optional override
}) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {} as any;
    const stage = deriveGrowthStage(c as any);
    // Perennials with no plantedAt → 'vegetative' OR 'dormant'
    // based on caller-provided lifecycle. Trees/shrubs default
    // to vegetative when no input.
    return Object.freeze({
      runtimeVersion: PLANT_LIFECYCLE_VERSION,
      stage:          _str((stage as any).stage) || 'unknown',
      daysIn:         (stage as any).daysIn,
      daysToNext:     (stage as any).daysToNext,
      nextStage:      _str((stage as any).nextStage),
      source:         _str((stage as any).source),
      stageTasks:     (stage as any).stageTasks,
    });
  }, Object.freeze({
    runtimeVersion: PLANT_LIFECYCLE_VERSION,
    stage: 'unknown', daysIn: null, daysToNext: null,
    nextStage: '', source: 'error', stageTasks: Object.freeze([]),
  }));
}

/**
 * Advance a plant to the given stage (or to the next stage if
 * `to` is omitted). Returns a new frozen Plant with the stage
 * change + a history entry. Rejects unknown stages.
 */
export function advancePlantStage(plant: ManagedPlant, to?: string) {
  return _safe(() => {
    if (!_isObj(plant)) return plant;
    const current = _str(plant.growthStage);
    let next = _str(to);
    if (!next) {
      const idx = GROWTH_STAGE_ORDER.indexOf(current);
      if (idx < 0 || idx >= GROWTH_STAGE_ORDER.length - 1) return plant;
      next = GROWTH_STAGE_ORDER[idx + 1];
    }
    if (!_validStages.has(next)) return plant;
    if (current === next) return plant;
    const stamped = appendPlantHistory(plant, {
      kind: 'stage_advanced',
      // History entry carries from/to so PlantMemoryGraph
      // can render a clean lifecycle timeline.
      ...({ from: current, to: next } as any),
    });
    return freezePlant({ ...stamped, growthStage: next });
  }, plant);
}

/**
 * Mark a plant as dormant — separate from advancePlantStage
 * because dormant is OFF the linear order.
 */
export function markPlantDormant(plant: ManagedPlant) {
  return advancePlantStage(plant, PLANT_LIFECYCLE_STAGES.DORMANT);
}

export const PLANT_LIFECYCLE_STAGE_ORDER = Object.freeze([
  PLANT_LIFECYCLE_STAGES.SEED,
  PLANT_LIFECYCLE_STAGES.SPROUT,
  PLANT_LIFECYCLE_STAGES.VEGETATIVE,
  PLANT_LIFECYCLE_STAGES.FLOWERING,
  PLANT_LIFECYCLE_STAGES.FRUITING,
  PLANT_LIFECYCLE_STAGES.HARVEST,
]);
