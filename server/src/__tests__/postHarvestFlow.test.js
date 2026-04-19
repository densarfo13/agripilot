/**
 * postHarvestFlow.test.js — the full post-harvest pipeline:
 *
 *   1. classifyHarvestOutcome   maps quality + progress + issues
 *                               to outcome class
 *   2. buildHarvestSummary      produces wentWell[] + couldImprove[]
 *                               + metrics + headlineKey
 *   3. applyOutcomeToRiskBaseline trims baseline on success, lifts on
 *                                 failure, ceilings at low/high
 *   4. getNextCycleAdjustments   bundles multiplier + baseline + hints
 *   5. getNextCycleRecommendations emits the right option mix per class
 *   6. i18n wire-up: every summary / next-cycle / postHarvest key
 *      this screen references resolves in every supported locale
 *      with no English leak
 */
import { describe, it, expect } from 'vitest';
import {
  classifyHarvestOutcome,
  buildHarvestSummary,
} from '../services/feedback/cycleSummary.js';
import {
  applyOutcomeToRiskBaseline,
  getNextCycleAdjustments,
  getNextCycleRecommendations,
} from '../services/feedback/nextCycleEngine.js';
import { t } from '../../../src/i18n/index.js';

const NON_EN_LOCALES = ['hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];

// ─── classifyHarvestOutcome ───────────────────────────────
describe('classifyHarvestOutcome', () => {
  it('good yield + high completion → successful', () => {
    expect(classifyHarvestOutcome({
      actualYieldKg: 25, qualityBand: 'good',
      completedTasksCount: 8, skippedTasksCount: 0,
    })).toBe('successful');
  });

  it('no yield + many skips → failed', () => {
    expect(classifyHarvestOutcome({
      actualYieldKg: 0, qualityBand: 'poor',
      completedTasksCount: 2, skippedTasksCount: 6,
    })).toBe('failed');
  });

  it('poor quality + multiple issues → high_risk', () => {
    expect(classifyHarvestOutcome({
      actualYieldKg: 5, qualityBand: 'poor', issueCount: 3,
      completedTasksCount: 4, skippedTasksCount: 1,
    })).toBe('high_risk');
  });
});

// ─── buildHarvestSummary ──────────────────────────────────
describe('buildHarvestSummary', () => {
  it('emits wentWell for a strong cycle and a metrics block', () => {
    const out = buildHarvestSummary({
      outcome: {
        cropKey: 'tomato', actualYieldKg: 22, qualityBand: 'good',
        completedTasksCount: 8, skippedTasksCount: 0,
        overdueTasksCount: 0, issueCount: 0,
        completionRate: 1, skipRate: 0, durationDays: 80,
      },
      cycle: { expectedHarvestDate: new Date() },
      actions: [],
    });
    expect(out.outcomeClass).toBe('successful');
    expect(out.headlineKey).toBe('summary.headline.successful');
    expect(out.wentWell.length).toBeGreaterThan(0);
    expect(out.wentWell.every((k) => k.startsWith('summary.wentWell.'))).toBe(true);
    expect(out.metrics.completionRate).toBe(1);
    expect(out.metrics.yieldKg).toBe(22);
  });

  it('emits couldImprove bullets for a weak cycle', () => {
    const out = buildHarvestSummary({
      outcome: {
        cropKey: 'tomato', actualYieldKg: 2, qualityBand: 'poor',
        completedTasksCount: 2, skippedTasksCount: 5,
        issueCount: 3, completionRate: 0.28, skipRate: 0.7,
      },
      cycle: { expectedHarvestDate: new Date(Date.now() - 15 * 86_400_000) },
      actions: [
        { actionType: 'task_skipped', details: { reason: 'heavy rain' } },
      ],
    });
    expect(['high_risk', 'failed']).toContain(out.outcomeClass);
    // Capped at 3 — at least one of the signals we set should land.
    expect(out.couldImprove.length).toBeGreaterThan(0);
    expect(out.couldImprove.length).toBeLessThanOrEqual(3);
    const expectedAny = ['tooManySkips', 'multipleIssues', 'weatherDelays', 'harvestedLate', 'qualityPoor']
      .map((suffix) => `summary.couldImprove.${suffix}`);
    expect(out.couldImprove.some((k) => expectedAny.includes(k))).toBe(true);
  });

  it('falls back to a generic wentWell bullet when nothing else fires', () => {
    const out = buildHarvestSummary({
      outcome: { cropKey: 'tomato', actualYieldKg: 5, qualityBand: 'good', completedTasksCount: 0, skippedTasksCount: 0 },
      cycle: {},
      actions: [],
    });
    if (out.outcomeClass === 'successful') {
      expect(out.wentWell.length).toBeGreaterThan(0);
    }
  });
});

// ─── applyOutcomeToRiskBaseline ───────────────────────────
describe('applyOutcomeToRiskBaseline', () => {
  it('successful outcome trims the baseline', () => {
    expect(applyOutcomeToRiskBaseline({ qualityBand: 'excellent', actualYieldKg: 25 }, 'medium')).toBe('low');
  });

  it('high_risk outcome lifts by 1 band', () => {
    expect(applyOutcomeToRiskBaseline({ qualityBand: 'poor', issueCount: 2, actualYieldKg: 5 }, 'low')).toBe('medium');
  });

  it('failed outcome lifts by 2 bands but caps at high', () => {
    expect(applyOutcomeToRiskBaseline({ actualYieldKg: 0, qualityBand: 'poor', skippedTasksCount: 6 }, 'low')).toBe('high');
    expect(applyOutcomeToRiskBaseline({ actualYieldKg: 0, qualityBand: 'poor', skippedTasksCount: 6 }, 'medium')).toBe('high');
  });
});

// ─── getNextCycleAdjustments ──────────────────────────────
describe('getNextCycleAdjustments', () => {
  it('returns multiplier + baseline + hints for a successful outcome', () => {
    const adj = getNextCycleAdjustments({
      cropKey: 'tomato', qualityBand: 'excellent', actualYieldKg: 22,
      completedTasksCount: 8, skippedTasksCount: 0,
    });
    expect(adj.outcomeClass).toBe('successful');
    expect(adj.confidenceMultiplier).toBeGreaterThan(1);
    expect(adj.riskBaseline).toBe('low');
    expect(adj.recommendationHints).toContain('nextCycle.hint.repeatImproved');
  });

  it('returns a switch-crop hint on failed outcomes', () => {
    const adj = getNextCycleAdjustments({
      cropKey: 'tomato', qualityBand: 'poor', actualYieldKg: 0,
      completedTasksCount: 1, skippedTasksCount: 6,
    });
    expect(adj.outcomeClass).toBe('failed');
    expect(adj.recommendationHints).toContain('nextCycle.hint.switchCrop');
  });
});

// ─── getNextCycleRecommendations ──────────────────────────
describe('getNextCycleRecommendations', () => {
  const baseArgs = {
    outcome: { cropKey: 'tomato', qualityBand: 'good', actualYieldKg: 20, completedTasksCount: 6 },
    cycle: { cropType: 'tomato' },
    region: { country: 'US', state: 'MD' },
    farmType: 'backyard',
    beginnerLevel: 'beginner',
    currentMonth: 4,
  };

  it('always includes an auto_pick option', () => {
    const rec = getNextCycleRecommendations(baseArgs);
    expect(rec.options.some((o) => o.type === 'auto_pick')).toBe(true);
  });

  it('offers repeat_improved for a successful cycle', () => {
    const rec = getNextCycleRecommendations(baseArgs);
    expect(rec.options[0].type).toBe('repeat_improved');
    expect(rec.options[0].cropKey).toBe('tomato');
  });

  it('offers switch_crop as the primary when cycle failed', () => {
    const rec = getNextCycleRecommendations({
      ...baseArgs,
      outcome: { cropKey: 'tomato', qualityBand: 'poor', actualYieldKg: 0, skippedTasksCount: 7 },
    });
    // failed outcome → no repeat, switch is first
    expect(rec.options.some((o) => o.type === 'repeat_improved')).toBe(false);
    expect(rec.options.some((o) => o.type === 'switch_crop')).toBe(true);
  });

  it('caps the option list at 3', () => {
    const rec = getNextCycleRecommendations(baseArgs);
    expect(rec.options.length).toBeLessThanOrEqual(3);
  });

  it('headlineKey matches the outcome class', () => {
    const good = getNextCycleRecommendations(baseArgs);
    expect(good.headlineKey).toBe('nextCycle.headline.successful');
    const bad = getNextCycleRecommendations({
      ...baseArgs,
      outcome: { cropKey: 'tomato', qualityBand: 'poor', actualYieldKg: 0, skippedTasksCount: 7 },
    });
    expect(bad.headlineKey).toBe('nextCycle.headline.failed');
  });
});

// ─── i18n wire-up for every key the new screens reference ──
// ─── Harvest input normalization ──────────────────────────
import { normalizeHarvestInput } from '../services/feedback/harvestOutcome.js';

describe('normalizeHarvestInput', () => {
  it('accepts the new {issues, harvestedAt, yieldUnit} fields', () => {
    const n = normalizeHarvestInput({
      actualYieldKg: 22, yieldUnit: 'kg', qualityBand: 'good',
      issues: ['pest', 'drought', 'bogus'], harvestedAt: '2026-04-10',
      notes: '  heavy rain in week 6  ',
    });
    expect(n.actualYieldKg).toBe(22);
    expect(n.yieldUnit).toBe('kg');
    expect(n.qualityBand).toBe('good');
    expect(n.issues).toEqual(['pest', 'drought']); // bogus dropped
    expect(n.harvestedAt).toBeInstanceOf(Date);
    expect(n.notes.length).toBeGreaterThan(0);
  });

  it('normalizes farmer-facing "average" quality to internal "fair"', () => {
    expect(normalizeHarvestInput({ qualityBand: 'average' }).qualityBand).toBe('fair');
  });

  it('falls back to kg for unknown units', () => {
    expect(normalizeHarvestInput({ yieldUnit: 'martian-sacks' }).yieldUnit).toBe('kg');
  });

  it('silently drops duplicate and invalid issue tags', () => {
    expect(normalizeHarvestInput({ issues: ['pest', 'pest', 'NOPE', 'drought'] }).issues)
      .toEqual(['pest', 'drought']);
  });
});

// ─── Summary surfaces farmer-reported issue tags ──────────
import { buildHarvestSummary as _buildSummary } from '../services/feedback/cycleSummary.js';

describe('buildHarvestSummary — farmer-reported issues drive summary bullets', () => {
  it('surfaces pest + drought tags from the farmer', () => {
    const out = _buildSummary({
      outcome: {
        cropKey: 'tomato', actualYieldKg: 8, qualityBand: 'fair',
        completedTasksCount: 5, skippedTasksCount: 1, issueCount: 0,
        issues: ['pest', 'drought'],
        completionRate: 0.83,
      },
      cycle: {},
      actions: [],
    });
    expect(out.couldImprove).toContain('summary.issueTag.pest');
    expect(out.couldImprove).toContain('summary.issueTag.drought');
  });
});

const POST_HARVEST_KEYS = [
  'postHarvest.title', 'postHarvest.loadError', 'postHarvest.backToToday',
  'postHarvest.startNext',
  'actionHome.harvest.datePrompt', 'actionHome.harvest.unitPrompt',
  'actionHome.harvest.issuesPrompt',
  'harvest.unit.kg', 'harvest.unit.lb', 'harvest.unit.crate', 'harvest.unit.bag',
  'harvest.quality.average',
  'harvest.issue.pest', 'harvest.issue.drought', 'harvest.issue.excess_rain',
  'harvest.issue.missed_tasks', 'harvest.issue.poor_growth', 'harvest.issue.other',
  'summary.issueTag.pest', 'summary.issueTag.drought', 'summary.issueTag.excessRain',
  'summary.issueTag.missedTasks', 'summary.issueTag.poorGrowth', 'summary.issueTag.other',
  'postHarvest.whatWentWell', 'postHarvest.whatCouldImprove',
  'postHarvest.metrics.completion', 'postHarvest.metrics.skipped',
  'postHarvest.metrics.issues', 'postHarvest.metrics.quality',
  'postHarvest.metrics.yield', 'postHarvest.metrics.duration',
  'postHarvest.metrics.timing',
  'summary.headline.successful', 'summary.headline.delayed',
  'summary.headline.highRisk', 'summary.headline.failed',
  'summary.wentWell.completedMostTasks', 'summary.wentWell.noSkips',
  'summary.wentWell.reportedIssuesEarly', 'summary.wentWell.qualityStrong',
  'summary.wentWell.fewIssues', 'summary.wentWell.cycleCompleted',
  'summary.couldImprove.tooManySkips', 'summary.couldImprove.lowCompletion',
  'summary.couldImprove.multipleIssues', 'summary.couldImprove.weatherDelays',
  'summary.couldImprove.harvestedLate', 'summary.couldImprove.harvestedEarly',
  'summary.couldImprove.qualityPoor', 'summary.couldImprove.consider_support',
  'nextCycle.title',
  'nextCycle.headline.successful', 'nextCycle.headline.delayed',
  'nextCycle.headline.highRisk', 'nextCycle.headline.failed',
  'nextCycle.type.repeat_improved', 'nextCycle.type.switch_crop',
  'nextCycle.type.delay_same_crop', 'nextCycle.type.auto_pick',
  'nextCycle.option.repeatImproved', 'nextCycle.option.switchCrop',
  'nextCycle.option.delay', 'nextCycle.option.autoPick',
];

describe('post-harvest i18n: every key resolves in English', () => {
  it.each(POST_HARVEST_KEYS)('%s has a non-empty English string', (key) => {
    expect(t(key, 'en')).toBeTruthy();
  });
});

// Abbreviations that legitimately match English in many languages
// (kg, lb, bushel etc.). Having "kg" show as "kg" in French is
// correct — it's not an English leak.
const SHARED_UNIT_KEYS = new Set([
  'harvest.unit.kg', 'harvest.unit.lb', 'harvest.unit.bushel',
]);

describe('post-harvest i18n: no English leak in non-English locales', () => {
  it.each(
    NON_EN_LOCALES.flatMap((lang) => POST_HARVEST_KEYS.map((key) => [lang, key])),
  )('[%s] %s is localized', (lang, key) => {
    const en = t(key, 'en');
    const localized = t(key, lang);
    expect(localized).toBeTruthy();
    if (SHARED_UNIT_KEYS.has(key)) return; // abbreviation shared with English
    expect(localized).not.toBe(en);
  });
});
