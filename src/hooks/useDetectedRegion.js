/**
 * useDetectedRegion — react hook that returns the user's detected
 * city/state via getLocation() + reverseGeocode() with a graceful
 * fallback chain.
 *
 *   const {
 *     region,        // human-readable string ("Greater Accra, Ghana") or ''
 *     city,          // detected city or ''
 *     state,         // detected state / region admin1 or ''
 *     country,       // detected country or ''
 *     status,        // 'idle' | 'detecting' | 'detected' | 'failed' | 'unsupported'
 *     refresh,       // () => void  manual re-trigger
 *   } = useDetectedRegion({ initialRegion, initialCountry, autoDetect = true });
 *
 * Behaviour
 *   • If `initialRegion` is supplied and non-empty, the hook
 *     surfaces that immediately (status === 'detected') and skips
 *     the GPS dance — farms with a saved region keep working.
 *   • Otherwise on mount it kicks off a single-shot detection.
 *     Reverse-geocode falls back to the coarse bounding-box
 *     mapper inside `lib/location/reverseGeocode.js` when the
 *     network call fails, so offline pilots still get a country
 *     match.
 *   • Failures move status to 'failed' so the UI can render
 *     "Set your location" instead of empty space.
 *
 * Strict-rule audit
 *   • Never throws — every async path is try/catch wrapped.
 *   • Geo permission is read-only; we never prompt unless the
 *     caller opts in via `autoDetect`.
 *   • Idempotent — manual `refresh()` cancels any in-flight call
 *     before kicking off a new one (via mount epoch).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import getLocation from '../location/getLocation.js';
import reverseGeocode from '../lib/location/reverseGeocode.js';

function _formatRegion({ city, state, country }) {
  const parts = [];
  if (city  && String(city).trim())  parts.push(String(city).trim());
  if (state && String(state).trim() && state !== city) parts.push(String(state).trim());
  if (country && String(country).trim() && parts.length === 0) parts.push(String(country).trim());
  return parts.join(', ');
}

export default function useDetectedRegion({
  initialRegion  = '',
  initialCountry = '',
  autoDetect     = true,
} = {}) {
  const [city,    setCity]    = useState('');
  const [state,   setState]   = useState(initialRegion || '');
  const [country, setCountry] = useState(initialCountry || '');
  const [status,  setStatus]  = useState(() =>
    initialRegion ? 'detected' : (autoDetect ? 'idle' : 'idle'));

  // Mount-epoch ref so a stale async resolution can't overwrite a
  // fresher detection.
  const epochRef = useRef(0);

  const detect = useCallback(async () => {
    const myEpoch = ++epochRef.current;
    setStatus('detecting');
    try {
      const loc = await getLocation();
      if (!loc || loc.lat == null || loc.lng == null) {
        if (myEpoch === epochRef.current) setStatus('failed');
        return;
      }
      const geo = await reverseGeocode({ lat: loc.lat, lng: loc.lng });
      if (myEpoch !== epochRef.current) return;     // raced
      if (!geo) { setStatus('failed'); return; }
      setCity(geo.city || '');
      setState(geo.state || geo.region || '');
      setCountry(geo.country || '');
      setStatus('detected');
    } catch {
      if (myEpoch === epochRef.current) setStatus('failed');
    }
  }, []);

  useEffect(() => {
    // Surface initialRegion immediately if supplied.
    if (initialRegion && String(initialRegion).trim()) {
      setStatus('detected');
      return;
    }
    if (autoDetect) {
      // Fire and forget; cleanup via epoch.
      detect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const region = useMemo(
    () => _formatRegion({ city, state, country }),
    [city, state, country],
  );

  return {
    region,
    city,
    state,
    country,
    status,
    refresh: detect,
  };
}
