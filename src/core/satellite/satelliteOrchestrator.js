/**
 * satelliteOrchestrator.js — single entry point for the satellite
 * intelligence layer.
 *
 *   import { orchestrateSatellite, SATELLITE_STATUS }
 *     from 'src/core/satellite/satelliteOrchestrator.js';
 *
 *   const s = orchestrateSatellite({
 *     fieldId: 'f1',
 *     crop: 'tomato',
 *     weather: { temperatureC: 32, rainProbability24hPct: 10 },
 *     nowMs: Date.now(),
 *   });
 *   // s.status      → SATELLITE_STATUS.NO_PROVIDER | UNAVAILABLE | OK
 *   // s.ndvi        → null | { value, label, asOf }
 *   // s.landHealth  → null | { score, label }
 *   // s.anomalies   → []  (empty until a provider is wired)
 *   // s.weatherFused → { temperatureC, rainProbability24hPct, ... }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   The fusion layer over the existing satellite primitives
 *   (satelliteProviderRegistry, fieldBoundaryStore, ndviPlaceholder)
 *   plus the new landHealthEngine + weatherFusionEngine +
 *   fieldAnomalyEngine.
 *
 *   It is ARCHITECTURE-ONLY: until a real Sentinel Hub / Planet /
 *   commercial provider is configured, every output that depends
 *   on imagery returns the honest `NO_PROVIDER` status. The
 *   weather fusion layer still runs because we already have
 *   weather data — the satellite layer just doesn't add any
 *   imagery-derived signal.
 *
 *   This means surfaces can safely call `orchestrateSatellite`
 *   today and degrade silently (`status: 'no_provider'`) until
 *   the provider is wired. No fake field maps, no broken widgets.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe. No network calls (provider
 *     wiring lives in satelliteProviderRegistry).
 */

import { isSatelliteEnabled, getSatelliteProvider } from './satelliteProviderRegistry.js';
import { ndviPlaceholder, labelForNdvi } from './ndviPlaceholder.js';
import { computeLandHealth, LAND_HEALTH_LABEL } from './landHealthEngine.js';
import { fuseWeather } from './weatherFusionEngine.js';
import { detectFieldAnomalies } from './fieldAnomalyEngine.js';

export const SATELLITE_STATUS = Object.freeze({
  NO_PROVIDER:  'no_provider',
  UNAVAILABLE:  'unavailable',
  OK:           'ok',
});

/**
 * @param {object} ctx
 * @returns {object}
 */
export function orchestrateSatellite(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const enabled = isSatelliteEnabled();
    const weatherFused = fuseWeather({ weather: c.weather, satellite: c.satellite });

    if (!enabled) {
      return {
        status:       SATELLITE_STATUS.NO_PROVIDER,
        provider:     getSatelliteProvider().id,
        ndvi:         null,
        landHealth:   null,
        anomalies:    [],
        weatherFused,
        disclaimer:   {
          key:      'satellite.disclaimer.noProvider',
          fallback: 'Satellite imagery is not enabled in your region yet. Guidance uses weather + scans only.',
        },
      };
    }

    // Even when enabled, a single call may not have imagery
    // (cloud cover / re-visit gap). ndviPlaceholder returns the
    // honest fallback when a real value isn't available.
    const ndviRaw = ndviPlaceholder({ fieldId: c.fieldId });
    const ndviValue = ndviRaw && typeof ndviRaw.value === 'number' ? ndviRaw.value : null;
    const ndvi = ndviValue == null ? null : {
      value: ndviValue,
      label: labelForNdvi(ndviValue),
      asOf:  ndviRaw.asOf || null,
    };

    const landHealth = computeLandHealth({ ndvi: ndviValue, weather: c.weather });
    const anomalies  = detectFieldAnomalies({ ndvi: ndviValue, weather: c.weather, scan: c.scan });

    return {
      status:       ndviValue == null ? SATELLITE_STATUS.UNAVAILABLE : SATELLITE_STATUS.OK,
      provider:     getSatelliteProvider().id,
      ndvi,
      landHealth,
      anomalies,
      weatherFused,
    };
  } catch {
    return {
      status:       SATELLITE_STATUS.UNAVAILABLE,
      provider:     'none',
      ndvi:         null,
      landHealth:   null,
      anomalies:    [],
      weatherFused: null,
    };
  }
}

export { LAND_HEALTH_LABEL };
const _module = { SATELLITE_STATUS, LAND_HEALTH_LABEL, orchestrateSatellite };
export default _module;
