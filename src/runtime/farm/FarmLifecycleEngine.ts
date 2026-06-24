/**
 * FarmLifecycleEngine.ts — sprint #216 §1.
 *
 * Derives the farm's operating state from signals the app already
 * holds (profile + crop stage + scan/harvest history). The state is
 * the anchor for "no state → no recommendation": a caller that has no
 * resolvable state must show setup guidance, not a recommendation.
 *
 * Read-only composition. Pure. Never throws. Pins
 * window.__farmLifecycleHealth().
 */

import { inferCropStage } from '../farmBrain/CropStageEngine';

export const FARM_LIFECYCLE_ENGINE_VERSION = 'farm-lifecycle-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export const FARM_STATES = Object.freeze([
  'CREATED', 'ONBOARDED', 'CROP_SELECTED', 'PLANTED', 'ACTIVE_GROWTH',
  'FLOWERING', 'FRUITING', 'HARVEST_READY', 'HARVESTED', 'POST_HARVEST',
  'INACTIVE',
] as const);
export type FarmState = (typeof FARM_STATES)[number];

// Crop stage → farm operating state.
const STAGE_TO_STATE: Readonly<Record<string, FarmState>> = Object.freeze({
  germination: 'PLANTED', seedling: 'ACTIVE_GROWTH', vegetative: 'ACTIVE_GROWTH',
  flowering: 'FLOWERING', fruiting: 'FRUITING', maturity: 'HARVEST_READY',
});

export function resolveFarmState(input: {
  farmExists?: boolean;
  onboarded?: boolean;
  crop?: string;
  plantingDate?: string;
  asOf?: string;
  harvested?: boolean;
  lastActivityDaysAgo?: number | null;
} = {}): Readonly<{
  runtimeVersion: string;
  state: FarmState | null;     // null = no resolvable state (no rec allowed)
  hasState: boolean;
  cropStage: string | null;
}> {
  return _safe(() => {
    if (!input.farmExists) {
      return Object.freeze({ runtimeVersion: FARM_LIFECYCLE_ENGINE_VERSION, state: 'CREATED' as FarmState, hasState: true, cropStage: null });
    }
    if (input.harvested) {
      return Object.freeze({ runtimeVersion: FARM_LIFECYCLE_ENGINE_VERSION, state: 'POST_HARVEST' as FarmState, hasState: true, cropStage: null });
    }
    const inactive = typeof input.lastActivityDaysAgo === 'number' && input.lastActivityDaysAgo > 60;
    if (inactive) {
      return Object.freeze({ runtimeVersion: FARM_LIFECYCLE_ENGINE_VERSION, state: 'INACTIVE' as FarmState, hasState: true, cropStage: null });
    }
    const crop = _str(input.crop);
    if (!crop) {
      const st: FarmState = input.onboarded ? 'ONBOARDED' : 'CREATED';
      return Object.freeze({ runtimeVersion: FARM_LIFECYCLE_ENGINE_VERSION, state: st, hasState: true, cropStage: null });
    }
    const planting = _str(input.plantingDate);
    if (!planting) {
      return Object.freeze({ runtimeVersion: FARM_LIFECYCLE_ENGINE_VERSION, state: 'CROP_SELECTED' as FarmState, hasState: true, cropStage: null });
    }
    const stageProbe = inferCropStage({ crop, plantingDate: planting, asOf: input.asOf });
    const stage = stageProbe.stage;
    const state = (stage && STAGE_TO_STATE[stage]) || 'PLANTED';
    return Object.freeze({
      runtimeVersion: FARM_LIFECYCLE_ENGINE_VERSION,
      state, hasState: true, cropStage: stage !== 'unknown' ? stage : null,
    });
  }, Object.freeze({
    runtimeVersion: FARM_LIFECYCLE_ENGINE_VERSION,
    state: null, hasState: false, cropStage: null,
  }));
}

/**
 * The "no state → no recommendation" guard. Returns true only when a
 * farm state exists to anchor a recommendation/task/alert.
 */
export function canRecommend(state: FarmState | null | undefined): boolean {
  return !!state && (FARM_STATES as ReadonlyArray<string>).includes(state);
}

export function buildFarmLifecycleHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  farmLifecycleReady: true; states: number; noStateNoRecommendation: true;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: FARM_LIFECYCLE_ENGINE_VERSION,
    farmLifecycleReady: true as const,
    states: FARM_STATES.length,
    noStateNoRecommendation: true as const,
  });
}

let _installed = false;
export function installFarmLifecycleHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__farmLifecycleHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildFarmLifecycleHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  resolveFarmState, canRecommend, buildFarmLifecycleHealth, installFarmLifecycleHealthGlobal,
});
export default resolveFarmState;
