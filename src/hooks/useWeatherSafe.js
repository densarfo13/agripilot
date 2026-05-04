/**
 * useWeatherSafe — hook that fetches /api/weather with a 6-second
 * timeout, never throws, never blocks render.
 *
 *   const { weather, loading, error } = useWeatherSafe();
 *   const { weather, loading, error } = useWeatherSafe({ enabled: false });
 *
 * Behaviour
 *   • Reads the saved location via locationSafe.getSavedLocation()
 *     on every mount. When the user updates location elsewhere,
 *     mount the hook with a key prop or call refetch() (returned).
 *   • Issues `fetch('/api/weather?...', { cache: 'no-store' })`
 *     wrapped in an AbortController — hard 6s deadline.
 *   • Server endpoint always returns 200 with the canonical
 *     fallback shape on its own failures, so this hook only
 *     ever sees network errors / abort signals as failures.
 *   • On any failure path the hook returns the SAME fallback
 *     shape the server would have returned, so the caller's
 *     render code is identical regardless of network state.
 *
 * Returned shape (always present, never null)
 *   weather: {
 *     temp:          number | null,
 *     condition:     string,
 *     rainChance:    number | null,
 *     windSpeed:     number | null,
 *     locationLabel: string,
 *     source:        'weather-api' | 'fallback',
 *   }
 *   loading: boolean
 *   error:   string | null
 *   refetch: () => void   (force a fresh fetch)
 *
 * Strict-rule audit
 *   • Hooks are declared unconditionally at the top of the
 *     function body — passes react-hooks/rules-of-hooks.
 *   • The `enabled` flag controls behaviour INSIDE the
 *     effect, not whether the effect runs (per spec §3 of
 *     the React #300 fix).
 *   • SSR-safe: `window`/`fetch` access wrapped.
 *   • Cleanup aborts the in-flight request on unmount and on
 *     every re-fetch so a slow network can't leak a setState
 *     into an unmounted tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSavedLocation } from '../lib/locationSafe.js';

const TIMEOUT_MS = 6_000;

const FALLBACK_WEATHER = Object.freeze({
  temp:          null,
  condition:     'Weather unavailable',
  rainChance:    null,
  windSpeed:     null,
  locationLabel: 'Your area',
  source:        'fallback',
});

function _buildUrl(loc) {
  const params = new URLSearchParams();
  if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
    params.set('lat', String(loc.lat));
    params.set('lng', String(loc.lng));
  }
  if (loc && typeof loc.region === 'string' && loc.region.trim()) {
    params.set('region', loc.region.trim());
  } else if (loc && typeof loc.label === 'string' && loc.label.trim()
             && loc.label !== 'Location not set'
             && loc.label !== 'Your area') {
    params.set('region', loc.label.trim());
  }
  const qs = params.toString();
  return qs ? '/api/weather?' + qs : '/api/weather';
}

function _normaliseResponse(json, fallbackLabel) {
  if (!json || typeof json !== 'object') {
    return { ...FALLBACK_WEATHER, locationLabel: fallbackLabel || 'Your area' };
  }
  return {
    temp:          Number.isFinite(json.temp)       ? json.temp       : null,
    condition:     typeof json.condition === 'string' && json.condition.trim()
                     ? json.condition.trim()
                     : 'Weather unavailable',
    rainChance:    Number.isFinite(json.rainChance) ? json.rainChance : null,
    windSpeed:     Number.isFinite(json.windSpeed)  ? json.windSpeed  : null,
    locationLabel: typeof json.locationLabel === 'string' && json.locationLabel.trim()
                     ? json.locationLabel.trim()
                     : (fallbackLabel || 'Your area'),
    source:        json.source === 'weather-api' ? 'weather-api' : 'fallback',
  };
}

/**
 * @param {{ enabled?: boolean }} [opts]
 */
export function useWeatherSafe(opts) {
  const enabled = opts && opts.enabled === false ? false : true;

  const [weather, setWeather] = useState(FALLBACK_WEATHER);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [refetchTick, setRefetchTick] = useState(0);

  const abortRef = useRef(null);
  const aliveRef = useRef(true);

  const refetch = useCallback(() => {
    setRefetchTick((n) => n + 1);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      try { abortRef.current?.abort(); } catch { /* swallow */ }
    };
  }, []);

  useEffect(() => {
    // Hard kill switch — caller can disable via opts.enabled.
    if (!enabled) {
      setLoading(false);
      setError(null);
      return undefined;
    }
    if (typeof window === 'undefined' || typeof fetch !== 'function') {
      // SSR / locked-down browser — paint fallback and stop.
      setLoading(false);
      return undefined;
    }

    // Resolve the saved location once per fetch. We deliberately
    // re-read here so a recent saveLocation() call propagates
    // without forcing the caller to plumb the location prop in.
    const loc = (() => {
      try { return getSavedLocation(); } catch { return null; }
    })();
    const fallbackLabel = (loc && loc.label) || 'Your area';

    // Cancel any prior in-flight request before starting a new one.
    try { abortRef.current?.abort(); } catch { /* swallow */ }
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => {
      try { controller.abort(); } catch { /* swallow */ }
    }, TIMEOUT_MS);

    setLoading(true);
    setError(null);

    fetch(_buildUrl(loc), {
      method: 'GET',
      signal: controller.signal,
      cache:  'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then((res) => {
        if (!res || !res.ok) throw new Error('weather_http_' + (res ? res.status : 'no_response'));
        return res.json();
      })
      .then((json) => {
        if (!aliveRef.current) return;
        setWeather(_normaliseResponse(json, fallbackLabel));
        setLoading(false);
      })
      .catch((err) => {
        if (!aliveRef.current) return;
        // Aborted (timeout or unmount) → silent. Real errors
        // surface as a string for diagnostic surfaces.
        const isAbort = err && (err.name === 'AbortError'
          || /aborted/i.test(String(err.message || '')));
        if (!isAbort) {
          setError(String(err && err.message ? err.message : 'weather_failed'));
        } else {
          setError(null);
        }
        // Always paint the fallback so the UI never sits empty.
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
  }, [enabled, refetchTick]);

  return { weather, loading, error, refetch };
}

// Test hooks.
export const _internal = Object.freeze({
  TIMEOUT_MS,
  FALLBACK_WEATHER,
  _buildUrl,
  _normaliseResponse,
});

export default useWeatherSafe;
