/**
 * SatelliteCorrelationEngine.ts — sprint #208, spec §7.
 *
 * Correlates a satellite reading with a scan/farm signal. Because the
 * provider is UNCONFIGURED, this ALWAYS returns satelliteConfidence
 * null + an UNCONFIGURED reading. It never invents NDVI, vegetation
 * stress, or a correlation score. This is the honest foundation the
 * spec asked for — satellite stays frozen; the engine simply refuses
 * to fabricate.
 *
 * Pure. SSR-safe. Never throws.
 */

import { fetchSatelliteReading } from './SatelliteProvider';
import { UNCONFIGURED_READING } from './SatelliteContracts';
import type { SatelliteCorrelation } from './SatelliteContracts';

export const SATELLITE_CORRELATION_VERSION = 'satellite-correlation-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Correlate satellite with a farm/scan signal. Always UNCONFIGURED in
 * this build → satelliteConfidence null (never faked).
 */
export function correlateSatellite(_input: {
  farmId?: string;
  scanIssue?: string;
} = {}): Readonly<SatelliteCorrelation> {
  return _safe(() => {
    const reading = fetchSatelliteReading(_input.farmId);
    if (reading.status !== 'CONFIGURED') {
      return Object.freeze({
        status: 'UNCONFIGURED' as const,
        satelliteConfidence: null,   // honest — no fabricated score
        reading,
        note: 'Satellite stress is not available — connect satellite to add this signal.',
      });
    }
    // No CONFIGURED path in this build.
    return Object.freeze({
      status: 'UNCONFIGURED' as const,
      satelliteConfidence: null,
      reading: UNCONFIGURED_READING,
      note: 'Satellite stress is not available.',
    });
  }, Object.freeze({
    status: 'UNCONFIGURED' as const,
    satelliteConfidence: null,
    reading: UNCONFIGURED_READING,
    note: 'Satellite stress is not available.',
  }));
}

export function buildSatelliteFoundationHealth(): Readonly<{
  ok: boolean;
  runtimeVersion: string;
  status: 'UNCONFIGURED' | 'CONFIGURED';
  fabricatesReadings: false;
}> {
  return Object.freeze({
    ok: true,
    runtimeVersion: SATELLITE_CORRELATION_VERSION,
    status: 'UNCONFIGURED' as const,
    fabricatesReadings: false as const,
  });
}

export const _internal = Object.freeze({
  correlateSatellite, buildSatelliteFoundationHealth,
});
export default correlateSatellite;
