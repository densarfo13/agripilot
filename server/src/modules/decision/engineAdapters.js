/**
 * engineAdapters.js — drop-in wrappers that let existing
 * recommendation, task, and listing engines call the decision
 * pipeline with one function call instead of assembling the
 * whole stage list themselves.
 *
 * Each adapter is a factory that returns a decorated function.
 * You pass your existing engine in; you get back a function
 * that runs the full pipeline (guardrails → mode restrictions
 * → base → optimization → arbitration → wording → analytics).
 *
 *   const recommend = createRecommendationAdapter({
 *     guardrails:   (ctx) => ['mango'],   // exclusions
 *     commodities:  () => ['maize', 'rice'],
 *     supportTier:  (ctx) => 'full',
 *   });
 *   const result = await recommend(ctx, baseEngineFn);
 *   // result.value   — { crop: score }
 *   // result.wordingKeys — i18n keys
 *   // result.confidence, result.locks, result.trace, result.explanation
 */

import {
  applyRecommendationDecisionPipeline,
  applyTaskDecisionPipeline,
  applyListingDecisionPipeline,
} from '../../services/decision/decisionPipeline.js';

const NOOP_ARR  = () => [];
const NOOP_VAL  = () => null;

/**
 * createRecommendationAdapter — decorate an existing
 * recommendation engine.
 *
 * @param {object} deps
 * @param {(ctx) => string[]}       [deps.guardrails]   — crops to hard-exclude
 * @param {(ctx) => string[]}       [deps.commodities]  — backyard-banned crops
 * @param {(ctx) => 'full'|'partial'|'limited'} [deps.supportTier]
 * @param {(ctx) => Confidence}     [deps.confidence]   — recommendation confidence
 * @param {(scores) => scores}      [deps.optimize]     — optional post-processor
 */
export function createRecommendationAdapter(deps = {}) {
  const {
    guardrails  = NOOP_ARR,
    commodities = NOOP_ARR,
    supportTier = NOOP_VAL,
    confidence  = NOOP_VAL,
    optimize    = null,
  } = deps;

  return async function recommend(ctx = {}, baseEngine) {
    if (typeof baseEngine !== 'function') {
      throw new Error('recommendationAdapter: baseEngine function required');
    }
    return await applyRecommendationDecisionPipeline({
      contextKey:    ctx.contextKey || null,
      country:       ctx.country,
      mode:          ctx.mode,
      supportTier:   supportTier(ctx),
      confidence:    confidence(ctx) || { level: 'medium', score: 50 },
      excludedCrops: guardrails(ctx) || [],
      commodityCrops: commodities(ctx) || [],
      baseEngine:    async () => baseEngine(ctx),
      optimize:      typeof optimize === 'function' ? optimize : undefined,
    });
  };
}

/**
 * createTaskAdapter — decorate an existing Today-task selector.
 */
export function createTaskAdapter(deps = {}) {
  const {
    guardrails  = NOOP_ARR,
    confidence  = NOOP_VAL,
    optimize    = null,
  } = deps;

  return async function selectPrimaryTask(ctx = {}, baseTasks = []) {
    if (!Array.isArray(baseTasks)) throw new Error('taskAdapter: baseTasks must be an array');
    return await applyTaskDecisionPipeline({
      contextKey:      ctx.contextKey || null,
      mode:            ctx.mode,
      tasks:           baseTasks,
      excludeIntents:  guardrails(ctx) || [],
      confidence:      confidence(ctx) || { level: 'medium', score: 50 },
      optimize:        typeof optimize === 'function' ? optimize : undefined,
    });
  };
}

/**
 * createListingAdapter — decorate listing lifecycle logic.
 */
export function createListingAdapter(deps = {}) {
  const {
    confidence = NOOP_VAL,
    optimize   = null,
  } = deps;

  return function resolveListing(ctx = {}, listing = {}) {
    return applyListingDecisionPipeline({
      contextKey: ctx.contextKey || null,
      listing,
      confidence: confidence({ listing, ...ctx }) || { level: 'medium' },
      optimize:   typeof optimize === 'function' ? optimize : undefined,
    });
  };
}
