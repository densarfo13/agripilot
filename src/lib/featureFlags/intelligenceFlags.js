/**
 * intelligenceFlags.js — the 5 named feature flags for the Context
 * + Recommendation Engine spec.
 *
 *   if (isIntelligenceFlagOn('FEATURE_SOIL_CONTEXT')) {
 *     soil = await fetchSoilForCoords(lat, lng);
 *   }
 *
 * Why a named registry
 * ────────────────────
 *   The spec mandates 5 specific flag names. Centralising the
 *   registry here means:
 *     • One place to enable/disable a signal source at runtime
 *     • Tests can assert exact flag names from the spec
 *     • The flags can read from Vite env vars + localStorage
 *       overrides + a frozen default map — all without each
 *       consumer reinventing the resolution logic.
 *
 * Strict-rule audit
 *   • Pure helpers. Never throw.
 *   • SSR-safe — localStorage / import.meta reads are guarded.
 *   • Defaults are conservative: SIMPLE_MODE = true (spec rule:
 *     new users default to Simple Mode); everything else = true
 *     so the intelligence layer is live by default but can be
 *     toggled off per env / per-user for testing.
 */

export const INTELLIGENCE_FLAGS = Object.freeze({
  FEATURE_SOIL_CONTEXT:        'FEATURE_SOIL_CONTEXT',
  FEATURE_SATELLITE_CONTEXT:   'FEATURE_SATELLITE_CONTEXT',
  FEATURE_SCAN_MEMORY:         'FEATURE_SCAN_MEMORY',
  FEATURE_SIMPLE_MODE:         'FEATURE_SIMPLE_MODE',
  FEATURE_PREDICTIVE_ALERTS:   'FEATURE_PREDICTIVE_ALERTS',
});

// Default-on for all flags. Ops can flip via env in deploy.
const _DEFAULTS = Object.freeze({
  FEATURE_SOIL_CONTEXT:      true,
  FEATURE_SATELLITE_CONTEXT: true,
  FEATURE_SCAN_MEMORY:       true,
  FEATURE_SIMPLE_MODE:       true,
  FEATURE_PREDICTIVE_ALERTS: true,
});

// In-process overrides — primary for tests, also useful for a
// future "switch flags in dev tools" affordance.
const _overrides = new Map();

function _readEnvOverride(flag) {
  try {
    if (typeof import.meta === 'undefined' || !import.meta.env) return undefined;
    const raw = import.meta.env[`VITE_${flag}`];
    if (raw === undefined || raw === null || raw === '') return undefined;
    const s = String(raw).toLowerCase().trim();
    if (s === 'true' || s === '1' || s === 'on') return true;
    if (s === 'false' || s === '0' || s === 'off') return false;
    return undefined;
  } catch { return undefined; }
}

function _readLocalStorageOverride(flag) {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const raw = localStorage.getItem(`farroway:flag:${flag}`);
    if (raw === null) return undefined;
    const s = String(raw).toLowerCase().trim();
    if (s === 'true' || s === '1' || s === 'on') return true;
    if (s === 'false' || s === '0' || s === 'off') return false;
    return undefined;
  } catch { return undefined; }
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Read the current state of a named intelligence flag.
 * Precedence: in-process override > localStorage > env > default.
 *
 * @param {string} flag
 * @returns {boolean}
 */
export function isIntelligenceFlagOn(flag) {
  if (typeof flag !== 'string' || !flag) return false;
  if (!(flag in _DEFAULTS)) return false;
  if (_overrides.has(flag)) return _overrides.get(flag) === true;
  const ls = _readLocalStorageOverride(flag);
  if (ls !== undefined) return ls;
  const env = _readEnvOverride(flag);
  if (env !== undefined) return env;
  return _DEFAULTS[flag];
}

/**
 * In-process override for tests + dev-tools. Pass `null` to clear.
 *
 * @param {string} flag
 * @param {boolean|null} value
 */
export function setIntelligenceFlagOverride(flag, value) {
  if (typeof flag !== 'string' || !(flag in _DEFAULTS)) return;
  if (value === null || value === undefined) {
    _overrides.delete(flag);
    return;
  }
  _overrides.set(flag, !!value);
}

/** Test helper — clears every override. */
export function _resetIntelligenceFlagOverrides() {
  _overrides.clear();
}

/**
 * Snapshot of all flag states for debug overlays.
 *
 * @returns {Record<string, boolean>}
 */
export function getIntelligenceFlagSnapshot() {
  const out = {};
  for (const flag of Object.keys(_DEFAULTS)) {
    out[flag] = isIntelligenceFlagOn(flag);
  }
  return out;
}

export default {
  INTELLIGENCE_FLAGS,
  isIntelligenceFlagOn,
  setIntelligenceFlagOverride,
  getIntelligenceFlagSnapshot,
  _resetIntelligenceFlagOverrides,
};
