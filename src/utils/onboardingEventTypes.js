/**
 * onboardingEventTypes — canonical string constants for the
 * client-side onboarding analytics events. Mirrors the matching
 * entries in server/src/services/analytics/eventLogService.js so
 * the two sides agree without importing server code into the
 * browser bundle.
 */

export const ONBOARDING_EVENT_TYPES = Object.freeze({
  LANGUAGE_SELECTED:              'onboarding_language_selected',
  LOCATION_DETECT_CLICKED:        'onboarding_location_detect_clicked',
  LOCATION_DETECT_SUCCESS:        'onboarding_location_detect_success',
  LOCATION_DETECT_FAILED:         'onboarding_location_detect_failed',
  LOCATION_PERMISSION_DENIED:     'onboarding_location_permission_denied',
  MANUAL_COUNTRY_SELECTED:        'onboarding_manual_country_selected',
  CONTINUE_BLOCKED_MISSING_COUNTRY:'onboarding_continue_blocked_missing_country',
  COMPLETED:                      'onboarding_completed',
  RESUMED:                        'onboarding_resumed',
});
