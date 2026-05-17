/**
 * recommendationRankingEngine.js — ranks Home recommendations
 * (Final Readiness §4).
 *
 *   import { rankRecommendations, pickPrimaryRecommendation }
 *     from 'src/core/recommendations/recommendationRankingEngine.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A PURE ranker. The engines that GENERATE recommendations
 *   (primaryActionEngine, dailyPlanEngine, weatherTaskRules, the
 *   scan flow) already exist — this module does not generate
 *   anything. It takes their candidate outputs, applies one fixed
 *   priority order, removes duplicates, and returns a clean list
 *   plus the single primary recommendation Home should show.
 *
 * Priority order (spec §4)
 *   1. urgent scan follow-up
 *   2. weather risk
 *   3. overdue task
 *   4. crop-stage task
 *   5. routine check
 *   6. market / funding opportunity
 *
 * Strict-rule audit
 *   • Pure. Never throws. No I/O.
 */

// Recommendation type → priority rank (lower = more important).
export const RECOMMENDATION_PRIORITY = Object.freeze({
  urgent_scan_followup: 1,
  scan_followup:        1,
  weather_risk:         2,
  weather_alert:        2,
  overdue_task:         3,
  crop_stage_task:      4,
  crop_task:            4,
  routine_check:        5,
  market_opportunity:   6,
  funding_opportunity:  6,
});

const UNRANKED = 99;

function _rankOf(type) {
  const key = String(type || '').toLowerCase();
  return RECOMMENDATION_PRIORITY[key] || UNRANKED;
}

/** Stable dedupe key — same type + same id/title collapses. */
function _dedupeKey(rec) {
  const type = String(rec.type || '').toLowerCase();
  const id = rec.id != null ? String(rec.id) : String(rec.title || rec.label || '');
  return `${type}::${id.toLowerCase()}`;
}

/**
 * Rank a list of candidate recommendations.
 *
 * @param {Array<object>} candidates  each: { type, id?, title?, why?, ... }
 * @returns {Array<object>} sorted, de-duplicated, each tagged with
 *          `priority` (the numeric rank).
 */
export function rankRecommendations(candidates) {
  try {
    const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
    const seen = new Set();
    const deduped = [];
    for (const rec of list) {
      if (!rec || typeof rec !== 'object') continue;
      const key = _dedupeKey(rec);
      if (seen.has(key)) continue;     // suppress duplicates
      seen.add(key);
      deduped.push({ ...rec, priority: _rankOf(rec.type) });
    }
    // Stable sort by priority; preserve input order within a tier.
    return deduped
      .map((rec, i) => ({ rec, i }))
      .sort((a, b) => (a.rec.priority - b.rec.priority) || (a.i - b.i))
      .map(({ rec }) => rec);
  } catch {
    return [];
  }
}

/**
 * The SINGLE recommendation Home should show. Returns null when
 * there are no candidates — Home renders its calm empty state.
 *
 * @param {Array<object>} candidates
 * @returns {object|null}
 */
export function pickPrimaryRecommendation(candidates) {
  const ranked = rankRecommendations(candidates);
  return ranked.length > 0 ? ranked[0] : null;
}

const _module = {
  RECOMMENDATION_PRIORITY,
  rankRecommendations,
  pickPrimaryRecommendation,
};
export default _module;
