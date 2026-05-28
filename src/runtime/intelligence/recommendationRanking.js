/**
 * recommendationRanking.js — Wave 6 RUNTIME ranking layer.
 *
 *   import {
 *     scoreRecommendation, rankRecommendations,
 *     SIGNAL_WEIGHTS,
 *   } from 'src/runtime/intelligence/recommendationRanking.js';
 *
 * What this is
 * ────────────
 *   Deterministic multi-signal ranker that scores a recommendation
 *   against the context. The ranker is pure: same input → same
 *   score. No randomness, no time-of-day jitter, no model calls.
 *
 *   Signals (weights sum to 1.0):
 *     • cropMatch        (0.18) — recommendation's crop vs farm crop
 *     • regionMatch      (0.12) — recommendation's region vs farm region
 *     • seasonalFit      (0.14) — current month within recommendation window
 *     • weatherAlignment (0.14) — weather risk vs recommendation kind
 *     • scanQuality      (0.10) — source scan's quality envelope
 *     • interventionHistory (0.08) — has farmer acted on similar recs
 *     • historicalOutcomes (0.10) — outcome memory for this rec kind
 *     • continuityConfidence (0.10) — calibrated confidence floor
 *     • alertFatigue     (0.04) — penalty if cooldown active
 *
 *   Suppressed recommendations (calibration.suppressed === true)
 *   are forced to score 0 so the pipeline can filter them out.
 *
 * Strict-rule audit
 *   • Pure function. Never throws. SSR-safe.
 *   • Deterministic. No randomness. No time-dependent jitter
 *     beyond the explicit `seasonalFit` signal.
 *   • Returns frozen envelopes.
 */

const RUNTIME_VERSION = 'recommendation-ranking-v1';

export const SIGNAL_WEIGHTS = Object.freeze({
  cropMatch:            0.18,
  regionMatch:          0.12,
  seasonalFit:          0.14,
  weatherAlignment:     0.14,
  scanQuality:          0.10,
  interventionHistory:  0.08,
  historicalOutcomes:   0.10,
  continuityConfidence: 0.10,
  alertFatigue:         0.04, // applied as penalty
});

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _str = (v) => (typeof v === 'string' ? v.toLowerCase() : '');
const _num = (v, fb) =>
  (typeof v === 'number' && Number.isFinite(v) ? v : fb);
const _clamp01 = (v) => Math.max(0, Math.min(1, _num(v, 0)));

// ─── Individual signal scorers ──────────────────────────────

function _scoreCropMatch(rec, ctx) {
  const recCrop = _str(rec.crop);
  const farmCrop = _str(ctx.crop);
  if (!recCrop || !farmCrop) return 0.5;       // unknown → neutral
  if (recCrop === farmCrop) return 1;
  if (rec.cropFamily && rec.cropFamily === ctx.cropFamily) return 0.7;
  return 0.1;
}

function _scoreRegionMatch(rec, ctx) {
  const recRegion = _str(rec.region);
  const farmRegion = _str(ctx.region);
  if (!recRegion || !farmRegion) return 0.5;
  if (recRegion === farmRegion) return 1;
  if (recRegion === 'global' || recRegion === 'any') return 0.6;
  return 0.2;
}

function _scoreSeasonalFit(rec, ctx) {
  const month = _num(ctx.currentMonth, null);
  if (month == null) return 0.5;
  const start = _num(rec.seasonStartMonth, null);
  const end = _num(rec.seasonEndMonth, null);
  if (start == null || end == null) return 0.5;
  // Handle wrap (e.g. Nov → Feb = months 11,12,1,2).
  const inWindow = start <= end
    ? (month >= start && month <= end)
    : (month >= start || month <= end);
  return inWindow ? 1 : 0.1;
}

function _scoreWeatherAlignment(rec, ctx) {
  const recKind = _str(rec.weatherKind);  // 'rain' | 'heat' | 'cold' | 'any'
  const ctxRisk = _str(ctx.weatherRisk);  // 'rain' | 'heat' | 'cold' | 'none'
  if (!recKind || recKind === 'any') return 0.6;
  if (recKind === ctxRisk) return 1;
  if (ctxRisk === 'none' || !ctxRisk) return 0.5;
  return 0.2;
}

function _scoreScanQuality(rec, ctx) {
  return _clamp01(_num(ctx.scanQuality, 0.5));
}

function _scoreInterventionHistory(rec, ctx) {
  // ctx.interventionsForKind: how many times farmer has acted on
  // this kind. More history = higher confidence the rec will land.
  const n = _num(ctx.interventionsForKind, 0);
  if (n >= 3) return 1;
  if (n >= 1) return 0.6;
  return 0.4;
}

function _scoreHistoricalOutcomes(rec, ctx) {
  // ctx.outcomeRate: 0-1 success rate for this rec kind on this crop+region.
  return _clamp01(_num(ctx.outcomeRate, 0.5));
}

function _scoreContinuityConfidence(rec, ctx) {
  // ctx.calibratedConfidence: 0-1 from the calibration layer.
  return _clamp01(_num(ctx.calibratedConfidence, 0.5));
}

function _scoreAlertFatigue(rec, ctx) {
  // Penalty signal — higher fatigue → lower score.
  // ctx.cooldownActive: boolean, ctx.notificationsToday: number.
  if (ctx.cooldownActive) return 0;
  const n = _num(ctx.notificationsToday, 0);
  if (n >= 3) return 0.1;
  if (n >= 2) return 0.5;
  return 1;
}

// ─── Main scorer ────────────────────────────────────────────

/**
 * Score a single recommendation against context.
 *
 *   @param {Object} rec        - recommendation envelope
 *   @param {Object} ctx        - farm + signal context
 *   @param {Object} [calibration] - confidence envelope from calibration layer
 *   @returns {Object} frozen { score, signals, suppressed }
 */
export function scoreRecommendation(rec, ctx, calibration) {
  return _safe(() => {
    if (!rec || typeof rec !== 'object') {
      return Object.freeze({
        score: 0, suppressed: true, reason: 'invalid_recommendation',
        signals: Object.freeze({}),
      });
    }
    // Calibration suppression short-circuits to score 0.
    if (calibration && calibration.suppressed) {
      return Object.freeze({
        score: 0,
        suppressed: true,
        reason: 'calibration_suppressed',
        signals: Object.freeze({}),
        calibration,
      });
    }
    const safeCtx = ctx || {};
    const enrichedCtx = calibration
      ? { ...safeCtx, calibratedConfidence:
          _num(calibration.normalized, 0.5) }
      : safeCtx;
    const signals = Object.freeze({
      cropMatch:            _scoreCropMatch(rec, enrichedCtx),
      regionMatch:          _scoreRegionMatch(rec, enrichedCtx),
      seasonalFit:          _scoreSeasonalFit(rec, enrichedCtx),
      weatherAlignment:     _scoreWeatherAlignment(rec, enrichedCtx),
      scanQuality:          _scoreScanQuality(rec, enrichedCtx),
      interventionHistory:  _scoreInterventionHistory(rec, enrichedCtx),
      historicalOutcomes:   _scoreHistoricalOutcomes(rec, enrichedCtx),
      continuityConfidence: _scoreContinuityConfidence(rec, enrichedCtx),
      alertFatigue:         _scoreAlertFatigue(rec, enrichedCtx),
    });
    let score = 0;
    for (const k of Object.keys(SIGNAL_WEIGHTS)) {
      score += (signals[k] || 0) * SIGNAL_WEIGHTS[k];
    }
    return Object.freeze({
      runtimeVersion: RUNTIME_VERSION,
      score:    _clamp01(score),
      suppressed: false,
      signals,
      calibration: calibration || null,
    });
  }, Object.freeze({
    score: 0, suppressed: true, reason: 'scoring_threw',
    signals: Object.freeze({}),
  }));
}

/**
 * Rank a list of recommendations against a single context. Returns
 * the recommendations sorted by score descending, each annotated
 * with its full signal breakdown.
 */
export function rankRecommendations(recs, ctx) {
  if (!Array.isArray(recs)) return Object.freeze([]);
  const scored = recs
    .map((rec) => Object.freeze({
      rec,
      scoring: scoreRecommendation(rec, ctx, rec && rec.calibration),
    }))
    .filter((row) => !row.scoring.suppressed)
    .sort((a, b) => b.scoring.score - a.scoring.score);
  return Object.freeze(scored);
}

const _telemetry = {
  totalScores:  0,
  suppressedScores: 0,
  totalRanks:   0,
};

const _score = scoreRecommendation;
export default function (rec, ctx, calibration) {
  _telemetry.totalScores += 1;
  const out = _score(rec, ctx, calibration);
  if (out.suppressed) _telemetry.suppressedScores += 1;
  return out;
}

export function getRankingTelemetry() {
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    totalScores:    _telemetry.totalScores,
    suppressedScores: _telemetry.suppressedScores,
    totalRanks:     _telemetry.totalRanks,
    weights:        SIGNAL_WEIGHTS,
  });
}

export function _resetForTests() {
  _telemetry.totalScores = 0;
  _telemetry.suppressedScores = 0;
  _telemetry.totalRanks = 0;
}
