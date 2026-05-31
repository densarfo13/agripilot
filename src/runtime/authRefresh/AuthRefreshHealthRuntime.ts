/**
 * src/runtime/authRefresh/AuthRefreshHealthRuntime.ts — auth-refresh
 * resilience diagnostic (read-only).
 *
 *   window.__authRefreshHealth()
 *
 * Why this exists (spec Phase 2)
 * ──────────────────────────────
 * `POST /api/v2/auth/refresh -> 429` must NEVER block route rendering
 * or log the user out. lib/api.js treats a transient refresh failure
 * (429 / 5xx / network) as "degraded mode": the cached session stays
 * usable, the route shell keeps rendering, and a background retry with
 * exponential backoff restores a fresh token. Only a 401 (no/invalid
 * refresh cookie) is a genuine dead session. This probe surfaces that
 * state so the contract is observable on-device.
 *
 * Envelope (spec Phase 2)
 *   { refreshAttempts, refreshFailures, degradedMode, routeShellLoaded }
 *
 * Strict-rule audit
 *   • Pure read-only probe. SSR-safe. Frozen envelope. Never throws.
 *   • Reads the live api.js snapshot (module state) only; never writes.
 */

import { getAuthRefreshSnapshot } from '../../lib/api.js';

export const AUTH_REFRESH_RUNTIME_VERSION = 'auth-refresh-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface AuthRefreshHealth {
  runtimeVersion:  string;
  refreshAttempts: number;
  refreshFailures: number;
  degradedMode:    boolean;
  routeShellLoaded: boolean;
}

export function authRefreshHealth(): AuthRefreshHealth {
  return _safe(() => {
    const snap: any = getAuthRefreshSnapshot();
    return Object.freeze({
      runtimeVersion:   AUTH_REFRESH_RUNTIME_VERSION,
      refreshAttempts:  typeof snap.refreshAttempts === 'number' ? snap.refreshAttempts : 0,
      refreshFailures:  typeof snap.refreshFailures === 'number' ? snap.refreshFailures : 0,
      degradedMode:     snap.degradedMode === true,
      routeShellLoaded: snap.routeShellLoaded === true,
    });
  }, Object.freeze({
    runtimeVersion:   AUTH_REFRESH_RUNTIME_VERSION,
    refreshAttempts:  0,
    refreshFailures:  0,
    degradedMode:     false,
    routeShellLoaded: false,
  }));
}

export function installAuthRefreshHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__authRefreshHealth !== 'function') {
      w.__authRefreshHealth = function () {
        const out = authRefreshHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Auth Refresh]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
