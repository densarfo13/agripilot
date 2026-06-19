/**
 * SatelliteProvider.ts — sprint #208, spec §7.
 *
 * The provider boundary. It reports whether satellite is configured
 * and NEVER fetches or fabricates a reading. In this build it always
 * returns UNCONFIGURED: there is no Sentinel client, no credential
 * read, no network call. This is the honest placeholder the frozen
 * doctrine requires — the alternative (a stubbed NDVI) is exactly the
 * fabrication the gates forbid.
 *
 * Pure. SSR-safe. Never throws.
 */

import {
  UNCONFIGURED_READING,
} from './SatelliteContracts';
import type { SatelliteStatus, SatelliteReading } from './SatelliteContracts';

export const SATELLITE_PROVIDER_VERSION = 'satellite-provider-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Is satellite configured? Always UNCONFIGURED in this build. We do
 * NOT read import.meta.env for a Sentinel key — wiring a real key is
 * a frozen-feature decision, not an engineering default. If a future
 * build connects satellite, this is the ONE place that flips.
 */
export function getSatelliteProviderStatus(): SatelliteStatus {
  return 'UNCONFIGURED';
}

/**
 * Fetch a reading. Returns the frozen UNCONFIGURED reading — no
 * network, no fabrication — whenever status is UNCONFIGURED, which is
 * always. The `_farmId` arg documents the future shape; it is unused.
 */
export function fetchSatelliteReading(_farmId?: string): Readonly<SatelliteReading> {
  return _safe(() => {
    if (getSatelliteProviderStatus() !== 'CONFIGURED') {
      return UNCONFIGURED_READING;
    }
    // No CONFIGURED path exists in this build. Returning the
    // unconfigured reading is the only honest outcome.
    return UNCONFIGURED_READING;
  }, UNCONFIGURED_READING);
}

export const _internal = Object.freeze({
  getSatelliteProviderStatus, fetchSatelliteReading,
});
export default getSatelliteProviderStatus;
