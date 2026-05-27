/**
 * recommendationTrustEngine.js — usefulness-threshold suppression.
 *
 *   import { applyRecommendationTrust }
 *     from 'src/core/intelligence/recommendationTrustEngine.js';
 *
 *   const v = applyRecommendationTrust({
 *     candidates,          // [{ candidateId, urgency, reason, ... }]
 *     signalQuality,       // scoreSignalQuality output
 *     alertFatigue,        // { ignoredCounts: { [id]: number } }
 *     priorRecommendations,// for continuity-aware filtering
 *     nowMs,
 *   });
 *
 *   v = {
 *     trustedRecommendations,  — surviving candidates (ordered)
 *     suppressedCount,         — total suppressed
 *     suppressed,              — [{ candidateId, reason }]
 *     trustConfidence,         — 'high' | 'medium' | 'low'
 *     reasoningSignals,        — bus-friendly array
 *     engineVersion:'rec-trust-v1', generatedAt,
 *   }
 *
 * Suppression rules (per spec §2):
 *   - weak recommendations         (signalQuality === 'insufficient' AND urgency != 'high')
 *   - repetitive advice            (same id surfaced in the previous 2 ticks)
 *   - contradictory guidance       (watering AND rain-skip in the same tick)
 *   - alert-fatigued candidates    (cooldown gate said no)
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is an envelope.
 */

import { SIGNAL_QUALITY } from './signalQualityEngine.js';
import { gateAlert } from './alertFatigueEngine.js';

const ENGINE_VERSION = 'rec-trust-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _isWatering(id) {
  return _str(id).toLowerCase().startsWith('watering_');
}
function _isRainSkip(id) {
  // Decision engine doesn't emit a rain_skip candidate today, but
  // we treat ANY weather_protect_rain candidate as the rain signal.
  return _str(id) === 'weather_protect_rain';
}

/**
 * Apply trust suppression to a candidate set. Always returns
 * frozen; never throws.
 */
export function applyRecommendationTrust(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const candidates = Array.isArray(safe.candidates)
      ? safe.candidates.filter(_isObj) : [];
    const sq = _isObj(safe.signalQuality) ? safe.signalQuality : null;
    const prior = Array.isArray(safe.priorRecommendations)
      ? safe.priorRecommendations : [];
    const ignoredCounts = (safe.alertFatigue && _isObj(safe.alertFatigue.ignoredCounts))
      ? safe.alertFatigue.ignoredCounts : {};
    const nowMs = _num(safe.nowMs) || Date.now();

    const trustedRecommendations = [];
    const suppressed = [];

    // Detect contradiction set up-front.
    const ids = new Set(candidates.map((c) => _str(c.candidateId)));
    const hasWatering = [...ids].some(_isWatering);
    const hasRainSkip = [...ids].some(_isRainSkip);

    for (const c of candidates) {
      const id = _str(c.candidateId);
      const urgency = _str(c.urgency).toLowerCase() || 'low';
      // 1. WEAK
      if (sq && sq.signalQuality === SIGNAL_QUALITY.INSUFFICIENT && urgency !== 'high') {
        suppressed.push(Object.freeze({ candidateId: id, reason: 'low_signal_quality' }));
        continue;
      }
      // 2. REPETITIVE — appeared in the last 2 ticks
      if (prior.includes(id)) {
        suppressed.push(Object.freeze({ candidateId: id, reason: 'recently_shown' }));
        continue;
      }
      // 3. CONTRADICTION — drop watering when rain-skip also present
      if (_isWatering(id) && hasWatering && hasRainSkip) {
        suppressed.push(Object.freeze({ candidateId: id, reason: 'contradiction_with_rain_skip' }));
        continue;
      }
      // 4. ALERT FATIGUE
      const decision = gateAlert({
        candidateId: id,
        urgency,
        ignoredCount: _num(ignoredCounts[id]) || 0,
        nowMs,
      });
      if (!decision.allowed) {
        suppressed.push(Object.freeze({
          candidateId: id,
          reason:      'alert_fatigue:' + decision.reason,
        }));
        continue;
      }
      trustedRecommendations.push(c);
    }

    // Trust confidence summary.
    let trustConfidence = 'medium';
    if (sq && sq.signalQuality === SIGNAL_QUALITY.HIGH) trustConfidence = 'high';
    else if (sq && sq.signalQuality === SIGNAL_QUALITY.INSUFFICIENT) trustConfidence = 'low';

    return Object.freeze({
      engineVersion:         ENGINE_VERSION,
      trustedRecommendations: Object.freeze(trustedRecommendations),
      suppressedCount:        suppressed.length,
      suppressed:             Object.freeze(suppressed),
      trustConfidence,
      reasoningSignals:       Object.freeze(suppressed.map((s) => Object.freeze({
        kind:  'suppression',
        id:    s.candidateId,
        cause: s.reason,
      }))),
      generatedAt:           Date.now(),
    });
  }, Object.freeze({
    engineVersion:         ENGINE_VERSION,
    trustedRecommendations: Object.freeze([]),
    suppressedCount:        0,
    suppressed:             Object.freeze([]),
    trustConfidence:        'low',
    reasoningSignals:       Object.freeze([]),
    generatedAt:            Date.now(),
  }));
}

export const _internal = Object.freeze({
  _isWatering, _isRainSkip, ENGINE_VERSION,
});

const _module = { applyRecommendationTrust, _internal };
export default _module;
