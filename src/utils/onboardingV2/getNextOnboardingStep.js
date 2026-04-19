/**
 * getNextOnboardingStep.js — the flow controller. All of the
 * onboarding's movement logic is in one place so it can be
 * tested without React.
 *
 *   getNextOnboardingStep(state) → next step id | null (complete)
 *   getPrevOnboardingStep(state) → prev step id | null (at start)
 *   canAdvanceFromStep(state, step) → boolean
 *   resumeOnboardingStep(state) → step id to land on
 *   deriveMode(growingType) → 'backyard' | 'farm' | null
 */

import { ONBOARDING_STEPS, STEP_ORDER, stepIndex, isValidStep } from './stepIds.js';
import { validateOnboardingStep, firstIncompleteStep } from './validateOnboardingStep.js';

/**
 * deriveMode — single source of truth for the backyard-vs-farm
 * split. growingType='backyard' → mode='backyard'; anything else
 * → mode='farm'.
 */
export function deriveMode(growingType) {
  const gt = String(growingType || '').toLowerCase();
  if (gt === 'backyard') return 'backyard';
  if (['small', 'medium', 'large'].includes(gt)) return 'farm';
  return null;
}

export function canAdvanceFromStep(state = {}, step) {
  const s = step || state.currentStep;
  if (!isValidStep(s)) return false;
  return validateOnboardingStep(s, state).ok;
}

export function getNextOnboardingStep(state = {}) {
  const curr = state.currentStep || STEP_ORDER[0];
  const idx = stepIndex(curr);
  if (idx < 0) return STEP_ORDER[0];
  if (!validateOnboardingStep(curr, state).ok) return curr;
  if (idx >= STEP_ORDER.length - 1) return null; // onboarding complete
  return STEP_ORDER[idx + 1];
}

export function getPrevOnboardingStep(state = {}) {
  const curr = state.currentStep || STEP_ORDER[0];
  const idx = stepIndex(curr);
  if (idx <= 0) return null;
  return STEP_ORDER[idx - 1];
}

/**
 * resumeOnboardingStep — on app resume, land on the most
 * appropriate step. Prefer `currentStep` if it's still invalid
 * (user was in the middle of filling it out); otherwise jump to
 * the first step that still needs input. If the saved state
 * already passes every step, the user has completed onboarding
 * and we land on first_value.
 */
export function resumeOnboardingStep(state = {}) {
  if (!state) return STEP_ORDER[0];
  // If the user has an in-progress step that's not yet complete,
  // land there (respect their context).
  if (isValidStep(state.currentStep)
      && !validateOnboardingStep(state.currentStep, state).ok) {
    return state.currentStep;
  }
  // Otherwise find the first step in canonical order that fails
  // validation — that's the next place to go.
  const incomplete = firstIncompleteStep(state, STEP_ORDER);
  if (incomplete) return incomplete;
  // All steps valid → go to first_value (the arrival).
  return ONBOARDING_STEPS.FIRST_VALUE;
}

/**
 * getOnboardingRouteForMode — returns the step IDs plus a
 * per-step "intent tag" the UI can use to branch content (e.g.
 * size_details shows different copy + options for backyard vs
 * farm). The step IDs themselves stay mode-invariant — only
 * the tag changes.
 */
export function getOnboardingRouteForMode(mode = null) {
  const m = mode === 'backyard' ? 'backyard' : mode === 'farm' ? 'farm' : 'unknown';
  return STEP_ORDER.map((step) => ({
    step,
    mode: m,
    intent: mode
      ? stepIntent(step, m)
      : null,
  }));
}

function stepIntent(step, mode) {
  switch (step) {
    case ONBOARDING_STEPS.SIZE_DETAILS:
      return mode === 'backyard' ? 'backyard_space' : 'farm_size_band';
    case ONBOARDING_STEPS.RECOMMENDATIONS:
      return mode === 'backyard' ? 'backyard_crop_pool' : 'farm_crop_pool';
    default:
      return 'shared';
  }
}

/**
 * buildPostOnboardingRoute — decides where to send the user
 * after first_value. If they have a selected crop AND the
 * first_value payload has an immediate task, route to Today;
 * otherwise route to the plan view.
 *
 * Returns `{ route: string, rationale: string }`.
 */
export function buildPostOnboardingRoute(state = {}, firstValue = null) {
  if (!state.selectedCrop) {
    return { route: '/farmer', rationale: 'no_crop_selected' };
  }
  if (firstValue && firstValue.immediateTask) {
    return { route: '/farmer/today', rationale: 'immediate_task_available' };
  }
  return { route: '/farmer', rationale: 'plan_ready_no_immediate_task' };
}
