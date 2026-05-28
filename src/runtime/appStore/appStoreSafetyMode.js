/**
 * appStoreSafetyMode.js — Wave 8 RUNTIME App Store safety enforcer.
 *
 *   import {
 *     installAppStoreSafetyMode, getAppStoreSafetySnapshot,
 *     getSafeFeatureFlags,
 *   } from 'src/runtime/appStore/appStoreSafetyMode.js';
 *
 * What this is
 * ────────────
 *   For App Store submission, certain feature flags must default
 *   OFF to avoid Apple Guideline 4.3 (spam) or 5.1.1 (data) flags.
 *   This module wraps `src/config/features.js` and produces a
 *   "safe view" — the same flag set with explicit overrides for
 *   the flags identified as transactional-but-not-real:
 *
 *     • buyMarketplace          — transactional UI without payment
 *     • marketTransactionFlow   — buyer interest flow incomplete
 *     • marketScale             — paid marketplace tier
 *     • marketRevenueScale      — revenue tier
 *     • multiMarket             — multi-region marketplace
 *     • smartFundingRecommendations — appears to disburse funds
 *
 *   The safety mode does NOT mutate the underlying FEATURES map —
 *   it provides a parallel `getSafeFeatureFlags()` accessor that
 *   the UI is expected to consult when running inside the native
 *   iOS/Android shell. The web build continues to use the raw
 *   feature flags (since waitlists / lead capture are fine on web
 *   for partner discussions).
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Read-only. Does not alter src/config/features.js.
 *   • No PII; the snapshot reports flag names + overridden values.
 */

import { FEATURES, isFeatureEnabled } from '../../config/features.js';

const RUNTIME_VERSION = 'app-store-safety-mode-v1';

// Flags that must be OFF in App Store builds until the transactional
// path is verified end-to-end with a real partner integration.
const APP_STORE_SAFE_DEFAULTS = Object.freeze({
  buyMarketplace:              false,
  marketTransactionFlow:       false,
  marketScale:                 false,
  marketRevenueScale:          false,
  multiMarket:                 false,
  smartFundingRecommendations: false,
  // Funding hub stays on but in "discovery" mode — copy in
  // FundingHub.jsx must use exploratory wording (handled by the
  // copy audit, not enforced here).
});

const _state = {
  installed:        false,
  installedAt:      null,
  nativeShell:      false,
  appStoreMode:     false,
  appliedOverrides: {},
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');
const _hasWindow = () => { try { return typeof window !== 'undefined'; } catch { return false; } };

function _detectNativeShell() {
  return _safe(() => {
    if (!_hasWindow()) return false;
    const c = window.Capacitor;
    if (!c) return false;
    if (typeof c.isNativePlatform === 'function') return c.isNativePlatform();
    return !!c.isNativePlatform;
  }, false);
}

/**
 * Install safety mode. Idempotent. App Store mode is enabled when:
 *   - We're running inside the native Capacitor shell (iOS/Android), OR
 *   - VITE_APP_STORE_MODE env is truthy (explicit flag for QA builds)
 */
export function installAppStoreSafetyMode(opts) {
  if (_state.installed) {
    return Object.freeze({ ok: true, alreadyInstalled: true });
  }
  const native = _detectNativeShell();
  const envFlag = _safe(() =>
    import.meta && import.meta.env
      && (import.meta.env.VITE_APP_STORE_MODE === 'true'
        || import.meta.env.VITE_APP_STORE_MODE === '1'),
  false);
  const explicit = !!(opts && opts.forceAppStoreMode);
  _state.nativeShell = native;
  _state.appStoreMode = native || envFlag || explicit;
  if (_state.appStoreMode) {
    // Record which flags would be overridden — actual override is
    // surfaced via getSafeFeatureFlags() (read by the UI layer).
    for (const [name, safeValue] of Object.entries(APP_STORE_SAFE_DEFAULTS)) {
      const current = _safe(() => isFeatureEnabled(name), false);
      if (current !== safeValue) {
        _state.appliedOverrides[name] = Object.freeze({
          original: current, applied: safeValue,
        });
      }
    }
  }
  _state.installed = true;
  _state.installedAt = _now();
  return Object.freeze({
    ok: true,
    nativeShell:  _state.nativeShell,
    appStoreMode: _state.appStoreMode,
    overrideCount: Object.keys(_state.appliedOverrides).length,
  });
}

/**
 * Read the flag value with App Store overrides applied. If safety
 * mode is OFF, returns the raw isFeatureEnabled value unchanged.
 */
export function isFeatureEnabledSafe(name) {
  if (!_state.installed) installAppStoreSafetyMode();
  if (_state.appStoreMode
      && Object.prototype.hasOwnProperty.call(APP_STORE_SAFE_DEFAULTS, name)) {
    return APP_STORE_SAFE_DEFAULTS[name];
  }
  return _safe(() => isFeatureEnabled(name), false);
}

/**
 * Snapshot of every known flag in current effective state. Drives
 * window.__featureFlags().
 */
export function getSafeFeatureFlags() {
  if (!_state.installed) installAppStoreSafetyMode();
  const flags = {};
  for (const [name, defaultOn] of Object.entries(FEATURES || {})) {
    const raw = !!defaultOn;
    const applied = isFeatureEnabledSafe(name);
    flags[name] = Object.freeze({
      raw,
      applied,
      overridden: raw !== applied,
    });
  }
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    appStoreMode:   _state.appStoreMode,
    nativeShell:    _state.nativeShell,
    overrideCount:  Object.keys(_state.appliedOverrides).length,
    overrides:      Object.freeze({ ..._state.appliedOverrides }),
    flags:          Object.freeze(flags),
  });
}

export function getAppStoreSafetySnapshot() {
  return Object.freeze({
    runtimeVersion:   RUNTIME_VERSION,
    installed:        _state.installed,
    installedAt:      _state.installedAt,
    nativeShell:      _state.nativeShell,
    appStoreMode:     _state.appStoreMode,
    safeDefaults:     APP_STORE_SAFE_DEFAULTS,
    appliedOverrides: Object.freeze({ ..._state.appliedOverrides }),
  });
}

export function _resetForTests() {
  _state.installed = false;
  _state.installedAt = null;
  _state.nativeShell = false;
  _state.appStoreMode = false;
  _state.appliedOverrides = {};
}
