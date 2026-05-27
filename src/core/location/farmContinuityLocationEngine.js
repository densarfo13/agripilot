/**
 * farmContinuityLocationEngine.js — anchor every intelligence layer
 * to the FARM rather than the active phone session.
 *
 *   import { resolveActiveLocation, LOCATION_PRIORITY }
 *     from 'src/core/location/farmContinuityLocationEngine.js';
 *
 *   const v = resolveActiveLocation({
 *     explicitFarmCoordinates,
 *     lastVerifiedFarmCoordinates,
 *     cachedFarmCoordinates,
 *     deviceLocation,
 *     regionFallback,
 *   });
 *
 *   v = {
 *     activeLocation,          — { lat, lng, label? } | null
 *     locationSource,          — LOCATION_PRIORITY.*
 *     confidence,              — 'high' | 'medium' | 'low'
 *     fallbackUsed,            — true when source rank ≥ 3
 *     isAwayFromFarm,          — boolean
 *     distanceFromFarm,        — miles | null
 *     engineVersion:'farm-continuity-loc-v1', generatedAt,
 *   }
 *
 * Priority cascade (highest → lowest):
 *   1. EXPLICIT_FARM             — coords set by the farmer themselves
 *   2. LAST_VERIFIED_FARM        — recent verified-on-farm coordinate
 *   3. CACHED_FARM               — offline / last-seen farm location
 *   4. DEVICE_LOCATION           — current GPS (only as last resort)
 *   5. REGION_FALLBACK           — region-centroid stub
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Composes — never reads localStorage directly. The caller
 *     pulls cached values from locationIntelligenceEngine.
 *   • Confidence drops when the rank drops past CACHED_FARM.
 */

import { distanceMilesBetween }
  from './locationIntelligenceEngine.js';

const ENGINE_VERSION = 'farm-continuity-loc-v1';
const AWAY_FROM_FARM_MILES = 5;

export const LOCATION_PRIORITY = Object.freeze({
  EXPLICIT_FARM:        'explicit_farm',
  LAST_VERIFIED_FARM:   'last_verified_farm',
  CACHED_FARM:          'cached_farm',
  DEVICE_LOCATION:      'device_location',
  REGION_FALLBACK:      'region_fallback',
  NONE:                 'none',
});

const _RANK = Object.freeze({
  [LOCATION_PRIORITY.EXPLICIT_FARM]:      1,
  [LOCATION_PRIORITY.LAST_VERIFIED_FARM]: 2,
  [LOCATION_PRIORITY.CACHED_FARM]:        3,
  [LOCATION_PRIORITY.DEVICE_LOCATION]:    4,
  [LOCATION_PRIORITY.REGION_FALLBACK]:    5,
  [LOCATION_PRIORITY.NONE]:               99,
});

const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _validLoc(loc) {
  if (!_isObj(loc)) return null;
  const lat = _num(loc.lat), lng = _num(loc.lng);
  if (lat == null || lng == null) return null;
  return Object.freeze({
    lat, lng,
    label: typeof loc.label === 'string' ? loc.label : null,
  });
}

function _confidenceFor(source) {
  switch (source) {
    case LOCATION_PRIORITY.EXPLICIT_FARM:      return 'high';
    case LOCATION_PRIORITY.LAST_VERIFIED_FARM: return 'high';
    case LOCATION_PRIORITY.CACHED_FARM:        return 'medium';
    case LOCATION_PRIORITY.DEVICE_LOCATION:    return 'medium';
    case LOCATION_PRIORITY.REGION_FALLBACK:    return 'low';
    default:                                    return 'low';
  }
}

/**
 * Resolve the active location from the 5-tier priority cascade.
 * Always returns a frozen envelope; never throws.
 */
export function resolveActiveLocation(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    // Build candidate ladder in priority order.
    const ladder = [
      [LOCATION_PRIORITY.EXPLICIT_FARM,      _validLoc(safe.explicitFarmCoordinates)],
      [LOCATION_PRIORITY.LAST_VERIFIED_FARM, _validLoc(safe.lastVerifiedFarmCoordinates)],
      [LOCATION_PRIORITY.CACHED_FARM,        _validLoc(safe.cachedFarmCoordinates)],
      [LOCATION_PRIORITY.DEVICE_LOCATION,    _validLoc(safe.deviceLocation)],
      [LOCATION_PRIORITY.REGION_FALLBACK,    _validLoc(safe.regionFallback)],
    ];

    let activeLocation = null;
    let locationSource = LOCATION_PRIORITY.NONE;
    for (const [source, loc] of ladder) {
      if (loc) { activeLocation = loc; locationSource = source; break; }
    }

    // Also compute distance + away-state when both a farm-anchored
    // location AND a device location are present. The "farm-anchored"
    // location for distance purposes is the first non-device candidate.
    const farmAnchor = _validLoc(safe.explicitFarmCoordinates)
      || _validLoc(safe.lastVerifiedFarmCoordinates)
      || _validLoc(safe.cachedFarmCoordinates);
    const device = _validLoc(safe.deviceLocation);
    const distanceFromFarm = (farmAnchor && device)
      ? distanceMilesBetween(farmAnchor, device) : null;
    const isAwayFromFarm = distanceFromFarm != null
      && distanceFromFarm > AWAY_FROM_FARM_MILES;

    const rank = _RANK[locationSource] || 99;
    const fallbackUsed = rank >= _RANK[LOCATION_PRIORITY.CACHED_FARM] + 1;

    return Object.freeze({
      engineVersion:    ENGINE_VERSION,
      activeLocation,
      locationSource,
      confidence:       _confidenceFor(locationSource),
      fallbackUsed,
      isAwayFromFarm,
      distanceFromFarm,
      generatedAt:      Date.now(),
    });
  }, _emptyEnvelope());
}

function _emptyEnvelope() {
  return Object.freeze({
    engineVersion:    ENGINE_VERSION,
    activeLocation:   null,
    locationSource:   LOCATION_PRIORITY.NONE,
    confidence:       'low',
    fallbackUsed:     true,
    isAwayFromFarm:   false,
    distanceFromFarm: null,
    generatedAt:      Date.now(),
  });
}

export const _internal = Object.freeze({
  _RANK, _validLoc, _confidenceFor, AWAY_FROM_FARM_MILES, ENGINE_VERSION,
});

const _module = { resolveActiveLocation, LOCATION_PRIORITY, _internal };
export default _module;
