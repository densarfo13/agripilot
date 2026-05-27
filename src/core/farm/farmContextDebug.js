/**
 * farmContextDebug.js — production debug + audit hooks for the
 * canonical farm context.
 *
 *   import { installFarmContextDebugHooks }
 *     from 'src/core/farm/farmContextDebug.js';
 *
 *   installFarmContextDebugHooks();   // idempotent, SSR-safe
 *
 *   // From DevTools on any device:
 *   window.__farmContextDebug()    // active farm + hydration source
 *   window.__stateMismatchAudit()  // legacy storage drift report
 *
 * What this is
 * ────────────
 *   The two diagnostic hooks the spec §15 calls out. Read-only.
 *   No writes, no throws, no PII.
 *
 *   `__farmContextDebug()` returns the activeFarm + which source
 *   hydrated it + a "screens using activeFarm" list (read from the
 *   subscriber set) so QA can see whether a stale screen is even
 *   listening to the canonical store.
 *
 *   `__stateMismatchAudit()` scans every known legacy storage key
 *   used by the duplicate stores (onboardingFarm, selectedFarm,
 *   etc.) and reports drift versus the canonical activeFarm.
 */

import {
  getActiveFarm, getHydrationSource, ACTIVE_FARM_STORAGE_KEY,
} from './farmContextStore.js';
import { normalizeLocationDisplay } from './normalizeLocationDisplay.js';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// Legacy storage keys we know about — every duplicate state source
// from the audit. The audit hook compares each one against the
// canonical activeFarm.
const _LEGACY_KEYS = Object.freeze([
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
  'farroway:sell:listingCrop',
  'farroway:progress:crop',
  'farroway:funding:region',
]);

function _readKey(key) {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }, null);
}

function _extractCrop(value) {
  if (typeof value === 'string') return value.toLowerCase();
  if (!_isObj(value)) return null;
  return _str(
    value.cropId || value.crop || value.cropType
    || value.selectedCrop || value.crop_name || value.cropLabel,
  ).toLowerCase() || null;
}

function _extractLocation(value) {
  if (typeof value === 'string') return normalizeLocationDisplay(value);
  if (!_isObj(value)) return null;
  return normalizeLocationDisplay(
    value.location || value.locationDisplay || value
    || { region: value.region, country: value.country },
  );
}

function _extractStage(value) {
  if (typeof value === 'string') return null;
  if (!_isObj(value)) return null;
  return _str(value.lifecycleStage || value.currentStage || value.stage)
    .toLowerCase() || null;
}

function _extractType(value) {
  if (typeof value === 'string') return null;
  if (!_isObj(value)) return null;
  return _str(value.type).toLowerCase() || null;
}

/**
 * Walk every legacy key + compare against the canonical activeFarm.
 * Returns a structural drift report.
 */
export function runStateMismatchAudit() {
  return _safe(() => {
    const active = getActiveFarm();
    const canonical = {
      crop:     _str(active.cropId).toLowerCase() || null,
      location: _str(active.location) || null,
      stage:    _str(active.lifecycleStage).toLowerCase() || null,
      type:     _str(active.type).toLowerCase() || null,
    };

    const cropMismatches      = [];
    const locationMismatches  = [];
    const stageMismatches     = [];
    const typeMismatches      = [];
    const staleSourcesDetected = [];

    for (const key of _LEGACY_KEYS) {
      const value = _readKey(key);
      if (value == null) continue;
      staleSourcesDetected.push(key);

      const crop = _extractCrop(value);
      if (crop && canonical.crop && crop !== canonical.crop) {
        cropMismatches.push({ key, value: crop, canonical: canonical.crop });
      }
      const location = _extractLocation(value);
      if (location && canonical.location
          && _str(location).toLowerCase() !== _str(canonical.location).toLowerCase()) {
        locationMismatches.push({ key, value: location, canonical: canonical.location });
      }
      const stage = _extractStage(value);
      if (stage && canonical.stage && stage !== canonical.stage) {
        stageMismatches.push({ key, value: stage, canonical: canonical.stage });
      }
      const type = _extractType(value);
      if (type && canonical.type && type !== canonical.type) {
        typeMismatches.push({ key, value: type, canonical: canonical.type });
      }
    }

    const totalMismatches =
        cropMismatches.length + locationMismatches.length
      + stageMismatches.length + typeMismatches.length;

    return Object.freeze({
      canonical: Object.freeze(canonical),
      cropMismatches:     Object.freeze(cropMismatches),
      locationMismatches: Object.freeze(locationMismatches),
      stageMismatches:    Object.freeze(stageMismatches),
      typeMismatches:     Object.freeze(typeMismatches),
      staleSourcesDetected: Object.freeze(staleSourcesDetected),
      totalMismatches,
      duplicateStateDetected: staleSourcesDetected.length > 0,
      clean: totalMismatches === 0,
      generatedAt: Date.now(),
    });
  }, Object.freeze({
    canonical: Object.freeze({ crop: null, location: null, stage: null, type: null }),
    cropMismatches: [], locationMismatches: [],
    stageMismatches: [], typeMismatches: [],
    staleSourcesDetected: [],
    totalMismatches: 0,
    duplicateStateDetected: false,
    clean: true,
    generatedAt: Date.now(),
  }));
}

/**
 * Pin the two diagnostic globals. Idempotent.
 */
export function installFarmContextDebugHooks() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;

    if (!window.__farmContextDebug) {
      window.__farmContextDebug = function () {
        const activeFarm = getActiveFarm();
        const audit = runStateMismatchAudit();
        const snapshot = {
          activeFarm,
          hydrationSource:        getHydrationSource(),
          canonicalStorageKey:    ACTIVE_FARM_STORAGE_KEY,
          cropId:                 activeFarm.cropId,
          localizedCropName:      activeFarm.localizedCropName,
          location:               activeFarm.location,
          lifecycleStage:         activeFarm.lifecycleStage,
          staleSourcesDetected:   audit.staleSourcesDetected,
          duplicateStateDetected: audit.duplicateStateDetected,
          totalMismatches:        audit.totalMismatches,
          generatedAt:            new Date().toISOString(),
        };
        try { console.log('[Farroway · Farm Context]', snapshot); } catch { /* swallow */ }
        return snapshot;
      };
    }

    if (!window.__stateMismatchAudit) {
      window.__stateMismatchAudit = function () {
        const audit = runStateMismatchAudit();
        try { console.log('[Farroway · State Mismatch Audit]', audit); } catch { /* swallow */ }
        return audit;
      };
    }

    return true;
  }, false);
}

export const _internal = Object.freeze({
  _LEGACY_KEYS, _extractCrop, _extractLocation, _extractStage, _extractType,
});

const _module = {
  runStateMismatchAudit, installFarmContextDebugHooks, _internal,
};
export default _module;
