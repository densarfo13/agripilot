/**
 * satelliteIntelligence.js — Phase 3 stub.
 *
 * STATUS: STUB ARCHITECTURE-READY. NOT imported anywhere. No
 * network calls. Designed as the single entrypoint for
 * vegetation-index + stress-level outputs once a real satellite
 * provider is wired (Sentinel-2 / Planet / VITO MODIS).
 *
 * Output shape (stable contract):
 *
 *   {
 *     vegetationIndex: number | null,    // NDVI 0..1 or -1..1 depending on provider
 *     stressLevel:     'none'|'low'|'medium'|'high'|null,
 *     lastUpdated:     ISO string | null,
 *     recommendationKey: string | null,  // i18n key
 *     confidence:      number,            // 0..1
 *     providerLabel:   string | null,    // 'stub' until wired
 *   }
 */

export function buildSatelliteIntelligence(input = {}) {
  return Object.freeze({
    vegetationIndex: null,
    stressLevel:     null,
    lastUpdated:     null,
    recommendationKey: null,
    confidence:      0,
    providerLabel:   'stub',
    _input:          input,
    _version:        SATELLITE_INTELLIGENCE_VERSION,
  });
}

export const SATELLITE_INTELLIGENCE_VERSION = '0.1.0-stub';
