/**
 * FarmerNextStepEngine.ts — sprint #212 §1.
 *
 * Given which of the 8 setup steps are done, returns the single next
 * step + its reason + CTA. Pure; the first incomplete step (in spec
 * order) is the next-best step. Never invents a step.
 */

import { COMPLETION_STEPS, STEP_REASON } from './FarmerCompletionContracts';

export const FARMER_NEXT_STEP_VERSION = 'farmer-next-step-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface NextStep {
  step:     string | null;
  labelKey: string | null;
  reason:   string | null;
  cta:      string | null;
}

/**
 * @param done Set/array of completed step keys.
 */
export function computeNextStep(done: Iterable<string> | null | undefined): Readonly<NextStep> {
  return _safe(() => {
    const set = new Set(done ? Array.from(done) : []);
    for (const s of COMPLETION_STEPS) {
      if (!set.has(s.key)) {
        return Object.freeze({
          step: s.key,
          labelKey: s.labelKey,
          reason: STEP_REASON[s.key] || null,
          cta: s.cta,
        });
      }
    }
    return Object.freeze({ step: null, labelKey: null, reason: null, cta: null });
  }, Object.freeze({ step: null, labelKey: null, reason: null, cta: null }));
}

export const _internal = Object.freeze({ computeNextStep });
export default computeNextStep;
