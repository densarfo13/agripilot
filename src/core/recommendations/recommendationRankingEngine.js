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
// Updated for the real-world reliability spec: `watering` is now
// a distinct tier between overdue_task and crop_stage_task.
export const RECOMMENDATION_PRIORITY = Object.freeze({
  urgent_scan_followup: 1,
  scan_followup:        1,
  weather_risk:         2,
  weather_alert:        2,
  overdue_task:         3,
  watering:             4,
  watering_need:        4,
  crop_stage_task:      5,
  crop_task:            5,
  routine_check:        6,
  market_opportunity:   7,
  funding_opportunity:  7,
});

// Short, calm explanation per type — drives the "why this matters"
// line on the Home card. Hedged wording only.
const EXPLANATION = Object.freeze({
  urgent_scan_followup: 'A recent scan needs a follow-up check.',
  scan_followup:        'Check back on the scanned plant.',
  weather_risk:         'Upcoming weather may affect your plants.',
  weather_alert:        'Upcoming weather may affect your plants.',
  overdue_task:         'A task on your list is past its best time.',
  watering:             'Soil and weather suggest watering soon.',
  watering_need:        'Soil and weather suggest watering soon.',
  crop_stage_task:      'Your crop has reached a stage worth acting on.',
  crop_task:            'Your crop has reached a stage worth acting on.',
  routine_check:        'A quick routine check keeps things on track.',
  market_opportunity:   'A relevant marketplace opportunity is available.',
  funding_opportunity:  'A relevant funding opportunity is available.',
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

/** Default "stale" threshold — 12 hours. Adjust per-call via opts. */
const DEFAULT_STALE_MS = 12 * 60 * 60 * 1000;

/** Whether a recommendation is older than `maxAgeMs`. */
export function isStaleRecommendation(rec, maxAgeMs, nowMs) {
  try {
    if (!rec || typeof rec !== 'object') return true;
    const created = (typeof rec.createdAt === 'number')
      ? rec.createdAt
      : Date.parse(String(rec.createdAt || ''));
    if (!Number.isFinite(created)) return false; // no timestamp → assume fresh
    const max = Number.isFinite(maxAgeMs) ? maxAgeMs : DEFAULT_STALE_MS;
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    return (now - created) > max;
  } catch {
    return false;
  }
}

/** Short, calm explanation for a recommendation type. */
export function explainRecommendation(rec) {
  try {
    const type = String((rec && rec.type) || '').toLowerCase();
    return EXPLANATION[type] || 'Worth a quick check.';
  } catch {
    return 'Worth a quick check.';
  }
}

/**
 * Urgency score in [0, 1] — higher = more urgent. Derived from the
 * priority rank: rank 1 → ~1.0, rank 7 → ~0.0. Useful when a UI
 * wants a single number instead of a discrete tier.
 */
export function scoreRecommendation(rec) {
  try {
    const rank = _rankOf((rec && rec.type) || '');
    if (rank >= UNRANKED) return 0;
    return Math.max(0, Math.min(1, (8 - rank) / 7));
  } catch {
    return 0;
  }
}

/**
 * Rank a list of candidate recommendations.
 *
 * @param {Array<object>} candidates  each: { type, id?, title?, why?, createdAt? }
 * @param {object} [opts] { maxAgeMs, nowMs, dropStale=false, withExplanation=false }
 * @returns {Array<object>} sorted, de-duplicated, each tagged with
 *          `priority` (rank), optional `score` + `explanation`.
 */
export function rankRecommendations(candidates, opts) {
  try {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
    const seen = new Set();
    const deduped = [];
    for (const rec of list) {
      if (!rec || typeof rec !== 'object') continue;
      // Stale suppression — opt-in so existing callers don't drop
      // their fresh, no-timestamp recommendations.
      if (o.dropStale && isStaleRecommendation(rec, o.maxAgeMs, o.nowMs)) continue;
      const key = _dedupeKey(rec);
      if (seen.has(key)) continue;     // suppress duplicates
      seen.add(key);
      const enriched = { ...rec, priority: _rankOf(rec.type) };
      if (o.withExplanation) {
        enriched.score = scoreRecommendation(rec);
        enriched.explanation = explainRecommendation(rec);
      }
      deduped.push(enriched);
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
  isStaleRecommendation,
  explainRecommendation,
  scoreRecommendation,
};
export default _module;
