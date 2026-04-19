/**
 * productionReadiness.test.js — locks in the final robustness pass:
 *
 *   1. getBehaviorPattern + applyBehaviorUrgency + getBehaviorAwareWhy
 *   2. getCatchUpPrimaryTask + adjustProgressAfterGap + buildCatchUpTasks
 *   3. getRecommendationReasonSummary + buildRecommendationReasons
 *   4. getPriorityAcrossCropCycles + buildUnifiedTodayPayload
 *   5. getFailureRecoveryOptions (failure-aware next-cycle)
 *   6. validateListingForActivation (duplicate-active + quantity + enums)
 *   7. getListingFreshnessLabel + expireStaleListings (stub prisma)
 *   8. getFirstValueScreen / buildPostOnboardingRoute
 *   9. i18n wire-up for the new keys
 */
import { describe, it, expect } from 'vitest';
import {
  getMissedDays, getBehaviorPattern,
  applyBehaviorUrgency, getBehaviorAwareWhy,
} from '../../../src/utils/getBehaviorPattern.js';
import {
  getCatchUpPrimaryTask, adjustProgressAfterGap, buildCatchUpTasks,
} from '../../../src/utils/getCatchUpTasks.js';
import {
  buildRecommendationReasons, getRecommendationReasonSummary,
} from '../../../src/utils/getRecommendationReasonSummary.js';
import {
  rankCropCyclesForToday, getPriorityAcrossCropCycles,
  buildUnifiedTodayPayload,
} from '../../../src/utils/getPriorityAcrossCropCycles.js';
import {
  getFailureSummary, getImprovedRetryPlan, getFailureRecoveryOptions,
} from '../../../src/utils/getFailureRecoveryOptions.js';
import { validateListingForActivation } from '../services/market/listingValidationService.js';
import {
  getListingFreshnessLabel, expireStaleListings,
  FRESH_DAYS, OLDER_DAYS, STALE_DAYS,
} from '../services/market/listingFreshnessService.js';
import {
  getFirstValueScreen, buildPostOnboardingRoute,
} from '../../../src/utils/getFirstValueScreen.js';
import { t } from '../../../src/i18n/index.js';

const MS_DAY = 86_400_000;
const mkAction = (type, daysAgo = 0, details = {}) => ({
  actionType: type,
  occurredAt: new Date(Date.now() - daysAgo * MS_DAY).toISOString(),
  details,
});

// ─── 1. Behavior pattern ────────────────────────────────
describe('getBehaviorPattern', () => {
  it('on_track when nothing is wrong', () => {
    const out = getBehaviorPattern({
      actions: [mkAction('task_completed', 0), mkAction('task_completed', 1)],
    });
    expect(out.pattern).toBe('on_track');
    expect(out.urgencyBoost).toBe(0);
  });

  it('inactive after 4+ missed days', () => {
    const out = getBehaviorPattern({ actions: [mkAction('task_completed', 5)] });
    expect(out.pattern).toBe('inactive');
    expect(out.urgencyBoost).toBe(25);
    expect(out.whyKey).toBe('today.why.catchUp');
  });

  it('missing_watering when a pending watering task exists and was recently skipped', () => {
    const out = getBehaviorPattern({
      actions: [mkAction('task_skipped', 1, { taskTitle: 'Water the rows' })],
      tasks: [{ status: 'pending', title: 'Water the rows' }],
    });
    expect(out.pattern).toBe('missing_watering');
  });

  it('pest_pressure with 2+ recent pest/disease issues', () => {
    const out = getBehaviorPattern({
      actions: [
        mkAction('issue_reported', 1, { category: 'pest' }),
        mkAction('issue_reported', 2, { category: 'disease' }),
      ],
    });
    expect(out.pattern).toBe('pest_pressure');
  });

  it('slipping when skipRate ≥ 0.5', () => {
    const out = getBehaviorPattern({
      actions: [
        mkAction('task_skipped', 0), mkAction('task_skipped', 1),
        mkAction('task_completed', 2),
      ],
    });
    expect(out.pattern).toBe('slipping');
  });

  it('recovering when user is on a streak after earlier skips', () => {
    const out = getBehaviorPattern({
      actions: [
        mkAction('task_completed', 0), mkAction('task_completed', 1),
        mkAction('task_completed', 2), mkAction('task_skipped', 3),
      ],
    });
    expect(out.pattern).toBe('recovering');
  });

  it('applyBehaviorUrgency raises priority + tags adjustedBy', () => {
    const next = applyBehaviorUrgency(
      { title: 'Water', priorityScore: 55, adjustedBy: [] },
      { urgencyBoost: 20 },
    );
    expect(next.priorityScore).toBe(75);
    expect(next.priority).toBe('high');
    expect(next.adjustedBy).toContain('behavior');
  });

  it('getBehaviorAwareWhy upgrades copy when heat + missed watering combine', () => {
    const whyKey = getBehaviorAwareWhy(null,
      { pattern: 'missing_watering' },
      { heatRisk: 'high' });
    expect(whyKey).toBe('today.why.wateringGapWithHeat');
  });

  it('getMissedDays returns null when there are no actions', () => {
    expect(getMissedDays({ actions: [] })).toBeNull();
  });
});

// ─── 2. Catch-up ────────────────────────────────────────
describe('getCatchUpPrimaryTask', () => {
  it('returns null when missedDays < 3', () => {
    expect(getCatchUpPrimaryTask({ missedDays: 1 })).toBeNull();
  });

  it('picks the water kind when hot + pending watering', () => {
    const out = getCatchUpPrimaryTask({
      missedDays: 4,
      tasks: [{ status: 'pending', title: 'Water the rows' }],
      weather: { heatRisk: 'high' },
    });
    expect(out.kind).toBe('water');
    expect(out.source).toBe('catchup');
    expect(out.banner.textKey).toBe('catchUp.banner.missedDays');
    expect(out.banner.vars.n).toBe(4);
  });

  it('picks harvest when stage is harvest_ready', () => {
    const out = getCatchUpPrimaryTask({ missedDays: 5, tasks: [], stage: 'harvest_ready' });
    expect(out.kind).toBe('harvest');
  });

  it('falls back to inspect', () => {
    const out = getCatchUpPrimaryTask({ missedDays: 5, tasks: [] });
    expect(out.kind).toBe('inspect');
  });

  it('adjustProgressAfterGap pulls percent back, capped at 20', () => {
    expect(adjustProgressAfterGap({ progressPercent: 80, missedDays: 1 })).toBe(80);
    expect(adjustProgressAfterGap({ progressPercent: 80, missedDays: 3 })).toBe(75);
    expect(adjustProgressAfterGap({ progressPercent: 80, missedDays: 10 })).toBe(60);
  });

  it('buildCatchUpTasks returns a single primary + inspect secondary when not already inspect', () => {
    const out = buildCatchUpTasks({
      missedDays: 5,
      tasks: [{ status: 'pending', title: 'Water rows' }],
      weather: { heatRisk: 'high' },
    });
    expect(out.primary.kind).toBe('water');
    expect(out.extras).toHaveLength(1);
    expect(out.extras[0].kind).toBe('inspect');
  });

  it('buildCatchUpTasks returns no extras when the primary is already inspect', () => {
    const out = buildCatchUpTasks({ missedDays: 5, tasks: [] });
    expect(out.primary.kind).toBe('inspect');
    expect(out.extras).toEqual([]);
  });
});

// ─── 3. Recommendation reason summary ────────────────────
describe('getRecommendationReasonSummary + buildRecommendationReasons', () => {
  it('filters vague wording out of summary', () => {
    const s = getRecommendationReasonSummary(
      { reasons: ['recommended', 'suitable', 'Good for your region'] },
    );
    expect(s).toBe('Good for your region');
  });

  it('builds backyard-specific reasons when mode is backyard', () => {
    const out = buildRecommendationReasons(
      { fitLevel: 'high', plantingStatus: 'plant_now' },
      { mode: 'backyard', beginnerLevel: 'beginner' },
    );
    expect(out).toContain('recommendation.goodForBackyard');
    expect(out).toContain('recommendation.plantingOpen');
    expect(out).toContain('recommendation.beginnerReason');
  });

  it('falls back to server-provided reasons when they are non-vague', () => {
    const s = getRecommendationReasonSummary(
      { reasons: ['Your climate suits this crop.', 'Planting window open.'] },
      {},
    );
    expect(s).toContain('Your climate suits this crop.');
  });

  it('caps output at 3 keys', () => {
    const out = buildRecommendationReasons(
      { fitLevel: 'high', plantingStatus: 'plant_now' },
      { farmSize: 'small', beginnerLevel: 'beginner' },
    );
    expect(out.length).toBeLessThanOrEqual(3);
  });
});

// ─── 4. Multi-cycle prioritization ──────────────────────
describe('getPriorityAcrossCropCycles', () => {
  const now = new Date();
  const cycles = [
    { id: 'c1', cropType: 'tomato', lifecycleStatus: 'growing',
      plantingDate: new Date(Date.now() - 30 * MS_DAY), updatedAt: now },
    { id: 'c2', cropType: 'pepper', lifecycleStatus: 'harvest_ready',
      plantingDate: new Date(Date.now() - 60 * MS_DAY), updatedAt: now },
  ];
  const tasksByCycleId = {
    c1: [{ status: 'pending', dueDate: new Date(Date.now() - 2 * MS_DAY) }],
    c2: [{ status: 'pending', dueDate: new Date(Date.now() - 1 * MS_DAY) }],
  };

  it('harvest_ready cycle outranks growing cycle', () => {
    const out = getPriorityAcrossCropCycles({ cycles, tasksByCycleId, now });
    expect(out.primaryCycleId).toBe('c2');
  });

  it('ranks cycles by score then freshness', () => {
    const ranked = rankCropCyclesForToday(cycles, { tasksByCycleId, now });
    expect(ranked[0].cycle.id).toBe('c2');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('buildUnifiedTodayPayload decorates primary with cycleContext', () => {
    const todayByCycleId = {
      c1: { primaryTask: { title: 'Water tomatoes', priority: 'high' }, secondaryTasks: [] },
      c2: { primaryTask: { title: 'Pick peppers',   priority: 'high' }, secondaryTasks: [] },
    };
    const out = buildUnifiedTodayPayload({ cycles, todayByCycleId, tasksByCycleId, now });
    expect(out.primaryTask.title).toBe('Pick peppers');
    expect(out.primaryTask.cycleContext.cycleId).toBe('c2');
    expect(out.primaryTask.cycleContext.cropKey).toBe('pepper');
  });

  it('buildUnifiedTodayPayload pulls a secondary from another cycle when the top has none', () => {
    const todayByCycleId = {
      c1: { primaryTask: { title: 'Water' },   secondaryTasks: [] },
      c2: { primaryTask: { title: 'Harvest' }, secondaryTasks: [] },
    };
    const out = buildUnifiedTodayPayload({ cycles, todayByCycleId, tasksByCycleId, now });
    expect(out.secondaryTasks.length).toBe(1);
    expect(out.secondaryTasks[0].cycleContext.cycleId).toBe('c1');
  });
});

// ─── 5. Failure recovery ────────────────────────────────
describe('getFailureRecoveryOptions', () => {
  it('returns null for successful outcomes', () => {
    const out = getFailureRecoveryOptions({
      outcome: { outcomeClass: 'successful' },
      cycle: {},
    });
    expect(out).toBeNull();
  });

  it('emits causes + retry plan + switch advice for a failed outcome', () => {
    const out = getFailureRecoveryOptions({
      outcome: {
        outcomeClass: 'failed', issues: ['drought', 'missed_tasks'],
        skippedTasksCount: 5,
      },
      cycle: { cropType: 'tomato' },
      actions: [],
      pastOutcomes: [],
    });
    expect(out.causes.length).toBeGreaterThan(0);
    expect(out.retry.tweaks.length).toBeGreaterThan(0);
    expect(out.switchSuggested).toBe(true);
    expect(out.adviceKey).toBe('failure.advice.tryDifferentCrop');
  });

  it('suggests retry-with-tweaks for a single high_risk outcome with no repeated failures', () => {
    const out = getFailureRecoveryOptions({
      outcome: { outcomeClass: 'high_risk', issues: ['pest'] },
      cycle: { cropType: 'tomato' },
      pastOutcomes: [],
    });
    expect(out.adviceKey).toBe('failure.advice.retryWithTweaks');
  });

  it('flips to switch when the same crop + region has failed twice before', () => {
    const out = getFailureRecoveryOptions({
      outcome: { outcomeClass: 'high_risk', issues: [] },
      cycle: { cropType: 'tomato' },
      region: { stateCode: 'MD' },
      pastOutcomes: [
        { cropKey: 'tomato', stateCode: 'MD', outcomeClass: 'failed' },
        { cropKey: 'tomato', stateCode: 'MD', outcomeClass: 'high_risk' },
      ],
    });
    expect(out.switchSuggested).toBe(true);
  });

  it('getFailureSummary caps causes at 3 and severity follows count', () => {
    const out = getFailureSummary(
      { outcomeClass: 'failed',
        issues: ['pest', 'drought', 'excess_rain', 'poor_growth'],
        skippedTasksCount: 5 },
      [],
    );
    expect(out.causes.length).toBeLessThanOrEqual(3);
    expect(out.severityKey).toBe('failure.severity.major');
  });

  it('getImprovedRetryPlan maps issue tags to tweak keys', () => {
    const r = getImprovedRetryPlan({ issues: ['drought', 'pest'] }, {});
    expect(r.tweaks).toContain('failure.retry.improvedWatering');
    expect(r.tweaks).toContain('failure.retry.earlierPestChecks');
  });
});

// ─── 6. Listing validation ──────────────────────────────
describe('validateListingForActivation', () => {
  const baseData = { cropKey: 'tomato', quantity: 10, quality: 'high', country: 'US' };

  it('accepts a well-formed listing with cycle id', async () => {
    const prisma = { cropListing: { findFirst: async () => null } };
    const out = await validateListingForActivation(prisma, {
      user: { id: 'u1' }, data: { ...baseData, cropCycleId: 'c1' },
    });
    expect(out.valid).toBe(true);
  });

  it('rejects quantity <= 0', async () => {
    const out = await validateListingForActivation(
      { cropListing: { findFirst: async () => null } },
      { user: { id: 'u1' }, data: { ...baseData, quantity: 0, cropCycleId: 'c1' } },
    );
    expect(out.errors.quantity).toBe('invalid_quantity');
  });

  it('rejects missing cropCycleId (supply credibility)', async () => {
    const out = await validateListingForActivation(
      { cropListing: { findFirst: async () => null } },
      { user: { id: 'u1' }, data: baseData },
    );
    expect(out.errors.cropCycleId).toBe('harvest_context_required');
  });

  it('allows manual override for admin tooling', async () => {
    const out = await validateListingForActivation(
      { cropListing: { findFirst: async () => null } },
      { user: { id: 'u1' }, data: baseData, allowManualWithoutHarvest: true },
    );
    expect(out.valid).toBe(true);
  });

  it('rejects duplicate active listing for same cycle', async () => {
    const prisma = {
      cropListing: { findFirst: async () => ({ id: 'L-existing', status: 'active' }) },
    };
    const out = await validateListingForActivation(prisma, {
      user: { id: 'u1' }, data: { ...baseData, cropCycleId: 'c1' },
    });
    expect(out.valid).toBe(false);
    expect(out.errors.duplicate).toBe('duplicate_active_listing');
  });

  it('rejects invalid enums', async () => {
    const out = await validateListingForActivation(
      { cropListing: { findFirst: async () => null } },
      { user: { id: 'u1' },
        data: { ...baseData, cropCycleId: 'c1', quality: 'gold', deliveryMode: 'teleport' } },
    );
    expect(out.errors.quality).toBe('invalid_enum');
    expect(out.errors.deliveryMode).toBe('invalid_enum');
  });
});

// ─── 7. Listing freshness + expiry ──────────────────────
describe('listingFreshnessService', () => {
  const now = new Date('2026-05-01T00:00:00Z');

  it('labels by age bucket', () => {
    const base = new Date('2026-04-30T00:00:00Z').getTime();
    expect(getListingFreshnessLabel({ createdAt: new Date(base - 1 * MS_DAY) }, now).key).toBe('market.freshness.fresh');
    expect(getListingFreshnessLabel({ createdAt: new Date(base - 8 * MS_DAY) }, now).key).toBe('market.freshness.older');
    expect(getListingFreshnessLabel({ createdAt: new Date(base - 25 * MS_DAY) }, now).key).toBe('market.freshness.stale');
    expect(getListingFreshnessLabel({ createdAt: new Date(base - 40 * MS_DAY) }, now).key).toBe('market.freshness.expired');
  });

  it('handles missing createdAt gracefully', () => {
    const out = getListingFreshnessLabel({}, now);
    expect(out.key).toBe('market.freshness.unknown');
    expect(out.ageDays).toBeNull();
  });

  it('FRESH_DAYS < OLDER_DAYS < STALE_DAYS', () => {
    expect(FRESH_DAYS).toBeLessThan(OLDER_DAYS);
    expect(OLDER_DAYS).toBeLessThan(STALE_DAYS);
  });

  it('expireStaleListings closes listings older than STALE_DAYS', async () => {
    let capturedWhere = null;
    const prisma = {
      cropListing: {
        updateMany: async ({ where, data }) => {
          capturedWhere = where;
          expect(data.status).toBe('closed');
          return { count: 3 };
        },
      },
    };
    const out = await expireStaleListings(prisma, { now });
    expect(out.expired).toBe(3);
    expect(capturedWhere.status).toBe('active');
    expect(capturedWhere.createdAt.lt).toBeInstanceOf(Date);
  });

  it('expireStaleListings swallows table-not-migrated errors', async () => {
    const prisma = {
      cropListing: { updateMany: async () => { throw new Error('no table'); } },
    };
    const out = await expireStaleListings(prisma, { now });
    expect(out.expired).toBe(0);
  });
});

// ─── 8. Post-onboarding routing ─────────────────────────
describe('getFirstValueScreen', () => {
  it('routes to /today when there is already an active cycle', () => {
    const r = getFirstValueScreen({ activeCycle: { id: 'c1' } });
    expect(r.path).toBe('/today');
  });

  it('routes to /crop-plan when a crop was picked in onboarding', () => {
    const r = getFirstValueScreen({ pickedCrop: { crop: 'tomato' } });
    expect(r.path).toBe('/crop-plan');
    expect(r.state.crop.crop).toBe('tomato');
  });

  it('falls back to /today with showRecommendations flag', () => {
    const r = getFirstValueScreen({});
    expect(r.path).toBe('/today');
    expect(r.state.showRecommendations).toBe(true);
  });

  it('buildPostOnboardingRoute accepts the full onboarding form', () => {
    const r = buildPostOnboardingRoute({
      pickedCrop: { crop: 'tomato' },
      mode: 'backyard',
    });
    expect(r.path).toBe('/crop-plan');
  });
});

// ─── 9. i18n ────────────────────────────────────────────
const NON_EN_LOCALES = ['hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];
const NEW_KEYS = [
  'today.why.keepGoing', 'today.why.slipping', 'today.why.wateringGap',
  'today.why.wateringGapWithHeat', 'today.why.pestPressure', 'today.why.catchUp',
  'catchUp.banner.missedDays',
  'catchUp.primary.water', 'catchUp.primary.harvest', 'catchUp.primary.inspect',
  'catchUp.detail.water', 'catchUp.detail.harvest', 'catchUp.detail.inspect',
  'catchUp.secondary.inspect',
  'failure.cause.drought', 'failure.cause.excessRain', 'failure.cause.pest',
  'failure.cause.poorGrowth', 'failure.cause.missedTasks',
  'failure.cause.weatherDelays', 'failure.cause.multipleIssues',
  'failure.severity.minor', 'failure.severity.moderate', 'failure.severity.major',
  'failure.retry.improvedWatering', 'failure.retry.plantEarlier',
  'failure.retry.earlierPestChecks', 'failure.retry.fewerTasks',
  'failure.retry.earlyStart',
  'failure.advice.tryDifferentCrop', 'failure.advice.retryWithTweaks',
  'market.freshness.fresh', 'market.freshness.older',
  'market.freshness.stale', 'market.freshness.expired', 'market.freshness.unknown',
];

describe('production-readiness i18n', () => {
  it.each(NEW_KEYS)('%s resolves in English', (k) => {
    expect(t(k, 'en')).toBeTruthy();
  });
  it.each(
    NON_EN_LOCALES.flatMap((lang) => NEW_KEYS.map((k) => [lang, k])),
  )('[%s] %s is localized', (lang, key) => {
    const en = t(key, 'en');
    const localized = t(key, lang);
    expect(localized).toBeTruthy();
    expect(localized).not.toBe(en);
  });
});
