/**
 * stepIds.js — canonical step identifiers + order for the
 * redesigned onboarding. One ID per screen; the flow controller
 * references these exclusively so no string leaks into screen
 * components.
 */

export const ONBOARDING_STEPS = Object.freeze({
  WELCOME:         'welcome',
  LOCATION:        'location',
  GROWING_TYPE:    'growing_type',
  EXPERIENCE:      'experience',
  SIZE_DETAILS:    'size_details',
  RECOMMENDATIONS: 'recommendations',
  CROP_CONFIRM:    'crop_confirm',
  FIRST_VALUE:     'first_value',
});

/**
 * STEP_ORDER — the linear order the controller walks. Mode does
 * NOT change the set of step IDs; it changes the content inside
 * size_details / recommendations. Keeping the step list
 * mode-invariant makes resume logic simpler and makes back
 * navigation deterministic.
 */
export const STEP_ORDER = Object.freeze([
  ONBOARDING_STEPS.WELCOME,
  ONBOARDING_STEPS.LOCATION,
  ONBOARDING_STEPS.GROWING_TYPE,
  ONBOARDING_STEPS.EXPERIENCE,
  ONBOARDING_STEPS.SIZE_DETAILS,
  ONBOARDING_STEPS.RECOMMENDATIONS,
  ONBOARDING_STEPS.CROP_CONFIRM,
  ONBOARDING_STEPS.FIRST_VALUE,
]);

export function stepIndex(step) {
  return STEP_ORDER.indexOf(String(step || ''));
}

export function isValidStep(step) {
  return STEP_ORDER.includes(String(step || ''));
}

export const TOTAL_STEPS = STEP_ORDER.length;

/**
 * VISIBLE_STEPS — which steps to COUNT for the progress dots.
 * The welcome screen doesn't need a dot (users perceive it as
 * the "start" line), and first_value doesn't either (it's the
 * arrival). This leaves a clean 6-dot progress the user
 * recognizes.
 */
export const VISIBLE_STEPS = Object.freeze([
  ONBOARDING_STEPS.LOCATION,
  ONBOARDING_STEPS.GROWING_TYPE,
  ONBOARDING_STEPS.EXPERIENCE,
  ONBOARDING_STEPS.SIZE_DETAILS,
  ONBOARDING_STEPS.RECOMMENDATIONS,
  ONBOARDING_STEPS.CROP_CONFIRM,
]);

export function visibleStepNumber(step) {
  const i = VISIBLE_STEPS.indexOf(String(step || ''));
  return i < 0 ? null : i + 1;
}
