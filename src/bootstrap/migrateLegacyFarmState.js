/**
 * migrateLegacyFarmState.js — boot-time sweep of the 13 legacy farm
 * storage keys into the canonical zustand key (spec §2).
 *
 *   import { migrateLegacyFarmState }
 *     from 'src/bootstrap/migrateLegacyFarmState.js';
 *
 *   // in App.jsx mount effect:
 *   migrateLegacyFarmState();
 *
 * Behavior
 * ────────
 *   • If the canonical key exists → drop every legacy key (they are
 *     stale by definition and create cross-screen drift).
 *   • If the canonical key does NOT exist → walk the legacy keys in
 *     priority order, lift the first one into the canonical slot
 *     under the zustand-persist shape `{ state: { activeFarm }, version }`,
 *     then drop every legacy key.
 *   • Never throws — logs on error and degrades.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe (no-ops without localStorage).
 *   • Synchronous; called once at app mount.
 */

import {
  CANONICAL_FARM_STORAGE_KEY, DEFAULT_FARM,
} from '../store/canonicalFarmStore.js';
import {
  normalizeFarmShape,
} from '../core/farm/farmContextStore.js';

// Keys in priority order — first match wins when promoting to canonical.
const LEGACY_KEYS = Object.freeze([
  // Newer first (more likely to be authoritative).
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
  // Bare keys used by older code paths.
  'farm',
  'farmData',
  'myFarm',
  'selectedFarm',
  'currentFarm',
  'gardenFarm',
  'userFarm',
  'farmProfile',
  'activeFarm',
  'farmStore',
  'farm_context',
  'farm-state',
  'crop-store',
]);

function _has(key) {
  try {
    return typeof localStorage !== 'undefined'
      && localStorage.getItem(key) !== null;
  } catch { return false; }
}

function _read(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  } catch { return null; }
}

function _remove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch { /* swallow */ }
}

function _writeCanonical(activeFarm) {
  try {
    if (typeof localStorage === 'undefined') return;
    // Match the zustand/persist envelope shape so the store reads
    // it back correctly on first hydrate.
    const envelope = {
      state:   { activeFarm },
      version: 2,
    };
    localStorage.setItem(
      CANONICAL_FARM_STORAGE_KEY,
      JSON.stringify(envelope),
    );
  } catch { /* swallow */ }
}

/**
 * Run the migration. Returns a structural summary the test suite
 * + production diagnostics consume.
 *
 *   {
 *     canonicalExisted, promotedFrom, promotedFarm,
 *     droppedKeys, summary, ranAt,
 *   }
 */
export function migrateLegacyFarmState() {
  const result = {
    canonicalExisted: false,
    promotedFrom:     null,
    promotedFarm:     null,
    droppedKeys:      [],
    summary:          'noop',
    ranAt:            new Date().toISOString(),
  };

  try {
    if (typeof localStorage === 'undefined') {
      result.summary = 'ssr_noop';
      return result;
    }

    const canonicalExists = _has(CANONICAL_FARM_STORAGE_KEY);
    result.canonicalExisted = canonicalExists;

    if (canonicalExists) {
      // Canonical wins — drop every legacy key.
      for (const key of LEGACY_KEYS) {
        if (_has(key)) {
          _remove(key);
          result.droppedKeys.push(key);
        }
      }
      result.summary = result.droppedKeys.length > 0
        ? 'canonical_present_cleaned_legacy'
        : 'canonical_present_already_clean';
      return result;
    }

    // No canonical yet — promote the first legacy hit.
    for (const key of LEGACY_KEYS) {
      const raw = _read(key);
      if (!raw) continue;

      // Some legacy payloads are zustand envelopes ({state:{activeFarm}}),
      // others are the bare farm object. Normalize either shape.
      const candidate = (raw && raw.state && raw.state.activeFarm)
        || raw.activeFarm
        || raw;

      const normalized = (() => {
        try {
          const n = normalizeFarmShape(candidate);
          // Map our farmContextStore canonical shape → DEFAULT_FARM shape.
          return {
            ...DEFAULT_FARM,
            id:               n.id || '',
            name:             n.name || '',
            crop:             n.cropId || '',
            cropDisplayName:  n.localizedCropName || '',
            type:             n.type || 'farm',
            location:         n.location || '',
            country:          n.country || '',
            region:           n.region || '',
            stage:            n.lifecycleStage || n.stage || '',
            size:             n.size != null ? String(n.size) : '',
            createdAt:        n.createdAt || Date.now(),
          };
        } catch {
          return null;
        }
      })();

      if (!normalized) continue;
      if (!normalized.crop && !normalized.name && !normalized.id) continue;

      _writeCanonical(normalized);
      result.promotedFrom = key;
      result.promotedFarm = normalized;
      break;
    }

    // Drop every legacy key regardless of promote outcome.
    for (const key of LEGACY_KEYS) {
      if (_has(key)) {
        _remove(key);
        result.droppedKeys.push(key);
      }
    }

    result.summary = result.promotedFrom
      ? 'promoted_legacy_to_canonical'
      : 'no_legacy_signal_found';
    return result;
  } catch (err) {
    try {
      console.error('[farroway] legacy farm migration failed:', err);
    } catch { /* swallow */ }
    result.summary = 'error';
    return result;
  }
}

export const LEGACY_FARM_KEYS = LEGACY_KEYS;

const _module = { migrateLegacyFarmState, LEGACY_FARM_KEYS };
export default _module;
