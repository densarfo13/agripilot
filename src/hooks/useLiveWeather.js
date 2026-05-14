/**
 * useLiveWeather(location?) — live weather hook for the Home screen.
 *
 *   const { weather, loading, error, refetch } = useLiveWeather();
 *   const { weather, loading, error, refetch } = useLiveWeather(resolvedLocation);
 *
 * Location resolution order (first non-null wins):
 *   1. `location` argument passed by the caller  — e.g. from farm profile
 *   2. farroway_location     (localStorage, canonical key)
 *   3. farroway_active_farm  (localStorage, legacy farm record)
 *   4. No location → skip the network call, paint fallback with
 *      locationLabel "Add location for weather tips" so the user
 *      knows how to unlock weather. No API request is ever issued
 *      without at least lat/lng.
 *
 * Fetch contract
 *   • GET /api/weather?lat=&lng=[&region=]
 *   • Hard 6-second AbortController timeout.
 *   • Server always returns HTTP 200 (fallback on provider failure).
 *   • Client-side normalisation guarantees the returned `weather`
 *     object is always fully-populated — callers never need null-
 *     checks on individual fields.
 *
 * Returned shape (always present, never null)
 *   weather: {
 *     temp:          number | null,
 *     condition:     string,           // human-readable headline
 *     rainChance:    number | null,    // 0-100 %
 *     windSpeed:     number | null,    // km/h
 *     locationLabel: string,
 *     weatherType:   'sunny'|'rain'|'cloudy'|'wind'|'heat'|'dry'|'unknown',
 *     source:        'weather-api'|'fallback',
 *   }
 *   loading: boolean
 *   error:   string | null
 *   refetch: () => void
 *
 * Strict-rule audit
 *   • All hooks declared unconditionally — passes rules-of-hooks.
 *   • The `location` argument changes trigger a refetch via the
 *     locationKey memo, not via conditional hook calls.
 *   • Never throws. Every code path resolves to the fallback shape.
 *   • SSR-safe: window/fetch access guarded.
 *   • AbortController cleans up on unmount AND on every re-fetch.
 *   • Never redirects — never calls navigate().
 *
 * Why this is distinct from useWeatherSafe
 *   useWeatherSafe is a low-level single-purpose hook that only
 *   reads from localStorage. useLiveWeather is the Home-screen
 *   hook: it accepts a caller-supplied location (from profile /
 *   farm context), merges it with localStorage fallbacks, and
 *   adds the weatherType field the animated WeatherHeroCard needs.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSavedLocation } from '../lib/locationSafe.js';
import { LIVE_WEATHER_ENABLED } from '../lib/pilotFlags.js';

// ─── Constants ────────────────────────────────────────────────────
const TIMEOUT_MS = 6_000;

/** Canonical fallback — same shape the server returns on failure. */
const FALLBACK_WEATHER = Object.freeze({
  temp:          null,
  tempCurrent:   null,
  tempHigh:      null,
  condition:     'Weather unavailable',
  rainChance:    null,
  windSpeed:     null,
  locationLabel: 'Your area',
  weatherType:   'unknown',
  source:        'fallback',
});

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Derive weatherType from the API response. Backend now returns
 * weatherType directly; this is the client-side fallback for any
 * backend version that doesn't yet include it.
 *
 * @returns {'sunny'|'rain'|'cloudy'|'wind'|'heat'|'dry'|'unknown'}
 */
function _deriveWeatherType(json) {
  // Trust backend's value if it's a known type.
  const knownTypes = new Set(['sunny', 'rain', 'cloudy', 'wind', 'heat', 'dry', 'unknown']);
  if (json && typeof json.weatherType === 'string' && knownTypes.has(json.weatherType)) {
    return json.weatherType;
  }

  // Client-side derivation from numeric signals.
  const rain = Number.isFinite(json && json.rainChance) ? json.rainChance : null;
  const temp = Number.isFinite(json && json.temp)       ? json.temp       : null;
  const wind = Number.isFinite(json && json.windSpeed)  ? json.windSpeed  : null;
  const c    = typeof json?.condition === 'string' ? json.condition.toLowerCase() : '';

  if ((rain != null && rain >= 60) || c.includes('rain'))   return 'rain';
  if (temp != null && temp >= 32)                            return 'heat';
  if ((wind != null && wind >= 25) || c.includes('wind'))   return 'wind';
  if (rain != null && rain <= 20) {
    if (c.includes('sun') || c.includes('clear') || c.includes('dry')) return 'sunny';
    return 'dry';
  }
  if (c.includes('cloud') || c.includes('overcast'))        return 'cloudy';
  if (c.includes('sun') || c.includes('clear'))             return 'sunny';
  return 'unknown';
}

/**
 * Resolve the best available location object from (in priority order):
 *   1. caller-supplied `location` prop
 *   2. farroway_location localStorage (canonical)
 *   3. farroway_active_farm localStorage (legacy)
 *   4. null
 *
 * The returned object, when non-null, is expected to have:
 *   { lat: number|null, lng: number|null, label?: string, region?: string }
 */
function _resolveLocation(locationProp) {
  // 1. Caller-supplied location (farm profile, user profile, etc.)
  if (locationProp && typeof locationProp === 'object') {
    const lat = Number.isFinite(locationProp.lat) ? locationProp.lat
              : Number.isFinite(locationProp.latitude) ? locationProp.latitude
              : null;
    const lng = Number.isFinite(locationProp.lng) ? locationProp.lng
              : Number.isFinite(locationProp.longitude) ? locationProp.longitude
              : null;
    const label  = typeof locationProp.label  === 'string' ? locationProp.label.trim()  : null;
    const region = typeof locationProp.region === 'string' ? locationProp.region.trim() : null;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng, label, region };
    }
  }

  // 2 + 3. localStorage fallback via locationSafe (handles both keys).
  try {
    const saved = getSavedLocation();
    if (saved && saved.hasLocation) {
      return {
        lat:    saved.lat,
        lng:    saved.lng,
        label:  saved.label  || null,
        region: saved.region || null,
      };
    }
  } catch { /* swallow */ }

  return null;
}

/** Build the URL for GET /api/weather. */
function _buildUrl(loc) {
  const params = new URLSearchParams();
  if (Number.isFinite(loc.lat)) params.set('lat', String(loc.lat));
  if (Number.isFinite(loc.lng)) params.set('lng', String(loc.lng));
  const region = loc.region || loc.label;
  if (typeof region === 'string' && region.trim()
      && region !== 'Location not set'
      && region !== 'Your area') {
    params.set('region', region.trim());
  }
  const qs = params.toString();
  return qs ? '/api/weather?' + qs : '/api/weather';
}

/** Normalise the server JSON into the canonical shape. */
function _normalise(json, fallbackLabel) {
  if (!json || typeof json !== 'object') {
    return { ...FALLBACK_WEATHER, locationLabel: fallbackLabel || 'Your area' };
  }
  // Production Weather Accuracy Audit — surface BOTH the current
  // ambient temp and the day's high. The backend now emits both;
  // older bundles only emit `temp`, so we accept either and prefer
  // the new `tempCurrent` when present so a stale server response
  // never produces the "morning showing 75F" mismatch.
  const tempCurrent = Number.isFinite(json.tempCurrent) ? json.tempCurrent : null;
  const tempHigh    = Number.isFinite(json.tempHigh)    ? json.tempHigh    : null;
  const tempLegacy  = Number.isFinite(json.temp)        ? json.temp        : null;
  const temp = tempCurrent != null ? tempCurrent : tempLegacy;
  return {
    temp,
    tempCurrent,
    tempHigh,
    condition:     typeof json.condition === 'string' && json.condition.trim()
                     ? json.condition.trim()
                     : 'Weather unavailable',
    rainChance:    Number.isFinite(json.rainChance) ? json.rainChance    : null,
    windSpeed:     Number.isFinite(json.windSpeed)  ? json.windSpeed     : null,
    locationLabel: typeof json.locationLabel === 'string' && json.locationLabel.trim()
                     ? json.locationLabel.trim()
                     : (fallbackLabel || 'Your area'),
    weatherType:   _deriveWeatherType(json),
    source:        json.source === 'weather-api' ? 'weather-api' : 'fallback',
  };
}

// ─── Hook ─────────────────────────────────────────────────────────

/**
 * @param {object|null|undefined} location
 *   Optional location override — e.g. from farm profile.
 *   Shape: { lat?, lng?, latitude?, longitude?, label?, region? }
 *   Omit or pass null to rely purely on localStorage fallback.
 */
export function useLiveWeather(location) {
  // All hooks are declared unconditionally here, regardless of
  // whether we'll actually fetch. The `enabled` + `resolvedLoc`
  // logic lives inside effects, not before the hook declarations.

  const [weather, setWeather] = useState(FALLBACK_WEATHER);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [tick,    setTick]    = useState(0);

  const abortRef = useRef(null);
  const aliveRef = useRef(true);

  // Mark alive on mount, dead on unmount.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      try { abortRef.current?.abort(); } catch { /* swallow */ }
    };
  }, []);

  /** Stable refetch trigger — increments the tick that the fetch effect watches. */
  const refetch = useCallback(() => setTick((n) => n + 1), []);

  // Derive a stable location key so the fetch effect only re-runs
  // when the effective coordinates actually change.
  const locationKey = useMemo(() => {
    const loc = _resolveLocation(location);
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return null;
    // Round to 3 decimal places (~110m precision) to avoid floating-
    // point noise from GPS retries re-triggering the fetch.
    return loc.lat.toFixed(3) + ',' + loc.lng.toFixed(3);
  }, [location]);  

  useEffect(() => {
    // ── Kill switch ──────────────────────────────────────────────
    if (!LIVE_WEATHER_ENABLED) {
      const loc = _resolveLocation(location);
      const label = (loc && loc.label) || 'Your area';
      setWeather({ ...FALLBACK_WEATHER, locationLabel: label });
      setLoading(false);
      setError(null);
      return undefined;
    }

    // ── SSR / locked browser guard ───────────────────────────────
    if (typeof window === 'undefined' || typeof fetch !== 'function') {
      setLoading(false);
      return undefined;
    }

    // ── No location → skip fetch, show "add location" prompt ─────
    const loc = _resolveLocation(location);
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) {
      const label = (loc && (loc.label || loc.region)) || null;
      setWeather({
        ...FALLBACK_WEATHER,
        locationLabel: label ? label : 'Add location for better weather timing',
      });
      setLoading(false);
      setError(null);
      return undefined;
    }

    // ── Fetch ────────────────────────────────────────────────────
    try { abortRef.current?.abort(); } catch { /* swallow */ }
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(() => {
      try { controller.abort(); } catch { /* swallow */ }
    }, TIMEOUT_MS);

    const fallbackLabel = loc.label || loc.region || 'Your area';

    // Production Weather Accuracy Audit §2 — single greppable log
    // line every time useLiveWeather decides what coordinates to
    // hit the backend with. Lets ops verify a "wrong weather"
    // report against the actual lat/lng + label the page used,
    // without re-instrumenting.
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
      try {

        console.log('[WEATHER_LOCATION]', {
          latitude:  loc.lat,
          longitude: loc.lng,
          source:    (location && (location.lat || location.latitude))
                      ? 'prop'
                      : 'storage_fallback',
          label:     fallbackLabel,
          region:    loc.region || null,
        });
      } catch { /* swallow */ }
    }

    setLoading(true);
    setError(null);

    fetch(_buildUrl(loc), {
      method:      'GET',
      signal:      controller.signal,
      cache:       'no-store',
      credentials: 'same-origin',
      headers:     { Accept: 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error('weather_http_' + res.status);
        return res.json();
      })
      .then((json) => {
        if (!aliveRef.current) return;
        setWeather(_normalise(json, fallbackLabel));
        setLoading(false);
      })
      .catch((err) => {
        if (!aliveRef.current) return;
        const isAbort = err && (err.name === 'AbortError'
          || /aborted/i.test(String(err.message || '')));
        setError(isAbort ? null : String(err?.message || 'weather_failed'));
        setWeather({ ...FALLBACK_WEATHER, locationLabel: fallbackLabel });
        setLoading(false);
      })
      .finally(() => {
        clearTimeout(timer);
      });

    return () => {
      clearTimeout(timer);
      try { controller.abort(); } catch { /* swallow */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationKey, tick]);

  return { weather, loading, error, refetch };
}

// ─── Test hooks ───────────────────────────────────────────────────
export const _internal = Object.freeze({
  TIMEOUT_MS,
  FALLBACK_WEATHER,
  _resolveLocation,
  _deriveWeatherType,
  _buildUrl,
  _normalise,
});

export default useLiveWeather;
