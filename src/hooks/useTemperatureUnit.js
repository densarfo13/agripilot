/**
 * useTemperatureUnit — reactive temperature-unit resolver.
 *
 *   const { unit, source, format } = useTemperatureUnit();
 *   //   unit:   'C' | 'F'
 *   //   source: 'user' | 'country' | 'fallback'
 *   //   format: (valueC) => '55°F'   // already converted + rounded
 *
 * Resolution order (matches resolveTemperatureUnit's ladder):
 *   1. User preference (farroway_temperature_unit_preference)
 *   2. Active farm country (via useFarmContext)
 *   3. Fallback — Celsius
 *
 * Why a hook, not a one-shot read
 *   resolveTemperatureUnit() is synchronous + caches in-session.
 *   That cache is what made the Maryland "13°" bug subtle — the
 *   first resolve happened before the farm context hydrated and
 *   pinned 'C', then every later read returned the stale 'C'
 *   even after the country surfaced as 'US'. This hook re-runs
 *   resolution on every FARM_UPDATED / LOCATION_UPDATED /
 *   CROP_ADDED bus event by piggy-backing on useFarmContext,
 *   AND it bypasses the session cache (`session: false`) so a
 *   country-change wins over the stale pin.
 *
 * Strict-rule audit
 *   * Returns a STABLE result across re-renders unless the
 *     underlying unit actually changed (avoids re-rendering
 *     every consumer on every Home tick).
 *   * Never throws. SSR-safe — returns 'C' / 'fallback' when
 *     localStorage is unavailable.
 */

import { useMemo } from 'react';
import {
  resolveTemperatureUnit,
  getUserTemperatureUnitPreference,
  formatTemperature,
} from '../lib/weatherUnits.js';
import useFarmContext from './useFarmContext.js';

export default function useTemperatureUnit() {
  const farmCtx = useFarmContext();
  const country = (farmCtx && farmCtx.farm && farmCtx.farm.country) || null;

  const resolved = useMemo(() => {
    const userPref = (() => {
      try { return getUserTemperatureUnitPreference(); }
      catch { return null; }
    })();
    return resolveTemperatureUnit({
      userPreference: userPref,
      countryCode:    country,
      session:        false,
    });
  }, [country]);

  // Closes over the resolved target unit so callers can render
  // a Celsius-sourced value with a single call instead of
  // re-importing formatTemperature + threading the unit through
  // props.
  const format = useMemo(() => {
    return (valueC) => formatTemperature(valueC, 'C', resolved.unit);
  }, [resolved.unit]);

  return useMemo(() => ({
    unit:   resolved.unit,
    source: resolved.source,
    format,
  }), [resolved.unit, resolved.source, format]);
}
