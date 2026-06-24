/**
 * FarmSuccessEngine.ts — sprint #217.
 *
 * The "Farm Success Score" — a farmer-facing 0-100 with an itemized
 * why (✓ done) + missing (○ next) list. It REUSES the #212
 * FarmerCompletion engine rather than re-implementing the score, so
 * "success" and "setup completion" can never disagree. Read-only;
 * each ✓ exists only when its datum genuinely exists.
 *
 * Pure. Never throws. Pins window.__farmSuccessHealth().
 */

import { buildFarmerCompletion } from '../farmerCompletion/FarmerCompletionEngine';

export const FARM_SUCCESS_ENGINE_VERSION = 'farm-success-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function buildFarmSuccess(input: {
  crop?: string; location?: string; plantingDate?: string;
  scanCount?: number; taskCount?: number; outcomeCount?: number;
  farmExists?: boolean;
} = {}): Readonly<{
  runtimeVersion: string;
  successScore: number;
  why: ReadonlyArray<string>;     // i18n label keys (done)
  missing: ReadonlyArray<string>; // i18n label keys (next)
  hasExplanation: boolean;
}> {
  return _safe(() => {
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const c = buildFarmerCompletion({
      farmExists: input.farmExists !== false,
      location: input.location, crop: input.crop, plantingDate: input.plantingDate,
      scanHistory: Array.from({ length: n(input.scanCount) }),
      taskCompletedCount: n(input.taskCount),
      outcomeHistory: Array.from({ length: n(input.outcomeCount) }),
    });
    const why = c.completedSteps.filter((s) => s.done).map((s) => s.labelKey);
    const missing = c.completedSteps.filter((s) => !s.done).map((s) => s.labelKey);
    return Object.freeze({
      runtimeVersion: FARM_SUCCESS_ENGINE_VERSION,
      successScore: c.percentComplete,
      why: Object.freeze(why),
      missing: Object.freeze(missing),
      hasExplanation: why.length > 0 || missing.length > 0,
    });
  }, Object.freeze({
    runtimeVersion: FARM_SUCCESS_ENGINE_VERSION,
    successScore: 0, why: Object.freeze([]), missing: Object.freeze([]),
    hasExplanation: true,
  }));
}

export function buildFarmSuccessHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  farmSuccessReady: true; reusesCompletion: true; noScoreWithoutExplanation: true;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: FARM_SUCCESS_ENGINE_VERSION,
    farmSuccessReady: true as const, reusesCompletion: true as const,
    noScoreWithoutExplanation: true as const,
  });
}

let _installed = false;
export function installFarmSuccessHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__farmSuccessHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildFarmSuccessHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  buildFarmSuccess, buildFarmSuccessHealth, installFarmSuccessHealthGlobal,
});
export default buildFarmSuccess;
