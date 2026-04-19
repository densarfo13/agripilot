/**
 * decisionPipeline.test.js — verifies pipeline execution order
 * and the lock invariant that protects higher-priority stages
 * from being overridden.
 */

import { describe, it, expect } from 'vitest';
import {
  applyDecisionPipeline,
  applyRecommendationDecisionPipeline,
  applyTaskDecisionPipeline,
  applyListingDecisionPipeline,
} from '../services/decision/decisionPipeline.js';
import { PIPELINE_PRIORITY, PIPELINE_STAGE_ORDER } from '../services/decision/pipelinePriority.js';

// ─── Basic ordering ────────────────────────────────────────
describe('applyDecisionPipeline — ordering', () => {
  it('runs stages in ascending priority', () => {
    const log = [];
    const stages = [
      { name: 'wording',    priority: PIPELINE_PRIORITY.WORDING,    run: () => { log.push('wording');    return {}; } },
      { name: 'guardrails', priority: PIPELINE_PRIORITY.HARD_GUARDRAILS, run: () => { log.push('guardrails'); return {}; } },
      { name: 'optimizer',  priority: PIPELINE_PRIORITY.OPTIMIZATION, run: () => { log.push('optimizer'); return {}; } },
      { name: 'base',       priority: PIPELINE_PRIORITY.BASE_LOGIC, run: () => { log.push('base');       return {}; } },
    ];
    applyDecisionPipeline({}, stages);
    expect(log).toEqual(['guardrails', 'base', 'optimizer', 'wording']);
  });

  it('records a trace entry per stage in execution order', () => {
    const stages = [
      { name: 'a', priority: PIPELINE_PRIORITY.BASE_LOGIC, run: () => ({}) },
      { name: 'b', priority: PIPELINE_PRIORITY.HARD_GUARDRAILS, run: () => ({}) },
    ];
    const state = applyDecisionPipeline({}, stages);
    expect(state.trace.map((t) => t.stage)).toEqual(['b', 'a']);
  });

  it('survives a stage that throws — pipeline continues', () => {
    const log = [];
    const stages = [
      { name: 'guardrails', priority: PIPELINE_PRIORITY.HARD_GUARDRAILS,
        run: () => { log.push('guardrails'); return {}; } },
      { name: 'boom', priority: PIPELINE_PRIORITY.BASE_LOGIC,
        run: () => { throw new Error('nope'); } },
      { name: 'wording', priority: PIPELINE_PRIORITY.WORDING,
        run: () => { log.push('wording'); return {}; } },
    ];
    const state = applyDecisionPipeline({}, stages);
    expect(log).toEqual(['guardrails', 'wording']);
    expect(state.trace.find((t) => t.stage === 'boom')?.error).toContain('nope');
  });
});

// ─── Lock invariant ────────────────────────────────────────
describe('applyDecisionPipeline — locks', () => {
  it('first writer wins: a later stage cannot re-lock the same key', () => {
    const stages = [
      {
        name: 'guardrails', priority: PIPELINE_PRIORITY.HARD_GUARDRAILS,
        run: () => ({ locks: { 'crop:mango': { lockedBy: 'guardrails', reason: 'cold_climate' } } }),
      },
      {
        name: 'optimizer', priority: PIPELINE_PRIORITY.OPTIMIZATION,
        run: () => ({ locks: { 'crop:mango': { lockedBy: 'optimizer', reason: 'should_not_override' } } }),
      },
    ];
    const state = applyDecisionPipeline({}, stages);
    expect(state.locks['crop:mango'].lockedBy).toBe('guardrails');
    expect(state.locks['crop:mango'].reason).toBe('cold_climate');
  });
});

// ─── Recommendation pipeline ──────────────────────────────
describe('applyRecommendationDecisionPipeline', () => {
  it('guardrails remove excluded crops and optimizer cannot add them back', async () => {
    const result = await applyRecommendationDecisionPipeline({
      excludedCrops: ['mango'],
      baseEngine: () => ({ maize: 0.8, cassava: 0.6, mango: 0.9 }), // tries to sneak mango in
      optimize:   (scores) => ({ ...scores, mango: 0.95 }),          // AND re-add it
      confidence: { level: 'medium', score: 55 },
    });
    expect(result.value.mango).toBeUndefined();
    expect(result.value.maize).toBeGreaterThan(0);
    expect(result.locks['crop:mango']).toBeDefined();
    expect(result.wordingKeys.header).toBe('recommendations.header.medium');
  });

  it('support_tier=limited caps shortlist to top 3', async () => {
    const result = await applyRecommendationDecisionPipeline({
      supportTier: 'limited',
      baseEngine: () => ({ a: 0.9, b: 0.8, c: 0.7, d: 0.6, e: 0.5 }),
      confidence: { level: 'low' },
    });
    expect(Object.keys(result.value).length).toBeLessThanOrEqual(3);
  });

  it('mode=backyard blocks commodity crops', async () => {
    const result = await applyRecommendationDecisionPipeline({
      mode: 'backyard',
      commodityCrops: ['maize'],
      baseEngine: () => ({ maize: 0.9, tomato: 0.7 }),
      confidence: { level: 'high' },
    });
    expect(result.value.maize).toBeUndefined();
    expect(result.value.tomato).toBeGreaterThan(0);
  });

  it('produces explanation entries for every stage that spoke', async () => {
    const result = await applyRecommendationDecisionPipeline({
      baseEngine: () => ({ maize: 0.7 }),
      confidence: { level: 'high' },
    });
    expect(result.explanation.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── Task pipeline ────────────────────────────────────────
describe('applyTaskDecisionPipeline', () => {
  it('guardrails drop excluded intents', async () => {
    const result = await applyTaskDecisionPipeline({
      tasks: [
        { intent: 'plant',  titleKey: 'task.plant' },
        { intent: 'water',  titleKey: 'task.water' },
      ],
      excludeIntents: ['plant'],
      confidence: { level: 'medium' },
    });
    expect(result.value).toHaveLength(1);
    expect(result.value[0].intent).toBe('water');
  });

  it('backyard mode filters machinery tasks', async () => {
    const result = await applyTaskDecisionPipeline({
      tasks: [
        { intent: 'till',  requiresMachinery: true },
        { intent: 'weed',  requiresMachinery: false },
      ],
      mode: 'backyard',
    });
    expect(result.value.map((t) => t.intent)).toEqual(['weed']);
  });

  it('wording keys reflect confidence tier', async () => {
    const result = await applyTaskDecisionPipeline({
      tasks: [{ intent: 'plant', titleKey: 'task.plant', detailKey: 'task.plant.detail' }],
      confidence: { level: 'low' },
    });
    expect(result.wordingKeys.title).toBe('task.plant.low');
    expect(result.wordingKeys.detail).toBe('task.plant.detail.low');
  });
});

// ─── Listing pipeline ─────────────────────────────────────
describe('applyListingDecisionPipeline', () => {
  it('expired listings are locked and cannot be reopened', () => {
    const result = applyListingDecisionPipeline({
      listing: { state: 'open', expiresAt: Date.now() - 1000 },
      optimize: (l) => ({ ...l, state: 'open' }),
      confidence: { level: 'medium' },
    });
    expect(result.value.state).toBe('expired');
    expect(result.locks['listing:state']).toBeDefined();
  });

  it('attaches a freshness wording key based on confidence', () => {
    const result = applyListingDecisionPipeline({
      listing: { completenessScore: 0.9 },
      confidence: { level: 'high' },
    });
    expect(result.wordingKeys.freshness).toBe('listing.freshness.high');
  });
});

// ─── Priority constant exposure ───────────────────────────
describe('pipeline priority', () => {
  it('stage order is stable', () => {
    expect(PIPELINE_STAGE_ORDER[0]).toBe('guardrails');
    expect(PIPELINE_STAGE_ORDER.at(-1)).toBe('analytics');
  });
  it('guardrails priority is the lowest number', () => {
    const values = Object.values(PIPELINE_PRIORITY);
    expect(Math.min(...values)).toBe(PIPELINE_PRIORITY.HARD_GUARDRAILS);
  });
});
