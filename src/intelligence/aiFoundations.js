/**
 * aiFoundations.js — Phase 10 stable interfaces for future AI/ML
 * surfaces. NO ML implementation here — only typed contracts so
 * surfaces can wire to readiness flags TODAY and the actual
 * providers ship behind feature flags LATER.
 *
 *   import {
 *     AI_PROVIDER, getProviderReadiness,
 *     fetchSatelliteSignal, fetchSoilSignal,
 *     classifyDiseaseStub, forecastYieldStub,
 *     voiceAssistantHandshake, predictBuyersStub,
 *   } from 'src/intelligence/aiFoundations.js';
 *
 *   const ready = getProviderReadiness();
 *   if (ready[AI_PROVIDER.DISEASE]) {
 *     // surface enables an advanced UI affordance
 *   } else {
 *     // surface falls back to existing scan flow
 *   }
 *
 * Why an interface module without implementations
 * ───────────────────────────────────────────────
 *   The spec says "do NOT fully implement ML yet — create stable
 *   architecture and interfaces." This file is the contract. It
 *   lets the UI safely call `classifyDiseaseStub(...)` today and
 *   get a calm "not yet ready" envelope. When a real provider
 *   lands, the stub is swapped out with the actual implementation
 *   behind the same signature — zero UI changes.
 *
 *   Every stub returns an envelope the UI already knows how to
 *   render: `{ ok, provider, ready, payload, reason }`.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • No network calls. No imports of any actual ML library.
 *   • Provider readiness reads from src/core/deployment/deploymentGovernance
 *     so a kill-switch off any provider is one env flag away.
 */

import {
  FLAG, isFeatureFlagOn,
} from '../core/deployment/deploymentGovernance.js';

const _isObj = (v) => v != null && typeof v === 'object';
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

export const AI_PROVIDER = Object.freeze({
  SATELLITE:        'satellite',
  SOIL_API:         'soil_api',
  DISEASE:          'disease',
  YIELD:            'yield',
  VOICE_ASSISTANT:  'voice_assistant',
  BUYER_PREDICTION: 'buyer_prediction',
});

const _PROVIDER_FLAG = Object.freeze({
  [AI_PROVIDER.SATELLITE]:        FLAG.SATELLITE_READINESS,
  [AI_PROVIDER.SOIL_API]:         FLAG.SOIL_INTELLIGENCE,
  [AI_PROVIDER.DISEASE]:          FLAG.SCAN_V5_INVISIBLE,
  [AI_PROVIDER.YIELD]:            FLAG.YIELD_PREDICTION,
  // Voice assistant intentionally proxies an OFF-by-default flag
  // until a dedicated VOICE_ASSISTANT flag lands in
  // deploymentGovernance. Pick NGO_ANALYTICS because it's the
  // closest existing default-OFF flag for a "future capability".
  [AI_PROVIDER.VOICE_ASSISTANT]:  FLAG.NGO_ANALYTICS,
  [AI_PROVIDER.BUYER_PREDICTION]: FLAG.MARKETPLACE_INTELLIGENCE,
});

/**
 * Per-provider readiness flags. UI surfaces read this to decide
 * whether to expose an advanced affordance. All providers default
 * OFF in production per deploymentGovernance defaults.
 */
export function getProviderReadiness() {
  return _safe(() => {
    const out = {};
    for (const [provider, flag] of Object.entries(_PROVIDER_FLAG)) {
      out[provider] = isFeatureFlagOn(flag);
    }
    return Object.freeze(out);
  }, Object.freeze(
    Object.fromEntries(Object.values(AI_PROVIDER).map((p) => [p, false])),
  ));
}

function _notReadyEnvelope(provider, reason) {
  return Object.freeze({
    ok:       false,
    provider,
    ready:    false,
    payload:  null,
    reason:   reason || 'provider_not_ready',
    generatedAt: Date.now(),
  });
}

function _placeholderOk(provider, payload) {
  return Object.freeze({
    ok:       true,
    provider,
    ready:    true,
    payload:  payload || null,
    reason:   null,
    generatedAt: Date.now(),
  });
}

// ─── Satellite signal ────────────────────────────────────────

/**
 * Future: NDVI / canopy cover / drought signals from Sentinel-2
 * or planet labs. Today: returns calm placeholder.
 */
export function fetchSatelliteSignal(opts) {
  return _safe(() => {
    const ready = getProviderReadiness()[AI_PROVIDER.SATELLITE];
    if (!ready) return _notReadyEnvelope(AI_PROVIDER.SATELLITE);
    // Stub: surface receives the calm "no-data-yet" payload.
    const o = _isObj(opts) ? opts : {};
    return _placeholderOk(AI_PROVIDER.SATELLITE, {
      requestedRegion: o.region || null,
      ndvi:            null,
      acquisitionDate: null,
    });
  }, _notReadyEnvelope(AI_PROVIDER.SATELLITE, 'stub_error'));
}

// ─── Soil API ────────────────────────────────────────────────

export function fetchSoilSignal(opts) {
  return _safe(() => {
    const ready = getProviderReadiness()[AI_PROVIDER.SOIL_API];
    if (!ready) return _notReadyEnvelope(AI_PROVIDER.SOIL_API);
    const o = _isObj(opts) ? opts : {};
    return _placeholderOk(AI_PROVIDER.SOIL_API, {
      ph:             null,
      moisture:       null,
      organicMatter:  null,
      requestedLatLng: o.latLng || null,
    });
  }, _notReadyEnvelope(AI_PROVIDER.SOIL_API, 'stub_error'));
}

// ─── Disease ML ──────────────────────────────────────────────

export function classifyDiseaseStub(opts) {
  return _safe(() => {
    const ready = getProviderReadiness()[AI_PROVIDER.DISEASE];
    if (!ready) return _notReadyEnvelope(AI_PROVIDER.DISEASE);
    const o = _isObj(opts) ? opts : {};
    return _placeholderOk(AI_PROVIDER.DISEASE, {
      candidates:     [],
      crop:           o.crop || null,
      modelVersion:   null,
    });
  }, _notReadyEnvelope(AI_PROVIDER.DISEASE, 'stub_error'));
}

// ─── Yield prediction ────────────────────────────────────────

export function forecastYieldStub(opts) {
  return _safe(() => {
    const ready = getProviderReadiness()[AI_PROVIDER.YIELD];
    if (!ready) return _notReadyEnvelope(AI_PROVIDER.YIELD);
    const o = _isObj(opts) ? opts : {};
    return _placeholderOk(AI_PROVIDER.YIELD, {
      estimateKg:        null,
      estimateBand:      null,
      crop:              o.crop || null,
      forecastHorizonDays: null,
    });
  }, _notReadyEnvelope(AI_PROVIDER.YIELD, 'stub_error'));
}

// ─── Voice assistant handshake ───────────────────────────────

export function voiceAssistantHandshake(opts) {
  return _safe(() => {
    const ready = getProviderReadiness()[AI_PROVIDER.VOICE_ASSISTANT];
    if (!ready) return _notReadyEnvelope(AI_PROVIDER.VOICE_ASSISTANT);
    const o = _isObj(opts) ? opts : {};
    return _placeholderOk(AI_PROVIDER.VOICE_ASSISTANT, {
      requestedLocale: o.locale || null,
      sessionToken:    null,
      capabilities:    Object.freeze(['stt', 'tts']),
    });
  }, _notReadyEnvelope(AI_PROVIDER.VOICE_ASSISTANT, 'stub_error'));
}

// ─── Buyer prediction ────────────────────────────────────────

export function predictBuyersStub(opts) {
  return _safe(() => {
    const ready = getProviderReadiness()[AI_PROVIDER.BUYER_PREDICTION];
    if (!ready) return _notReadyEnvelope(AI_PROVIDER.BUYER_PREDICTION);
    const o = _isObj(opts) ? opts : {};
    return _placeholderOk(AI_PROVIDER.BUYER_PREDICTION, {
      candidateBuyers:    [],
      requestedCrop:      o.crop || null,
      requestedRegion:    o.region || null,
    });
  }, _notReadyEnvelope(AI_PROVIDER.BUYER_PREDICTION, 'stub_error'));
}

export const _internal = Object.freeze({
  _PROVIDER_FLAG, _notReadyEnvelope, _placeholderOk,
});

const _module = {
  AI_PROVIDER,
  getProviderReadiness,
  fetchSatelliteSignal, fetchSoilSignal,
  classifyDiseaseStub, forecastYieldStub,
  voiceAssistantHandshake, predictBuyersStub,
  _internal,
};
export default _module;
