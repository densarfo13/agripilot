/**
 * decisionEventTypes.js — the decision-quality event taxonomy that
 * sits above the raw onboarding/funnel events. These are the events
 * the product team reasons about — "did the farmer accept the
 * recommendation?", "did a buyer click Interested?" — not just
 * "did the detect button fire?".
 *
 * Categories:
 *   • LOCATION_*   — trust decisions during onboarding confirmation
 *   • RECOMMENDATION_* — whether suggestions were accepted / swapped
 *   • TASK_*       — daily task behavior on the Today screen
 *   • HARVEST_*    — outcome signals that feed recommendations
 *   • LISTING_*    — sale-loop lifecycle on the marketplace side
 *   • INTEREST_*   — buyer-side engagement on listings
 *   • ISSUE_*      — pest / disease / general problem reports
 *
 * Keep the string values stable — they land in analytics storage
 * and dashboards. Adding a new value is fine; changing an existing
 * one breaks historical reconstruction.
 */

export const DECISION_EVENT_TYPES = Object.freeze({
  // ─── Location trust gap ─────────────────────────────
  LOCATION_CONFIRMED_YES:       'location_confirmed_yes',
  LOCATION_CONFIRMED_MANUAL:    'location_confirmed_manual',
  LOCATION_RETRY_CLICKED:       'location_retry_clicked',
  LOCATION_DETECTION_ABANDONED: 'location_detection_abandoned',

  // ─── Recommendation acceptance loop ─────────────────
  RECOMMENDATION_VIEWED:              'recommendation_viewed',
  RECOMMENDATION_SELECTED:            'recommendation_selected',
  RECOMMENDATION_REJECTED:            'recommendation_rejected',
  CROP_CHANGED_AFTER_RECOMMENDATION:  'crop_changed_after_recommendation',

  // ─── Today-screen task behavior ─────────────────────
  TODAY_PRIMARY_TASK_VIEWED: 'today_primary_task_viewed',
  TASK_COMPLETED:            'task_completed',
  TASK_SKIPPED:              'task_skipped',
  TASK_REPEAT_SKIPPED:       'task_repeat_skipped',

  // ─── Issue reporting ────────────────────────────────
  ISSUE_REPORTED:            'issue_reported',

  // ─── Harvest + post-harvest ─────────────────────────
  HARVEST_SUBMITTED:               'harvest_submitted',
  POST_HARVEST_NEXT_CYCLE_CHOSEN:  'post_harvest_next_cycle_chosen',
  LISTING_CREATED_FROM_HARVEST:    'listing_created_from_harvest',

  // ─── Sale loop ──────────────────────────────────────
  LISTING_VIEWED:           'listing_viewed',
  LISTING_EXPIRED:          'listing_expired',
  LISTING_SOLD:             'listing_sold',
  BUYER_INTEREST_SUBMITTED: 'buyer_interest_submitted',
  INTEREST_ACCEPTED:        'interest_accepted',
  INTEREST_DECLINED:        'interest_declined',

  // ─── Offline behavior ───────────────────────────────
  OFFLINE_ACTION_QUEUED:       'offline_action_queued',
  OFFLINE_DETECT_BLOCKED:      'offline_detect_blocked',
  OFFLINE_MANUAL_CONTINUED:    'offline_manual_continued',
});

/** All decision-event values as a Set — cheap membership checks. */
export const DECISION_EVENT_VALUES = Object.freeze(
  new Set(Object.values(DECISION_EVENT_TYPES)),
);

/**
 * Coarse category a decision event belongs to — useful for grouping
 * dashboards / funnels without hand-maintaining a second table.
 */
export function categorizeDecisionEvent(type) {
  const t = String(type || '');
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
