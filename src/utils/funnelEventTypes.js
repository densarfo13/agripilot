/**
 * funnelEventTypes.js — canonical onboarding-funnel step identifiers
 * and the viewed/completed/abandoned event names that sit on top of
 * them. The funnel is the reconstruction spine: every step emits
 * `viewed` on mount, `completed` on forward-progress, and
 * `abandoned` when the user leaves without completing.
 *
 * The three verbs are separate from ONBOARDING_EVENT_TYPES (in
 * onboardingEventTypes.js) so the coarse decision-quality events
 * (language_selected, location_detect_clicked, …) stay decoupled
 * from the raw funnel spine. Both layers coexist.
 */

export const FUNNEL_STEPS = Object.freeze({
  WELCOME:              'welcome',
  LOCATION:             'location',
  GROWING_TYPE:         'growing_type',
  EXPERIENCE:           'experience',
  SIZE_DETAILS:         'size_details',
  RECOMMENDATIONS:      'recommendations',
  CROP_SELECTED:        'crop_selected',
  FIRST_VALUE_SCREEN:   'first_value_screen',
  ONBOARDING_COMPLETED: 'onboarding_completed',
});

export const FUNNEL_STEP_ORDER = Object.freeze([
  FUNNEL_STEPS.WELCOME,
  FUNNEL_STEPS.LOCATION,
  FUNNEL_STEPS.GROWING_TYPE,
  FUNNEL_STEPS.EXPERIENCE,
  FUNNEL_STEPS.SIZE_DETAILS,
  FUNNEL_STEPS.RECOMMENDATIONS,
  FUNNEL_STEPS.CROP_SELECTED,
  FUNNEL_STEPS.FIRST_VALUE_SCREEN,
  FUNNEL_STEPS.ONBOARDING_COMPLETED,
]);

export const FUNNEL_EVENT_TYPES = Object.freeze({
  STEP_VIEWED:    'funnel_step_viewed',
  STEP_COMPLETED: 'funnel_step_completed',
  STEP_ABANDONED: 'funnel_step_abandoned',
});

/** Index of a step in the forward order. -1 if unknown. */
export function getFunnelStepIndex(step) {
  return FUNNEL_STEP_ORDER.indexOf(String(step || ''));
}

/** Next step in the forward order, or null if terminal / unknown. */
export function getNextFunnelStep(step) {
  const i = getFunnelStepIndex(step);
  if (i < 0 || i >= FUNNEL_STEP_ORDER.length - 1) return null;
  return FUNNEL_STEP_ORDER[i + 1];
}
