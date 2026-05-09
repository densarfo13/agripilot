/**
 * intelligence/featureFlags.js — six named flags that gate the
 * invisible-intelligence layer per the May 2026 spec §13.
 *
 *   import { isIntelligenceFlagEnabled, INTELLIGENCE_FLAGS }
 *     from '../intelligence/featureFlags.js';
 *
 *   if (isIntelligenceFlagEnabled('ENABLE_AI_ADAPTER')) { ... }
 *
 * Default behaviour
 * ─────────────────
 *   Every flag defaults to **false** in this file. The host
 *   environment can opt-in via:
 *
 *     server-side:   process.env.<FLAG>=1
 *     frontend:      VITE_<FLAG>=1   (Vite-prefixed alias)
 *
 *   Truthy values: '1' | 'true' | 'on' | 'yes' | 'enabled'
 *   Falsy values:  '0' | 'false' | 'off' | 'no' | 'disabled'
 *
 *   When disabled, the matching engine MUST fall back to the
 *   safe rule-based behaviour shipped in this codebase
 *   (orchestrator.js / weatherRiskModel / pestDiseaseRisk /
 *   recommendationEngine / satelliteSignals mock).
 *
 * Strict-rule audit
 *   • Pure. SSR-safe (process / import.meta guarded).
 *   • Reads env at CALL TIME — runtime toggles are honoured.
 *   • Unknown flag names → false (safe by default).
 *   • Frozen catalogue prevents drift.
 */

export const INTELLIGENCE_FLAGS = Object.freeze([
  'ENABLE_ANALYTICS_ENGINE',
  'ENABLE_PREDICTION_ENGINE',
  'ENABLE_AI_ADAPTER',
  'ENABLE_SATELLITE_ENGINE',
  'ENABLE_SCORING_ENGINE',
  'ENABLE_RISK_ENGINE',
]);

const TRUTHY = new Set(['1', 'true', 'on', 'yes', 'enabled']);
const FALSY  = new Set(['0', 'false', 'off', 'no', 'disabled']);

function _readEnv(name) {
  // Server-side process.env
  try {
    if (typeof process !== 'undefined' && process.env) {
      const v = process.env[name];
      if (typeof v === 'string' && v.length > 0) return v;
    }
  } catch { /* swallow */ }
  // Frontend Vite import.meta.env (VITE_-prefixed)
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const v = import.meta.env['VITE_' + name];
      if (typeof v === 'string' && v.length > 0) return v;
    }
  } catch { /* swallow */ }
  return '';
}

function _coerce(raw) {
  if (raw == null || raw === '') return undefined;
  const v = String(raw).trim().toLowerCase();
  if (TRUTHY.has(v)) return true;
  if (FALSY.has(v))  return false;
  return undefined;
}

/**
 * isIntelligenceFlagEnabled(name) — read-time predicate.
 *
 *   Unknown flag → false (safe default).
 *   Env override truthy → true.
 *   Env override falsy → false.
 *   Otherwise → false (every flag opts-in deliberately).
 */
export function isIntelligenceFlagEnabled(name) {
  if (!name || typeof name !== 'string') return false;
  if (!INTELLIGENCE_FLAGS.includes(name)) return false;
  const env = _coerce(_readEnv(name));
  if (env === true)  return true;
  if (env === false) return false;
  return false; // default off
}

/**
 * intelligenceFlagsSnapshot — { [flag]: bool } map. Used by the
 * production startup banner + tests to emit a single greppable
 * line per flag.
 */
export function intelligenceFlagsSnapshot() {
  const out = {};
  for (const k of INTELLIGENCE_FLAGS) {
    out[k] = isIntelligenceFlagEnabled(k);
  }
  return Object.freeze(out);
}

export default isIntelligenceFlagEnabled;
