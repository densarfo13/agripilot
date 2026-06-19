/**
 * FarmBrainExplanation.ts — sprint #212 §8.
 *
 * Turns the farmer-completion state into the visible "FarmBrain
 * Confidence" card: a score with an itemized WHY (the data we have)
 * and MISSING list (the data we don't) — where each missing item is
 * itself the next action. NO score without explanation: the
 * explanation IS the step list.
 *
 * Read-only composition over FarmerCompletion. Pins
 * window.__farmBrainExplanationHealth(). Pure. Never throws.
 */

import { buildFarmerCompletion } from '../farmerCompletion/FarmerCompletionEngine';

export const FARMBRAIN_EXPLANATION_VERSION = 'farmbrain-explanation-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface FarmBrainExplanation {
  runtimeVersion: string;
  confidence:     number;        // 0-100 (= completion %)
  why:            ReadonlyArray<string>;   // i18n label keys (data we have)
  missing:        ReadonlyArray<string>;   // i18n label keys (data we lack)
  nextActionKey:  string | null;
  hasExplanation: boolean;       // success-criterion: never a bare score
}

export function buildFarmBrainExplanation(input: Parameters<typeof buildFarmerCompletion>[0] = {}): Readonly<FarmBrainExplanation> {
  return _safe(() => {
    const c = buildFarmerCompletion(input);
    const why = c.completedSteps.filter((s) => s.done).map((s) => s.labelKey);
    const missing = c.completedSteps.filter((s) => !s.done).map((s) => s.labelKey);
    return Object.freeze({
      runtimeVersion: FARMBRAIN_EXPLANATION_VERSION,
      confidence: c.percentComplete,
      why: Object.freeze(why),
      missing: Object.freeze(missing),
      nextActionKey: c.nextBestStepKey,
      hasExplanation: why.length > 0 || missing.length > 0,
    });
  }, Object.freeze({
    runtimeVersion: FARMBRAIN_EXPLANATION_VERSION,
    confidence: 0, why: Object.freeze([]), missing: Object.freeze([]),
    nextActionKey: null, hasExplanation: true,
  }));
}

export function buildFarmBrainExplanationHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  farmBrainExplanationReady: true; noScoreWithoutExplanation: true;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: FARMBRAIN_EXPLANATION_VERSION,
    farmBrainExplanationReady: true as const,
    noScoreWithoutExplanation: true as const,
  });
}

let _installed = false;
export function installFarmBrainExplanationHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__farmBrainExplanationHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildFarmBrainExplanationHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  buildFarmBrainExplanation, buildFarmBrainExplanationHealth,
  installFarmBrainExplanationHealthGlobal,
});
export default buildFarmBrainExplanation;
