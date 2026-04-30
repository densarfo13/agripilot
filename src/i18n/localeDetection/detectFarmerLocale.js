/**
 * detectFarmerLocale.js — assemble the farmer's locale signal
 * from the four-tier chain mandated by the spec:
 *
 *   1. GPS (if permission already granted, or `requestGps:true`)
 *   2. Saved farm profile (country / region from the active farm)
 *   3. Browser / device locale (navigator.language)
 *   4. English as final fallback
 *
 * The chain is non-blocking: GPS failure / denial / timeout falls
 * through to the next tier silently, so onboarding NEVER hangs
 * waiting for a permission prompt.
 *
 * Output shape:
 *   {
 *     country:        'GH'                      // ISO-2, may be null
 *     region:         'Ashanti' | null
 *     suggestedLang:  'en' | 'fr' | 'sw' | ...   // never null
 *     localeSource:   'gps' | 'farm_profile' | 'browser' | 'manual' | 'fallback'
 *     coords:         { lat, lon } | null
 *   }
 *
 * The function is pure-ish — it reads window.navigator + the
 * farm profile getter you pass in, and returns a Promise. No
 * persistence, no setLanguage call. Wire it through
 * `applyFarmLanguage` + `saveLanguagePreference` separately so
 * the detection step stays composable and unit-testable.
 */

import { mapLocationToLanguage, mapBrowserLocaleToLanguage, normaliseCountryCode } from './mapLocationToLanguage.js';

// Reverse-geocoder is optional — we already ship one for the
// "Detect my location" button. We import lazily so detection
// works in environments without the geocoder available.
async function tryReverseGeocode(lat, lon) {
  try {
    const mod = await import('../../lib/location/reverseGeocode.js');
    if (typeof mod.reverseGeocode === 'function') {
      return await mod.reverseGeocode(lat, lon);
    }
  } catch { /* geocoder absent or threw */ }
  return null;
}

function safeNavigatorLanguage() {
  try {
    if (typeof navigator !== 'undefined') {
      return navigator.language
        || (Array.isArray(navigator.languages) && navigator.languages[0])
        || null;
    }
  } catch { /* SSR / locked-down */ }
  return null;
}

/**
 * tryGps — attempt to read a position via navigator.geolocation.
 *
 * @param  {object}  opts
 * @param  {number}  opts.timeoutMs   default 6000
 * @param  {boolean} opts.requestGps  if false, this call only
 *   succeeds when permission was already granted (we don't want
 *   to surprise a farmer with a permission prompt during their
 *   first onboarding tap).
 * @returns Promise<{lat, lon} | null>
 */
async function tryGps({ timeoutMs = 6000, requestGps = false } = {}) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

  // If we're not allowed to request permission, peek at the
  // Permissions API first — only proceed if 'granted'.
  if (!requestGps) {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const res = await navigator.permissions.query({ name: 'geolocation' });
        if (res.state !== 'granted') return null;
      }
    } catch { /* Permissions API unavailable — bail rather than prompt. */
      return null;
    }
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timeout = setTimeout(() => finish(null), timeoutMs);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeout);
          if (!pos || !pos.coords) return finish(null);
          finish({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => { clearTimeout(timeout); finish(null); },
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
      );
    } catch { clearTimeout(timeout); finish(null); }
  });
}

/**
 * detectFarmerLocale — the public entry point.
 *
 * @param  {object} opts
 * @param  {object} opts.farm       optional farm profile object;
 *   shape: { country, countryCode, stateCode, state, region }
 * @param  {boolean} opts.requestGps   default false — only read
 *   GPS when permission already granted; pass true from a
 *   user-initiated "Detect my location" tap.
 * @param  {number}  opts.gpsTimeoutMs default 6000
 *
 * @returns Promise<DetectionResult>
 */
export async function detectFarmerLocale({
  farm = null,
  requestGps = false,
  gpsTimeoutMs = 6000,
} = {}) {
  // ─── 1. GPS ──────────────────────────────────────────────
  const coords = await tryGps({ requestGps, timeoutMs: gpsTimeoutMs });
  if (coords) {
    const geo = await tryReverseGeocode(coords.lat, coords.lon);
    const country = normaliseCountryCode(
      geo?.countryCode || geo?.country || null,
    );
    if (country) {
      const map = mapLocationToLanguage(country);
      return Object.freeze({
        country,
        region: geo?.region || geo?.state || null,
        suggestedLang: map.primary,
        alternatives: map.alternatives,
        localeSource: 'gps',
        coords,
      });
    }
    // GPS gave us coords but the geocoder couldn't resolve a
    // country — fall through to the next tier.
  }

  // ─── 2. Farm profile ─────────────────────────────────────
  if (farm && typeof farm === 'object') {
    const country = normaliseCountryCode(
      farm.country || farm.countryCode || farm.country_code || null,
    );
    if (country) {
      const map = mapLocationToLanguage(country);
      return Object.freeze({
        country,
        region: farm.state || farm.stateCode || farm.region || null,
        suggestedLang: map.primary,
        alternatives: map.alternatives,
        localeSource: 'farm_profile',
        coords: null,
      });
    }
  }

  // ─── 3. Browser locale ───────────────────────────────────
  const browser = safeNavigatorLanguage();
  if (browser) {
    const lang = mapBrowserLocaleToLanguage(browser);
    // Try to extract a region tag from the locale ('en-GH').
    const regionPart = String(browser).split(/[-_]/)[1] || null;
    const country = regionPart ? normaliseCountryCode(regionPart) : null;
    return Object.freeze({
      country,
      region: null,
      suggestedLang: lang || 'en',
      alternatives: country
        ? mapLocationToLanguage(country).alternatives
        : [],
      localeSource: 'browser',
      coords: null,
    });
  }

  // ─── 4. English fallback ─────────────────────────────────
  return Object.freeze({
    country: null,
    region: null,
    suggestedLang: 'en',
    alternatives: [],
    localeSource: 'fallback',
    coords: null,
  });
}
