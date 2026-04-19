/**
 * onboardingV2/index.js — single import surface.
 *
 *   import {
 *     ONBOARDING_STEPS, STEP_ORDER, VISIBLE_STEPS, TOTAL_STEPS,
 *     loadOnboardingState, saveOnboardingState, clearOnboardingState,
 *     resetOnboardingState, patchOnboardingState, defaultOnboardingState,
 *     validateOnboardingStep, firstIncompleteStep,
 *     getNextOnboardingStep, getPrevOnboardingStep, canAdvanceFromStep,
 *     resumeOnboardingStep, getOnboardingRouteForMode,
 *     buildPostOnboardingRoute, deriveMode,
 *     selectFirstValueContent, filterRecommendations,
 *     visibleStepNumber,
 *   } from '@/utils/onboardingV2';
 */

export {
  ONBOARDING_STEPS, STEP_ORDER, VISIBLE_STEPS, TOTAL_STEPS,
  stepIndex, isValidStep, visibleStepNumber,
} from './stepIds.js';

export {
  defaultOnboardingState, loadOnboardingState, saveOnboardingState,
  clearOnboardingState, resetOnboardingState, patchOnboardingState,
} from './onboardingPersistence.js';

export {
  validateOnboardingStep, firstIncompleteStep,
} from './validateOnboardingStep.js';

export {
  getNextOnboardingStep, getPrevOnboardingStep, canAdvanceFromStep,
  resumeOnboardingStep, getOnboardingRouteForMode,
  buildPostOnboardingRoute, deriveMode,
} from './getNextOnboardingStep.js';

export { selectFirstValueContent } from './selectFirstValueContent.js';
export { filterRecommendations }  from './filterRecommendations.js';
