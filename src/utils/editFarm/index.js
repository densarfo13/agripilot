/**
 * src/utils/editFarm/index.js — single import surface for the
 * Edit Farm flow helpers. This folder is DELIBERATELY separate
 * from fastOnboarding — edit is not onboarding.
 */

export {
  farmToEditForm, editFormToPatch,
  hasAnyChange, validateEditForm,
  classifyFarmChanges,
} from './editFarmMapper.js';

export {
  buildRecomputeIntent, analyticsPayloadForChanges,
} from './recomputeIntent.js';

export {
  assertEditRouteNotOnboarding,
  assertNoStepIndicatorInEdit,
  assertFarmWasUpdatedNotRecreated,
  assertEditPatchHasNoOnboardingState,
  assertRecomputeTriggered,
  assertFarmerTypeNotMutated,
  assertHomeRefreshedAfterEdit,
} from './editFarmDevAssertions.js';
