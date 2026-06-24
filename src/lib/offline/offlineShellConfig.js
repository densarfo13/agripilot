/**
 * offlineShellConfig.js — OFFLINE_SHELL_V1 single source of truth.
 *
 * Flip OFFLINE_SHELL_ENABLED to false + redeploy to fully disable the
 * service worker (forceUiReset then resumes purging it on boot). This is
 * the one-line kill switch if the shell ever misbehaves.
 */
export const OFFLINE_SHELL_ENABLED = true;
export const SW_URL = '/sw.js';

// Caches owned by the offline shell. forceUiReset's legacy-cache purge
// must SPARE these (else it would delete the shell on every boot).
export const SW_CACHE_PREFIXES = ['fwshell-', 'fwassets-', 'fwdata-'];

/** True when a cache name belongs to the offline shell. */
export function isOfflineShellCache(name) {
  return typeof name === 'string' && SW_CACHE_PREFIXES.some((p) => name.startsWith(p));
}
