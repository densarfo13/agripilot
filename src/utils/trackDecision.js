/**
 * trackDecision.js — imperative one-liner helpers for the most
 * common decision events. Matches the React hook-based API
 * (useAnalytics) but can be called from non-React code paths
 * (event handlers, saga middleware, old class components, Redux
 * reducers, service workers).
 *
 * Each helper mirrors a DECISION_EVENT_TYPES value, pre-fills
 * the envelope via buildAnalyticsMetadata, and enqueues through
 * the shared analytics buffer. A single flush attempt runs in
 * the background; the reconnect listener set up by useAnalytics
 * handles retries on recovery.
 *
 * Usage:
 *   import { trackDecision } from '@/utils/trackDecision';
 *   trackDecision.recommendationSelected({ crop: 'maize', confidence });
 */

import { buildAnalyticsMetadata } from './analyticsEnvelope.js';
import {
  enqueueAnalyticsEvent,
  flushAnalyticsBuffer,
} from './analyticsBuffer.js';
import { DECISION_EVENT_TYPES } from './decisionEventTypes.js';

const ANALYTICS_ENDPOINT = '/api/v2/analytics/events';

async function defaultSendOne(event) {
  if (typeof fetch !== 'function') return false;
  try {
    const res = await fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [event] }),
      credentials: 'include',
    });
    return res && res.ok;
  } catch {
    return false;
  }
}

function raw(type, extras = {}) {
  const envelope = buildAnalyticsMetadata({
    type,
    mode:      extras.mode,
    language:  extras.language,
    country:   extras.country,
    stateCode: extras.stateCode,
    confidence: extras.confidence,
    meta: extras.meta || {},
  });
  enqueueAnalyticsEvent(envelope);
  flushAnalyticsBuffer(extras.sendOne || defaultSendOne).catch(() => {});
  return envelope;
}

export const trackDecision = Object.freeze({
  // Location trust loop
  locationConfirmedYes:    (extras) => raw(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES, extras),
  locationConfirmedManual: (extras) => raw(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, extras),
  locationRetryClicked:    (extras) => raw(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, extras),
  locationDetectionAbandoned: (extras) => raw(DECISION_EVENT_TYPES.LOCATION_DETECTION_ABANDONED, extras),

  // Recommendations
  recommendationViewed:   (extras) => raw(DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED, extras),
  recommendationSelected: (extras) => raw(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, extras),
  recommendationRejected: (extras) => raw(DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED, extras),
  cropChangedAfterRecommendation: (extras) => raw(DECISION_EVENT_TYPES.CROP_CHANGED_AFTER_RECOMMENDATION, extras),

  // Today tasks
  todayPrimaryTaskViewed: (extras) => raw(DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED, extras),
  taskCompleted:          (extras) => raw(DECISION_EVENT_TYPES.TASK_COMPLETED, extras),
  taskSkipped:            (extras) => raw(DECISION_EVENT_TYPES.TASK_SKIPPED, extras),
  taskRepeatSkipped:      (extras) => raw(DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED, extras),

  // Issues
  issueReported:          (extras) => raw(DECISION_EVENT_TYPES.ISSUE_REPORTED, extras),

  // Harvest
  harvestSubmitted:              (extras) => raw(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, extras),
  postHarvestNextCycleChosen:    (extras) => raw(DECISION_EVENT_TYPES.POST_HARVEST_NEXT_CYCLE_CHOSEN, extras),
  listingCreatedFromHarvest:     (extras) => raw(DECISION_EVENT_TYPES.LISTING_CREATED_FROM_HARVEST, extras),

  // Sale loop
  listingViewed:          (extras) => raw(DECISION_EVENT_TYPES.LISTING_VIEWED, extras),
  listingExpired:         (extras) => raw(DECISION_EVENT_TYPES.LISTING_EXPIRED, extras),
  listingSold:            (extras) => raw(DECISION_EVENT_TYPES.LISTING_SOLD, extras),
  buyerInterestSubmitted: (extras) => raw(DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED, extras),
  interestAccepted:       (extras) => raw(DECISION_EVENT_TYPES.INTEREST_ACCEPTED, extras),
  interestDeclined:       (extras) => raw(DECISION_EVENT_TYPES.INTEREST_DECLINED, extras),

  // Offline
  offlineActionQueued:    (extras) => raw(DECISION_EVENT_TYPES.OFFLINE_ACTION_QUEUED, extras),
  offlineDetectBlocked:   (extras) => raw(DECISION_EVENT_TYPES.OFFLINE_DETECT_BLOCKED, extras),
  offlineManualContinued: (extras) => raw(DECISION_EVENT_TYPES.OFFLINE_MANUAL_CONTINUED, extras),

  // Escape hatch for anything not in the list above
  raw,
});

export default trackDecision;
