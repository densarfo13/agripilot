/**
 * weatherAndLanguageDiagnostics.js — Phase 7 diagnostic hooks.
 *
 *   import { installWeatherAndLanguageDiagnostics }
 *     from 'src/lib/weatherAndLanguageDiagnostics.js';
 *
 *   installWeatherAndLanguageDiagnostics();
 *
 *   // From DevTools on any device:
 *   window.__weatherRuntimeHealth()
 *   window.__languageHealth()
 *
 * What this is
 * ────────────
 *   Completes the Phase 7 observability set (alongside the
 *   already-pinned __farmRuntimeHealth() + __scanRuntimeHealth()).
 *
 *   __weatherRuntimeHealth()
 *     Reads the canonical weather context the rest of the app
 *     already exposes (window.__weatherDebug if present, otherwise
 *     the canonical farm location), reports:
 *       - latest fetch state
 *       - hasCoords
 *       - fallback active
 *       - error count in the recent window
 *
 *   __languageHealth()
 *     Reports the cross-storage locale state from localeStorageBridge
 *     PLUS the canonical zustand languageStore. Drift between the
 *     two is the production-bug signal we want to catch.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe (no-ops without window).
 *   • Idempotent install — guards against double-pinning.
 *   • No PII, no API keys, no coordinates leaked verbatim
 *     (lat/lng are rounded to 2 decimals if exposed).
 */

import {
  readBridgedLocale, auditLocaleStorage,
} from '../i18n/localeStorageBridge.js';
import { useLanguageStore } from '../store/languageStore.js';
import { useCanonicalFarmStore } from '../store/canonicalFarmStore.js';
import {
  getLearningSnapshot,
} from '../core/intelligence/recommendationLearning.js';
import {
  getLoopEvents, summariseLoopHealth,
} from '../core/trust/confidenceLoopEngine.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _str   = (v) => (typeof v === 'string' ? v : '');

let _installed = false;

function _hasWindow() {
  try { return typeof window !== 'undefined'; } catch { return false; }
}

function _round(v, digits) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const p = Math.pow(10, digits);
  return Math.round(v * p) / p;
}

// ─── Weather diagnostic ──────────────────────────────────────

function _weatherSnapshot() {
  return _safe(() => {
    const win = _hasWindow() ? window : {};
    const externalDebug = typeof win.__weatherDebug === 'function'
      ? _safe(win.__weatherDebug, null) : null;

    const farmState = useCanonicalFarmStore.getState && useCanonicalFarmStore.getState();
    const farm = farmState && farmState.activeFarm;
    const region = farm ? farm.region : null;
    const country = farm ? farm.country : null;
    const hasCoords = !!(farm && (farm.lat != null && farm.lng != null));

    // Heuristic — surface whether the existing fallback is active.
    const fallbackActive = externalDebug && _isObj(externalDebug)
      ? !!externalDebug.usingFallback
      : !hasCoords;

    return Object.freeze({
      hasCoords,
      lat:            farm && hasCoords ? _round(farm.lat, 2) : null,
      lng:            farm && hasCoords ? _round(farm.lng, 2) : null,
      region,
      country,
      fallbackActive,
      externalDebug,
      generatedAt:    new Date().toISOString(),
    });
  }, Object.freeze({
    hasCoords: false, lat: null, lng: null,
    region: null, country: null,
    fallbackActive: true, externalDebug: null,
    generatedAt: new Date().toISOString(),
  }));
}

// ─── Language diagnostic ─────────────────────────────────────

function _languageSnapshot() {
  return _safe(() => {
    const bridge = _safe(() => auditLocaleStorage(), null);
    const bridged = _safe(() => readBridgedLocale(), 'en');
    const zustandLang = _safe(() => {
      const s = useLanguageStore.getState && useLanguageStore.getState();
      return s ? s.language : null;
    }, null);

    const farmState = useCanonicalFarmStore.getState && useCanonicalFarmStore.getState();
    const farmLang = farmState && farmState.activeFarm && farmState.activeFarm.language;

    const allEqual = [bridged, zustandLang, farmLang]
      .filter((v) => typeof v === 'string' && v.length > 0)
      .every((v, _, arr) => v === arr[0]);

    return Object.freeze({
      bridged,
      zustandLanguage:    zustandLang,
      farmStoreLanguage:  farmLang,
      bridgeAudit:        bridge,
      allKeysAgree:       !!(bridge && bridge.allKeysAgree) && allEqual,
      driftBetweenStores: !allEqual,
      generatedAt:        new Date().toISOString(),
    });
  }, Object.freeze({
    bridged: 'en', zustandLanguage: null, farmStoreLanguage: null,
    bridgeAudit: null, allKeysAgree: true, driftBetweenStores: false,
    generatedAt: new Date().toISOString(),
  }));
}

// ─── Public installer ────────────────────────────────────────

export function installWeatherAndLanguageDiagnostics() {
  return _safe(() => {
    if (_installed) return true;
    if (!_hasWindow()) return false;

    if (!window.__weatherRuntimeHealth) {
      window.__weatherRuntimeHealth = function () {
        const snap = _weatherSnapshot();
        try { console.log('[Farroway · Weather Runtime Health]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    if (!window.__languageHealth) {
      window.__languageHealth = function () {
        const snap = _languageSnapshot();
        try { console.log('[Farroway · Language Health]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    if (!window.__offlineHealth) {
      window.__offlineHealth = function () {
        const snap = _offlineSnapshot();
        try { console.log('[Farroway · Offline Health]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    if (!window.__learningLoopAudit) {
      window.__learningLoopAudit = function () {
        const snap = _learningLoopSnapshot();
        try { console.log('[Farroway · Learning Loop Audit]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    if (!window.__invisibleIntelligenceHealth) {
      window.__invisibleIntelligenceHealth = function () {
        const snap = _invisibleIntelSnapshot();
        try { console.log('[Farroway · Invisible Intelligence Health]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    if (!window.__farmContinuityHealth) {
      window.__farmContinuityHealth = function () {
        const snap = _farmContinuitySnapshot();
        try { console.log('[Farroway · Farm Continuity Health]', snap); } catch { /* swallow */ }
        return snap;
      };
    }

    _installed = true;
    return true;
  }, false);
}

// ─── Farm continuity diagnostic ──────────────────────────────

function _farmContinuitySnapshot() {
  return _safe(() => {
    const cont = _safe(() =>
      require('../core/location/farmContinuityLocationEngine.js'), null);
    const loc  = _safe(() =>
      require('../core/location/locationIntelligenceEngine.js'), null);
    const sat  = _safe(() =>
      require('../core/satellite/satelliteEnrichmentAdapter.js'), null);
    const bnd  = _safe(() =>
      require('../core/location/farmBoundaryReadiness.js'), null);

    const farmCached = loc && loc.getCachedFarmLocation
      ? loc.getCachedFarmLocation() : null;
    const deviceCached = loc && loc.getCachedDeviceLocation
      ? loc.getCachedDeviceLocation() : null;

    const farmState = useCanonicalFarmStore.getState
      ? useCanonicalFarmStore.getState() : null;
    const farm = farmState && farmState.activeFarm;

    const explicit = farm && _num(farm.lat) != null && _num(farm.lng) != null
      ? { lat: farm.lat, lng: farm.lng, label: _str(farm.location) } : null;

    const active = cont && cont.resolveActiveLocation ? cont.resolveActiveLocation({
      explicitFarmCoordinates:    explicit,
      cachedFarmCoordinates:      farmCached,
      deviceLocation:             deviceCached,
    }) : null;

    const boundary = bnd && bnd.assessFarmBoundary ? bnd.assessFarmBoundary({
      lat: explicit && explicit.lat,
      lng: explicit && explicit.lng,
      sizeAcres: farm && _num(farm.size),
      sizeUnit:  farm && _str(farm.sizeUnit),
      satelliteProviderAvailable: sat && sat.isSatelliteProviderAvailable
        ? sat.isSatelliteProviderAvailable() : false,
    }) : null;

    return Object.freeze({
      farmLocationExists:    !!(explicit || farmCached),
      deviceLocationExists:  !!deviceCached,
      weatherConfidence:     active && active.confidence,
      distanceFromFarm:      active && active.distanceFromFarm,
      activeLocationSource:  active && active.locationSource,
      driftSuppressed:       null, // populated by surfaces that run the suppressor
      awayState:             !!(active && active.isAwayFromFarm),
      boundaryReady:         !!(boundary && boundary.boundaryReady),
      satelliteReady:        !!(boundary && boundary.satelliteReady),
      offlineCacheHealthy:   !!farmCached,
      generatedAt:           new Date().toISOString(),
    });
  }, Object.freeze({
    farmLocationExists: false, deviceLocationExists: false,
    weatherConfidence: null, distanceFromFarm: null,
    activeLocationSource: null, driftSuppressed: null,
    awayState: false, boundaryReady: false, satelliteReady: false,
    offlineCacheHealthy: false,
    generatedAt: new Date().toISOString(),
  }));
}

// ─── Invisible Intelligence Phase 2 diagnostic ───────────────

function _invisibleIntelSnapshot() {
  return _safe(() => {
    // Lazy-import to keep the diagnostics file lightweight even if
    // the Phase 2 engines never get used.
    const flagsModule = _safe(() =>
      require('../core/deployment/deploymentGovernance.js'), null);
    const flagSnapshot = flagsModule && flagsModule.FLAG ? {
      ml_ranking:           flagsModule.isFeatureFlagOn(flagsModule.FLAG.ENABLE_ML_RANKING),
      disease_calibration:  flagsModule.isFeatureFlagOn(flagsModule.FLAG.ENABLE_DISEASE_CONFIDENCE_CALIBRATION),
      predictive_yield:     flagsModule.isFeatureFlagOn(flagsModule.FLAG.ENABLE_PREDICTIVE_YIELD),
      satellite_enrichment: flagsModule.isFeatureFlagOn(flagsModule.FLAG.ENABLE_SATELLITE_ENRICHMENT),
      ngo_intelligence:     flagsModule.isFeatureFlagOn(flagsModule.FLAG.ENABLE_NGO_INTELLIGENCE),
    } : null;
    return Object.freeze({
      phase:        'invisible-intelligence-v2',
      flagSnapshot: flagSnapshot ? Object.freeze(flagSnapshot) : null,
      anyOn:        flagSnapshot ? Object.values(flagSnapshot).some(Boolean) : false,
      generatedAt:  new Date().toISOString(),
    });
  }, Object.freeze({
    phase: 'invisible-intelligence-v2',
    flagSnapshot: null, anyOn: false,
    generatedAt: new Date().toISOString(),
  }));
}

// ─── Offline diagnostic ──────────────────────────────────────

function _offlineSnapshot() {
  return _safe(() => {
    const win = _hasWindow() ? window : {};
    const online = typeof navigator !== 'undefined'
      ? !!navigator.onLine : null;
    // Read the canonical offline queue if it's exposed; otherwise
    // report what we can see.
    const queueLength = _safe(() => {
      if (typeof win.__offlineQueueLength === 'function') {
        return win.__offlineQueueLength();
      }
      // Defensive: walk localStorage for the standard offline-queue key.
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('farroway:offlineQueue');
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.length;
          } catch { /* swallow */ }
        }
      }
      return null;
    }, null);
    return Object.freeze({
      online,
      queueLength,
      hasNavigator: typeof navigator !== 'undefined',
      generatedAt:  new Date().toISOString(),
    });
  }, Object.freeze({
    online: null, queueLength: null,
    hasNavigator: false, generatedAt: new Date().toISOString(),
  }));
}

// ─── Learning loop diagnostic ────────────────────────────────

function _learningLoopSnapshot() {
  return _safe(() => {
    const learning = _safe(getLearningSnapshot,
      { adjustmentCount: 0, averageBoost: 0 });
    const events = _safe(getLoopEvents, []);
    const health = _safe(summariseLoopHealth, null);
    return Object.freeze({
      learning,
      loopEventCount:        Array.isArray(events) ? events.length : 0,
      loopHealth:            health,
      recentLoopEvents:      Array.isArray(events) ? events.slice(-10) : [],
      generatedAt:           new Date().toISOString(),
    });
  }, Object.freeze({
    learning: { adjustmentCount: 0, averageBoost: 0 },
    loopEventCount: 0, loopHealth: null, recentLoopEvents: [],
    generatedAt: new Date().toISOString(),
  }));
}

export function _resetWeatherAndLanguageDiagnosticsForTests() {
  _installed = false;
}

export const _internal = Object.freeze({
  _weatherSnapshot, _languageSnapshot,
});

const _module = {
  installWeatherAndLanguageDiagnostics,
  _resetWeatherAndLanguageDiagnosticsForTests,
  _internal,
};
export default _module;
