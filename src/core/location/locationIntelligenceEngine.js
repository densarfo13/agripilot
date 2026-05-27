/**
 * locationIntelligenceEngine.js — permanently separate deviceLocation
 * (where the user is now) from farmLocation (saved farm location),
 * silently auto-detect on permission grant, and detect "farmer is
 * away from the farm" so guidance stays tied to the FARM.
 *
 *   import {
 *     probePermission, fetchDeviceLocation, computeLocationIntelligence,
 *     installLocationDiagnostics, LOCATION_SOURCE,
 *   } from 'src/core/location/locationIntelligenceEngine.js';
 *
 *   const perm = await probePermission();   // silent — never prompts
 *   const dev  = perm.canAutoFetch ? await fetchDeviceLocation() : null;
 *   const v    = computeLocationIntelligence({ deviceLocation: dev, farmLocation });
 *
 *   v = {
 *     deviceLocation,            — { lat, lng, at } | null
 *     farmLocation,              — { lat, lng, label } | null
 *     distanceFromFarm,          — number (miles) | null
 *     isAwayFromFarm,            — boolean
 *     weatherLocationSource,     — 'farm' | 'device' | 'none'
 *     locationConfidence,        — 'high' | 'medium' | 'low'
 *     awayMessage,               — { key, fallback } | null
 *     permission,                — 'granted' | 'denied' | 'prompt' | 'unknown'
 *     statusChip,                — { key, fallback }   (calm subtitle, not a CTA)
 *     setupPromptVisible,        — boolean (only when truly missing)
 *     engineVersion:'location-intel-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   The single source of truth for location-driven UX. Replaces
 *   the page-level "Use my location" CTA spam with:
 *     • silent permission probe via navigator.permissions
 *     • auto-fetch ONLY when already granted (no surprise prompts)
 *     • subtle status chip vs big CTA
 *     • farmLocation always wins for weather + tasks
 *     • away-from-farm calm signal
 *
 *   Weather + task engines consult `weatherLocationSource` and
 *   pin to farmLocation when available. The device location is
 *   read-only context — never the basis for crop guidance.
 *
 * Strict-rule audit
 *   • Pure runtime where possible. Never throws. SSR-safe.
 *   • Permission probe + geolocation call wrapped in try/catch.
 *   • Cached last-known locations in localStorage so offline boots
 *     still surface "Using farm location".
 *   • No coordinates are exposed beyond 2-decimal rounding in
 *     diagnostics.
 */

const ENGINE_VERSION = 'location-intel-v1';

const STORAGE_DEVICE = 'farroway:location:device:v1';
const STORAGE_FARM   = 'farroway:location:farm:v1';

// 5-mile threshold per spec.
const AWAY_FROM_FARM_MILES = 5;

export const LOCATION_SOURCE = Object.freeze({
  FARM:   'farm',
  DEVICE: 'device',
  NONE:   'none',
});

const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _hasWindow() {
  try { return typeof window !== 'undefined'; } catch { return false; }
}

function _hasNavigator() {
  try { return typeof navigator !== 'undefined'; } catch { return false; }
}

function _hasLocalStorage() {
  try { return _hasWindow() && typeof window.localStorage !== 'undefined'; }
  catch { return false; }
}

// ─── localStorage cache helpers ──────────────────────────────

function _readCachedLocation(key) {
  return _safe(() => {
    if (!_hasLocalStorage()) return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!_isObj(parsed)) return null;
    const lat = _num(parsed.lat);
    const lng = _num(parsed.lng);
    if (lat == null || lng == null) return null;
    return Object.freeze({
      lat, lng,
      at:    _num(parsed.at) || null,
      label: typeof parsed.label === 'string' ? parsed.label : null,
    });
  }, null);
}

function _writeCachedLocation(key, loc) {
  _safe(() => {
    if (!_hasLocalStorage()) return;
    if (loc == null) { window.localStorage.removeItem(key); return; }
    window.localStorage.setItem(key, JSON.stringify({
      lat: loc.lat, lng: loc.lng, at: loc.at, label: loc.label,
    }));
  });
}

export function getCachedDeviceLocation()  { return _readCachedLocation(STORAGE_DEVICE); }
export function getCachedFarmLocation()    { return _readCachedLocation(STORAGE_FARM); }
export function cacheDeviceLocation(loc)   { _writeCachedLocation(STORAGE_DEVICE, loc); }
export function cacheFarmLocation(loc)     { _writeCachedLocation(STORAGE_FARM,   loc); }

// ─── Permission probe ────────────────────────────────────────

/**
 * Silently probe the geolocation permission state via
 * navigator.permissions. NEVER triggers the browser prompt.
 *
 * Returns:
 *   { state: 'granted' | 'denied' | 'prompt' | 'unknown',
 *     canAutoFetch, supported }
 */
export async function probePermission() {
  return _safe(async () => {
    if (!_hasNavigator() || !navigator.permissions
        || typeof navigator.permissions.query !== 'function') {
      return Object.freeze({
        state: 'unknown', canAutoFetch: false, supported: false,
      });
    }
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      const state = (result && typeof result.state === 'string') ? result.state : 'unknown';
      return Object.freeze({
        state,
        canAutoFetch: state === 'granted',
        supported:    true,
      });
    } catch {
      return Object.freeze({
        state: 'unknown', canAutoFetch: false, supported: false,
      });
    }
  }, Object.freeze({
    state: 'unknown', canAutoFetch: false, supported: false,
  }));
}

// ─── Device location fetch (only when permission granted) ────

/**
 * Fetch device location ONLY when the caller has confirmed
 * `probePermission().canAutoFetch === true`. Never prompts.
 *
 * Returns: `{ lat, lng, at } | null`.
 */
export async function fetchDeviceLocation(opts) {
  return _safe(() => new Promise((resolve) => {
    if (!_hasNavigator() || !navigator.geolocation) {
      resolve(null); return;
    }
    const o = _isObj(opts) ? opts : {};
    const timeoutMs = _num(o.timeoutMs) || 8000;
    let done = false;
    const finish = (loc) => { if (!done) { done = true; resolve(loc); } };
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!pos || !pos.coords) { finish(null); return; }
          const lat = _num(pos.coords.latitude);
          const lng = _num(pos.coords.longitude);
          if (lat == null || lng == null) { finish(null); return; }
          const loc = Object.freeze({ lat, lng, at: Date.now() });
          cacheDeviceLocation(loc);
          finish(loc);
        },
        () => finish(null),
        { timeout: timeoutMs, enableHighAccuracy: false, maximumAge: 5 * 60 * 1000 },
      );
    } catch { finish(null); }
    // Defensive — never hang.
    setTimeout(() => finish(null), timeoutMs + 100);
  }), null);
}

// ─── Distance ────────────────────────────────────────────────

/**
 * Haversine distance in miles between two `{lat, lng}` points.
 * Returns null if either is invalid.
 */
export function distanceMilesBetween(a, b) {
  return _safe(() => {
    if (!_isObj(a) || !_isObj(b)) return null;
    const lat1 = _num(a.lat), lng1 = _num(a.lng);
    const lat2 = _num(b.lat), lng2 = _num(b.lng);
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
    const R_MILES = 3958.8;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const s = Math.sin(dLat / 2) ** 2
            + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    return R_MILES * c;
  }, null);
}

// ─── Compose ─────────────────────────────────────────────────

function _statusChipFor(weatherSource, hasFarmLocation, hasDeviceLocation) {
  if (weatherSource === LOCATION_SOURCE.FARM) {
    return Object.freeze({
      key: 'location.chip.usingFarm',
      fallback: 'Using farm location',
    });
  }
  if (weatherSource === LOCATION_SOURCE.DEVICE) {
    return Object.freeze({
      key: 'location.chip.usingDevice',
      fallback: 'Using your current location',
    });
  }
  if (!hasFarmLocation && !hasDeviceLocation) {
    return Object.freeze({
      key: 'location.chip.setFarmLocation',
      fallback: 'Set farm location',
    });
  }
  return Object.freeze({
    key: 'location.chip.unknown',
    fallback: 'Location not set',
  });
}

function _awayMessageFor(isAway, distanceMiles) {
  if (!isAway) return null;
  return Object.freeze({
    key:      'location.away.calm',
    fallback: 'You\'re away from your farm. Guidance is based on your farm location.',
    params:   { distanceMiles: distanceMiles != null ? Math.round(distanceMiles) : null },
  });
}

function _locationConfidence(deviceLoc, farmLoc) {
  if (farmLoc && deviceLoc) return 'high';
  if (farmLoc || deviceLoc) return 'medium';
  return 'low';
}

/**
 * Build the location-intelligence envelope. Always returns
 * frozen; never throws. Pure (no I/O — pass cached/fetched
 * locations in).
 */
export function computeLocationIntelligence(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const deviceLocation = _isObj(safe.deviceLocation) ? safe.deviceLocation : null;
    const farmLocation   = _isObj(safe.farmLocation)   ? safe.farmLocation   : null;
    const permission     = typeof safe.permission === 'string' ? safe.permission : 'unknown';

    const distanceFromFarm = (deviceLocation && farmLocation)
      ? distanceMilesBetween(deviceLocation, farmLocation) : null;
    const isAwayFromFarm = (distanceFromFarm != null)
      && (distanceFromFarm > AWAY_FROM_FARM_MILES);

    const weatherLocationSource = farmLocation
      ? LOCATION_SOURCE.FARM
      : (deviceLocation ? LOCATION_SOURCE.DEVICE : LOCATION_SOURCE.NONE);

    const locationConfidence = _locationConfidence(deviceLocation, farmLocation);

    return Object.freeze({
      engineVersion:         ENGINE_VERSION,
      deviceLocation,
      farmLocation,
      distanceFromFarm,
      isAwayFromFarm,
      weatherLocationSource,
      locationConfidence,
      awayMessage:           _awayMessageFor(isAwayFromFarm, distanceFromFarm),
      permission,
      statusChip:            _statusChipFor(weatherLocationSource,
                              !!farmLocation, !!deviceLocation),
      // Setup prompt only when we truly have NO location AND
      // permission isn't granted (granted but unfetched is treated
      // as "fetching" elsewhere — no need for a CTA).
      setupPromptVisible:    !farmLocation && !deviceLocation
                              && permission !== 'granted',
      generatedAt:           Date.now(),
    });
  }, _emptyEnvelope());
}

function _emptyEnvelope() {
  return Object.freeze({
    engineVersion:         ENGINE_VERSION,
    deviceLocation:        null,
    farmLocation:          null,
    distanceFromFarm:      null,
    isAwayFromFarm:        false,
    weatherLocationSource: LOCATION_SOURCE.NONE,
    locationConfidence:    'low',
    awayMessage:           null,
    permission:            'unknown',
    statusChip: Object.freeze({
      key: 'location.chip.setFarmLocation',
      fallback: 'Set farm location',
    }),
    setupPromptVisible:    true,
    generatedAt:           Date.now(),
  });
}

// ─── Diagnostics ─────────────────────────────────────────────

function _roundedCopy(loc) {
  if (!_isObj(loc)) return null;
  const lat = _num(loc.lat), lng = _num(loc.lng);
  if (lat == null || lng == null) return null;
  return Object.freeze({
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
    at:  _num(loc.at),
  });
}

let _diagnosticsInstalled = false;

/**
 * Pin `window.__locationHealth()`. Idempotent + SSR-safe.
 */
export function installLocationDiagnostics() {
  return _safe(() => {
    if (_diagnosticsInstalled) return true;
    if (!_hasWindow()) return false;
    if (!window.__locationHealth) {
      window.__locationHealth = async function () {
        const perm = await probePermission();
        const dev  = getCachedDeviceLocation();
        const farm = getCachedFarmLocation();
        const v    = computeLocationIntelligence({
          deviceLocation: dev, farmLocation: farm,
          permission: perm.state,
        });
        const snap = {
          permission:            perm.state,
          permissionSupported:   perm.supported,
          deviceLocation:        _roundedCopy(dev),
          farmLocation:          _roundedCopy(farm),
          distanceFromFarm:      v.distanceFromFarm != null
                                  ? Math.round(v.distanceFromFarm * 10) / 10 : null,
          weatherLocationSource: v.weatherLocationSource,
          isAwayFromFarm:        v.isAwayFromFarm,
          generatedAt:           new Date().toISOString(),
        };
        try { console.log('[Farroway · Location Health]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    _diagnosticsInstalled = true;
    return true;
  }, false);
}

/** Test-only reset. */
export function _resetLocationDiagnosticsForTests() {
  _diagnosticsInstalled = false;
}

export const _internal = Object.freeze({
  _statusChipFor, _awayMessageFor, _locationConfidence,
  _roundedCopy, AWAY_FROM_FARM_MILES, STORAGE_DEVICE, STORAGE_FARM,
  ENGINE_VERSION,
});

const _module = {
  LOCATION_SOURCE,
  probePermission, fetchDeviceLocation,
  computeLocationIntelligence, distanceMilesBetween,
  getCachedDeviceLocation, getCachedFarmLocation,
  cacheDeviceLocation, cacheFarmLocation,
  installLocationDiagnostics, _resetLocationDiagnosticsForTests,
  _internal,
};
export default _module;
