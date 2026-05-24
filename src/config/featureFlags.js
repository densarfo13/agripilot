/**
 * featureFlags.js — Phase 2 intelligence rollout flags.
 *
 *   import { isFeatureEnabled, FEATURE, getFeatureFlags }
 *     from 'src/config/featureFlags.js';
 *
 *   if (isFeatureEnabled(FEATURE.SUPPLIER_INTELLIGENCE)) {
 *     const suggestions = matchSuppliers(ctx);
 *   }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Single source of truth for feature gating during the Phase 2
 *   intelligence rollout. Every advanced capability that isn't
 *   yet ready for 100 % rollout (supplier / marketplace / soil /
 *   satellite / yield / NGO analytics) is gated through here.
 *
 *   It is NOT a remote-config system. Flag values resolve from:
 *     1. localStorage override (per-user, manual QA) — highest
 *     2. import.meta.env (build-time env) — production rollout
 *     3. Built-in DEFAULTS — final fallback (always OFF-safe)
 *
 *   This ordering means an operator can flip a flag for one
 *   beta user via DevTools without changing code. Production
 *   rollout uses the build-time env path so the values are
 *   bundled, not fetched.
 *
 *   OFF-safe means: a user with no flag set sees the existing
 *   stable surface. New capability is opt-in until it is proven
 *   in the cohort that received it.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe (guards localStorage +
 *     import.meta access).
 */

export const FEATURE = Object.freeze({
  SUPPLIER_INTELLIGENCE:    'ENABLE_SUPPLIER_INTELLIGENCE',
  MARKETPLACE_INTELLIGENCE: 'ENABLE_MARKETPLACE_INTELLIGENCE',
  SOIL_INTELLIGENCE:        'ENABLE_SOIL_INTELLIGENCE',
  SATELLITE_INTELLIGENCE:   'ENABLE_SATELLITE_INTELLIGENCE',
  YIELD_PREDICTION:         'ENABLE_YIELD_PREDICTION',
  NGO_ANALYTICS:            'ENABLE_NGO_ANALYTICS',
});

// Every feature defaults to OFF. Production rolls them on per
// the spec's Phase 1/2/3 sequence by flipping env vars or
// flipping the per-user localStorage override.
const _DEFAULTS = Object.freeze({
  [FEATURE.SUPPLIER_INTELLIGENCE]:    false,
  [FEATURE.MARKETPLACE_INTELLIGENCE]: false,
  [FEATURE.SOIL_INTELLIGENCE]:        false,
  [FEATURE.SATELLITE_INTELLIGENCE]:   false,
  [FEATURE.YIELD_PREDICTION]:         false,
  [FEATURE.NGO_ANALYTICS]:            false,
});

const _LS_PREFIX = 'farroway_feature_';

function _readLocalOverride(flag) {
  try {
    if (typeof window === 'undefined') return null;
    const ls = window.localStorage;
    if (!ls) return null;
    const raw = ls.getItem(_LS_PREFIX + flag);
    if (raw === 'true')  return true;
    if (raw === 'false') return false;
    return null;
  } catch { return null; }
}

function _readBuildEnv(flag) {
  try {
    const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
    const v = env['VITE_' + flag];
    if (v === 'true' || v === true)   return true;
    if (v === 'false' || v === false) return false;
    return null;
  } catch { return null; }
}

/**
 * Resolve a single feature flag. Order: localStorage override →
 * build-time env → default (false).
 *
 * @param {string} flag a value from the FEATURE table
 * @returns {boolean}
 */
export function isFeatureEnabled(flag) {
  try {
    if (!flag) return false;
    const lo = _readLocalOverride(flag);
    if (lo !== null) return lo;
    const be = _readBuildEnv(flag);
    if (be !== null) return be;
    return !!_DEFAULTS[flag];
  } catch { return false; }
}

/**
 * Set a localStorage override. Useful for per-user beta testing
 * and admin-side QA. Pass `null` to clear the override and fall
 * back to the build-time / default value.
 */
export function setFeatureOverride(flag, value) {
  try {
    if (typeof window === 'undefined') return false;
    const ls = window.localStorage;
    if (!ls) return false;
    if (value === null || value === undefined) {
      ls.removeItem(_LS_PREFIX + flag);
    } else {
      ls.setItem(_LS_PREFIX + flag, value ? 'true' : 'false');
    }
    return true;
  } catch { return false; }
}

/**
 * Snapshot all flags as a plain object for admin diagnostics +
 * the in-app debug panel. Never includes secrets.
 */
export function getFeatureFlags() {
  const out = {};
  for (const flag of Object.values(FEATURE)) {
    out[flag] = isFeatureEnabled(flag);
  }
  return out;
}

const _module = { FEATURE, isFeatureEnabled, setFeatureOverride, getFeatureFlags };
export default _module;
