/**
 * scoring — internal-only ranking engine for candidate actions.
 *
 * SPEC §4
 *   Inputs:  weather relevance, crop stage relevance, urgency,
 *            user history, recent scans, soil condition, region
 *            season, effort/time, confidence.
 *   Output:  { score, confidence, priority, explanation }
 *
 *   The numeric score is INTERNAL ONLY. The farmer-facing
 *   adapter strips it before render. Admin/NGO surfaces may
 *   read it for triage.
 *
 * SAFETY
 *   • Pure function — no side effects, never throws.
 *   • Accepts partial signal sets (missing keys = 0 weight).
 *   • Final score clamps to [0, 1].
 */

import { confidenceFromSignals } from './confidence.js';
import { PRIORITY } from './intelligenceTypes.js';

// Default weights tuned so urgent + weather signals dominate
// when present, but a confident user-history signal can still
// promote a routine task. Anything missing contributes 0.
const DEFAULT_WEIGHTS = Object.freeze({
  urgency:           1.4,
  weatherRelevance:  1.2,
  cropStage:         1.0,
  recentScan:        0.9,
  soilCondition:     0.8,
  regionSeason:      0.7,
  userHistory:       0.6,
  effortPenalty:     0.5,   // higher effort REDUCES the score
  confidence:        0.4,
});

function _clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Score a candidate action against a normalized context.
 * `signals` is a flat object of 0..1 numbers — missing keys
 * are treated as 0. `effortPenalty` is INVERTED (high penalty
 * pushes the score down).
 *
 * @param {import('./intelligenceTypes.js').IntelligenceContext} _context
 * @param {object} candidate
 * @param {string} candidate.id
 * @param {object} [candidate.signals]
 * @param {string} [candidate.explanation]
 * @returns {import('./intelligenceTypes.js').Recommendation}
 */
export function scoreRecommendation(_context, candidate = {}) {
  const signals = (candidate && candidate.signals && typeof candidate.signals === 'object')
    ? candidate.signals : {};
  const weights = DEFAULT_WEIGHTS;

  let total = 0;
  let weightSum = 0;
  // Standard accumulators.
  for (const key of ['urgency','weatherRelevance','cropStage','recentScan',
                     'soilCondition','regionSeason','userHistory','confidence']) {
    const s = _clamp01(Number(signals[key]));
    const w = weights[key] || 0;
    total    += s * w;
    weightSum += w;
  }
  // Effort penalty: subtract `effortPenalty * weight` from the
  // numerator so a high-effort task ranks below a low-effort one.
  const effort = _clamp01(Number(signals.effortPenalty));
  total -= effort * (weights.effortPenalty || 0);
  weightSum += weights.effortPenalty || 0;

  const score = weightSum > 0 ? _clamp01(total / weightSum) : 0;

  // Confidence comes from the same signals that fed the score —
  // a candidate with strong urgency + weather + scan signals
  // gets HIGH confidence; sparse signals stay LOW.
  const confidence = confidenceFromSignals([
    signals.urgency,
    signals.weatherRelevance,
    signals.cropStage,
    signals.recentScan,
    signals.confidence,
  ].filter((v) => Number.isFinite(Number(v))));

  // Priority is a render hint for internal surfaces (NGO/Admin
  // queue ordering, server-side notification batching). Mapped
  // straight from the score so the calling layer doesn't need a
  // second translator.
  let priority = PRIORITY.LOW;
  if (score >= 0.85)      priority = PRIORITY.URGENT;
  else if (score >= 0.65) priority = PRIORITY.HIGH;
  else if (score >= 0.40) priority = PRIORITY.MEDIUM;

  return Object.freeze({
    score,
    confidence,
    priority,
    explanation: String(candidate.explanation || '').slice(0, 240),
  });
}

/**
 * Rank a list of candidate actions by score, descending. Stable
 * sort so two equal-score candidates keep their input order
 * (which lets the orchestrator put weather-related candidates
 * first when ties happen).
 *
 * @param {import('./intelligenceTypes.js').IntelligenceContext} context
 * @param {Array<object>} candidates
 * @returns {Array<{ candidate: object, score: number, confidence: string, priority: string, explanation: string }>}
 */
export function rankRecommendations(context, candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const scored = candidates.map((c, i) => {
    const r = scoreRecommendation(context, c);
    return { candidate: c, idx: i, ...r };
  });
  // Stable: sort by (score desc, idx asc).
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx;
  });
  return scored.map(({ idx: _idx, ...rest }) => rest);
}

const _module = { scoreRecommendation, rankRecommendations };
export default _module;
