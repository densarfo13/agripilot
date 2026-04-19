/**
 * decisionEventTypes.js (server) — mirrors the client file of the
 * same name. Importing the client module directly from the server
 * would pull React-adjacent code through the bundler graph, so we
 * keep a tiny copy. The test suite asserts the two lists stay in
 * sync (analyticsFunnelContract.test.js).
 *
 * Server-authoritative list: if an event makes it here, the
 * validator accepts it. New events land here *first*, then on the
 * client.
 */

export const DECISION_EVENT_TYPES = Object.freeze({
  // Location trust gap
  LOCATION_CONFIRMED_YES:       'location_confirmed_yes',
  LOCATION_CONFIRMED_MANUAL:    'location_confirmed_manual',
  LOCATION_RETRY_CLICKED:       'location_retry_clicked',
  LOCATION_DETECTION_ABANDONED: 'location_detection_abandoned',

  // Recommendation acceptance loop
  RECOMMENDATION_VIEWED:              'recommendation_viewed',
  RECOMMENDATION_SELECTED:            'recommendation_selected',
  RECOMMENDATION_REJECTED:            'recommendation_rejected',
  CROP_CHANGED_AFTER_RECOMMENDATION:  'crop_changed_after_recommendation',

  // Today-screen task behavior
  TODAY_PRIMARY_TASK_VIEWED: 'today_primary_task_viewed',
  TASK_COMPLETED:            'task_completed',
  TASK_SKIPPED:              'task_skipped',
  TASK_REPEAT_SKIPPED:       'task_repeat_skipped',

  // Issue reporting
  ISSUE_REPORTED: 'issue_reported',

  // Harvest + post-harvest
  HARVEST_SUBMITTED:               'harvest_submitted',
  POST_HARVEST_NEXT_CYCLE_CHOSEN:  'post_harvest_next_cycle_chosen',
  LISTING_CREATED_FROM_HARVEST:    'listing_created_from_harvest',

  // Sale loop
  LISTING_VIEWED:           'listing_viewed',
  LISTING_EXPIRED:          'listing_expired',
  LISTING_SOLD:             'listing_sold',
  BUYER_INTEREST_SUBMITTED: 'buyer_interest_submitted',
  INTEREST_ACCEPTED:        'interest_accepted',
  INTEREST_DECLINED:        'interest_declined',

  // Offline behavior
  OFFLINE_ACTION_QUEUED:    'offline_action_queued',
  OFFLINE_DETECT_BLOCKED:   'offline_detect_blocked',
  OFFLINE_MANUAL_CONTINUED: 'offline_manual_continued',
});

export const FUNNEL_EVENT_TYPES = Object.freeze({
  STEP_VIEWED:    'funnel_step_viewed',
  STEP_COMPLETED: 'funnel_step_completed',
  STEP_ABANDONED: 'funnel_step_abandoned',
});

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

/** All decision + funnel event values as a single Set. */
export const ALL_DECISION_EVENT_VALUES = Object.freeze(new Set([
  ...Object.values(DECISION_EVENT_TYPES),
  ...Object.values(FUNNEL_EVENT_TYPES),
]));

export function categorizeDecisionEvent(type) {
  const t = String(type || '');
  if (t.startsWith('funnel_step_'))             return 'funnel';
  if (t.startsWith('location_'))                return 'location';
  if (t.startsWith('recommendation_') || t === 'crop_changed_after_recommendation') return 'recommendation';
  if (t.startsWith('task_') || t === 'today_primary_task_viewed') return 'task';
  if (t.startsWith('issue_'))                   return 'issue';
  if (t.startsWith('harvest_') || t.startsWith('post_harvest_') || t === 'listing_created_from_harvest') return 'harvest';
  if (t.startsWith('listing_'))                 return 'listing';
  if (t.startsWith('interest_') || t === 'buyer_interest_submitted') return 'interest';
  if (t.startsWith('offline_'))                 return 'offline';
  return 'unknown';
}
