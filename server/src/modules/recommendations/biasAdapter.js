/**
 * biasAdapter.js — thin adapter that plugs product-intelligence
 * feedback into the existing recommendation pipeline without
 * knowing its internals.
 *
 * Contract: the recommendation engine produces a map of
 *   { [crop]: score }   (scores in [0, 1])
 * We load the accumulated feedback history for the relevant
 * country and apply `biasRecommendationScores`. Result is the
 * same shape, with individual crops nudged by prior outcomes.
 *
 * Usage — drop-in filter at the end of your existing engine:
 *
 *   import { createBiasAdapter } from '../recommendations/biasAdapter.js';
 *   const biasAdapter = createBiasAdapter({ store });
 *
 *   // Inside your recommendation engine, after computing baseScores:
 *   const finalScores = await biasAdapter.apply(baseScores, { country });
 *
 * `store` must expose `loadFeedbackHistory()` — the same contract
 * the v2 analytics routes use. A lightweight in-process cache
 * keeps repeated requests cheap.
 */

import { biasRecommendationScores } from '../../services/recommendations/recommendationFeedbackService.js';

const DEFAULT_TTL_MS = 60 * 1000; // 1-min cache — feedback is append-only

export function createBiasAdapter({
  store,
  influence = 0.3,
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  if (!store || typeof store.loadFeedbackHistory !== 'function') {
    throw new Error('createBiasAdapter: store.loadFeedbackHistory is required');
  }
  let cache = null;
  let cachedAt = 0;

  async function getHistory(force = false) {
    const now = Date.now();
    if (!force && cache && now - cachedAt < ttlMs) return cache;
    cache    = (await store.loadFeedbackHistory()) || {};
    cachedAt = now;
    return cache;
  }

  async function apply(baseScores, { country, influence: localInfluence } = {}) {
    if (!baseScores || typeof baseScores !== 'object') return {};
    const history = await getHistory();
    return biasRecommendationScores(baseScores, history, {
      country: country ?? null,
      influence: Number.isFinite(localInfluence) ? localInfluence : influence,
    });
  }

  function invalidate() { cache = null; cachedAt = 0; }

  return { apply, invalidate, _getCache: () => cache };
}

/**
 * wrapRecommendationEngine — decorate an existing recommendation
 * function with bias post-processing. The inner function must
 * return `{ [crop]: score }` or something containing a `scores`
 * field of that shape.
 *
 *   const biasedEngine = wrapRecommendationEngine(
 *     originalEngine, biasAdapter, { country: 'GH' },
 *   );
 */
export function wrapRecommendationEngine(engineFn, biasAdapter, defaults = {}) {
  if (typeof engineFn !== 'function') throw new Error('engineFn required');
  if (!biasAdapter || typeof biasAdapter.apply !== 'function') {
    throw new Error('biasAdapter.apply required');
  }
  return async function biasedEngine(ctx = {}) {
    const out = await engineFn(ctx);
    const country = ctx.country ?? defaults.country ?? null;
    if (!out) return out;
    if (isPlainScoreMap(out)) {
      return biasAdapter.apply(out, { country });
    }
    if (out.scores && typeof out.scores === 'object') {
      return { ...out, scores: await biasAdapter.apply(out.scores, { country }) };
    }
    return out;
  };
}

function isPlainScoreMap(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const v of Object.values(obj)) {
    if (typeof v !== 'number') return false;
  }
  return Object.keys(obj).length > 0;
}
