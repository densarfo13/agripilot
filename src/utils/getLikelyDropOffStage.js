/**
 * getLikelyDropOffStage.js — reconstruct the probable drop-off
 * point for a user given their observed events so far. Used by:
 *
 *   • dev-panel snapshot
 *   • server-side drop-off dashboards (mirror logic lives in
 *     server/src/services/analytics/dropOffDetectionService.js)
 *   • in-product retry nudges ("You didn't finish setup — resume?")
 *
 * Inputs:
 *   events: [{ type, timestamp, meta? }, ...]
 *   now:    override for tests
 *
 * Output:
 *   {
 *     stage:   one of the FUNNEL_STEPS | 'today' | 'harvest' |
 *              'marketplace_seller' | 'marketplace_buyer' | 'none',
 *     reason:  short human-readable tag,
 *     lastEventAt: epoch ms | null,
 *     minutesSinceLastEvent: number | null,
 *   }
 *
 * The "stage" is the last stage the user *entered* but didn't
 * finish. If they entered multiple stages out of order (buyers
 * skipping straight into listings), we pick the most recent
 * unfinished one.
 */

import { FUNNEL_STEPS, FUNNEL_STEP_ORDER, FUNNEL_EVENT_TYPES } from './funnelEventTypes.js';
import { DECISION_EVENT_TYPES } from './decisionEventTypes.js';

function lastOf(events, predicate) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (predicate(events[i])) return events[i];
  }
  return null;
}

function hasType(events, type) {
  return events.some((e) => e?.type === type);
}

export function getLikelyDropOffStage(events = [], now = Date.now()) {
  const safe = Array.isArray(events) ? events.filter(Boolean) : [];
  const last = safe.length ? safe[safe.length - 1] : null;
  const lastEventAt = last?.timestamp ?? null;
  const minutesSinceLastEvent = lastEventAt != null
    ? Math.max(0, Math.round((now - lastEventAt) / 60000))
    : null;

  // ─── Onboarding first ───────────────────────────────
  const enteredWelcome = enteredStep(safe, FUNNEL_STEPS.WELCOME);
  const finishedOnboarding = hasType(safe, FUNNEL_EVENT_TYPES.STEP_COMPLETED)
    && safe.some((e) =>
      e.type === FUNNEL_EVENT_TYPES.STEP_COMPLETED
      && e.meta?.step === FUNNEL_STEPS.ONBOARDING_COMPLETED);

  if (enteredWelcome && !finishedOnboarding) {
    const stage = latestUnfinishedFunnelStep(safe);
    if (stage) {
      return {
        stage,
        reason: onboardingReason(stage, safe),
        lastEventAt, minutesSinceLastEvent,
      };
    }
  }

  // ─── Today loop ─────────────────────────────────────
  const sawToday = hasType(safe, DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED);
  const completedTask = hasType(safe, DECISION_EVENT_TYPES.TASK_COMPLETED);
  if (finishedOnboarding && !sawToday) {
    return {
      stage: 'today',
      reason: 'onboarding_done_but_today_never_opened',
      lastEventAt, minutesSinceLastEvent,
    };
  }
  if (sawToday && !completedTask) {
    return {
      stage: 'today',
      reason: 'today_viewed_no_task_completed',
      lastEventAt, minutesSinceLastEvent,
    };
  }

  // ─── Harvest / post-harvest ─────────────────────────
  const submittedHarvest = hasType(safe, DECISION_EVENT_TYPES.HARVEST_SUBMITTED);
  const nextCycleChosen  = hasType(safe, DECISION_EVENT_TYPES.POST_HARVEST_NEXT_CYCLE_CHOSEN);
  if (submittedHarvest && !nextCycleChosen) {
    return {
      stage: 'harvest',
      reason: 'harvest_done_no_next_cycle',
      lastEventAt, minutesSinceLastEvent,
    };
  }

  // ─── Marketplace seller ─────────────────────────────
  const createdListing = hasType(safe, DECISION_EVENT_TYPES.LISTING_CREATED_FROM_HARVEST);
  const gotInterest    = hasType(safe, DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED);
  if (createdListing && !gotInterest) {
    return {
      stage: 'marketplace_seller',
      reason: 'listing_created_no_buyer_interest',
      lastEventAt, minutesSinceLastEvent,
    };
  }

  // ─── Marketplace buyer ──────────────────────────────
  const viewedListing     = hasType(safe, DECISION_EVENT_TYPES.LISTING_VIEWED);
  const submittedInterest = gotInterest;
  if (viewedListing && !submittedInterest) {
    return {
      stage: 'marketplace_buyer',
      reason: 'listing_viewed_no_interest_sent',
      lastEventAt, minutesSinceLastEvent,
    };
  }

  return { stage: 'none', reason: 'no_drop_off_detected', lastEventAt, minutesSinceLastEvent };
}

function enteredStep(events, step) {
  return events.some((e) =>
    e?.type === FUNNEL_EVENT_TYPES.STEP_VIEWED && e?.meta?.step === step,
  );
}

function latestUnfinishedFunnelStep(events) {
  // Iterate back through the step order; the first step whose VIEWED
  // was observed but whose COMPLETED was not, is our drop-off.
  for (let i = FUNNEL_STEP_ORDER.length - 1; i >= 0; i--) {
    const step = FUNNEL_STEP_ORDER[i];
    const viewed = events.some((e) =>
      e?.type === FUNNEL_EVENT_TYPES.STEP_VIEWED && e?.meta?.step === step,
    );
    if (!viewed) continue;
    const completed = events.some((e) =>
      e?.type === FUNNEL_EVENT_TYPES.STEP_COMPLETED && e?.meta?.step === step,
    );
    if (!completed) return step;
  }
  return null;
}

function onboardingReason(stage, events) {
  if (stage === FUNNEL_STEPS.LOCATION) {
    if (hasType(events, DECISION_EVENT_TYPES.LOCATION_DETECTION_ABANDONED)) return 'location_detection_abandoned';
    if (hasType(events, 'onboarding_location_permission_denied'))           return 'location_permission_denied';
    return 'location_not_completed';
  }
  if (stage === FUNNEL_STEPS.RECOMMENDATIONS) {
    return 'recommendations_shown_no_selection';
  }
  if (stage === FUNNEL_STEPS.CROP_SELECTED) {
    return 'crop_select_never_confirmed';
  }
  return `unfinished_${stage}`;
}

/**
 * Convenience helper used in server dashboards: turn a stage into a
 * coarse bucket ("onboarding" / "today" / "harvest" / "market" / "none").
 */
export function dropOffBucket(stage) {
  if (!stage || stage === 'none') return 'none';
  if (FUNNEL_STEP_ORDER.includes(stage)) return 'onboarding';
  if (stage === 'today')   return 'today';
  if (stage === 'harvest') return 'harvest';
  if (stage === 'marketplace_seller' || stage === 'marketplace_buyer') return 'market';
  return 'unknown';
}
