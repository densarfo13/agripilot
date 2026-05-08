/**
 * src/core/runtime/logger.js — structured, prefix-namespaced logger.
 *
 * PURPOSE
 * ───────
 * Centralise all Farroway console output behind a single façade so:
 *   • Every line is grepped reliably with "[Farroway]"
 *   • debug() and log() are stripped from production bundles at runtime
 *     (Vite's import.meta.env.DEV check — no dead-code in the bundle,
 *     just an early return that the JIT elides)
 *   • warn() and error() always surface — they are real signals
 *   • A single logStartup() call emits the one permitted boot line
 *
 * USAGE
 * ─────
 *   import { log, warn, error, debug, logStartup } from '../core/runtime/logger.js';
 *
 *   logStartup();          // once, at the end of main.jsx boot sequence
 *   log('route loaded');   // dev-only status lines
 *   debug('state', obj);   // dev-only verbose inspection
 *   warn('fallback used'); // always visible
 *   error('fetch failed', err); // always visible, Sentry-greppable
 *
 * RULES
 * ─────
 *   • No side-effects on import — call the functions explicitly.
 *   • SSR-safe — never accesses window.
 *   • Never throws — every call is wrapped in try/catch.
 *   • All output is prefixed with "[Farroway]" for quick grep.
 *   • Do not import this from test files — tests use console directly.
 */

const PREFIX = '[Farroway]';

/** @returns {boolean} true when running under the Vite dev server */
function _isDev() {
  try {
    return typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;
  } catch {
    return false;
  }
}

/**
 * Development-only informational log.
 * Stripped (no-op) in production builds.
 *
 * @param {string} message
 * @param {...unknown} args
 */
export function log(message, ...args) {
  if (!_isDev()) return;
  try { console.log(PREFIX, message, ...args); } catch { /* swallow */ }
}

/**
 * Development-only verbose debug output.
 * Stripped (no-op) in production builds.
 *
 * @param {string} message
 * @param {...unknown} args
 */
export function debug(message, ...args) {
  if (!_isDev()) return;
  try { console.debug(PREFIX, message, ...args); } catch { /* swallow */ }
}

/**
 * Warning — always surfaces in both dev and production.
 * Use for recoverable unexpected states (fallback engaged, etc.).
 *
 * @param {string} message
 * @param {...unknown} args
 */
export function warn(message, ...args) {
  try { console.warn(PREFIX, message, ...args); } catch { /* swallow */ }
}

/**
 * Error — always surfaces in both dev and production.
 * Use for genuine failures that engineers and Sentry need to see.
 *
 * @param {string} message
 * @param {...unknown} args
 */
export function error(message, ...args) {
  try { console.error(PREFIX, message, ...args); } catch { /* swallow */ }
}

/**
 * Emit the single permitted boot success line.
 * Call ONCE at the end of main.jsx after React mounts.
 * Always surfaces — confirms the app reached mounted state.
 */
export function logStartup() {
  try { console.log(PREFIX + ' App initialized successfully'); } catch { /* swallow */ }
}
