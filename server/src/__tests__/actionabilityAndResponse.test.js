/**
 * actionabilityAndResponse.test.js — verifies:
 *   • detected friction maps to the correct recovery action
 *   • recovery actions apply to the correct surface
 *   • low-signal contexts produce no aggressive responses
 *   • response application is additive, bounded, rule-based
 */

import { describe, it, expect } from 'vitest';
import {
  resolveFrictionAction,
  resolveTrustRecoveryAction,
  resolveRecommendationRecoveryAction,
  buildActionabilityPlan,
  listActionabilityRules,
} from '../services/decision/actionabilityService.js';
import {
  applyRecoveryActionToOnboarding,
  applyRecoveryActionToRecommendations,
  applyRecoveryActionToToday,
  applyRecoveryActionToListings,
  applyRecoveryPlan,
} from '../services/decision/responseApplicationService.js';
import { buildJourneyHealthSnapshot } from '../services/decision/journeyHealthService.js';
import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEPS,
} from '../services/analytics/decisionEventTypes.js';

const NOW = new Date('2026-04-19T00:00:00Z').getTime();
function ev(type, meta = {}, i = 0) { return { type, meta, timestamp: NOW + i * 1000 }; }

function ctxFromEvents(events, extras = {}) {
  const journey = buildJourneyHealthSnapshot(events, { now: NOW });
  return { journey, ...extras };
}

// ─── onboarding ──────────────────────────────────────────
describe('onboarding friction → action', () => {
  it('repeated retries surface the manual location shortcut', () => {
    const events = [
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 1),
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 2),
    ];
    const ctx = ctxFromEvents(events);
    const plan = resolveFrictionAction(ctx, 'onboarding');
    expect(plan?.actionKey).toBe('show_manual_location_shortcut');
    expect(plan?.priority).toBe('high');
    expect(plan?.appliesTo).toBe('onboarding');
  });

  it('permission denied + silence also surfaces the shortcut', () => {
    // Use an older denied timestamp so the trust-break detector's
    // 10-min silence check fires at the journey-snapshot "now".
    const events = [{
      type: 'onboarding_location_permission_denied', meta: {},
      timestamp: NOW - 60 * 60 * 1000, // one hour before NOW
    }];
    const journey = buildJourneyHealthSnapshot(events, { now: NOW });
    const ctx = { journey, contextKey: 'u_1' };
    const plan = resolveFrictionAction(ctx, 'onboarding');
    expect(plan?.actionKey).toBe('show_manual_location_shortcut');
  });

  it('low location confidence softens copy when no bigger issue fired', () => {
    const ctx = { journey: buildJourneyHealthSnapshot([]), locationConfidence: { level: 'low' } };
    const plan = resolveFrictionAction(ctx, 'onboarding');
    expect(plan?.actionKey).toBe('soften_location_copy');
    expect(plan?.payload?.tier).toBe('low');
  });
});

// ─── recommendation ──────────────────────────────────────
describe('recommendation friction → action', () => {
  it('high-confidence rec rejected → confidence downgrade', () => {
    const events = [
      { type: DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED,
        meta: { crop: 'maize' }, confidence: { level: 'high', score: 90 }, timestamp: NOW },
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED, { crop: 'maize' }, 1),
    ];
    const ctx = ctxFromEvents(events);
    const plan = resolveRecommendationRecoveryAction(ctx);
    expect(plan?.actionKey).toBe('downgrade_recommendation_confidence_wording');
    expect(plan?.payload?.targetTier).toBe('medium');
  });

  it('low trust shows reason cards', () => {
    const ctx = { journey: { trustScore: 0.4, topDrivers: [], sources: {} } };
    const plan = resolveRecommendationRecoveryAction(ctx);
    expect(plan?.actionKey).toBe('show_recommendation_reasons');
  });

  it('very low trust offers manual crop search', () => {
    const ctx = { journey: { trustScore: 0.2, topDrivers: [], sources: {} } };
    const plan = resolveRecommendationRecoveryAction(ctx);
    expect(plan?.actionKey).toBe('offer_manual_crop_search');
  });
});

// ─── today ───────────────────────────────────────────────
describe('today friction → action', () => {
  it('repeat-skipped task triggers catch-up task', () => {
    const events = [
      ev(DECISION_EVENT_TYPES.TASK_SKIPPED, { taskId: 't1' }, 1),
      ev(DECISION_EVENT_TYPES.TASK_SKIPPED, { taskId: 't1' }, 2),
      ev(DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED, { taskId: 't1' }, 3),
    ];
    const ctx = ctxFromEvents(events);
    const plan = resolveFrictionAction(ctx, 'today');
    expect(plan?.actionKey).toBe('add_catch_up_task');
    expect(plan?.payload?.escalation).toBe('soft');
  });

  it('low task confidence switches to check-first wording', () => {
    const ctx = { journey: buildJourneyHealthSnapshot([]), taskConfidence: { level: 'low' } };
    const plan = resolveFrictionAction(ctx, 'today');
    expect(plan?.actionKey).toBe('simplify_task_wording');
  });
});

// ─── listing ─────────────────────────────────────────────
describe('listing friction → action', () => {
  it('missing fields prompt completeness nudge', () => {
    const ctx = { journey: buildJourneyHealthSnapshot([]),
                  listing: { missingFields: ['price', 'quantity'] } };
    const plan = resolveFrictionAction(ctx, 'listing');
    expect(plan?.actionKey).toBe('prompt_listing_completeness');
    expect(plan?.payload?.fields).toEqual(['price', 'quantity']);
  });

  it('low listing confidence marks listing as aging', () => {
    const ctx = { journey: buildJourneyHealthSnapshot([]),
                  listingConfidence: { level: 'low' } };
    const plan = resolveFrictionAction(ctx, 'listing');
    expect(plan?.actionKey).toBe('mark_listing_as_aging');
  });
});

// ─── buildActionabilityPlan rollup ───────────────────────
describe('buildActionabilityPlan', () => {
  it('returns null-per-surface when nothing is wrong', () => {
    const ctx = { journey: buildJourneyHealthSnapshot([]) };
    const plan = buildActionabilityPlan(ctx);
    expect(plan.surfaces.onboarding).toBeNull();
    expect(plan.surfaces.recommendation).toBeNull();
    expect(plan.surfaces.today).toBeNull();
    expect(plan.surfaces.listing).toBeNull();
    expect(plan.hasAnyAction).toBe(false);
  });

  it('aggregates per-surface actions and reports highestPriority', () => {
    const events = [
      ev(DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED, { taskId: 't1' }, 1),
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 2),
    ];
    const ctx = ctxFromEvents(events);
    const plan = buildActionabilityPlan(ctx);
    expect(plan.hasAnyAction).toBe(true);
    expect(plan.highestPriority).toBe('high');
  });

  it('flat mode returns just the plans array', () => {
    // Two retries needed to trip the multi_retry hesitation driver.
    const ctx = ctxFromEvents([
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 1),
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 2),
    ]);
    const flat = buildActionabilityPlan(ctx, { flat: true });
    expect(Array.isArray(flat)).toBe(true);
    expect(flat.length).toBeGreaterThan(0);
  });
});

// ─── response application ────────────────────────────────
describe('applyRecoveryActionToOnboarding', () => {
  it('returns manualShortcut for the shortcut action', () => {
    const out = applyRecoveryActionToOnboarding({
      appliesTo: 'onboarding',
      actionType: 'ui_recovery',
      actionKey: 'show_manual_location_shortcut',
      priority: 'high',
    });
    expect(out.manualShortcut.visible).toBe(true);
    expect(out.manualShortcut.prominence).toBe('high');
  });
  it('no-op for null or wrong surface', () => {
    expect(applyRecoveryActionToOnboarding(null)).toEqual({});
    expect(applyRecoveryActionToOnboarding({ appliesTo: 'today' })).toEqual({});
  });
});

describe('applyRecoveryActionToRecommendations', () => {
  it('confidence_downgrade sets confidenceOverride', () => {
    const out = applyRecoveryActionToRecommendations({
      appliesTo: 'recommendation',
      actionType: 'confidence_downgrade',
      actionKey: 'downgrade_recommendation_confidence_wording',
      priority: 'high',
      payload: { targetTier: 'medium' },
    });
    expect(out.confidenceOverride.targetTier).toBe('medium');
  });
});

describe('applyRecoveryActionToToday', () => {
  it('catch_up_task plan adds a catch-up task', () => {
    const out = applyRecoveryActionToToday({
      appliesTo: 'today',
      actionType: 'catch_up_task',
      actionKey: 'add_catch_up_task',
      priority: 'high',
      payload: { escalation: 'soft' },
    });
    expect(out.addedTasks).toHaveLength(1);
    expect(out.addedTasks[0].escalation).toBe('soft');
  });
});

describe('applyRecoveryActionToListings', () => {
  it('completeness nudge exposes fields', () => {
    const out = applyRecoveryActionToListings({
      appliesTo: 'listing',
      actionType: 'listing_nudge',
      actionKey: 'prompt_listing_completeness',
      priority: 'high',
      payload: { fields: ['price'] },
    });
    expect(out.completenessPrompt.fields).toEqual(['price']);
    expect(out.highlightFields).toEqual(['price']);
  });
});

describe('applyRecoveryPlan — full dispatch', () => {
  it('dispatches to all four surfaces', () => {
    const fullPlan = {
      surfaces: {
        onboarding: {
          appliesTo: 'onboarding', actionType: 'ui_recovery',
          actionKey: 'show_manual_location_shortcut', priority: 'high',
        },
        recommendation: null,
        today: {
          appliesTo: 'today', actionType: 'catch_up_task',
          actionKey: 'add_catch_up_task', priority: 'high',
          payload: { escalation: 'soft' },
        },
        listing: null,
      },
      hasAnyAction: true, highestPriority: 'high', contextKey: 'u_42',
    };
    const out = applyRecoveryPlan(fullPlan);
    expect(out.onboarding.manualShortcut.visible).toBe(true);
    expect(out.today.addedTasks).toHaveLength(1);
    expect(out.recommendation).toEqual({});
    expect(out.listing).toEqual({});
    expect(out.meta.hasAnyAction).toBe(true);
    expect(out.meta.highestPriority).toBe('high');
  });
});

describe('listActionabilityRules', () => {
  it('exposes a frozen row per rule', () => {
    const rules = listActionabilityRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(Object.isFrozen(rules[0])).toBe(true);
  });
});

// ─── Stability rail ──────────────────────────────────────
describe('stability', () => {
  it('calm context → no action and no aggressive response', () => {
    const ctx = { journey: buildJourneyHealthSnapshot([]) };
    const plan = buildActionabilityPlan(ctx);
    const responses = applyRecoveryPlan(plan);
    expect(plan.hasAnyAction).toBe(false);
    expect(responses.onboarding).toEqual({});
    expect(responses.recommendation).toEqual({});
    expect(responses.today).toEqual({});
    expect(responses.listing).toEqual({});
  });

  it('resolveTrustRecoveryAction returns null when nothing is broken', () => {
    const ctx = { journey: buildJourneyHealthSnapshot([]) };
    const plan = resolveTrustRecoveryAction(ctx);
    expect(plan).toBeNull();
  });
});
