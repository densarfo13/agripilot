/**
 * stepIds.js — the 5-screen first-time flow, designed to get a
 * new farmer from first open to their first farm task in under
 * 60 seconds.
 *
 *   0. intro              — "Welcome to Farroway" (one-time)
 *   1. setup              — language + country + optional location
 *   2. farmer_type        — new vs existing
 *   3. first_time_entry   — "Let's start your first farm"
 *   4. recommendation     — pick a crop from 3–5 suggestions
 *   5. transition         — ~1s animation while farm auto-creates
 *   → home                — arrives at the first real task
 *
 * After the transition, navigation leaves the onboarding flow
 * entirely. "home" is not an onboarding step — it's the
 * destination.
 */

export const FAST_STEPS = Object.freeze({
  INTRO:              'intro',
  SETUP:              'setup',
  FARMER_TYPE:        'farmer_type',
  FIRST_TIME_ENTRY:   'first_time_entry',
  RECOMMENDATION:     'recommendation',
  TRANSITION:         'transition',
});

export const FAST_STEP_ORDER = Object.freeze([
  FAST_STEPS.INTRO,
  FAST_STEPS.SETUP,
  FAST_STEPS.FARMER_TYPE,
  FAST_STEPS.FIRST_TIME_ENTRY,
  FAST_STEPS.RECOMMENDATION,
  FAST_STEPS.TRANSITION,
]);

export function fastStepIndex(step) {
  return FAST_STEP_ORDER.indexOf(String(step || ''));
}

export function isValidFastStep(step) {
  return FAST_STEP_ORDER.includes(String(step || ''));
}
