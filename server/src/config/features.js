/**
 * features.js — global feature flags. ONE place to flip a
 * feature on or off, with an environment-variable override so
 * the flag can be changed at deploy time without code changes.
 *
 * Precedence (highest first):
 *   1. process.env.FARROWAY_FEATURE_<NAME_UPPER> = "1" | "0"
 *   2. built-in default below
 *
 * Rule: every new feature ships with `false` here. Flipping
 * requires either an intentional code change OR setting the
 * environment variable at runtime.
 */

const DEFAULTS = Object.freeze({
  marketplace: false,
});

function envOverride(name) {
  const key = `FARROWAY_FEATURE_${String(name).toUpperCase()}`;
  if (typeof process === 'undefined' || !process.env) return undefined;
  const raw = process.env[key];
  if (raw == null || raw === '') return undefined;
  const truthy = new Set(['1', 'true', 'on', 'yes', 'enabled']);
  const falsy  = new Set(['0', 'false', 'off', 'no', 'disabled']);
  const v = String(raw).trim().toLowerCase();
  if (truthy.has(v)) return true;
  if (falsy.has(v))  return false;
  return undefined;
}

/**
 * isFeatureEnabled — the one public predicate. Pure, safe on
 * unknown features (returns false). Reads env at CALL TIME so
 * tests and runtime toggles reflect immediately.
 */
export function isFeatureEnabled(name) {
  if (!name || typeof name !== 'string') return false;
  if (!(name in DEFAULTS)) return false;
  const env = envOverride(name);
  if (env === true)  return true;
  if (env === false) return false;
  return DEFAULTS[name] === true;
}

/** featuresSnapshot — dev-only helper; returns current states. */
export function featuresSnapshot() {
  const out = {};
  for (const k of Object.keys(DEFAULTS)) out[k] = isFeatureEnabled(k);
  return Object.freeze(out);
}

/**
 * FEATURES — spec-compatible static export. Read on module
 * load, so env changes after load require isFeatureEnabled()
 * for live reads. Keep this for simple call sites; the
 * predicate is canonical.
 */
export const FEATURES = Object.freeze({ ...DEFAULTS, ...featuresSnapshot() });

export default { FEATURES, isFeatureEnabled, featuresSnapshot };
