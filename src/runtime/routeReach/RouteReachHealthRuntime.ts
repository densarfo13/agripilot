/**
 * src/runtime/routeReach/RouteReachHealthRuntime.ts — route-reach
 * proof for /scan (read-only).
 *
 *   window.__routeReachHealth()
 *
 * Why this exists (spec §2)
 * ─────────────────────────
 * When /scan "spins", the open question is WHERE execution stopped:
 * did the route match? did the lazy chunk import? did ScanPage
 * mount? did the ScanHub safe shell render? This probe answers that
 * with a single envelope so a field operator can paste one console
 * line and know the exact stall stage.
 *
 * It is COMPOSITION-ONLY — it reads the live __scanStartupHealth
 * probe (which already tracks routeMatched / suspenseResolved /
 * componentMounted / safeShellRendered via DOM polling) plus the
 * DOM + the pinned build SHA. It never navigates, mounts, or mutates.
 *
 * Envelope (spec §2)
 *   requestedPath, routeMatched, componentImported, componentMounted,
 *   safeShellRendered, routeGuardAllowed, redirectTarget, loadedBundleHash
 *
 * Strict-rule audit
 *   • Pure read-only probe. SSR-safe. Frozen envelope. Never throws.
 */

import { readBuildSha } from '../appVersion/AppVersionRuntime';

export const ROUTE_REACH_RUNTIME_VERSION = 'route-reach-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _path(): string {
  return _safe(() => (typeof window !== 'undefined' && window.location
    ? String(window.location.pathname || '') : ''), '');
}

function _domHas(testid: string): boolean {
  return _safe(() => {
    if (typeof document === 'undefined' || !document.querySelector) return false;
    return !!document.querySelector(`[data-testid="${testid}"]`);
  }, false);
}

export interface RouteReachHealth {
  runtimeVersion:    string;
  initialized:       boolean;
  requestedPath:     string;
  routeMatched:      boolean;
  componentImported: boolean;
  componentMounted:  boolean;
  safeShellRendered: boolean;
  routeGuardAllowed: boolean;
  redirectTarget:    string | null;
  loadedBundleHash:  string | null;
}

export function routeReachHealth(): RouteReachHealth {
  return _safe(() => {
    const requestedPath = _path();
    const onScan = /^\/scan(\/|$)/.test(requestedPath);

    // Compose the live scan-startup probe (DOM-polled stage tracker).
    const startup = _probe('__scanStartupHealth') || {};

    // routeMatched — react-router matched /scan. The scan-startup
    // probe sets routeMatched once location.pathname enters /scan.
    const routeMatched = onScan
      ? (startup.routeMatched === true || startup.routeLoaded === true)
      : false;

    // componentImported — the lazy ScanPage chunk resolved. We proxy
    // this from suspenseResolved (any scan-bound testid mounted means
    // the Suspense boundary resolved the import).
    const componentImported = onScan
      ? (startup.suspenseResolved === true || startup.componentMounted === true
         || _domHas('scan-hub') || _domHas('scan-capture'))
      : false;

    // componentMounted — ScanPage actually rendered something.
    const componentMounted = onScan
      ? (startup.componentMounted === true
         || _domHas('scan-hub') || _domHas('scan-capture'))
      : false;

    // safeShellRendered — the ScanHub upload-first shell is on screen.
    const safeShellRendered = onScan
      ? (startup.safeShellRendered === true || _domHas('scan-hub'))
      : false;

    // routeGuardAllowed — /scan is NOT role-gated (only FEATURE_SCAN +
    // ScanErrorBoundary wrap it). It is reachable for every signed-in
    // role; location/onboarding never block it (RouteGuard gates on
    // role only — enforced by check-login-routing-location-gate).
    const routeGuardAllowed = true;

    // redirectTarget — null on the happy path. If a lazy-chunk error
    // fired, the recovery surface (LazyLoadErrorBoundary) may have
    // recorded a route; surface that for drilldown.
    const redirectTarget = _safe(() => {
      if (typeof window === 'undefined') return null;
      const w = window as any;
      return typeof w.__lastLazyLoadErrorRoute === 'string' && w.__lastLazyLoadErrorRoute
        ? w.__lastLazyLoadErrorRoute : null;
    }, null);

    return Object.freeze({
      runtimeVersion:    ROUTE_REACH_RUNTIME_VERSION,
      initialized:       true,
      requestedPath,
      routeMatched,
      componentImported,
      componentMounted,
      safeShellRendered,
      routeGuardAllowed,
      redirectTarget,
      loadedBundleHash:  readBuildSha(),
    });
  }, Object.freeze({
    runtimeVersion:    ROUTE_REACH_RUNTIME_VERSION,
    initialized:       false,
    requestedPath:     '',
    routeMatched:      false,
    componentImported: false,
    componentMounted:  false,
    safeShellRendered: false,
    routeGuardAllowed: true,
    redirectTarget:    null,
    loadedBundleHash:  null,
  }));
}

export function installRouteReachHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__routeReachHealth !== 'function') {
      w.__routeReachHealth = function () {
        const out = routeReachHealth();
        try { console.log('[Farroway · Route Reach]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
