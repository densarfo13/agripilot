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

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _isObj = (v) => v != null && typeof v === 'object';

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

    _installed = true;
    return true;
  }, false);
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
