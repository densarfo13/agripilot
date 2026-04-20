/**
 * regionResolver.js — resolve the active agronomic region
 * independently of the UI language.
 *
 * Priority chain:
 *   1. manual selection    — confirmed in onboarding or settings
 *   2. saved profile region — what the farmer last confirmed
 *   3. GPS-derived region  — from a prior geolocation attempt
 *   4. default unknown state
 *
 * The output shape is intentionally small so call sites don't couple
 * to the full state catalog:
 *   { country, stateCode, source }
 * where `source` is one of 'manual' | 'profile' | 'gps' | 'unknown'.
 *
 * A farmer can have Hindi UI with Maryland agronomy, or English UI
 * with Ghana region logic — language and region never share storage.
 */

const KEY_MANUAL = 'farroway:region:manual';
const KEY_PROFILE = 'farroway:region:profile';
const KEY_GPS = 'farroway:region:gps';

function readLs(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeLs(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function removeLs(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function parse(raw) {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === 'object' && typeof v.country === 'string') return v;
  } catch { /* ignore */ }
  return null;
}

/** Serialize + persist a region record under the given slot. */
function serialize(record) {
  return JSON.stringify({
    country: record?.country || '',
    stateCode: record?.stateCode || null,
    recordedAt: Date.now(),
  });
}

/**
 * Resolve the active region. `opts.profileRegion` is what the caller
 * read from the authenticated user's profile.
 */
export function resolveRegion(opts = {}) {
  const manual = parse(readLs(KEY_MANUAL));
  if (manual?.country) return { ...manual, source: 'manual' };

  const profile = opts.profileRegion && typeof opts.profileRegion === 'object'
    ? opts.profileRegion
    : parse(readLs(KEY_PROFILE));
  if (profile?.country) return { ...profile, source: 'profile' };

  const gps = parse(readLs(KEY_GPS));
  if (gps?.country) return { ...gps, source: 'gps' };

  return { country: null, stateCode: null, source: 'unknown' };
}

/**
 * Record a confirmed region. `country` is required; `stateCode` is
 * optional (e.g. international farmers who don't use states).
 */
export function confirmRegion({ country, stateCode }) {
  if (!country) return false;
  const record = {
    country: String(country).trim().toUpperCase(),
    stateCode: stateCode ? String(stateCode).trim().toUpperCase() : null,
  };
  writeLs(KEY_MANUAL, serialize(record));
  writeLs(KEY_PROFILE, serialize(record));
  // Explicit confirmation supersedes any stale GPS record.
  removeLs(KEY_GPS);
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent('farroway:regionchange', { detail: record })); }
    catch { /* ignore */ }
  }
  return true;
}

/** Record a GPS-derived region without bumping the manual slot. */
export function recordGpsRegion({ country, stateCode }) {
  if (!country) return false;
  writeLs(KEY_GPS, serialize({
    country: String(country).trim().toUpperCase(),
    stateCode: stateCode ? String(stateCode).trim().toUpperCase() : null,
  }));
  return true;
}

/**
 * @deprecated — superseded by src/lib/location/productionDetectFn.js.
 *
 * Kept exported only so that any legacy import still parses and the
 * app keeps booting. Every live onboarding screen now uses the
 * shared production detector, which provides:
 *   • classified errors (permission_denied / timeout / …)
 *   • provider-chain reverse geocoding (bigdatacloud → Nominatim →
 *     coarse bounding-box)
 *   • 24h coord-keyed cache
 *   • privacy rounding at every persistence boundary
 *
 * Do NOT add new call sites. Prefer:
 *   import { productionDetectFn } from '../lib/location/productionDetectFn.js';
 *
 * If this function is invoked the fallback still works (calls the
 * caller-supplied geocoder if any) but emits a dev-only warning so
 * regressions are visible.
 */
export async function detectRegionViaGps({ geocoder, timeoutMs = 7000 } = {}) {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    // eslint-disable-next-line no-console
    console.warn(
      '[farroway] detectRegionViaGps is deprecated — use productionDetectFn() instead.',
    );
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  try {
    const pos = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      navigator.geolocation.getCurrentPosition(
        (p) => { clearTimeout(t); resolve(p); },
        (err) => { clearTimeout(t); reject(err); },
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 },
      );
    });
    if (!pos?.coords) return null;
    if (typeof geocoder !== 'function') return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const region = await geocoder(pos.coords.latitude, pos.coords.longitude);
    if (region?.country) recordGpsRegion(region);
    return region || null;
  } catch {
    return null;
  }
}

export const _keys = { KEY_MANUAL, KEY_PROFILE, KEY_GPS };
