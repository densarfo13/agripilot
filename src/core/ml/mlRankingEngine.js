/**
 * mlRankingEngine.js — Phase 2 §2.
 *
 *   import { runMlRanking } from 'src/core/ml/mlRankingEngine.js';
 *
 *   const v = runMlRanking({
 *     baseRecommendations, activeFarm, crop, region, lifecycleStage,
 *     weather, scanHistory, taskHistory, outcomeHistory,
 *     recommendationHistory, offlineState,
 *   });
 *
 *   v = {
 *     rankedRecommendations,   — reorder of baseRecommendations
 *     topRecommendation,       — first of ranked OR null
 *     rankingReason,           — { key, fallback, params }
 *     modelUsed,               — 'deterministic_fallback' (today)
 *                              | 'baseline_v1' (future)
 *     confidenceTone,          — 'high_confidence' | 'medium_confidence' | 'needs_review'
 *     fallbackUsed,            — true when ML not ready
 *     engineVersion:'ml-ranking-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   A safe re-RANKER. Never invents a new recommendation, never
 *   overrides an urgent deterministic safety rule. When the flag
 *   ENABLE_ML_RANKING is OFF OR data quality is insufficient, the
 *   engine returns the base recommendations unchanged with
 *   `fallbackUsed: true` and `modelUsed: 'deterministic_fallback'`.
 *
 *   Today the "ML" model is a deterministic baseline (no actual
 *   neural network) so the surface can call this engine TODAY and
 *   get safe behavior; a real model swaps in behind the same
 *   signature later.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is a `{key, fallback, params}` envelope.
 *   • Never claims "AI ranked this". Never exposes raw scores.
 */

import { FLAG, isFeatureFlagOn } from '../deployment/deploymentGovernance.js';
import { gateEngine } from '../intelligence/dataQualityGate.js';

const ENGINE_VERSION = 'ml-ranking-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const _URGENCY_RANK = Object.freeze({ high: 0, medium: 1, low: 2 });

function _confidenceToneFor(topUrgency, fallbackUsed) {
  if (fallbackUsed) return 'medium_confidence';
  if (topUrgency === 'high') return 'high_confidence';
  if (topUrgency === 'medium') return 'medium_confidence';
  return 'medium_confidence';
}

function _baselineRerank(base, input) {
  // Deterministic baseline: keep urgency order, break ties by
  // outcome-history success rate (if the candidate id has appeared
  // in outcomeHistory with mostly-positive outcomes).
  const outcomes = Array.isArray(input.outcomeHistory) ? input.outcomeHistory : [];
  const successCounts = new Map();
  for (const o of outcomes) {
    if (!_isObj(o) || !o.recommendationId) continue;
    const v = successCounts.get(o.recommendationId) || 0;
    if (o.outcome === 'improved' || o.outcome === 'resolved') {
      successCounts.set(o.recommendationId, v + 1);
    } else if (o.outcome === 'worsened') {
      successCounts.set(o.recommendationId, v - 1);
    }
  }
  return base.slice().sort((a, b) => {
    const ua = _URGENCY_RANK[_str(a.urgency).toLowerCase()] ?? 99;
    const ub = _URGENCY_RANK[_str(b.urgency).toLowerCase()] ?? 99;
    if (ua !== ub) return ua - ub;
    const sa = successCounts.get(a.candidateId) || 0;
    const sb = successCounts.get(b.candidateId) || 0;
    return sb - sa;
  });
}

/**
 * Re-rank the supplied base recommendations.
 * Always returns an envelope; never throws.
 */
export function runMlRanking(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const base = Array.isArray(safe.baseRecommendations)
      ? safe.baseRecommendations.filter(_isObj) : [];

    // Flag check — flag OFF = fallback to base.
    const flagOn = isFeatureFlagOn(FLAG.ENABLE_ML_RANKING);
    const gate = gateEngine('ml_ranking', safe);
    const fallbackUsed = !flagOn || !gate.ready;

    let ranked = base;
    let modelUsed = 'deterministic_fallback';
    if (!fallbackUsed && base.length > 0) {
      ranked = _baselineRerank(base, safe);
      modelUsed = 'baseline_v1';
    }

    const top = ranked.length > 0 ? ranked[0] : null;
    const topUrgency = _str(top && top.urgency).toLowerCase();

    return Object.freeze({
      engineVersion:         ENGINE_VERSION,
      rankedRecommendations: Object.freeze(ranked),
      topRecommendation:     top,
      rankingReason: Object.freeze(fallbackUsed
        ? { key: 'ml.ranking.reason.fallback',
            fallback: 'Using calm baseline ordering — advanced ranking is off.' }
        : { key: 'ml.ranking.reason.baseline',
            fallback: 'Ordered by what has worked on this farm before.' }),
      modelUsed,
      confidenceTone:        _confidenceToneFor(topUrgency, fallbackUsed),
      fallbackUsed,
      dataQuality:           gate.quality,
      generatedAt:           Date.now(),
    });
  }, Object.freeze({
    engineVersion: ENGINE_VERSION,
    rankedRecommendations: Object.freeze([]),
    topRecommendation:     null,
    rankingReason: Object.freeze({
      key: 'ml.ranking.reason.fallback',
      fallback: 'Using calm baseline ordering — advanced ranking is off.',
    }),
    modelUsed:        'deterministic_fallback',
    confidenceTone:   'medium_confidence',
    fallbackUsed:     true,
    dataQuality:      null,
    generatedAt:      Date.now(),
  }));
}

export const _internal = Object.freeze({
  _baselineRerank, _confidenceToneFor, _URGENCY_RANK, ENGINE_VERSION,
});

const _module = { runMlRanking, _internal };
export default _module;
