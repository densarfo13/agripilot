/**
 * journeySnapshotService.js — server-side mirror of
 * buildUserJourneySnapshot.js on the client. Given a sorted list
 * of events for a single user (or session), produce the three
 * structural snapshots:
 *
 *   • OnboardingSnapshot
 *   • CropCycleSnapshot
 *   • ListingLifecycleSnapshot
 *
 * The shapes are identical to the client so dashboards can consume
 * either side. Kept in JS (no Prisma calls) so it's easy to unit
 * test and easy to run against raw event-log rows that the caller
 * selects however it wants (Prisma, a view, a CSV import, etc.).
 *
 * summarizeJourneyEvents() wraps all three and stitches in a drop-
 * off inference — that's the canonical entry point for reports.
 */

import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEPS,
  FUNNEL_STEP_ORDER,
} from './decisionEventTypes.js';

const LOCATION_DETECT_SUCCESS     = 'onboarding_location_detect_success';
const LOCATION_MANUAL_FALLBACK    = 'onboarding_manual_country_selected';

function byType(events, type)  { return events.filter((e) => e?.type === type); }
function firstOf(events, type) { return byType(events, type)[0] || null; }

export function buildOnboardingSnapshot(events = []) {
  const viewedSteps    = byType(events, FUNNEL_EVENT_TYPES.STEP_VIEWED);
  const completedSteps = byType(events, FUNNEL_EVENT_TYPES.STEP_COMPLETED);
  const completedEv    = completedSteps.find((e) => e.meta?.step === FUNNEL_STEPS.ONBOARDING_COMPLETED);
  const startedAt      = viewedSteps[0]?.timestamp ?? null;

  const locationMethod =
       firstOf(events, LOCATION_DETECT_SUCCESS) ? 'detect'
     : firstOf(events, DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL) ? 'manual'
     : firstOf(events, LOCATION_MANUAL_FALLBACK) ? 'manual'
     : null;

  const modeEv = events.find((e) => e?.meta?.mode);

  return {
    startedAt,
    completedAt: completedEv?.timestamp ?? null,
    locationMethod,
    mode: normalizeMode(modeEv?.meta?.mode),
    selectedCrop: firstOf(events, DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED)?.meta?.crop ?? null,
    completed: !!completedEv,
    durationMs:
      completedEv && startedAt
        ? Math.max(0, completedEv.timestamp - startedAt)
        : null,
    stepsViewed:    Array.from(new Set(viewedSteps.map((e) => e.meta?.step).filter(Boolean))),
    stepsCompleted: Array.from(new Set(completedSteps.map((e) => e.meta?.step).filter(Boolean))),
    stepsAbandoned: Array.from(new Set(
      byType(events, FUNNEL_EVENT_TYPES.STEP_ABANDONED).map((e) => e.meta?.step).filter(Boolean),
    )),
  };
}

export function buildCropCycleSnapshot(events = [], opts = {}) {
  const recView   = firstOf(events, DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED);
  const recPick   = firstOf(events, DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED);
  const recReject = firstOf(events, DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED);
  const switched  = firstOf(events, DECISION_EVENT_TYPES.CROP_CHANGED_AFTER_RECOMMENDATION);
  const totalTaskViews = byType(events, DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED).length;
  const completed = byType(events, DECISION_EVENT_TYPES.TASK_COMPLETED).length;
  const skipped   = byType(events, DECISION_EVENT_TYPES.TASK_SKIPPED).length;
  const repeatSkipped = byType(events, DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED).length;
  const issues    = byType(events, DECISION_EVENT_TYPES.ISSUE_REPORTED).map((e) => e.meta?.type).filter(Boolean);
  const harvest   = firstOf(events, DECISION_EVENT_TYPES.HARVEST_SUBMITTED);

  return {
    crop: opts.crop ?? recPick?.meta?.crop ?? null,
    country:   opts.country   ?? recPick?.country   ?? null,
    stateCode: opts.stateCode ?? recPick?.stateCode ?? null,
    recommendationConfidence: recPick?.confidence ?? recView?.confidence ?? null,
    accepted: !!recPick,
    rejected: !!recReject,
    switched: !!switched,
    totalTasksShown: totalTaskViews,
    completedTasks: completed,
    skippedTasks: skipped,
    repeatSkippedTasks: repeatSkipped,
    taskCompletionRate: totalTaskViews > 0
      ? +(completed / totalTaskViews).toFixed(3)
      : null,
    issuesReported: issues,
    harvestSubmittedAt: harvest?.timestamp ?? null,
    outcomeClass: normalizeOutcome(harvest?.meta?.outcomeClass ?? harvest?.meta?.outcome),
    nextCycleChosen: !!firstOf(events, DECISION_EVENT_TYPES.POST_HARVEST_NEXT_CYCLE_CHOSEN),
  };
}

export function buildListingLifecycleSnapshot(events = [], opts = {}) {
  const createdEv   = firstOf(events, DECISION_EVENT_TYPES.LISTING_CREATED_FROM_HARVEST);
  const viewedCount = byType(events, DECISION_EVENT_TYPES.LISTING_VIEWED).length;
  const interestEvs = byType(events, DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED);
  const acceptedEv  = firstOf(events, DECISION_EVENT_TYPES.INTEREST_ACCEPTED);
  const declinedEvs = byType(events, DECISION_EVENT_TYPES.INTEREST_DECLINED);
  const soldEv      = firstOf(events, DECISION_EVENT_TYPES.LISTING_SOLD);
  const expiredEv   = firstOf(events, DECISION_EVENT_TYPES.LISTING_EXPIRED);

  let state = 'unknown';
  if (soldEv)              state = 'sold';
  else if (expiredEv)      state = 'expired';
  else if (acceptedEv)     state = 'accepted';
  else if (interestEvs.length) state = 'has_interest';
  else if (createdEv)      state = 'open';

  return {
    listingId: opts.listingId ?? createdEv?.meta?.listingId ?? null,
    createdAt:  createdEv?.timestamp ?? null,
    viewCount:  viewedCount,
    interestCount: interestEvs.length,
    acceptedAt: acceptedEv?.timestamp ?? null,
    declinedCount: declinedEvs.length,
    soldAt:    soldEv?.timestamp ?? null,
    expiredAt: expiredEv?.timestamp ?? null,
    state,
  };
}

/**
 * summarizeJourneyEvents — single canonical entry point for
 * report pipelines. Takes a sorted event list and returns all
 * three snapshots plus a coarse drop-off classification.
 */
export function summarizeJourneyEvents(events = [], opts = {}) {
  const sorted = Array.isArray(events)
    ? [...events].filter(Boolean).sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
    : [];
  return {
    generatedAt: opts.now ?? Date.now(),
    eventCount: sorted.length,
    onboarding: buildOnboardingSnapshot(sorted),
    cropCycle:  buildCropCycleSnapshot(sorted, opts),
    listing:    buildListingLifecycleSnapshot(sorted, opts),
  };
}

function normalizeMode(m) {
  const v = String(m || '').toLowerCase();
  return v === 'backyard' || v === 'farm' ? v : null;
}

function normalizeOutcome(v) {
  const s = String(v || '').toLowerCase();
  if (!s) return null;
  if (s.startsWith('good'))  return 'good';
  if (s.startsWith('bad'))   return 'bad';
  if (s.startsWith('mixed')) return 'mixed';
  return s;
}

export const _internal = {
  FUNNEL_STEP_ORDER, LOCATION_DETECT_SUCCESS, LOCATION_MANUAL_FALLBACK,
};
