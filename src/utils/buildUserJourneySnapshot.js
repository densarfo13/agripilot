/**
 * buildUserJourneySnapshot.js — turns a flat event stream into
 * the three structural snapshots product intelligence wants:
 *
 *   OnboardingSnapshot
 *   CropCycleSnapshot
 *   ListingLifecycleSnapshot
 *
 * Plus a top-level JourneySnapshot that stitches them together
 * with the inferred drop-off stage. No DB access — callers pass
 * in events and whatever metadata they have locally. The server
 * mirror (journeySnapshotService.js) uses the same shape.
 *
 * Each snapshot type is `Object.freeze`d-friendly: it's a plain
 * object of primitives + arrays, ready to ship across the wire.
 */

import { FUNNEL_STEPS, FUNNEL_EVENT_TYPES } from './funnelEventTypes.js';
import { DECISION_EVENT_TYPES } from './decisionEventTypes.js';
import { getLikelyDropOffStage } from './getLikelyDropOffStage.js';

/** @typedef {{type:string, timestamp:number, meta?:object}} Ev */

function byType(events, type) {
  return events.filter((e) => e?.type === type);
}
function firstOf(events, type) { return byType(events, type)[0] || null; }
function lastOf (events, type) { const all = byType(events, type); return all.length ? all[all.length - 1] : null; }

// ─── Onboarding snapshot ───────────────────────────────────
export function buildOnboardingSnapshot(events = []) {
  const startedEv = firstOf(events, FUNNEL_EVENT_TYPES.STEP_VIEWED);
  const completedEv = byType(events, FUNNEL_EVENT_TYPES.STEP_COMPLETED)
    .find((e) => e.meta?.step === FUNNEL_STEPS.ONBOARDING_COMPLETED);

  const locSuccess = firstOf(events, 'onboarding_location_detect_success');
  const locManual  = firstOf(events, DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL)
                  || firstOf(events, 'onboarding_manual_country_selected');
  const locationMethod = locSuccess ? 'detect'
                        : locManual ? 'manual'
                        : null;

  const modeStep = events.find((e) => e?.meta?.mode)?.meta?.mode || null;
  const selectedCrop = firstOf(events, DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED)?.meta?.crop
                    || firstOf(events, 'crop_selected')?.meta?.crop
                    || null;

  return {
    startedAt: startedEv?.timestamp ?? null,
    completedAt: completedEv?.timestamp ?? null,
    locationMethod,
    mode: normalizeMode(modeStep),
    selectedCrop,
    completed: !!completedEv,
    stepsViewed: Array.from(new Set(
      byType(events, FUNNEL_EVENT_TYPES.STEP_VIEWED).map((e) => e.meta?.step).filter(Boolean),
    )),
    stepsCompleted: Array.from(new Set(
      byType(events, FUNNEL_EVENT_TYPES.STEP_COMPLETED).map((e) => e.meta?.step).filter(Boolean),
    )),
  };
}

// ─── Crop-cycle snapshot ──────────────────────────────────
export function buildCropCycleSnapshot(events = [], opts = {}) {
  const crop = opts.crop
            ?? firstOf(events, DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED)?.meta?.crop
            ?? null;
  const recViewed  = firstOf(events, DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED);
  const recPicked  = firstOf(events, DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED);
  const totalTasks = byType(events, DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED).length;
  const completedTasks = byType(events, DECISION_EVENT_TYPES.TASK_COMPLETED).length;
  const skippedTasks   = byType(events, DECISION_EVENT_TYPES.TASK_SKIPPED).length;
  const issues = byType(events, DECISION_EVENT_TYPES.ISSUE_REPORTED).map((e) => e.meta?.type).filter(Boolean);

  const harvestEv = firstOf(events, DECISION_EVENT_TYPES.HARVEST_SUBMITTED);
  const outcomeClass = harvestEv?.meta?.outcomeClass
                    ?? harvestEv?.meta?.outcome
                    ?? null;

  return {
    crop,
    country: opts.country || null,
    stateCode: opts.stateCode || null,
    recommendationConfidence: recViewed?.meta?.confidence
                            ?? recPicked?.meta?.confidence
                            ?? null,
    accepted: !!recPicked,
    rejected: !!firstOf(events, DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED),
    switched: !!firstOf(events, DECISION_EVENT_TYPES.CROP_CHANGED_AFTER_RECOMMENDATION),
    totalTasksShown: totalTasks,
    completedTasks,
    skippedTasks,
    taskCompletionRate: totalTasks > 0 ? +(completedTasks / totalTasks).toFixed(3) : null,
    issuesReported: issues,
    harvestSubmittedAt: harvestEv?.timestamp ?? null,
    outcomeClass: normalizeOutcomeClass(outcomeClass),
    nextCycleChosen: !!firstOf(events, DECISION_EVENT_TYPES.POST_HARVEST_NEXT_CYCLE_CHOSEN),
  };
}

// ─── Listing lifecycle snapshot ──────────────────────────
export function buildListingLifecycleSnapshot(events = [], opts = {}) {
  const createdEv  = firstOf(events, DECISION_EVENT_TYPES.LISTING_CREATED_FROM_HARVEST);
  const viewedEvs  = byType(events, DECISION_EVENT_TYPES.LISTING_VIEWED);
  const interestEvs = byType(events, DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED);
  const acceptedEv  = firstOf(events, DECISION_EVENT_TYPES.INTEREST_ACCEPTED);
  const declinedEvs = byType(events, DECISION_EVENT_TYPES.INTEREST_DECLINED);
  const soldEv      = firstOf(events, DECISION_EVENT_TYPES.LISTING_SOLD);
  const expiredEv   = firstOf(events, DECISION_EVENT_TYPES.LISTING_EXPIRED);

  let state = 'open';
  if (soldEv)        state = 'sold';
  else if (expiredEv) state = 'expired';
  else if (acceptedEv) state = 'accepted';
  else if (interestEvs.length) state = 'has_interest';
  else if (createdEv) state = 'open';
  else state = 'unknown';

  return {
    listingId: opts.listingId || createdEv?.meta?.listingId || null,
    createdAt:  createdEv?.timestamp ?? null,
    viewCount:  viewedEvs.length,
    interestCount: interestEvs.length,
    acceptedAt: acceptedEv?.timestamp ?? null,
    declinedCount: declinedEvs.length,
    soldAt:    soldEv?.timestamp ?? null,
    expiredAt: expiredEv?.timestamp ?? null,
    state,
  };
}

// ─── Top-level journey snapshot ──────────────────────────
export function buildUserJourneySnapshot(events = [], opts = {}) {
  const sorted = Array.isArray(events)
    ? [...events].filter(Boolean).sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
    : [];
  return {
    generatedAt: opts.now ?? Date.now(),
    eventCount: sorted.length,
    firstEventAt: sorted[0]?.timestamp ?? null,
    lastEventAt:  sorted[sorted.length - 1]?.timestamp ?? null,
    onboarding: buildOnboardingSnapshot(sorted),
    cropCycle:  buildCropCycleSnapshot(sorted, opts),
    listing:    buildListingLifecycleSnapshot(sorted, opts),
    dropOff:    getLikelyDropOffStage(sorted, opts.now ?? Date.now()),
  };
}

function normalizeMode(m) {
  const v = String(m || '').toLowerCase();
  return v === 'backyard' || v === 'farm' ? v : null;
}

function normalizeOutcomeClass(c) {
  const v = String(c || '').toLowerCase();
  if (!v) return null;
  if (v.startsWith('good'))  return 'good';
  if (v.startsWith('bad'))   return 'bad';
  if (v.startsWith('mixed')) return 'mixed';
  return v;
}
