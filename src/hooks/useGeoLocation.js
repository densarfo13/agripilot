/**
 * useGeoLocation — button-triggered, iOS-Safari-safe geolocation.
 *
 *   const { location, error, isLoading, supported, requestLocation, reset } = useGeoLocation();
 *
 *   <button onClick={requestLocation} disabled={isLoading}>
 *     Use my location
 *   </button>
 *   {error && <div className="warning">{error}</div>}
 *
 * Why this exists
 *   • iPhone Safari fails location requests silently if any
 *     async work happens between the user gesture and the call
 *     to getCurrentPosition. The hook calls it synchronously
 *     inside the handler the user invokes.
 *   • Several places in the app each had their own
 *     getCurrentPosition snippet with subtly different error
 *     handling. This hook is the canonical wrapper.
 *   • `requestLocation()` is the ONLY way to trigger a request.
 *     The hook NEVER auto-runs on mount — the user always
 *     consents with a tap.
 *
 * Returned shape
 *   location:      { lat, lng, accuracy } | null
 *   error:         string | null            (user-friendly message)
 *   errorCode:     'unsupported' | 'permission_denied' | 'unavailable'
 *                  | 'timeout' | 'unknown' | null
 *   isLoading:     boolean                  (request in flight)
 *   supported:     boolean                  (geolocation API present)
 *   requestLocation(): void                 (call from a click handler)
 *   reset():       void                     (clear error + location)
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Hard-cap timeout (10s) — the request never hangs forever,
 *     even on an iOS Safari that refuses to fire either callback.
 *   • Permission-denied + every other failure mode is mapped to
 *     a user-friendly string the caller can render verbatim.
 */

import { useCallback, useRef, useState } from 'react';

const DEFAULT_OPTS = Object.freeze({
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
});

const ERROR_MESSAGES = Object.freeze({
  unsupported:       'Location is not supported on this device. Enter your location manually.',
  permission_denied: 'Permission denied. Please allow location access — or enter manually.',
  unavailable:       'Unable to detect location. Try again or enter manually.',
  timeout:           'Location is taking too long. Try again or enter manually.',
  unknown:           'We couldn\u2019t detect your location. You can enter it manually.',
});

function _mapErr(err) {
  if (!err) return 'unknown';
  if (typeof err.code === 'number') {
    if (err.code === 1) return 'permission_denied';
    if (err.code === 2) return 'unavailable';
    if (err.code === 3) return 'timeout';
  }
  return 'unknown';
}

export function useGeoLocation(opts = {}) {
  const supported = typeof navigator !== 'undefined'
    && navigator.geolocation
    && typeof navigator.geolocation.getCurrentPosition === 'function';

  const [location,  setLocation]  = useState(null);
  const [error,     setError]     = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Double-tap guard — a synchronous ref so React batching can't
  // let two requests fire from a fast double-tap.
  const busyRef = useRef(false);

  const reset = useCallback(() => {
    setLocation(null);
    setError(null);
    setErrorCode(null);
    setIsLoading(false);
    busyRef.current = false;
  }, []);

  const requestLocation = useCallback(() => {
    if (busyRef.current) return;
    if (!supported) {
      setError(ERROR_MESSAGES.unsupported);
      setErrorCode('unsupported');
      return;
    }
    busyRef.current = true;
    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    // Hard ceiling — even if the browser refuses to fire either
    // callback (rare iOS Safari bug), bail after 11s with a
    // friendly timeout message rather than leaving the spinner
    // forever. The browser's own `timeout` option is 10s; we
    // give it 1s of grace before tripping our own.
    const positionOptions = { ...DEFAULT_OPTS, ...(opts.positionOptions || {}) };
    let settled = false;
    const guardTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      busyRef.current = false;
      setIsLoading(false);
      setError(ERROR_MESSAGES.timeout);
      setErrorCode('timeout');
    }, (positionOptions.timeout || 10000) + 1000);

    const finishOk = (pos) => {
      if (settled) return;
      settled = true;
      clearTimeout(guardTimer);
      busyRef.current = false;
      const c = pos && pos.coords;
      if (!c
          || !Number.isFinite(c.latitude)
          || !Number.isFinite(c.longitude)) {
        setError(ERROR_MESSAGES.unavailable);
        setErrorCode('unavailable');
        setIsLoading(false);
        return;
      }
      setLocation({
        lat:      c.latitude,
        lng:      c.longitude,
        accuracy: Number.isFinite(c.accuracy) ? c.accuracy : null,
      });
      setError(null);
      setErrorCode(null);
      setIsLoading(false);
    };

    const finishErr = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(guardTimer);
      busyRef.current = false;
      const code = _mapErr(err);
      setErrorCode(code);
      setError(ERROR_MESSAGES[code] || ERROR_MESSAGES.unknown);
      setIsLoading(false);
      // Safe debug logging for field troubleshooting on mobile.
      try { console.warn('[useGeoLocation] failed:', { code, message: err && err.message }); }
      catch { /* swallow */ }
    };

    try {
      navigator.geolocation.getCurrentPosition(finishOk, finishErr, positionOptions);
    } catch (e) {
      finishErr(e);
    }
  }, [opts, supported]);

  return { location, error, errorCode, isLoading, supported, requestLocation, reset };
}

// Test hooks.
export const _internal = Object.freeze({
  DEFAULT_OPTS,
  ERROR_MESSAGES,
  _mapErr,
});

export default useGeoLocation;
