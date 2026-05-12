/**
 * subsystemIsolator.js — imperative-call error containment (spec §9).
 *
 *   const weather = runIsolated('weather', () => fetchWeatherCache(), null);
 *   const risks   = await runIsolatedAsync('predictive_risk', async () => ...);
 *
 * Why this exists
 * ───────────────
 *   React error boundaries already isolate render-tree crashes
 *   (we have AppCrashBoundary + DashboardErrorBoundary + others).
 *   What ISN'T isolated today is the imperative side: a thrown
 *   error inside computeFarmHealthScore or readWeatherCache would
 *   propagate up to its caller. Every helper has try/catch today,
 *   but the *pattern* is ad-hoc.
 *
 *   This module gives us ONE place that:
 *     • runs the work
 *     • returns a safe fallback on throw
 *     • records the failure to FarmTelemetry so we can SEE which
 *       subsystem is breaking
 *
 *   "weather API failure must not break scan / tasks / home /
 *    journal" — wrap the weather read in runIsolated() and the
 *    rest of the code reads the safe fallback.
 *
 * Strict-rule audit
 *   • Both sync and async variants. Async returns a Promise that
 *     never rejects — failures resolve with the fallback.
 *   • Telemetry is best-effort; a broken telemetry layer can't
 *     itself crash the isolator.
 *   • Optional `onError` hook lets the caller log to a custom
 *     channel (Sentry, etc.) without coupling this module to it.
 */

import { trackError, trackCount } from './farmTelemetry.js';

/**
 * Run a synchronous function under isolation. Returns the function's
 * value on success, or `fallback` on throw. The failure is recorded
 * to telemetry under `subsystem.<name>`.
 *
 * @template T
 * @param {string} name
 * @param {() => T} fn
 * @param {T} fallback
 * @param {{ onError?: (err: any) => void }} [options]
 * @returns {T}
 */
export function runIsolated(name, fn, fallback, options) {
  const subsystem = (typeof name === 'string' && name) ? name : 'unknown';
  if (typeof fn !== 'function') return fallback;
  try {
    const result = fn();
    try { trackCount('subsystem.' + subsystem + '.ok'); } catch { /* swallow */ }
    return result;
  } catch (err) {
    try { trackError('subsystem.' + subsystem, err); } catch { /* swallow */ }
    try { trackCount('subsystem.' + subsystem + '.failure'); } catch { /* swallow */ }
    if (options && typeof options.onError === 'function') {
      try { options.onError(err); } catch { /* swallow */ }
    }
    return fallback;
  }
}

/**
 * Async variant. Returns a promise that NEVER rejects — failures
 * resolve with the fallback.
 *
 * @template T
 * @param {string} name
 * @param {() => Promise<T>} fn
 * @param {T} fallback
 * @param {{ onError?: (err: any) => void, timeoutMs?: number }} [options]
 * @returns {Promise<T>}
 */
export async function runIsolatedAsync(name, fn, fallback, options) {
  const subsystem = (typeof name === 'string' && name) ? name : 'unknown';
  if (typeof fn !== 'function') return fallback;
  const opts = (options && typeof options === 'object') ? options : {};
  const timeoutMs = (typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0)
    ? opts.timeoutMs : null;

  try {
    let resultPromise = fn();
    if (timeoutMs != null) {
      // Race against a timeout so a hung subsystem can't pin the
      // caller's promise forever (spec §9 spirit: "weather API
      // failure must not break scan").
      const timeout = new Promise((resolve) => {
        setTimeout(() => resolve({ __ISOLATOR_TIMEOUT__: true }), timeoutMs);
      });
      const raced = await Promise.race([resultPromise, timeout]);
      if (raced && raced.__ISOLATOR_TIMEOUT__) {
        try { trackError('subsystem.' + subsystem, new Error('timeout_' + timeoutMs + 'ms')); } catch { /* swallow */ }
        try { trackCount('subsystem.' + subsystem + '.timeout'); } catch { /* swallow */ }
        return fallback;
      }
      try { trackCount('subsystem.' + subsystem + '.ok'); } catch { /* swallow */ }
      return raced;
    }
    const result = await resultPromise;
    try { trackCount('subsystem.' + subsystem + '.ok'); } catch { /* swallow */ }
    return result;
  } catch (err) {
    try { trackError('subsystem.' + subsystem, err); } catch { /* swallow */ }
    try { trackCount('subsystem.' + subsystem + '.failure'); } catch { /* swallow */ }
    if (opts.onError && typeof opts.onError === 'function') {
      try { opts.onError(err); } catch { /* swallow */ }
    }
    return fallback;
  }
}

export default { runIsolated, runIsolatedAsync };
