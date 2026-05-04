/**
 * locationSafe.js — pilot-safe location helpers (May 2026 spec).
 *
 *   import {
 *     requestUserLocation,
 *     saveLocation,
 *     getSavedLocation,
 *     getLocationFallback,
 *   } from '../lib/locationSafe.js';
 *
 * Contract
 * ────────
 *   • Location is ALWAYS optional. The app never blocks if it
 *     can't be obtained.
 *   • GPS is requested ONLY when the user explicitly taps a
 *     button — `requestUserLocation()` is a one-shot call
 *     designed to be wired to an `onClick` handler. There is
 *     NO ambient GPS request anywhere on the boot path.
 *   • Manual entry is supported via `saveLocation({ region,
 *     country })` — no coordinates required.
 *   • Reads return safe defaults; failures resolve to the
 *     fallback shape `{ hasLocation: false, label: "Location
 *     not set" }`.
 *
 * Storage
 * ───────
 *   localStorage['farroway_location'] = JSON.stringify({
 *     hasLocation: true,
 *     lat: number | null,
 *     lng: number | null,
 *     country: string | null,
 *     region:  string | null,
 *     label:   string,
 *     source:  'gps' | 'manual' | 'farm-record' | 'fallback',
 *     savedAt: ms-epoch,
 *   })
 *
 *   The legacy `farroway_active_farm` row (containing
 *   .locationName / .country / .region) is honoured as a
 *   read-only fallback so existing pilot users don't lose
 *   their location after this lands.
 *
 * Strict-rule audit
 *   • No throws. Every storage / geolocation call is wrapped.
 *   • No side effects on import — every function is pure /
 *     idempotent.
 *   • SSR-safe — every `window` / `localStorage` / `navigator`
 *     access is guarded.
 */

const STORAGE_KEY = 'farroway_location';
const LEGACY_FARM_KEY = 'farroway_active_farm';

// 10 s default — same as the existing useGeoLocation hook so
// pilot UX feels identical across entry points.
const GPS_TIMEOUT_MS = 10_000;

const FALLBACK = Object.freeze({
  hasLocation: false,
  lat:    null,
  lng:    null,
  country: null,
  region:  null,
  label:   'Location not set',
  source:  'fallback',
  savedAt: null,
});

function _safeGetItem(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeSetItem(key, value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch { return false; }
}

function _safeJsonParse(raw) {
  try {
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function _trimOrNull(s) {
  if (typeof s !== 'string') return null;
  const v = s.trim();
  return v.length > 0 ? v : null;
}

function _buildLabel({ country, region }) {
  const r = _trimOrNull(region);
  const c = _trimOrNull(country);
  if (r && c) return r + ', ' + c;
  if (r) return r;
  if (c) return c;
  return 'Your area';
}

/**
 * getLocationFallback() — the shape EVERY caller can fall back
 * to when nothing else resolves. Frozen so callers can't
 * accidentally mutate it.
 */
export function getLocationFallback() {
  return { ...FALLBACK };
}

/**
 * getSavedLocation() — synchronous read of the saved location.
 *
 *   1. `farroway_location` (this module's canonical key)
 *   2. `farroway_active_farm` (legacy farm record — used only
 *      to recover a label, never to claim hasLocation=true
 *      with phantom coordinates)
 *   3. fallback shape
 *
 * Returns the same object shape regardless of which branch fires.
 * Never throws.
 */
export function getSavedLocation() {
  const direct = _safeJsonParse(_safeGetItem(STORAGE_KEY));
  if (direct && typeof direct === 'object'
      && direct.hasLocation === true) {
    const country = _trimOrNull(direct.country);
    const region  = _trimOrNull(direct.region);
    const label = _trimOrNull(direct.label) || _buildLabel({ country, region });
    return {
      hasLocation: true,
      lat:    Number.isFinite(direct.lat) ? direct.lat : null,
      lng:    Number.isFinite(direct.lng) ? direct.lng : null,
      country,
      region,
      label,
      source: typeof direct.source === 'string' ? direct.source : 'manual',
      savedAt: Number.isFinite(direct.savedAt) ? direct.savedAt : null,
    };
  }

  // Legacy fall-through — recover a label from the farm record
  // so the UI shows SOMETHING when the canonical key is empty
  // but the user has previously saved farm context.
  const legacy = _safeJsonParse(_safeGetItem(LEGACY_FARM_KEY));
  if (legacy && typeof legacy === 'object') {
    const country = _trimOrNull(legacy.country) || _trimOrNull(legacy.countryCode);
    const region  = _trimOrNull(legacy.region)  || _trimOrNull(legacy.locationName);
    const label   = _trimOrNull(legacy.locationName)
                 || _buildLabel({ country, region });
    if (country || region) {
      return {
        hasLocation: true,
        lat:    Number.isFinite(legacy.latitude)  ? legacy.latitude  : null,
        lng:    Number.isFinite(legacy.longitude) ? legacy.longitude : null,
        country,
        region,
        label,
        source: 'farm-record',
        savedAt: null,
      };
    }
  }

  return getLocationFallback();
}

/**
 * saveLocation(input) — persist a location row.
 *
 *   saveLocation({ lat, lng })                         // GPS
 *   saveLocation({ country, region })                  // manual
 *   saveLocation({ lat, lng, country, region, label }) // hybrid
 *
 * Returns the persisted row (same shape as getSavedLocation).
 * If localStorage is unavailable / quota-exceeded, returns the
 * row anyway so the caller can still reflect it in component
 * state for the current session.
 */
export function saveLocation(input) {
  const lat     = (input && Number.isFinite(input.lat)) ? input.lat
                : (input && Number.isFinite(input.latitude)) ? input.latitude
                : null;
  const lng     = (input && Number.isFinite(input.lng)) ? input.lng
                : (input && Number.isFinite(input.longitude)) ? input.longitude
                : null;
  const country = _trimOrNull(input && (input.country || input.countryCode));
  const region  = _trimOrNull(input && (input.region || input.locationName));
  const label   = _trimOrNull(input && input.label)
               || _buildLabel({ country, region });
  const sourceHint = typeof input?.source === 'string' ? input.source : null;
  const source = sourceHint
              || (Number.isFinite(lat) && Number.isFinite(lng) ? 'gps' : 'manual');

  const row = {
    hasLocation: !!(country || region || (Number.isFinite(lat) && Number.isFinite(lng))),
    lat,
    lng,
    country,
    region,
    label,
    source,
    savedAt: Date.now(),
  };

  try {
    _safeSetItem(STORAGE_KEY, JSON.stringify(row));
  } catch { /* tolerate */ }

  return row;
}

/**
 * requestUserLocation({ timeoutMs? = 10000 }) — user-triggered
 * GPS request. Returns a Promise that always resolves (never
 * rejects) with EITHER:
 *
 *   { hasLocation: true,  lat, lng, label, source: 'gps', ... }
 *   { hasLocation: false, label: 'Location not set', source: 'fallback', ... }
 *
 * On success the row is persisted via saveLocation(). On any
 * failure (denied permission, timeout, no API support, server-
 * side render) the fallback row is returned and NOTHING is
 * persisted, so a previously-saved manual entry stays put.
 *
 * Wire this directly to a button's onClick. It must NEVER be
 * called from a useEffect on mount — that would fire an ambient
 * GPS prompt the user didn't ask for.
 */
export function requestUserLocation(opts = {}) {
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : GPS_TIMEOUT_MS;
  return new Promise((resolve) => {
    try {
      if (typeof navigator === 'undefined'
          || !navigator.geolocation
          || typeof navigator.geolocation.getCurrentPosition !== 'function') {
        resolve(getLocationFallback());
        return;
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(getLocationFallback());
      }, timeoutMs);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          try {
            const lat = pos && pos.coords && Number(pos.coords.latitude);
            const lng = pos && pos.coords && Number(pos.coords.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              resolve(getLocationFallback());
              return;
            }
            const row = saveLocation({ lat, lng, source: 'gps' });
            resolve(row);
          } catch {
            resolve(getLocationFallback());
          }
        },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          // Permission denied / position unavailable — return
          // the fallback. We deliberately do NOT clear any
          // existing manual entry on a denied prompt.
          resolve(getLocationFallback());
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 0,
        },
      );
    } catch {
      resolve(getLocationFallback());
    }
  });
}

// Test hooks.
export const _internal = Object.freeze({
  STORAGE_KEY,
  LEGACY_FARM_KEY,
  FALLBACK,
  _buildLabel,
});

export default {
  requestUserLocation,
  saveLocation,
  getSavedLocation,
  getLocationFallback,
};
