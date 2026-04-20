/**
 * fastOnboarding/index.js — single import surface for the
 * 60-second first-time flow.
 */

export {
  FAST_STEPS, FAST_STEP_ORDER,
  fastStepIndex, isValidFastStep,
} from './stepIds.js';

export {
  defaultFastState, loadFastState, saveFastState,
  clearFastState, patchFastState,
  hasCompletedFastOnboarding,
} from './fastOnboardingPersistence.js';

export {
  validateFastStep, firstIncompleteFastStep,
} from './validateFastStep.js';

export {
  getNextFastStep, getPrevFastStep,
  canAdvanceFastStep, resumeFastStep, routeForFarmerType,
} from './getNextFastStep.js';

export { createFarmFromCrop } from './createFarmFromCrop.js';
export { generateInitialTasks } from './generateInitialTasks.js';

export {
  hasFarmYet, isFirstTimeHome,
  filterTasksForFirstTime, getFirstTimeHomeMode,
} from './firstTimeHomeGuard.js';

export {
  isFirstTimeFarmer,
  warnFirstTimeRoutingRegression,
  FIRST_TIME_WARN,
} from './firstTimeFarmerGuard.js';

export {
  assertSingleDominantCard,
  assertHomeHasWhy,
  assertCountryPresent,
  assertCheckFirstHasReason,
  assertNotDirectOnStale,
  assertLocationConfirmed,
  assertHeaderFromStateEngine,
  assertNotBothOnboardingRoutes,
  assertNoEnglishLeakInHindi,
} from './devAssertions.js';
