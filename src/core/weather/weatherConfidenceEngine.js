/**
 * weatherConfidenceEngine.js — classify weather-reading confidence.
 *
 *   import { classifyWeatherConfidence, WEATHER_CONFIDENCE }
 *     from 'src/core/weather/weatherConfidenceEngine.js';
 *
 *   const v = classifyWeatherConfidence({
 *     coordinatesUsed,        — { lat, lng, source }
 *     fetchedAt,              — number | null
 *     fromCache,              — boolean
 *     hasExactFarmCoords,     — boolean
 *     hasRegionOnly,          — boolean
 *     nowMs,                  — number
 *   });
 *
 *   v = {
 *     weatherConfidence,      — WEATHER_CONFIDENCE.*
 *     source,                 — 'exact_farm'|'verified_region'|'cached_weather'|...
 *     staleMinutes,           — minutes since fetch | null
 *     coordinatesUsed,        — passthrough
 *     fallbackUsed,           — true unless EXACT_FARM
 *     engineVersion:'weather-confidence-v1', generatedAt,
 *   }
 *
 * Confidence rules (worst signal wins):
 *   EXACT_FARM         — coords pinned to a verified farm; fresh (<30m)
 *   VERIFIED_REGION    — regional centroid; fresh (<60m)
 *   CACHED_WEATHER     — from offline cache, ≤ 2h old
 *   ESTIMATED_REGION   — coarse region fallback
 *   STALE_FALLBACK     — > 2h old or unknown source
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Time math is relative — no Date.parse on partial strings.
 */

const ENGINE_VERSION = 'weather-confidence-v1';

export const WEATHER_CONFIDENCE = Object.freeze({
  EXACT_FARM:        'exact_farm',
  VERIFIED_REGION:   'verified_region',
  CACHED_WEATHER:    'cached_weather',
  ESTIMATED_REGION:  'estimated_region',
  STALE_FALLBACK:    'stale_fallback',
});

const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _staleMinutes(fetchedAt, nowMs) {
  const fa = _num(fetchedAt);
  const n  = _num(nowMs) || Date.now();
  if (fa == null) return null;
  return Math.max(0, Math.floor((n - fa) / 60000));
}

/**
 * Classify weather confidence. Always returns frozen; never throws.
 */
export function classifyWeatherConfidence(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const stale = _staleMinutes(safe.fetchedAt, safe.nowMs);
    const fromCache = !!safe.fromCache;
    const hasExact  = !!safe.hasExactFarmCoords;
    const hasRegion = !!safe.hasRegionOnly;
    const coordinatesUsed = _isObj(safe.coordinatesUsed) ? safe.coordinatesUsed : null;

    let confidence;
    if (stale != null && stale > 120) {
      confidence = WEATHER_CONFIDENCE.STALE_FALLBACK;
    } else if (fromCache && stale != null && stale <= 120) {
      confidence = WEATHER_CONFIDENCE.CACHED_WEATHER;
    } else if (hasExact && (stale == null || stale <= 30)) {
      confidence = WEATHER_CONFIDENCE.EXACT_FARM;
    } else if (hasRegion && (stale == null || stale <= 60)) {
      confidence = WEATHER_CONFIDENCE.VERIFIED_REGION;
    } else if (hasRegion) {
      confidence = WEATHER_CONFIDENCE.ESTIMATED_REGION;
    } else {
      confidence = WEATHER_CONFIDENCE.STALE_FALLBACK;
    }

    return Object.freeze({
      engineVersion:    ENGINE_VERSION,
      weatherConfidence: confidence,
      source:            confidence,
      staleMinutes:      stale,
      coordinatesUsed,
      fallbackUsed:      confidence !== WEATHER_CONFIDENCE.EXACT_FARM,
      generatedAt:       Date.now(),
    });
  }, _emptyEnvelope());
}

function _emptyEnvelope() {
  return Object.freeze({
    engineVersion:     ENGINE_VERSION,
    weatherConfidence: WEATHER_CONFIDENCE.STALE_FALLBACK,
    source:            WEATHER_CONFIDENCE.STALE_FALLBACK,
    staleMinutes:      null,
    coordinatesUsed:   null,
    fallbackUsed:      true,
    generatedAt:       Date.now(),
  });
}

export const _internal = Object.freeze({
  _staleMinutes, ENGINE_VERSION,
});

const _module = { classifyWeatherConfidence, WEATHER_CONFIDENCE, _internal };
export default _module;
