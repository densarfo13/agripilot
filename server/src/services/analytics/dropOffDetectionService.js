/**
 * dropOffDetectionService.js — server-side drop-off inference.
 * Mirrors src/utils/getLikelyDropOffStage.js but is the
 * authoritative implementation for dashboards. Two exports:
 *
 *   getLikelyDropOffStage(events, now?) → single-user inference
 *   aggregateDropOffCounts(users, now?) → rollup for dashboards
 *
 * The rollup groups by stage + reason and exposes the counts the
 * product team actually wants to see:
 *   "how many people reached recommendations but never selected?"
 *
 * No DB access — callers pass in a `users` array where each item
 * is `{ userId, events[] }`. The analytics pipeline wires the
 * selection to Prisma outside this file.
 */

import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEPS,
  FUNNEL_STEP_ORDER,
} from './decisionEventTypes.js';

const LOCATION_PERMISSION_DENIED = 'onboarding_location_permission_denied';
const LOCATION_DETECT_SUCCESS    = 'onboarding_location_detect_success';

function hasType(events, type)    { return events.some((e) => e?.type === type); }
function byType(events, type)     { return events.filter((e) => e?.type === type); }

export function getLikelyDropOffStage(events = [], now = Date.now()) {
  const safe = Array.isArray(events) ? events.filter(Boolean) : [];
  const last = safe.length ? safe[safe.length - 1] : null;
  const lastEventAt = last?.timestamp ?? null;
  const minutesSinceLastEvent = lastEventAt != null
    ? Math.max(0, Math.round((now - lastEventAt) / 60000))
    : null;

  const sawOnboardingStart = safe.some((e) =>
    e?.type === FUNNEL_EVENT_TYPES.STEP_VIEWED && e?.meta?.step === FUNNEL_STEPS.WELCOME,
  );
  const onboardingDone = safe.some((e) =>
    e?.type === FUNNEL_EVENT_TYPES.STEP_COMPLETED
    && e?.meta?.step === FUNNEL_STEPS.ONBOARDING_COMPLETED,
  );

  if (sawOnboardingStart && !onboardingDone) {
    const stage = latestUnfinishedFunnelStep(safe);
    if (stage) {
      return {
        stage,
        bucket: 'onboarding',
        reason: onboardingReason(stage, safe),
        lastEventAt, minutesSinceLastEvent,
      };
    }
  }

  const sawToday  = hasType(safe, DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED);
  const didTask   = hasType(safe, DECISION_EVENT_TYPES.TASK_COMPLETED);
  if (onboardingDone && !sawToday) {
    return { stage: 'today', bucket: 'today', reason: 'onboarding_done_but_today_never_opened', lastEventAt, minutesSinceLastEvent };
  }
  if (sawToday && !didTask) {
    return { stage: 'today', bucket: 'today', reason: 'today_viewed_no_task_completed', lastEventAt, minutesSinceLastEvent };
  }

  if (hasType(safe, DECISION_EVENT_TYPES.HARVEST_SUBMITTED)
      && !hasType(safe, DECISION_EVENT_TYPES.POST_HARVEST_NEXT_CYCLE_CHOSEN)) {
    return { stage: 'harvest', bucket: 'harvest', reason: 'harvest_done_no_next_cycle', lastEventAt, minutesSinceLastEvent };
  }

  if (hasType(safe, DECISION_EVENT_TYPES.LISTING_CREATED_FROM_HARVEST)
      && !hasType(safe, DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED)) {
    return { stage: 'marketplace_seller', bucket: 'market', reason: 'listing_created_no_buyer_interest', lastEventAt, minutesSinceLastEvent };
  }

  if (hasType(safe, DECISION_EVENT_TYPES.LISTING_VIEWED)
      && !hasType(safe, DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED)) {
    return { stage: 'marketplace_buyer', bucket: 'market', reason: 'listing_viewed_no_interest_sent', lastEventAt, minutesSinceLastEvent };
  }

  return { stage: 'none', bucket: 'none', reason: 'no_drop_off_detected', lastEventAt, minutesSinceLastEvent };
}

function latestUnfinishedFunnelStep(events) {
  for (let i = FUNNEL_STEP_ORDER.length - 1; i >= 0; i--) {
    const step = FUNNEL_STEP_ORDER[i];
    const viewed = events.some((e) => e?.type === FUNNEL_EVENT_TYPES.STEP_VIEWED && e?.meta?.step === step);
    if (!viewed) continue;
    const completed = events.some((e) => e?.type === FUNNEL_EVENT_TYPES.STEP_COMPLETED && e?.meta?.step === step);
    if (!completed) return step;
  }
  return null;
}

function onboardingReason(stage, events) {
  if (stage === FUNNEL_STEPS.LOCATION) {
    if (hasType(events, DECISION_EVENT_TYPES.LOCATION_DETECTION_ABANDONED)) return 'location_detection_abandoned';
    if (hasType(events, LOCATION_PERMISSION_DENIED))                        return 'location_permission_denied';
    if (!hasType(events, LOCATION_DETECT_SUCCESS)
        && !hasType(events, DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL))  return 'location_not_completed';
    return 'location_confirmed_but_step_not_completed';
  }
  if (stage === FUNNEL_STEPS.RECOMMENDATIONS) return 'recommendations_shown_no_selection';
  if (stage === FUNNEL_STEPS.CROP_SELECTED)   return 'crop_select_never_confirmed';
  return `unfinished_${stage}`;
}

/**
 * aggregateDropOffCounts — rollup. `users` is an array of
 * `{ userId, events[] }`. Returns:
 *   {
 *     totalUsers,
 *     byStage: { [stage]: count },
 *     byReason: { [reason]: count },
 *     byBucket: { onboarding, today, harvest, market, none },
 *     byMode:   { backyard, farm, unknown },
 *     byLocationMethod: { detect, manual, unknown },
 *   }
 */
export function aggregateDropOffCounts(users = [], now = Date.now()) {
  const out = {
    totalUsers: 0,
    byStage: {},
    byReason: {},
    byBucket: { onboarding: 0, today: 0, harvest: 0, market: 0, none: 0, unknown: 0 },
    byMode:   { backyard: 0, farm: 0, unknown: 0 },
    byLocationMethod: { detect: 0, manual: 0, unknown: 0 },
  };
  if (!Array.isArray(users)) return out;

  for (const u of users) {
    const events = Array.isArray(u?.events) ? u.events : [];
    out.totalUsers += 1;
    const inf = getLikelyDropOffStage(events, now);
    out.byStage[inf.stage]   = (out.byStage[inf.stage]   || 0) + 1;
    out.byReason[inf.reason] = (out.byReason[inf.reason] || 0) + 1;
    out.byBucket[inf.bucket] = (out.byBucket[inf.bucket] || 0) + 1;

    const modeEv = events.find((e) => e?.meta?.mode);
    const mode = normalizeMode(modeEv?.meta?.mode);
    out.byMode[mode] = (out.byMode[mode] || 0) + 1;

    const method = events.some((e) => e?.type === LOCATION_DETECT_SUCCESS) ? 'detect'
                 : events.some((e) => e?.type === DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL
                                    || e?.type === 'onboarding_manual_country_selected') ? 'manual'
                 : 'unknown';
    out.byLocationMethod[method] = (out.byLocationMethod[method] || 0) + 1;
  }
  return out;
}

/**
 * getOnboardingDropOffReason — thin wrapper that only returns
 * onboarding-phase drop-offs. Anything past onboarding returns
 * null. Handy for the "resume onboarding?" nudge service.
 */
export function getOnboardingDropOffReason(events = [], now = Date.now()) {
  const inf = getLikelyDropOffStage(events, now);
  if (inf.bucket !== 'onboarding') return null;
  return { stage: inf.stage, reason: inf.reason, minutesSinceLastEvent: inf.minutesSinceLastEvent };
}

/**
 * getBuyerFunnelDropOff — buyer-specific slice.
 */
export function getBuyerFunnelDropOff(events = []) {
  const viewed = hasType(events, DECISION_EVENT_TYPES.LISTING_VIEWED);
  const sent   = hasType(events, DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED);
  const accepted = hasType(events, DECISION_EVENT_TYPES.INTEREST_ACCEPTED);
  if (!viewed)          return { stage: 'not_viewing',     complete: false };
  if (viewed && !sent)  return { stage: 'viewed_no_interest', complete: false };
  if (sent && !accepted) return { stage: 'sent_not_accepted', complete: false };
  return { stage: 'complete', complete: true };
}

function normalizeMode(m) {
  const v = String(m || '').toLowerCase();
  if (v === 'backyard' || v === 'farm') return v;
  return 'unknown';
}
