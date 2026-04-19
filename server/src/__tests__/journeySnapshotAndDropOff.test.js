/**
 * journeySnapshotAndDropOff.test.js — behavioral contract for the
 * snapshot + drop-off services. The tests are written as
 * end-to-end scenarios so they match the acceptance-criteria
 * grid from the spec:
 *
 *   1. detect success → confirm yes → correct event sequence
 *   2. detect fail → manual → correct event sequence
 *   3. recommendation shown → different crop selected → switched
 *      rejection signal recorded
 *   4. buyer views listings but never clicks Interested → drop-off
 *      classified as marketplace_buyer / listing_viewed_no_interest_sent
 *   5. harvest done but no next cycle → drop-off classified as
 *      harvest / harvest_done_no_next_cycle
 */

import { describe, it, expect } from 'vitest';
import {
  buildOnboardingSnapshot,
  buildCropCycleSnapshot,
  buildListingLifecycleSnapshot,
  summarizeJourneyEvents,
} from '../services/analytics/journeySnapshotService.js';
import {
  getLikelyDropOffStage,
  getOnboardingDropOffReason,
  getBuyerFunnelDropOff,
  aggregateDropOffCounts,
} from '../services/analytics/dropOffDetectionService.js';
import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEPS,
} from '../services/analytics/decisionEventTypes.js';

const T0 = new Date('2026-04-19T09:00:00Z').getTime();
let tick = 0;
function t(step = 0) { return T0 + (tick += step + 1) * 60_000; }
function e(type, meta = {}, extras = {}) {
  return { type, timestamp: t(), mode: extras.mode ?? 'farm', meta, ...extras };
}

describe('onboarding snapshot — detect + confirm yes', () => {
  it('records locationMethod = detect and completed = true', () => {
    tick = 0;
    const events = [
      e(FUNNEL_EVENT_TYPES.STEP_VIEWED,    { step: FUNNEL_STEPS.WELCOME }),
      e(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.WELCOME }),
      e(FUNNEL_EVENT_TYPES.STEP_VIEWED,    { step: FUNNEL_STEPS.LOCATION }),
      e('onboarding_location_detect_clicked', {}),
      e('onboarding_location_detect_success', {}),
      e(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES, {}),
      e(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.LOCATION }),
      e(FUNNEL_EVENT_TYPES.STEP_VIEWED,    { step: FUNNEL_STEPS.RECOMMENDATIONS }),
      e(DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED, { crop: 'maize' }),
      e(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }),
      e(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.RECOMMENDATIONS }),
      e(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.ONBOARDING_COMPLETED }),
    ];
    const snap = buildOnboardingSnapshot(events);
    expect(snap.locationMethod).toBe('detect');
    expect(snap.completed).toBe(true);
    expect(snap.selectedCrop).toBe('maize');
    expect(snap.stepsCompleted).toContain(FUNNEL_STEPS.LOCATION);
    expect(snap.durationMs).toBeGreaterThan(0);
  });
});

describe('onboarding snapshot — detect fails, manual fallback', () => {
  it('records locationMethod = manual even when detect was tried', () => {
    tick = 0;
    const events = [
      e(FUNNEL_EVENT_TYPES.STEP_VIEWED,    { step: FUNNEL_STEPS.WELCOME }),
      e(FUNNEL_EVENT_TYPES.STEP_VIEWED,    { step: FUNNEL_STEPS.LOCATION }),
      e('onboarding_location_detect_clicked', {}),
      e('onboarding_location_detect_failed', {}),
      e(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}),
      e('onboarding_location_detect_failed', {}),
      e(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, { country: 'GH' }),
      e(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.LOCATION }),
    ];
    const snap = buildOnboardingSnapshot(events);
    expect(snap.locationMethod).toBe('manual');
    expect(snap.completed).toBe(false);
  });
});

describe('crop cycle snapshot — rejection/switch signal', () => {
  it('records switched=true when the user picked a different crop', () => {
    tick = 0;
    const events = [
      e(DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED, { crop: 'maize' }),
      e(DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED, { crop: 'maize' }),
      e(DECISION_EVENT_TYPES.CROP_CHANGED_AFTER_RECOMMENDATION, { from: 'maize', to: 'tomato' }),
      e(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'tomato' }),
    ];
    const cycle = buildCropCycleSnapshot(events, { country: 'GH' });
    expect(cycle.accepted).toBe(true);
    expect(cycle.rejected).toBe(true);
    expect(cycle.switched).toBe(true);
    expect(cycle.crop).toBe('tomato');
  });

  it('records taskCompletionRate and outcomeClass', () => {
    tick = 0;
    const events = [
      e(DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED, { taskId: 't1' }),
      e(DECISION_EVENT_TYPES.TASK_COMPLETED, { taskId: 't1' }),
      e(DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED, { taskId: 't2' }),
      e(DECISION_EVENT_TYPES.TASK_SKIPPED, { taskId: 't2' }),
      e(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, { outcomeClass: 'good' }),
    ];
    const cycle = buildCropCycleSnapshot(events, { crop: 'maize' });
    expect(cycle.totalTasksShown).toBe(2);
    expect(cycle.completedTasks).toBe(1);
    expect(cycle.taskCompletionRate).toBe(0.5);
    expect(cycle.outcomeClass).toBe('good');
  });
});

describe('listing lifecycle snapshot', () => {
  it('moves from open → has_interest → sold', () => {
    tick = 0;
    const events = [
      e(DECISION_EVENT_TYPES.LISTING_CREATED_FROM_HARVEST, { listingId: 'L1' }),
      e(DECISION_EVENT_TYPES.LISTING_VIEWED, { listingId: 'L1' }),
      e(DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED, { listingId: 'L1' }),
      e(DECISION_EVENT_TYPES.INTEREST_ACCEPTED, { listingId: 'L1' }),
      e(DECISION_EVENT_TYPES.LISTING_SOLD, { listingId: 'L1' }),
    ];
    const snap = buildListingLifecycleSnapshot(events);
    expect(snap.listingId).toBe('L1');
    expect(snap.state).toBe('sold');
    expect(snap.interestCount).toBe(1);
    expect(snap.viewCount).toBe(1);
  });

  it('classifies expired correctly', () => {
    tick = 0;
    const events = [
      e(DECISION_EVENT_TYPES.LISTING_CREATED_FROM_HARVEST, { listingId: 'L2' }),
      e(DECISION_EVENT_TYPES.LISTING_EXPIRED, { listingId: 'L2' }),
    ];
    const snap = buildListingLifecycleSnapshot(events);
    expect(snap.state).toBe('expired');
  });
});

describe('getLikelyDropOffStage — onboarding paths', () => {
  it('location entered but never completed → onboarding / location', () => {
    tick = 0;
    const events = [
      e(FUNNEL_EVENT_TYPES.STEP_VIEWED, { step: FUNNEL_STEPS.WELCOME }),
      e(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.WELCOME }),
      e(FUNNEL_EVENT_TYPES.STEP_VIEWED, { step: FUNNEL_STEPS.LOCATION }),
      e('onboarding_location_permission_denied', {}),
    ];
    const inf = getLikelyDropOffStage(events);
    expect(inf.bucket).toBe('onboarding');
    expect(inf.stage).toBe(FUNNEL_STEPS.LOCATION);
    expect(inf.reason).toBe('location_permission_denied');
  });

  it('recommendations viewed but never selected', () => {
    tick = 0;
    const events = [
      e(FUNNEL_EVENT_TYPES.STEP_VIEWED, { step: FUNNEL_STEPS.WELCOME }),
      e(FUNNEL_EVENT_TYPES.STEP_VIEWED, { step: FUNNEL_STEPS.RECOMMENDATIONS }),
      e(DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED, { crop: 'maize' }),
    ];
    const inf = getLikelyDropOffStage(events);
    expect(inf.bucket).toBe('onboarding');
    expect(inf.stage).toBe(FUNNEL_STEPS.RECOMMENDATIONS);
    expect(inf.reason).toBe('recommendations_shown_no_selection');
  });
});

describe('getLikelyDropOffStage — post-onboarding', () => {
  it('today viewed, no task completed', () => {
    tick = 0;
    const events = [
      e(FUNNEL_EVENT_TYPES.STEP_VIEWED, { step: FUNNEL_STEPS.WELCOME }),
      e(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.ONBOARDING_COMPLETED }),
      e(DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED, {}),
    ];
    const inf = getLikelyDropOffStage(events);
    expect(inf.bucket).toBe('today');
    expect(inf.reason).toBe('today_viewed_no_task_completed');
  });

  it('harvest done but no next cycle chosen', () => {
    tick = 0;
    const events = [
      e(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, { outcomeClass: 'good' }),
    ];
    const inf = getLikelyDropOffStage(events);
    expect(inf.bucket).toBe('harvest');
    expect(inf.reason).toBe('harvest_done_no_next_cycle');
  });

  it('buyer viewed listings but never sent interest', () => {
    tick = 0;
    const events = [
      e(DECISION_EVENT_TYPES.LISTING_VIEWED, { listingId: 'L1' }),
      e(DECISION_EVENT_TYPES.LISTING_VIEWED, { listingId: 'L2' }),
    ];
    const inf = getLikelyDropOffStage(events);
    expect(inf.bucket).toBe('market');
    expect(inf.stage).toBe('marketplace_buyer');
    expect(inf.reason).toBe('listing_viewed_no_interest_sent');
  });

  it('seller listing exists but no buyer interest', () => {
    tick = 0;
    const events = [
      e(DECISION_EVENT_TYPES.LISTING_CREATED_FROM_HARVEST, { listingId: 'L1' }),
    ];
    const inf = getLikelyDropOffStage(events);
    expect(inf.bucket).toBe('market');
    expect(inf.stage).toBe('marketplace_seller');
  });

  it('no drop-off when everything ran through', () => {
    tick = 0;
    const events = [
      e(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, { outcomeClass: 'good' }),
      e(DECISION_EVENT_TYPES.POST_HARVEST_NEXT_CYCLE_CHOSEN, { crop: 'tomato' }),
    ];
    const inf = getLikelyDropOffStage(events);
    expect(inf.stage).toBe('none');
  });
});

describe('getOnboardingDropOffReason', () => {
  it('returns null when the user is past onboarding', () => {
    tick = 0;
    const events = [
      e(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.ONBOARDING_COMPLETED }),
      e(DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED, {}),
    ];
    expect(getOnboardingDropOffReason(events)).toBeNull();
  });

  it('returns a stage+reason when still in onboarding', () => {
    tick = 0;
    const events = [
      e(FUNNEL_EVENT_TYPES.STEP_VIEWED, { step: FUNNEL_STEPS.WELCOME }),
      e(FUNNEL_EVENT_TYPES.STEP_VIEWED, { step: FUNNEL_STEPS.GROWING_TYPE }),
    ];
    const res = getOnboardingDropOffReason(events);
    expect(res).toBeTruthy();
    expect(res.stage).toBe(FUNNEL_STEPS.GROWING_TYPE);
  });
});

describe('getBuyerFunnelDropOff', () => {
  it('labels each stage', () => {
    expect(getBuyerFunnelDropOff([]).stage).toBe('not_viewing');
    expect(getBuyerFunnelDropOff([{ type: DECISION_EVENT_TYPES.LISTING_VIEWED, timestamp: 1 }]).stage)
      .toBe('viewed_no_interest');
    expect(getBuyerFunnelDropOff([
      { type: DECISION_EVENT_TYPES.LISTING_VIEWED, timestamp: 1 },
      { type: DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED, timestamp: 2 },
    ]).stage).toBe('sent_not_accepted');
    expect(getBuyerFunnelDropOff([
      { type: DECISION_EVENT_TYPES.LISTING_VIEWED, timestamp: 1 },
      { type: DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED, timestamp: 2 },
      { type: DECISION_EVENT_TYPES.INTEREST_ACCEPTED, timestamp: 3 },
    ])).toEqual({ stage: 'complete', complete: true });
  });
});

describe('aggregateDropOffCounts', () => {
  it('rolls multiple users into bucket + mode counts', () => {
    tick = 0;
    const users = [
      { userId: 'u1', events: [
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED, timestamp: 1, meta: { step: FUNNEL_STEPS.WELCOME, mode: 'backyard' } },
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED, timestamp: 2, meta: { step: FUNNEL_STEPS.LOCATION, mode: 'backyard' } },
      ]},
      { userId: 'u2', events: [
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED, timestamp: 3, meta: { step: FUNNEL_STEPS.WELCOME, mode: 'farm' } },
        { type: FUNNEL_EVENT_TYPES.STEP_COMPLETED, timestamp: 4, meta: { step: FUNNEL_STEPS.ONBOARDING_COMPLETED, mode: 'farm' } },
        { type: DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED, timestamp: 5, meta: { mode: 'farm' } },
      ]},
      { userId: 'u3', events: [
        { type: DECISION_EVENT_TYPES.LISTING_VIEWED, timestamp: 6, meta: {} },
      ]},
    ];
    const agg = aggregateDropOffCounts(users);
    expect(agg.totalUsers).toBe(3);
    expect(agg.byBucket.onboarding).toBe(1);
    expect(agg.byBucket.today).toBe(1);
    expect(agg.byBucket.market).toBe(1);
    expect(agg.byMode.backyard).toBe(1);
    expect(agg.byMode.farm).toBe(1);
  });
});

describe('summarizeJourneyEvents', () => {
  it('stitches onboarding + cycle + listing in one call', () => {
    tick = 0;
    const events = [
      e(FUNNEL_EVENT_TYPES.STEP_VIEWED, { step: FUNNEL_STEPS.WELCOME }),
      e(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.ONBOARDING_COMPLETED }),
      e(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }),
      e(DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED, {}),
      e(DECISION_EVENT_TYPES.TASK_COMPLETED, {}),
      e(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, { outcomeClass: 'good' }),
      e(DECISION_EVENT_TYPES.LISTING_CREATED_FROM_HARVEST, { listingId: 'L1' }),
    ];
    const s = summarizeJourneyEvents(events);
    expect(s.onboarding.completed).toBe(true);
    expect(s.cropCycle.outcomeClass).toBe('good');
    expect(s.listing.state).toBe('open');
    expect(s.eventCount).toBe(events.length);
  });
});
