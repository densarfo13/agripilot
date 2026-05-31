/**
 * src/runtime/authStartup/AuthStartupHealthRuntime.ts — auth-bootstrap
 * hard-stop diagnostic (read-only).
 *
 *   window.__authStartupHealth()
 *
 * Why this exists (spec §3)
 * ─────────────────────────
 * The whole app is gated on `authLoading` (AuthLoadingGate wraps every
 * route). If AuthContext.bootstrap() hangs — a stalled dynamic import
 * from a stale SW precache, or an IndexedDB hang under Safari Private /
 * ITP — `authLoading` would never flip false and the full-screen
 * spinner would render forever. The fix (already shipped) is an
 * absolute 8s hard-stop timer scheduled BEFORE any await that releases
 * the gate no matter what hangs, plus bounding the repair awaits with
 * withBootstrapTimeout. This probe reports that the bootstrap settled
 * (and how fast), and whether the hard-stop had to fire.
 *
 * Envelope (spec §3)
 *   authBootstrapStarted, authBootstrapSettled, authBootstrapMs,
 *   timeoutMs (8000), timedOut, recoveryRendered, appShellAllowed
 *
 * Strict-rule audit
 *   • Pure read-only probe. SSR-safe. Frozen envelope. Never throws.
 *   • Reads the shared authStartupState + window recovery flags only.
 */

import { getAuthStartupSnapshot } from './authStartupState.js';

export const AUTH_STARTUP_RUNTIME_VERSION = 'auth-startup-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface AuthStartupHealth {
  runtimeVersion:       string;
  authBootstrapStarted: boolean;
  authBootstrapSettled: boolean;
  authBootstrapMs:      number | null;
  timeoutMs:            number;
  timedOut:             boolean;
  recoveryRendered:     boolean;
  appShellAllowed:      true;
}

export function authStartupHealth(): AuthStartupHealth {
  return _safe(() => {
    const snap = getAuthStartupSnapshot();
    // recoveryRendered — did a timeout-bearing loader flip to its
    // recovery UI this session? SafeLoader + PageLoaderWithTimeout
    // each stamp a window flag when they show recovery.
    const recoveryRendered = _safe(() => {
      if (typeof window === 'undefined') return false;
      const w = window as any;
      return w.__safeLoaderRecoveryRendered === true
        || typeof w.__lastLoaderTimeoutAt === 'string'
        || w.__scanSpinnerTimeoutFired === true;
    }, false);
    return Object.freeze({
      runtimeVersion:       AUTH_STARTUP_RUNTIME_VERSION,
      authBootstrapStarted: snap.authBootstrapStarted,
      authBootstrapSettled: snap.authBootstrapSettled,
      authBootstrapMs:      snap.authBootstrapMs,
      timeoutMs:            snap.timeoutMs,
      timedOut:             snap.timedOut,
      recoveryRendered,
      // The hard-stop guarantees the gate ALWAYS opens within the
      // ceiling, so the app shell is always eventually allowed.
      appShellAllowed:      true as const,
    });
  }, Object.freeze({
    runtimeVersion:       AUTH_STARTUP_RUNTIME_VERSION,
    authBootstrapStarted: false,
    authBootstrapSettled: false,
    authBootstrapMs:      null,
    timeoutMs:            8000,
    timedOut:             false,
    recoveryRendered:     false,
    appShellAllowed:      true as const,
  }));
}

export function installAuthStartupHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__authStartupHealth !== 'function') {
      w.__authStartupHealth = function () {
        const out = authStartupHealth();
        try { console.log('[Farroway · Auth Startup]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
