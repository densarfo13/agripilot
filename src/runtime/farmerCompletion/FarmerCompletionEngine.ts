/**
 * FarmerCompletionEngine.ts — sprint #212 §1.
 *
 * Read-only 8-step setup tracker. Derives completion from signals the
 * app already holds (profile + scan/task/outcome/sell history); no new
 * store, no fabrication. Pins window.__farmerCompletionHealth().
 *
 * Pure. SSR-safe. Idempotent install. Never throws. Frozen returns.
 */

import { COMPLETION_STEPS, STEP_REASON } from './FarmerCompletionContracts';
import { computeNextStep } from './FarmerNextStepEngine';
import type { FarmerCompletion } from './FarmerCompletionContracts';

export const FARMER_COMPLETION_ENGINE_VERSION = 'farmer-completion-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/**
 * Compute completion from raw farm signals. A step is "done" only
 * when its underlying datum genuinely exists.
 */
export function buildFarmerCompletion(input: {
  farmExists?: boolean;
  location?: string;
  crop?: string;
  plantingDate?: string;
  scanHistory?: ReadonlyArray<unknown>;
  taskCompletedCount?: number;
  outcomeHistory?: ReadonlyArray<unknown>;
  harvestOrSellDrafts?: ReadonlyArray<unknown>;
} = {}): Readonly<FarmerCompletion> {
  return _safe(() => {
    const doneMap: Record<string, boolean> = {
      farmCreated:                    !!input.farmExists,
      locationAdded:                  !!_str(input.location),
      cropSelected:                   !!_str(input.crop),
      plantingDateAdded:              !!_str(input.plantingDate),
      firstScanCompleted:             _arr(input.scanHistory).length > 0,
      firstTaskCompleted:             (typeof input.taskCompletedCount === 'number' && input.taskCompletedCount > 0),
      firstOutcomeRecorded:           _arr(input.outcomeHistory).length > 0,
      firstHarvestOrSellDraftCreated: _arr(input.harvestOrSellDrafts).length > 0,
    };
    const completedSteps = COMPLETION_STEPS.map((s) => Object.freeze({
      key: s.key, labelKey: s.labelKey, done: !!doneMap[s.key],
    }));
    const completedCount = completedSteps.filter((s) => s.done).length;
    const total = COMPLETION_STEPS.length;
    const pct = Math.round((completedCount / total) * 100);
    const doneKeys = completedSteps.filter((s) => s.done).map((s) => s.key);
    const next = computeNextStep(doneKeys);

    return Object.freeze({
      runtimeVersion: FARMER_COMPLETION_ENGINE_VERSION,
      completedSteps: Object.freeze(completedSteps),
      totalSteps: total,
      completedCount,
      percentComplete: pct,
      nextBestStep: next.step,
      nextBestStepKey: next.labelKey,
      nextBestStepReason: next.reason,
      primaryCTA: next.cta,
      allComplete: completedCount === total,
    });
  }, Object.freeze({
    runtimeVersion: FARMER_COMPLETION_ENGINE_VERSION,
    completedSteps: Object.freeze(COMPLETION_STEPS.map((s) => Object.freeze({ key: s.key, labelKey: s.labelKey, done: false }))),
    totalSteps: COMPLETION_STEPS.length,
    completedCount: 0,
    percentComplete: 0,
    nextBestStep: COMPLETION_STEPS[0].key,
    nextBestStepKey: COMPLETION_STEPS[0].labelKey,
    nextBestStepReason: STEP_REASON[COMPLETION_STEPS[0].key],
    primaryCTA: COMPLETION_STEPS[0].cta,
    allComplete: false,
  }));
}

export function buildFarmerCompletionHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  farmerCompletionReady: true; totalSteps: number; hasNextStep: true;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: FARMER_COMPLETION_ENGINE_VERSION,
    farmerCompletionReady: true as const,
    totalSteps: COMPLETION_STEPS.length,
    hasNextStep: true as const,
  });
}

let _installed = false;
export function installFarmerCompletionHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__farmerCompletionHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildFarmerCompletionHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  buildFarmerCompletion, buildFarmerCompletionHealth, installFarmerCompletionHealthGlobal,
});
export default buildFarmerCompletion;
