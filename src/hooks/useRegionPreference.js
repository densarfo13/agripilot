/**
 * useRegionPreference — read/write the user-set country override.
 *
 *   const { countryCode, setCountry, clear, regionContext } = useRegionPreference();
 *
 *   countryCode     ISO-2 country code from the persisted override,
 *                   or null when unset
 *   setCountry(c)   stamps the override (validated against the
 *                   regionProfiles registry)
 *   clear()         removes the override (caller falls back to
 *                   detection chain)
 *   regionContext   resolved RegionContext for `countryCode` —
 *                   ready to feed into Home / scan / briefing
 *
 * Subscribes to:
 *   • farroway:region_override_changed (same-tab updates)
 *   • storage event (cross-tab sync)
 *
 * Strict-rule audit
 *   • All hooks unconditional — rules-of-hooks safe.
 *   • Never throws — every store call wrapped.
 *   • Region context computed via useMemo so callers can drop
 *     it into render without performance cost.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  readRegionOverride, writeRegionOverride, clearRegionOverride,
  REGION_OVERRIDE_KEY, REGION_OVERRIDE_EVENT,
} from '../lib/region/regionPreference.js';
import { getRegionContext } from '../intelligence/region/regionIntelligence.js';

export default function useRegionPreference() {
  const [countryCode, setCodeState] = useState(() => {
    try { return readRegionOverride(); } catch { return null; }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const refresh = (ev) => {
      try {
        // Same-tab event — read the canonical value back to stay
        // honest with what's actually persisted.
        const next = (ev && ev.detail && 'countryCode' in ev.detail)
          ? ev.detail.countryCode
          : readRegionOverride();
        setCodeState(next || null);
      } catch { /* swallow */ }
    };
    const onStorage = (ev) => {
      try {
        if (ev?.key === REGION_OVERRIDE_KEY) {
          setCodeState(readRegionOverride());
        }
      } catch { /* swallow */ }
    };

    try {
      window.addEventListener(REGION_OVERRIDE_EVENT, refresh);
      window.addEventListener('storage', onStorage);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener(REGION_OVERRIDE_EVENT, refresh);
        window.removeEventListener('storage', onStorage);
      } catch { /* swallow */ }
    };
  }, []);

  const setCountry = useCallback((code) => {
    const stored = writeRegionOverride(code);
    setCodeState(stored);
    return stored;
  }, []);

  const clear = useCallback(() => {
    clearRegionOverride();
    setCodeState(null);
  }, []);

  // Resolved context — fed into briefing / scan / Home for any
  // surface that wants region-aware copy. Recomputed only when
  // the country code actually changes.
  const regionContext = useMemo(() => {
    try { return getRegionContext({ countryCode }); }
    catch { return getRegionContext({}); }
  }, [countryCode]);

  return { countryCode, setCountry, clear, regionContext };
}

export { useRegionPreference };
