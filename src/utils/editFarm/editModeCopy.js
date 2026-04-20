/**
 * editModeCopy.js — pure mapper from the `mode` query-param
 * value to the header copy (title + helper) shown on
 * EditFarmScreen.
 *
 * Kept separate so tests can verify the behavior without
 * mounting React.
 */

/** Frozen table of supported edit modes. */
export const EDIT_MODES = Object.freeze({
  EDIT:                    'edit',
  COMPLETE_PROFILE:        'complete_profile',
  COMPLETE_FOR_RECOMMENDATION: 'complete_for_recommendation',
});

/**
 * getEditModeCopy — return { titleKey, titleFallback, helperKey,
 * helperFallback } for the given mode. Unknown modes fall back
 * to the plain "Edit Farm" copy.
 */
export function getEditModeCopy(mode) {
  const m = (mode && typeof mode === 'string') ? mode : EDIT_MODES.EDIT;
  switch (m) {
    case EDIT_MODES.COMPLETE_PROFILE:
      return Object.freeze({
        titleKey:      'farm.editFarm.completeProfileTitle',
        titleFallback: 'Complete your farm profile',
        helperKey:     'farm.editFarm.completeProfileHelper',
        helperFallback:'Fill in the missing details so your guidance gets sharper.',
      });
    case EDIT_MODES.COMPLETE_FOR_RECOMMENDATION:
      return Object.freeze({
        titleKey:      'farm.editFarm.completeForRecTitle',
        titleFallback: 'Add your farm details for better recommendations',
        helperKey:     'farm.editFarm.completeForRecHelper',
        helperFallback:'Add your farm location to get the best crop recommendations.',
      });
    default:
      return Object.freeze({
        titleKey:      'farm.editFarm.title',
        titleFallback: 'Edit Farm',
        helperKey:     'farm.editFarm.helper',
        helperFallback:'Change your farm details. This does not start onboarding over.',
      });
  }
}
