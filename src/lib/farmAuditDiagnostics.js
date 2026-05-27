/**
 * farmAuditDiagnostics.js — pin window.__farmAudit() and
 * window.__hardResetFarroway() (spec §16 + §17).
 *
 *   import { installFarmAuditDiagnostics }
 *     from 'src/lib/farmAuditDiagnostics.js';
 *
 *   installFarmAuditDiagnostics();
 *
 * What this is
 * ────────────
 *   `window.__farmAudit()` returns a snapshot showing whether the
 *   canonical zustand key is populated AND lists any legacy keys
 *   still lingering in localStorage. Use it in DevTools on a
 *   real device to confirm the migration worked.
 *
 *   `window.__hardResetFarroway()` is the nuclear recovery hook —
 *   clears localStorage AND every cache the service worker holds,
 *   then reloads. Reserved for the rare case where a stale bundle
 *   survives normal reloads.
 *
 *   Idempotent — calling installFarmAuditDiagnostics() twice is a
 *   no-op. Both functions degrade silently on SSR / locked-down
 *   environments.
 */

import {
  CANONICAL_FARM_STORAGE_KEY,
} from '../store/canonicalFarmStore.js';
import { LANGUAGE_STORAGE_KEY } from '../store/languageStore.js';

const LEGACY_KEYS_PROBE = Object.freeze([
  'farm', 'farmData', 'myFarm',
  'selectedFarm', 'currentFarm', 'gardenFarm', 'userFarm',
  'farmProfile', 'activeFarm', 'farmStore',
  'farm_context', 'farm-state', 'crop-store',
  'farroway:activeFarm:v1',
  'farroway:onboardingFarm',
  'farroway:onboardingDraft',
  'farroway:selectedFarm',
  'farroway:currentFarm',
  'farroway:taskFarm',
  'farroway:gardenFarm',
  'farroway:farmDraft',
  'farroway:profileSetup',
  'farroway:scan:lastFarm',
  'farroway:journal:lastFarm',
]);

function _safe(fn, fb) {
  try { return fn(); } catch { return fb; }
}

function _readCanonical() {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CANONICAL_FARM_STORAGE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }, null);
}

function _listLingeringLegacy() {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return [];
    return LEGACY_KEYS_PROBE.filter((k) => {
      try { return localStorage.getItem(k) != null; }
      catch { return false; }
    });
  }, []);
}

export function runFarmAudit() {
  return _safe(() => {
    const canonical = _readCanonical();
    const legacy = _listLingeringLegacy();
    return Object.freeze({
      canonicalExists:     canonical != null,
      canonicalData:       canonical,
      legacyKeysRemaining: Object.freeze(legacy),
      canonicalKey:        CANONICAL_FARM_STORAGE_KEY,
      languageKey:         LANGUAGE_STORAGE_KEY,
      clean:               legacy.length === 0,
      generatedAt:         new Date().toISOString(),
    });
  }, Object.freeze({
    canonicalExists: false,
    canonicalData:   null,
    legacyKeysRemaining: Object.freeze([]),
    canonicalKey:    CANONICAL_FARM_STORAGE_KEY,
    languageKey:     LANGUAGE_STORAGE_KEY,
    clean:           true,
    generatedAt:     new Date().toISOString(),
  }));
}

async function _hardReset() {
  try {
    if (typeof localStorage !== 'undefined') {
      try { localStorage.clear(); } catch { /* swallow */ }
    }
    if (typeof caches !== 'undefined' && caches && typeof caches.keys === 'function') {
      try {
        const keys = await caches.keys();
        await Promise.all((keys || []).map((k) => caches.delete(k)));
      } catch { /* swallow */ }
    }
    if (typeof location !== 'undefined' && typeof location.reload === 'function') {
      try { location.reload(); } catch { /* swallow */ }
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Pin the diagnostic globals. Idempotent + SSR-safe.
 */
export function installFarmAuditDiagnostics() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;

    if (!window.__farmAudit) {
      window.__farmAudit = function () {
        const snap = runFarmAudit();
        try { console.log('[Farroway · Farm Audit]', snap); } catch { /* swallow */ }
        return snap;
      };
    }
    if (!window.__hardResetFarroway) {
      window.__hardResetFarroway = _hardReset;
    }
    return true;
  }, false);
}

const _module = {
  installFarmAuditDiagnostics, runFarmAudit, LEGACY_KEYS_PROBE,
};
export default _module;
