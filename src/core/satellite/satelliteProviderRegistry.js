/**
 * satelliteProviderRegistry.js — architecture-only seam for a
 * future satellite-imagery provider.
 *
 *   import { listSatelliteProviders, getSatelliteProvider }
 *     from 'src/core/satellite/satelliteProviderRegistry.js';
 *
 * What it is
 * ──────────
 *   A FROZEN registry of satellite-imagery providers Farroway
 *   could plug in later. Every entry currently has
 *   `enabled: false` — no real provider is wired. This module
 *   is the SEAM: flipping an entry's enabled flag and supplying
 *   credentials is a config-only change.
 *
 * What it is NOT
 *   • A live integration. There is no real satellite data.
 *   • A map renderer. UI work is out of scope.
 *   • A billable subscription. No API keys leave this file.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe. Frozen data.
 */

const REGISTRY = Object.freeze({
  sentinel_hub: Object.freeze({
    id:           'sentinel_hub',
    label:        'Sentinel Hub',
    enabled:      false,
    capabilities: Object.freeze(['ndvi', 'true_color', 'historical']),
    notes:        'European Sentinel-2 free tier — needs API key.',
  }),
  planet_basemaps: Object.freeze({
    id:           'planet_basemaps',
    label:        'Planet Basemaps',
    enabled:      false,
    capabilities: Object.freeze(['true_color', 'monthly_composite']),
    notes:        'Commercial high-cadence basemaps — paid tier.',
  }),
  modis: Object.freeze({
    id:           'modis',
    label:        'NASA MODIS',
    enabled:      false,
    capabilities: Object.freeze(['ndvi', 'lst', 'historical']),
    notes:        'Free coarse-resolution (250 m) public dataset.',
  }),
  none: Object.freeze({
    id:           'none',
    label:        'No satellite provider',
    enabled:      true,
    capabilities: Object.freeze([]),
    notes:        'Default — satellite features disabled.',
  }),
});

export function listSatelliteProviders() {
  return Object.values(REGISTRY).map((p) => ({ ...p }));
}

export function getSatelliteProvider(id) {
  const key = String(id || '').toLowerCase();
  return REGISTRY[key] ? { ...REGISTRY[key] } : { ...REGISTRY.none };
}

/** Whether any non-`none` provider is currently enabled. */
export function isSatelliteEnabled() {
  return Object.values(REGISTRY)
    .filter((p) => p.id !== 'none')
    .some((p) => p.enabled === true);
}

const _module = {
  listSatelliteProviders, getSatelliteProvider, isSatelliteEnabled,
};
export default _module;
