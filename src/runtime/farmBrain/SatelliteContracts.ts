/**
 * SatelliteContracts.ts — sprint #208, spec §7 (INTERFACES ONLY).
 *
 * Types for the satellite foundation. The whole point of this layer
 * is HONESTY: it exists so the rest of the app can ask "is satellite
 * configured?" and always get a truthful UNCONFIGURED answer instead
 * of a fabricated NDVI. There is NO Sentinel integration here and
 * none is scaffolded — satellite remains on the frozen list
 * (Do-Not-Build; founder #200/#206 calls). This contract makes the
 * "never fake satellite" rule type-enforced.
 *
 * Pure types + frozen constants. No side effects.
 */

export const SATELLITE_CONTRACTS_VERSION = 'satellite-contracts-v1';

export type SatelliteStatus = 'UNCONFIGURED' | 'CONFIGURED';

/**
 * A satellite reading. Every numeric field is nullable and is null
 * whenever status is UNCONFIGURED — which, in this build, is ALWAYS.
 * No code path may set these to a number without real credentials +
 * a real provider response.
 */
export interface SatelliteReading {
  status:           SatelliteStatus;
  ndvi:             number | null;   // vegetation index — null unless configured
  ndmi:             number | null;   // moisture index — null unless configured
  vegetationStress: number | null;   // 0..100 — null unless configured
  waterStress:      number | null;   // 0..100 — null unless configured
  capturedAt:       string | null;   // ISO — null unless configured
  note:             string;          // farmer-safe explanation
}

export interface SatelliteCorrelation {
  status:            SatelliteStatus;
  satelliteConfidence: number | null; // null unless configured — never faked
  reading:           SatelliteReading;
  note:              string;
}

// The unconfigured reading every code path returns today. Frozen so
// no caller can mutate it into a fake reading.
export const UNCONFIGURED_READING: Readonly<SatelliteReading> = Object.freeze({
  status: 'UNCONFIGURED',
  ndvi: null,
  ndmi: null,
  vegetationStress: null,
  waterStress: null,
  capturedAt: null,
  note: 'Satellite data is not connected for this farm.',
});

// Strings a gate forbids near satellite output — fabricated index
// values would name these.
export const SATELLITE_FORBIDDEN_FAKE_TOKENS = Object.freeze([
  'fakeNdvi', 'mockNdvi', 'randomNdvi', 'simulatedVegetation',
]);
