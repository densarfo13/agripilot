/**
 * pilotReadiness — global "are we in pilot mode" gate.
 *
 *   import { PILOT_READINESS_MODE, isPilotReady } from
 *     '../config/pilotReadiness.js';
 *
 *   if (PILOT_READINESS_MODE) hideExperimentalBanner();
 *
 * SPEC §1
 *   When PILOT_READINESS_MODE=true:
 *     • verbose debug logs disabled (consoleFilter is the actual
 *       enforcement point — see lib/consoleFilter.js)
 *     • experimental banners hidden
 *     • fallback states polished
 *     • test/demo placeholders hidden
 *     • non-essential metrics hidden
 *     • aggressive animations reduced
 *     • user-facing errors softened
 *
 * RESOLUTION ORDER
 *   1. `import.meta.env.VITE_PILOT_READINESS_MODE` set at build
 *      time wins (CI/CD pins it on/off explicitly).
 *   2. localStorage `farroway_pilot_readiness` lets QA flip
 *      without a redeploy.
 *   3. Production builds default to TRUE; dev defaults to FALSE
 *      so engineers keep the verbose surfaces on.
 *
 * STRICT-RULE AUDIT
 *   • Pure constants. SSR-safe. Never throws.
 *   • Resolved ONCE at module load — flipping localStorage
 *     mid-session requires a reload (matches the existing
 *     forceUiReset contract).
 */

const _STORAGE_KEY = 'farroway_pilot_readiness';

function _readEnvFlag() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const v = import.meta.env.VITE_PILOT_READINESS_MODE;
      if (v === '1' || v === 1 || v === true || v === 'true')  return true;
      if (v === '0' || v === 0 || v === false || v === 'false') return false;
    }
  } catch { /* swallow */ }
  return undefined;
}

function _readLocalFlag() {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const v = localStorage.getItem(_STORAGE_KEY);
    if (v === '1' || v === 'true')  return true;
    if (v === '0' || v === 'false') return false;
  } catch { /* swallow */ }
  return undefined;
}

function _readDevDefault() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // PROD default = on. DEV default = off (engineers keep the
      // experimental banners + verbose logs in dev).
      return !import.meta.env.DEV;
    }
  } catch { /* swallow */ }
  return true;
}

function _resolve() {
  const env = _readEnvFlag();
  if (typeof env === 'boolean') return env;
  const local = _readLocalFlag();
  if (typeof local === 'boolean') return local;
  return _readDevDefault();
}

// Module-level constant — resolved exactly once on first import.
export const PILOT_READINESS_MODE = _resolve();

/**
 * Convenience helper for callers that prefer a function form.
 * Returns the same value as the constant.
 */
export function isPilotReady() {
  return PILOT_READINESS_MODE;
}

/**
 * Per spec §1 — bundled set of UI behaviours gated by the flag.
 * UI components import from here so the contract is one file.
 */
export const PILOT_BEHAVIOR = Object.freeze({
  hideExperimentalBanners: PILOT_READINESS_MODE,
  hideDebugPanels:         PILOT_READINESS_MODE,
  hideDemoPlaceholders:    PILOT_READINESS_MODE,
  hideNonEssentialMetrics: PILOT_READINESS_MODE,
  reduceMotion:            PILOT_READINESS_MODE,
  softenErrorWording:      PILOT_READINESS_MODE,
});

const _module = { PILOT_READINESS_MODE, isPilotReady, PILOT_BEHAVIOR };
export default _module;
