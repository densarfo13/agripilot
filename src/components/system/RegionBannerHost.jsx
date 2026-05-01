/**
 * RegionBannerHost — thin wrapper that reads the active farm,
 * resolves region UX, and decides whether to render the
 * <RegionBanner> at the top of the protected app shell.
 *
 * Lives separately from ProtectedLayout so the layout's import
 * graph stays small and so this surface can be unmounted with
 * a single feature-flag check inside the layout.
 *
 * Behaviour
 * ─────────
 *   • Off when `regionUxSystem` feature flag is disabled.
 *   • Off when no banner message is needed (active country in
 *     `active` status — `resolveRegionUX` returns no message).
 *   • Off when the user has already dismissed the banner for
 *     the current country (persisted in localStorage under
 *     `farroway_region_banner_dismissed_<COUNTRY>`).
 *   • Fires the regionAnalytics events `region_banner_shown`
 *     once per mount + `region_banner_dismissed` on click.
 *
 * Strict-rule audit
 *   • Pure UI; no I/O outside localStorage.
 *   • Never throws — all storage reads / writes wrapped.
 *   • Adds zero render overhead when the flag is off (we
 *     return null immediately before any other work).
 */

import { useEffect, useMemo, useState } from 'react';
import { useProfile } from '../../context/ProfileContext.jsx';
import { isFeatureEnabled } from '../../config/features.js';
import { resolveRegionUX } from '../../core/regionUXEngine.js';
import { trackRegionUXEvent } from '../../analytics/regionAnalytics.js';
import RegionBanner from './RegionBanner.jsx';

const KEY_PREFIX = 'farroway_region_banner_dismissed_';

function _readDismissed(country) {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(KEY_PREFIX + (country || 'unknown')) === 'true';
  } catch { return false; }
}

function _writeDismissed(country) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KEY_PREFIX + (country || 'unknown'), 'true');
  } catch { /* ignore quota / private mode */ }
}

export default function RegionBannerHost() {
  // Cheap exit when the feature is off — no state, no effects.
  const flagOn = isFeatureEnabled('regionUxSystem');

  // ProfileContext is mounted above ProtectedLayout, so this is
  // safe; defensive try/catch keeps the component renderable
  // even when consumed outside the provider during tests.
  let activeFarm = null;
  try {
    const ctx = useProfile();
    activeFarm = ctx?.profile || null;
  } catch { activeFarm = null; }

  const ux = useMemo(() => {
    if (!flagOn) return null;
    return resolveRegionUX({
      detectedCountry: activeFarm?.country || activeFarm?.countryCode || activeFarm?.detectedCountry,
      detectedRegion:  activeFarm?.region || activeFarm?.detectedRegion,
      farmType:        activeFarm?.farmType || activeFarm?.type,
    });
  }, [
    flagOn,
    activeFarm?.country,
    activeFarm?.countryCode,
    activeFarm?.region,
    activeFarm?.farmType,
    activeFarm?.type,
  ]);

  const country = ux?.country || 'unknown';
  const [dismissed, setDismissed] = useState(() => _readDismissed(country));

  // Re-check the dismissed flag whenever the active country changes
  // (a farmer switching farms across countries).
  useEffect(() => {
    setDismissed(_readDismissed(country));
  }, [country]);

  // Fire the "shown" event exactly once per mount per country
  // when a banner actually renders. Tracks at the boundary so
  // dismissed sessions don't generate noise.
  const willShow = !!(flagOn && ux && ux.message && !dismissed);
  useEffect(() => {
    if (!willShow) return;
    try {
      trackRegionUXEvent('region_banner_shown', {
        country,
        status: ux?.status,
        experience: ux?.experience,
      });
    } catch { /* never propagate */ }
  }, [willShow, country, ux?.status, ux?.experience]);

  if (!flagOn) return null;
  if (!ux || !ux.message) return null;
  if (dismissed) return null;

  const onDismiss = () => {
    _writeDismissed(country);
    setDismissed(true);
    try {
      trackRegionUXEvent('region_banner_dismissed', {
        country,
        status: ux.status,
        experience: ux.experience,
      });
    } catch { /* never propagate */ }
  };

  return (
    <RegionBanner
      messageKey={ux.message}
      onDismiss={onDismiss}
    />
  );
}
