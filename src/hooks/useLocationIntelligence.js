/**
 * useLocationIntelligence.js — React surface over
 * locationIntelligenceEngine. Single hook every page consumes.
 *
 *   import { useLocationIntelligence }
 *     from 'src/hooks/useLocationIntelligence.js';
 *
 *   const loc = useLocationIntelligence();
 *   // loc.statusChip   — subtle text for the Home chip
 *   // loc.awayMessage  — calm "you're away from your farm" line
 *   // loc.weatherLocationSource — pass to weather fetchers
 *
 * What this is
 * ────────────
 *   Subscribes to the canonical farm store for `farmLocation`, runs
 *   `probePermission()` once on mount, auto-fetches deviceLocation
 *   ONLY when permission is already granted (never prompts), and
 *   recomputes the envelope on every mutation.
 *
 *   Page-level surfaces (Home / Weather card / Tasks) render the
 *   subtle status chip + the calm away message instead of the old
 *   dominant "Use my location" CTA.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe (returns the empty envelope when
 *     React is hydrated on the server).
 *   • Never triggers the browser permission prompt automatically —
 *     `requestPermission()` is exposed for explicit user opt-in
 *     (button tap).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  probePermission, fetchDeviceLocation,
  computeLocationIntelligence,
  getCachedDeviceLocation, getCachedFarmLocation,
  cacheFarmLocation,
  LOCATION_SOURCE,
} from '../core/location/locationIntelligenceEngine.js';
import { useCanonicalFarmStore } from '../store/canonicalFarmStore.js';

const _isObj = (v) => v != null && typeof v === 'object';

function _farmLocationFrom(farm) {
  if (!_isObj(farm)) return null;
  const lat = typeof farm.lat === 'number' ? farm.lat : null;
  const lng = typeof farm.lng === 'number' ? farm.lng : null;
  if (lat == null || lng == null) {
    // Fall through to cached farm location if the active farm
    // hasn't pinned coords yet (early-onboarding state).
    return getCachedFarmLocation();
  }
  return Object.freeze({
    lat, lng,
    label: typeof farm.location === 'string' ? farm.location : null,
    at:    typeof farm.updatedAt === 'number' ? farm.updatedAt : null,
  });
}

export function useLocationIntelligence() {
  // Pull the canonical farm so we re-render when the farm changes.
  const activeFarm = useCanonicalFarmStore((s) => s.activeFarm);

  const [permission, setPermission] = useState('unknown');
  const [deviceLocation, setDeviceLocation] = useState(() => getCachedDeviceLocation());
  const mountedRef = useRef(false);

  // Silent permission probe + auto-fetch on mount.
  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    (async () => {
      try {
        const perm = await probePermission();
        if (cancelled) return;
        setPermission(perm.state);
        if (perm.canAutoFetch) {
          const loc = await fetchDeviceLocation();
          if (!cancelled && loc) setDeviceLocation(loc);
        }
      } catch { /* swallow */ }
    })();
    return () => { cancelled = true; mountedRef.current = false; };
  }, []);

  // Mirror activeFarm's coords into the location cache so offline
  // boots still show "Using farm location".
  useEffect(() => {
    const farmLoc = _farmLocationFrom(activeFarm);
    if (farmLoc) {
      try { cacheFarmLocation(farmLoc); } catch { /* swallow */ }
    }
  }, [activeFarm]);

  const intelligence = useMemo(() => {
    const farmLoc = _farmLocationFrom(activeFarm);
    return computeLocationIntelligence({
      deviceLocation, farmLocation: farmLoc, permission,
    });
  }, [activeFarm, deviceLocation, permission]);

  // Explicit user opt-in — triggers the OS permission prompt only
  // when the farmer taps a "Use my location" button.
  const requestPermission = useCallback(async () => {
    try {
      const loc = await fetchDeviceLocation();
      if (loc) {
        setDeviceLocation(loc);
        // Re-probe — permission probably granted now.
        const perm = await probePermission();
        if (mountedRef.current) setPermission(perm.state);
      }
      return loc;
    } catch { return null; }
  }, []);

  return Object.freeze({
    ...intelligence,
    requestPermission,
  });
}

export { LOCATION_SOURCE };

const _module = { useLocationIntelligence, LOCATION_SOURCE };
export default _module;
