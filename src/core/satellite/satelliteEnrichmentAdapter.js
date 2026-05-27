/**
 * satelliteEnrichmentAdapter.js — Phase 2 §5.
 *
 *   import { fetchSatelliteEnrichment, registerSatelliteProvider }
 *     from 'src/core/satellite/satelliteEnrichmentAdapter.js';
 *
 *   const v = await fetchSatelliteEnrichment({
 *     farmBoundary, lat, lng, crop, region, dateRange,
 *   });
 *
 *   v = {
 *     vegetationTrend,         — { key, fallback } | null
 *     moistureStressSignal,    — { key, fallback } | null
 *     anomalyDetected,         — boolean
 *     provider,                — string | null
 *     available,               — boolean
 *     dataQuality,             — 'low' | 'medium' | 'high' | 'none'
 *     nextAction,              — { key, fallback } | null
 *     engineVersion:'satellite-adapter-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   Adapter pattern over a future Sentinel Hub / Planet Labs / etc.
 *   provider. NO hard dependency — if no provider is registered
 *   OR the flag is OFF OR data quality is insufficient, returns
 *   `available: false` with a calm fallback envelope.
 *
 *   Surfaces using this adapter MUST treat `available: false` as
 *   "do not surface this data". The adapter never makes claims
 *   without a provider.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Async-safe — never blocks the caller.
 *   • No fetches without a registered provider.
 *   • No exact claims — narrative only.
 */

import { FLAG, isFeatureFlagOn } from '../deployment/deploymentGovernance.js';
import { gateEngine } from '../intelligence/dataQualityGate.js';

const ENGINE_VERSION = 'satellite-adapter-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

let _provider = null;

/**
 * Register a satellite provider adapter. Provider signature:
 *
 *   async function fetchTile(opts) → {
 *     vegetationTrend?: 'rising' | 'flat' | 'falling',
 *     moistureStress?:  'low'    | 'medium' | 'high',
 *     anomalyDetected?: boolean,
 *     dataQuality?:     'low'    | 'medium' | 'high',
 *     name?:            string,
 *   }
 *
 * Idempotent — registering null clears the provider.
 */
export function registerSatelliteProvider(provider) {
  _provider = (typeof provider === 'function') ? provider : null;
  return _provider != null;
}

/** Is a provider currently registered? Used by farm-boundary readiness. */
export function isSatelliteProviderAvailable() {
  return _provider != null;
}

/**
 * Readiness probe — returns the structural flags the caller (e.g.
 * farmContinuityHealth diagnostic) reports without firing any
 * network call. Compose with `assessFarmBoundary` upstream.
 *
 *   { farmBoundaryReady, satelliteEligibility, ndviReady,
 *     moistureSignalReady, provider }
 */
export function probeSatelliteReadiness(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const farmBoundaryReady = !!safe.farmBoundaryReady;
    const flagOn = isFeatureFlagOn(FLAG.ENABLE_SATELLITE_ENRICHMENT);
    const providerAvailable = isSatelliteProviderAvailable();
    const eligible = flagOn && providerAvailable && farmBoundaryReady;
    return Object.freeze({
      farmBoundaryReady,
      satelliteEligibility: eligible,
      ndviReady:            eligible,
      moistureSignalReady:  eligible,
      provider:             providerAvailable ? 'registered' : null,
      flagOn,
      generatedAt:          Date.now(),
    });
  }, Object.freeze({
    farmBoundaryReady:    false,
    satelliteEligibility: false,
    ndviReady:            false,
    moistureSignalReady:  false,
    provider:             null,
    flagOn:               false,
    generatedAt:          Date.now(),
  }));
}

function _vegetationTrendEnvelope(trend) {
  if (trend === 'rising') return Object.freeze({
    key: 'satEnrich.vegetation.rising',
    fallback: 'Canopy is filling in — growth looks healthy from above.',
  });
  if (trend === 'falling') return Object.freeze({
    key: 'satEnrich.vegetation.falling',
    fallback: 'Canopy density may be dropping — worth a closer look.',
  });
  if (trend === 'flat') return Object.freeze({
    key: 'satEnrich.vegetation.flat',
    fallback: 'Canopy is holding steady.',
  });
  return null;
}

function _moistureStressEnvelope(stress) {
  if (stress === 'high') return Object.freeze({
    key: 'satEnrich.moisture.high',
    fallback: 'The field looks drier than usual from above.',
  });
  if (stress === 'medium') return Object.freeze({
    key: 'satEnrich.moisture.medium',
    fallback: 'Soil moisture from above looks borderline.',
  });
  return null;
}

function _nextActionFor(trend, stress, anomaly) {
  if (anomaly) return Object.freeze({
    key:      'satEnrich.action.checkAnomaly',
    fallback: 'Take a closer field walk — the canopy reading is unusual.',
  });
  if (stress === 'high') return Object.freeze({
    key:      'satEnrich.action.checkWater',
    fallback: 'Plan deeper watering in the cooler hours.',
  });
  if (trend === 'falling') return Object.freeze({
    key:      'satEnrich.action.checkLowerLeaves',
    fallback: 'Inspect lower leaves for early signs of stress.',
  });
  return null;
}

function _unavailableEnvelope(reason) {
  return Object.freeze({
    engineVersion:        ENGINE_VERSION,
    vegetationTrend:      null,
    moistureStressSignal: null,
    anomalyDetected:      false,
    provider:             null,
    available:            false,
    dataQuality:          'none',
    nextAction:           null,
    reasonHidden:         reason || 'unavailable',
    generatedAt:          Date.now(),
  });
}

/**
 * Fetch satellite enrichment. Always returns an envelope; never
 * throws. Async — returns a promise.
 */
export async function fetchSatelliteEnrichment(input) {
  return _safe(async () => {
    const safe = _isObj(input) ? input : {};
    const flagOn = isFeatureFlagOn(FLAG.ENABLE_SATELLITE_ENRICHMENT);
    if (!flagOn) return _unavailableEnvelope('flag_off');
    if (_provider == null) return _unavailableEnvelope('no_provider');
    const gate = gateEngine('satellite_enrichment', safe);
    if (!gate.ready) return _unavailableEnvelope('insufficient_data');

    // Defensive provider call — wrap in try/catch.
    let raw;
    try { raw = await _provider(safe); } catch { return _unavailableEnvelope('provider_error'); }
    if (!_isObj(raw)) return _unavailableEnvelope('provider_empty');

    const trend = _str(raw.vegetationTrend).toLowerCase();
    const stress = _str(raw.moistureStress).toLowerCase();
    const anomaly = !!raw.anomalyDetected;

    return Object.freeze({
      engineVersion:        ENGINE_VERSION,
      vegetationTrend:      _vegetationTrendEnvelope(trend),
      moistureStressSignal: _moistureStressEnvelope(stress),
      anomalyDetected:      anomaly,
      provider:             _str(raw.name) || 'registered',
      available:            true,
      dataQuality:          _str(raw.dataQuality).toLowerCase() || 'medium',
      nextAction:           _nextActionFor(trend, stress, anomaly),
      generatedAt:          Date.now(),
    });
  }, _unavailableEnvelope('adapter_error'));
}

export const _internal = Object.freeze({
  _vegetationTrendEnvelope, _moistureStressEnvelope, _nextActionFor,
  _unavailableEnvelope, ENGINE_VERSION,
  get _provider() { return _provider; },
});

const _module = {
  fetchSatelliteEnrichment, registerSatelliteProvider,
  isSatelliteProviderAvailable, probeSatelliteReadiness,
  _internal,
};
export default _module;
