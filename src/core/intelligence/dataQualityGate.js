/**
 * dataQualityGate.js — Invisible Intelligence Phase 2 §8.
 *
 *   import { assessDataQuality, isReadyFor }
 *     from 'src/core/intelligence/dataQualityGate.js';
 *
 *   const quality = assessDataQuality({
 *     activeFarm, scanHistory, taskHistory, weather, outcomeHistory,
 *   });
 *
 *   if (isReadyFor('predictive_yield', quality)) {
 *     // run the advanced engine
 *   } else {
 *     // surface the safe fallback
 *   }
 *
 * What this is
 * ────────────
 *   A pure quality probe used by every advanced engine BEFORE it
 *   runs. Returns a structured `{ score, missing, ready }` envelope.
 *   Each Phase-2 engine consults a feature-specific readiness check
 *   so missing data degrades the engine to a calm fallback instead
 *   of producing low-quality output.
 *
 *   Checks (each independent, all defensive):
 *     • valid crop                 — activeFarm.cropId / .crop
 *     • valid region               — activeFarm.region / .country
 *     • valid weather              — temp + humidity OR rainProbability
 *     • enough scan history        — ≥ 3 rows
 *     • enough task history        — ≥ 5 rows
 *     • reliable image quality     — most recent scan has imageQualityScore ≥ 0.5
 *     • sufficient outcome data    — ≥ 2 outcome confirmations
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every field defaults to "missing" — never claims data it
 *     hasn't seen.
 */

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const CHECKS = Object.freeze([
  'validCrop', 'validRegion', 'validWeather',
  'enoughScans', 'enoughTasks', 'imageQuality', 'outcomeData',
]);

// Per-feature readiness — each key is the set of checks the engine
// REQUIRES before running. Missing checks → not ready → fallback.
const FEATURE_REQUIREMENTS = Object.freeze({
  ml_ranking:               ['validCrop', 'validRegion'],
  disease_calibration:      ['validCrop', 'imageQuality'],
  predictive_yield:         ['validCrop', 'validRegion', 'enoughScans',
                             'enoughTasks', 'outcomeData'],
  satellite_enrichment:     ['validCrop', 'validRegion'],
  ngo_intelligence:         ['validCrop', 'validRegion', 'outcomeData'],
});

function _hasValidCrop(input) {
  const farm = input.activeFarm || {};
  return !!(_str(farm.cropId || farm.crop));
}

function _hasValidRegion(input) {
  const farm = input.activeFarm || {};
  return !!(_str(farm.region) || _str(farm.country));
}

function _hasValidWeather(input) {
  const w = input.weather || {};
  if (_num(w.temp) != null && _num(w.humidityPct) != null) return true;
  if (_num(w.rainProbability24hPct) != null) return true;
  return false;
}

function _hasEnoughScans(input) {
  return Array.isArray(input.scanHistory) && input.scanHistory.length >= 3;
}

function _hasEnoughTasks(input) {
  return Array.isArray(input.taskHistory) && input.taskHistory.length >= 5;
}

function _hasReliableImageQuality(input) {
  const scans = Array.isArray(input.scanHistory) ? input.scanHistory : [];
  if (scans.length === 0) return false;
  const latest = scans[0];
  const score = _num(latest && latest.imageQualityScore);
  if (score == null) return false;
  return score >= 0.5;
}

function _hasOutcomeData(input) {
  return Array.isArray(input.outcomeHistory) && input.outcomeHistory.length >= 2;
}

const _CHECKERS = Object.freeze({
  validCrop:    _hasValidCrop,
  validRegion:  _hasValidRegion,
  validWeather: _hasValidWeather,
  enoughScans:  _hasEnoughScans,
  enoughTasks:  _hasEnoughTasks,
  imageQuality: _hasReliableImageQuality,
  outcomeData:  _hasOutcomeData,
});

/**
 * Assess every check against the supplied input.
 * Returns `{ score (0..1), passed, missing }`.
 */
export function assessDataQuality(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const results = {};
    const passed  = [];
    const missing = [];
    for (const check of CHECKS) {
      const fn = _CHECKERS[check];
      const ok = _safe(() => !!fn(safe), false);
      results[check] = ok;
      if (ok) passed.push(check); else missing.push(check);
    }
    const score = CHECKS.length > 0 ? passed.length / CHECKS.length : 0;
    return Object.freeze({
      checks:  Object.freeze(results),
      passed:  Object.freeze(passed),
      missing: Object.freeze(missing),
      score,
      generatedAt: Date.now(),
    });
  }, Object.freeze({
    checks: Object.freeze({}),
    passed: Object.freeze([]),
    missing: Object.freeze(CHECKS.slice()),
    score: 0,
    generatedAt: Date.now(),
  }));
}

/**
 * Feature-specific readiness — returns true when every required
 * check for that feature passed.
 */
export function isReadyFor(feature, quality) {
  return _safe(() => {
    const reqs = FEATURE_REQUIREMENTS[feature];
    if (!Array.isArray(reqs)) return false;
    const q = _isObj(quality) ? quality : assessDataQuality({});
    return reqs.every((r) => q.checks && q.checks[r] === true);
  }, false);
}

/** Surface-level "should we run this engine?" helper. */
export function gateEngine(feature, input) {
  const quality = assessDataQuality(input);
  return Object.freeze({
    feature,
    ready:   isReadyFor(feature, quality),
    quality,
  });
}

export const _internal = Object.freeze({
  CHECKS, FEATURE_REQUIREMENTS, _CHECKERS,
});

const _module = {
  assessDataQuality, isReadyFor, gateEngine,
  CHECKS, FEATURE_REQUIREMENTS, _internal,
};
export default _module;
