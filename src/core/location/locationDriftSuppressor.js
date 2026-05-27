/**
 * locationDriftSuppressor.js — prevent GPS jitter from causing
 * weather flicker + noisy task regeneration.
 *
 *   import { suppressLocationDrift, shouldRegenerateForLocation }
 *     from 'src/core/location/locationDriftSuppressor.js';
 *
 *   const v = suppressLocationDrift({
 *     prevLocation, nextLocation, prevAt, nowMs,
 *     minMovementMiles, minDebounceMs,
 *   });
 *
 *   v = {
 *     accepted,                — true if movement passes thresholds
 *     reason,                  — 'first_sample' | 'meaningful_move'
 *                              | 'too_soon' | 'below_threshold' | 'no_change'
 *     deltaMiles,              — number | null
 *     msSinceLast,             — number | null
 *     suppressed,              — !accepted
 *     engineVersion:'drift-suppressor-v1', generatedAt,
 *   }
 *
 *   shouldRegenerateForLocation({prevLocation, nextLocation})
 *     → boolean — caller uses this to decide whether to regen tasks.
 *
 * Defaults:
 *   minMovementMiles = 0.25   (≈400m — below this it's GPS jitter)
 *   minDebounceMs    = 5 * 60 * 1000   (5 minutes between accepted)
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • No timers — caller drives time via `nowMs`.
 */

import { distanceMilesBetween }
  from './locationIntelligenceEngine.js';

const ENGINE_VERSION = 'drift-suppressor-v1';

const DEFAULT_MIN_MOVEMENT_MILES = 0.25;
const DEFAULT_MIN_DEBOUNCE_MS    = 5 * 60 * 1000;

const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

/**
 * Decide if a new sample should be accepted or suppressed.
 * Always returns frozen; never throws.
 */
export function suppressLocationDrift(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const prev = _isObj(safe.prevLocation) ? safe.prevLocation : null;
    const next = _isObj(safe.nextLocation) ? safe.nextLocation : null;
    const minMove = _num(safe.minMovementMiles) != null
      ? safe.minMovementMiles : DEFAULT_MIN_MOVEMENT_MILES;
    const minDebounce = _num(safe.minDebounceMs) != null
      ? safe.minDebounceMs : DEFAULT_MIN_DEBOUNCE_MS;

    if (!next) {
      return _freeze({
        accepted: false, reason: 'no_change', deltaMiles: null,
        msSinceLast: null, suppressed: true,
      });
    }
    if (!prev) {
      return _freeze({
        accepted: true, reason: 'first_sample',
        deltaMiles: null, msSinceLast: null, suppressed: false,
      });
    }

    const delta = distanceMilesBetween(prev, next);
    const now = _num(safe.nowMs) || Date.now();
    const prevAt = _num(safe.prevAt) || _num(prev.at) || null;
    const msSinceLast = prevAt != null ? Math.max(0, now - prevAt) : null;

    if (msSinceLast != null && msSinceLast < minDebounce) {
      return _freeze({
        accepted: false, reason: 'too_soon',
        deltaMiles: delta, msSinceLast, suppressed: true,
      });
    }
    if (delta != null && delta < minMove) {
      return _freeze({
        accepted: false, reason: 'below_threshold',
        deltaMiles: delta, msSinceLast, suppressed: true,
      });
    }
    if (delta == null) {
      return _freeze({
        accepted: false, reason: 'no_change',
        deltaMiles: null, msSinceLast, suppressed: true,
      });
    }
    return _freeze({
      accepted: true, reason: 'meaningful_move',
      deltaMiles: delta, msSinceLast, suppressed: false,
    });
  }, _freeze({
    accepted: false, reason: 'no_change',
    deltaMiles: null, msSinceLast: null, suppressed: true,
  }));
}

function _freeze(o) {
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    ...o,
    generatedAt: Date.now(),
  });
}

/**
 * Convenience predicate — should the caller regenerate tasks /
 * weather based on the new location? Answers TRUE only if the
 * drift suppressor accepts the change.
 */
export function shouldRegenerateForLocation(input) {
  return _safe(() => suppressLocationDrift(input).accepted, false);
}

export const _internal = Object.freeze({
  DEFAULT_MIN_MOVEMENT_MILES, DEFAULT_MIN_DEBOUNCE_MS, ENGINE_VERSION,
});

const _module = {
  suppressLocationDrift, shouldRegenerateForLocation, _internal,
};
export default _module;
