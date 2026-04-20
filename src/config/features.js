/**
 * features.js — frontend mirror of the server feature flags.
 *
 * Defaults to disabled. Override at build time via:
 *   VITE_FARROWAY_FEATURE_<NAME_UPPER>=1
 *
 * The server is always authoritative — if the client opts in
 * but the server flag is off, the API returns 404 and the UI
 * branch degrades to the "feature unavailable" state. This
 * config exists mainly so the UI doesn't bother mounting a
 * feature's entry points when we already know it's disabled.
 */

const DEFAULTS = Object.freeze({
  marketplace: false,
});

function envOverride(name) {
  if (typeof import.meta === 'undefined' || !import.meta.env) return undefined;
  const key = `VITE_FARROWAY_FEATURE_${String(name).toUpperCase()}`;
  const raw = import.meta.env[key];
  if (raw == null || raw === '') return undefined;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'on', 'yes', 'enabled'].includes(v))  return true;
  if (['0', 'false', 'off', 'no', 'disabled'].includes(v)) return false;
  return undefined;
}

/** isFeatureEnabled — pure predicate. Safe on unknown names. */
export function isFeatureEnabled(name) {
  if (!name || typeof name !== 'string') return false;
  if (!(name in DEFAULTS)) return false;
  const env = envOverride(name);
  if (env === true)  return true;
  if (env === false) return false;
  return DEFAULTS[name] === true;
}

/** FEATURES — snapshot at import time. Use for static branches. */
export const FEATURES = Object.freeze(Object.keys(DEFAULTS).reduce((acc, k) => {
  acc[k] = isFeatureEnabled(k);
  return acc;
}, {}));

export default { FEATURES, isFeatureEnabled };
