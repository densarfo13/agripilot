/**
 * taskPrioritization.js — score + rank scan-derived tasks so the
 * dashboard can surface the "best action to take now."
 *
 *   const ranked = prioritizeTasks(getActiveScanTasks(), {
 *     weatherRisks: computePredictiveRisks(...),
 *   });
 *   const topAction = ranked[0] || null;
 *
 * Spec §3 inputs
 * ──────────────
 *   • urgency           — task.urgency (high/medium/low)
 *   • weather dependency — when a predictive risk fires for the
 *                          same kind of task (e.g. fungal +
 *                          spraying task), the task gets a boost.
 *   • yield impact       — task.estimatedImpact (free text — we
 *                          parse for "high"/"medium"/"low" or
 *                          numeric percentages).
 *   • cost efficiency    — task.estimatedCost (lower cost ties go
 *                          to the cheaper option).
 *   • confidence         — task.confidence (0-1 numeric).
 *
 * Scoring model
 * ─────────────
 *   Each input contributes 0-100 to a weighted sum. The weights
 *   are tunable + frozen. We expose the per-task breakdown so the
 *   UI can render a "why this is top" line.
 *
 * Strict-rule audit
 *   • Pure function. Never throws on garbage input.
 *   • Stable sort — tasks that tie on score keep their original
 *     order (more recent inputs stay later).
 *   • All inputs optional; missing signals just don't contribute
 *     to the score, they don't disqualify the task.
 */

export const PRIORITY_WEIGHTS = Object.freeze({
  URGENCY:        4,      // dominant signal
  DUE_DATE:       3,      // closer due date wins
  WEATHER_MATCH:  3,      // task aligns with an active risk
  IMPACT:         2,      // estimated yield impact
  CONFIDENCE:     1,      // engine's confidence in the suggestion
  COST_EFFICIENCY: 1,     // tiebreak — cheaper wins ties
});

const _URGENCY_SCORE = Object.freeze({ high: 100, medium: 60, low: 25 });
const _IMPACT_SCORE  = Object.freeze({ high: 100, medium: 60, low: 25 });

// Task actionType → risk kinds it's most aligned with. When any of
// those risks is firing, the task gets the weather-match boost.
const _ACTION_RISK_MAP = Object.freeze({
  spray:      ['fungal', 'pest'],
  treat:      ['fungal', 'pest', 'recent_issue'],
  inspect:    ['fungal', 'pest', 'recent_issue', 'drought', 'heat'],
  water:      ['drought', 'heat'],
  irrigate:   ['drought', 'heat'],
  drain:      ['flood'],
  harvest:    [],
  fertilize:  [],
});

// ─── Helpers ──────────────────────────────────────────────────

function _safeStr(v) {
  return String(v == null ? '' : v).toLowerCase().trim();
}

function _parseImpact(raw) {
  const s = _safeStr(raw);
  if (!s) return 0;
  if (s.includes('high'))                 return _IMPACT_SCORE.high;
  if (s.includes('med') || s.includes('moderate')) return _IMPACT_SCORE.medium;
  if (s.includes('low') || s.includes('minor'))    return _IMPACT_SCORE.low;
  // Numeric percentages like "20%" → scaled to 0..100.
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (m) {
    const pct = parseFloat(m[1]);
    if (Number.isFinite(pct)) return Math.max(0, Math.min(100, pct));
  }
  return 0;
}

function _parseCost(raw) {
  // Lower cost = better. Returns 0..100 where 100 means "very cheap"
  // and 0 means "expensive / unknown".
  const s = _safeStr(raw);
  if (!s) return 50;
  if (s.includes('low')   || s.includes('cheap') || s.includes('$') && !s.includes('$$')) return 80;
  if (s.includes('med')   || s.includes('$$'))   return 50;
  if (s.includes('high')  || s.includes('$$$'))  return 20;
  return 50;
}

function _dueDateScore(dueAt, nowMs) {
  if (!dueAt) return 30;
  const t = Date.parse(String(dueAt));
  if (Number.isNaN(t)) return 30;
  const hoursAway = (t - nowMs) / (60 * 60 * 1000);
  if (hoursAway <= 0)     return 100;   // overdue
  if (hoursAway <= 24)    return 90;    // due today
  if (hoursAway <= 48)    return 70;    // due tomorrow
  if (hoursAway <= 24 * 5) return 45;   // within a work week
  return 20;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * @param {Array<object>} tasks    — scanToTask entries
 * @param {object} [options]
 * @param {Array<object>} [options.weatherRisks] — predictiveRisk output
 * @param {number} [options.nowMs] — injection point for tests
 * @returns {Array<object>}        — original task + { score, why }
 */
export function prioritizeTasks(tasks, options = {}) {
  const list = Array.isArray(tasks) ? tasks : [];
  if (list.length === 0) return [];
  const opts = (options && typeof options === 'object') ? options : {};
  const nowMs = (typeof opts.nowMs === 'number') ? opts.nowMs : Date.now();

  const activeRiskKinds = new Set();
  const risks = Array.isArray(opts.weatherRisks) ? opts.weatherRisks : [];
  for (const r of risks) {
    if (r && r.kind && (r.level === 'medium' || r.level === 'high')) {
      activeRiskKinds.add(String(r.kind));
    }
  }

  const scored = list.map((t, originalIdx) => {
    if (!t || typeof t !== 'object') {
      return { task: t, score: 0, why: [], _originalIdx: originalIdx };
    }
    const why = [];
    let score = 0;

    const urgencyScore = _URGENCY_SCORE[_safeStr(t.urgency)] || 0;
    if (urgencyScore) {
      score += urgencyScore * PRIORITY_WEIGHTS.URGENCY;
      why.push(`urgency:${_safeStr(t.urgency)}`);
    }

    const dueScore = _dueDateScore(t.dueAt, nowMs);
    score += dueScore * PRIORITY_WEIGHTS.DUE_DATE;
    if (dueScore >= 90) why.push('due_today_or_overdue');

    const actionType = _safeStr(t.actionType);
    const aligned = _ACTION_RISK_MAP[actionType] || [];
    const hit = aligned.find((kind) => activeRiskKinds.has(kind));
    if (hit) {
      score += 100 * PRIORITY_WEIGHTS.WEATHER_MATCH;
      why.push(`weather_match:${hit}`);
    }

    const impactScore = _parseImpact(t.estimatedImpact);
    if (impactScore > 0) {
      score += impactScore * PRIORITY_WEIGHTS.IMPACT;
      why.push(`impact:${impactScore}`);
    }

    if (typeof t.confidence === 'number' && Number.isFinite(t.confidence)) {
      const confScore = Math.max(0, Math.min(1, t.confidence)) * 100;
      score += confScore * PRIORITY_WEIGHTS.CONFIDENCE;
      why.push(`confidence:${t.confidence.toFixed(2)}`);
    }

    const costScore = _parseCost(t.estimatedCost);
    score += costScore * PRIORITY_WEIGHTS.COST_EFFICIENCY;

    return { task: t, score: Math.round(score), why, _originalIdx: originalIdx };
  });

  // Sort by score desc; stable on original index (preserves insertion
  // order for ties so the older task wins).
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a._originalIdx - b._originalIdx;
  });

  // Strip the internal index before returning.
  return scored.map(({ _originalIdx, ...rest }) => rest);  // eslint-disable-line no-unused-vars
}

/**
 * The single "best action to take now." Returns null when the queue
 * is empty.
 */
export function topAction(tasks, options) {
  const ranked = prioritizeTasks(tasks, options);
  return ranked.length > 0 ? ranked[0] : null;
}

export default { prioritizeTasks, topAction, PRIORITY_WEIGHTS };
