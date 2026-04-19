/**
 * getNextFastStep.js — flow controller for the 60-second path.
 *
 *   getNextFastStep(state)   → next step id | null (→ home)
 *   getPrevFastStep(state)   → previous step | null (at start)
 *   canAdvanceFastStep(state, step) → boolean
 *   resumeFastStep(state)    → step to land on for returning users
 *   routeForFarmerType(type) → 'fast' | 'v2'
 *
 * EXISTING farmers are handed off to the full v2 flow (or
 * directly to Home if their onboarding is already complete).
 * NEW farmers walk the five-screen fast track.
 */

import {
  FAST_STEPS, FAST_STEP_ORDER, fastStepIndex, isValidFastStep,
} from './stepIds.js';
import { validateFastStep, firstIncompleteFastStep } from './validateFastStep.js';
import { hasCompletedFastOnboarding } from './fastOnboardingPersistence.js';

export function canAdvanceFastStep(state = {}, step) {
  const s = step || state.currentStep;
  if (!isValidFastStep(s)) return false;
  return validateFastStep(s, state).ok;
}

export function getNextFastStep(state = {}) {
  const curr = state.currentStep || FAST_STEP_ORDER[0];
  const idx = fastStepIndex(curr);
  if (idx < 0) return FAST_STEP_ORDER[0];
  if (!validateFastStep(curr, state).ok) return curr;
  if (idx >= FAST_STEP_ORDER.length - 1) return null; // → home
  return FAST_STEP_ORDER[idx + 1];
}

export function getPrevFastStep(state = {}) {
  const curr = state.currentStep || FAST_STEP_ORDER[0];
  const idx = fastStepIndex(curr);
  if (idx <= 0) return null;
  return FAST_STEP_ORDER[idx - 1];
}

/**
 * resumeFastStep — where a returning user lands.
 *
 * Priority:
 *   1. If onboarding is fully complete, return null (→ Home).
 *   2. If the user was mid-way through a step that's still
 *      invalid, land there (respect their in-progress state).
 *   3. Otherwise find the first step in canonical order that
 *      still fails validation.
 *   4. If everything is complete but the farm was never
 *      created, send them to TRANSITION so the handoff can
 *      finish.
 */
export function resumeFastStep(state = null) {
  if (!state) return FAST_STEP_ORDER[0];
  if (hasCompletedFastOnboarding(state)) return null;

  if (isValidFastStep(state.currentStep)
      && !validateFastStep(state.currentStep, state).ok) {
    return state.currentStep;
  }
  const incomplete = firstIncompleteFastStep(state, FAST_STEP_ORDER);
  if (incomplete) return incomplete;
  return FAST_STEPS.TRANSITION;
}

/**
 * routeForFarmerType — 'fast' for new farmers, 'v2' for
 * existing. Existing users get the fuller setup because they
 * likely already have crop history + land knowledge to share.
 */
export function routeForFarmerType(farmerType) {
  if (farmerType === 'new')      return 'fast';
  if (farmerType === 'existing') return 'v2';
  return 'fast'; // safe default
}

export { FAST_STEPS, FAST_STEP_ORDER, isValidFastStep };
