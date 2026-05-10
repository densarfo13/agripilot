/**
 * satellite — feature-flag-gated foundation for satellite signals
 * (NDVI vegetation health, rainfall, moisture, heat stress,
 * drought, flood risk, crop stress detection).
 *
 *   Feature flag: enableSatelliteEngine (default OFF)
 *
 * Behaviour
 *   • When the flag is OFF, every export returns null / [].
 *     Callers receive a deterministic "no signal" response and
 *     should fall back to their rule-based path.
 *   • When the flag is ON, callers can pass a future
 *     `SatelliteAdapter` into the resolve functions; the
 *     concrete HTTP adapters for Sentinel-Hub / Planet Labs /
 *     equivalent providers are deferred feature work.
 *
 * Output contract (spec §4)
 *   The satellite engine NEVER exposes raw NDVI / pixel scores
 *   to users. It converts signals into calm one-line guidance
 *   that the orchestrator can rank alongside other inputs:
 *
 *     "Recent heat conditions may increase water stress this week."
 *     "Rainfall has been lower than usual for your region."
 *
 * Strict-rule audit
 *   • Pure / no I/O / no React. Frozen exports.
 *   • Never throws. Never exposes raw scores.
 *   • Flag-gated at every entry — disabled is the safe default.
 */

import { isFeatureEnabled } from '../../config/features.js';

const FLAG = 'enableSatelliteEngine';

export type SatelliteStressLevel = 'low' | 'medium' | 'high';

export interface SatelliteSignal {
  /** Internal label — never user-facing. */
  readonly kind: 'vegetation' | 'rainfall' | 'moisture' | 'heat' | 'drought' | 'flood';
  /** Internal magnitude — never user-facing. */
  readonly stress: SatelliteStressLevel;
  /** ISO timestamp of the underlying satellite pass. */
  readonly observedAt: string;
}

export interface SatelliteRegion {
  readonly country: string | null;
  readonly region:  string | null;
  /** Approximate tile centroid for fetching pass data. */
  readonly lat: number | null;
  readonly lng: number | null;
}

export function isSatelliteEnabled(): boolean {
  try { return !!isFeatureEnabled(FLAG); } catch { return false; }
}

/**
 * Resolve the satellite tile for the supplied region. Today
 * returns the input shape; concrete tile-resolution lands when
 * a provider adapter is wired.
 */
export function resolveSatelliteRegion(region: Partial<SatelliteRegion>): SatelliteRegion {
  return Object.freeze({
    country: region?.country || null,
    region:  region?.region  || null,
    lat:     Number.isFinite(region?.lat as number) ? Number(region!.lat) : null,
    lng:     Number.isFinite(region?.lng as number) ? Number(region!.lng) : null,
  });
}

/**
 * Fetch the latest satellite signals for the supplied region.
 * Today returns []; concrete HTTP adapter behind a flag.
 */
export async function fetchSatelliteSignals(
  _region: SatelliteRegion,
): Promise<ReadonlyArray<SatelliteSignal>> {
  if (!isSatelliteEnabled()) return [];
  // Concrete adapter (Sentinel-Hub, Planet Labs, OpenLandMap, …)
  // wires in here when the operator sets the relevant API key +
  // flips enableSatelliteEngine to true. Today: deterministic [].
  return [];
}

/**
 * Convert satellite signals into a user-visible guidance line.
 * Never returns raw scores; only calm observational language.
 * Returns null when nothing meaningful to surface.
 */
export function satelliteSignalToGuidance(
  signals: ReadonlyArray<SatelliteSignal>,
): string | null {
  if (!Array.isArray(signals) || signals.length === 0) return null;
  // Priority — drought/heat first, vegetation last.
  const ranked = [...signals].sort((a, b) => {
    const order: SatelliteStressLevel[] = ['high', 'medium', 'low'];
    return order.indexOf(a.stress) - order.indexOf(b.stress);
  });
  const top = ranked[0];
  switch (top.kind) {
    case 'heat':
      return 'Recent heat conditions may increase water stress this week.';
    case 'drought':
      return 'Rainfall has been lower than usual for your region.';
    case 'moisture':
      return top.stress === 'low'
        ? 'Soil moisture looks low compared to recent weeks.'
        : 'Soil moisture looks steady this week.';
    case 'rainfall':
      return 'Recent rainfall has been heavier than the seasonal average.';
    case 'flood':
      return 'Conditions may favour water pooling — check drainage.';
    case 'vegetation':
    default:
      return null;
  }
}

export default Object.freeze({
  isSatelliteEnabled,
  resolveSatelliteRegion,
  fetchSatelliteSignals,
  satelliteSignalToGuidance,
});
