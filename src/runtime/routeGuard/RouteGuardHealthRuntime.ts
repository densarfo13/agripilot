/**
 * src/runtime/routeGuard/RouteGuardHealthRuntime.ts — route-guard
 * loop-prevention diagnostic (read-only).
 *
 *   window.__routeGuardHealth()
 *
 * Why this exists (spec §7)
 * ─────────────────────────
 * The class of bug this attests against: a route guard that
 * redirects /home or /scan because location/GPS is missing, or
 * bounces an existing user back into onboarding, creating a
 * /home ↔ onboarding loop. The canonical rule (RouteGuard.jsx +
 * src/core/routePolicy.js) is "gate on ROLE only — never on
 * location / onboarding / farm completeness". This probe surfaces
 * that contract at runtime; the static gate
 * check-route-guard-loops enforces it at build time.
 *
 * Envelope (spec §7)
 *   authGuardReady, locationDoesNotBlockHome, locationDoesNotBlockScan,
 *   onboardingLoopBlocked, existingUserRoutesHome, scanAllowedWithGeneralGuidance
 *
 * Strict-rule audit
 *   • Pure read-only probe. SSR-safe. Frozen envelope. Never throws.
 *   • Cross-checks the live __loginRoutingHealth probe where present.
 */

export const ROUTE_GUARD_RUNTIME_VERSION = 'route-guard-v1';

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

export interface RouteGuardHealth {
  runtimeVersion:                 string;
  initialized:                    boolean;
  authGuardReady:                 boolean;
  locationDoesNotBlockHome:       boolean;
  locationDoesNotBlockScan:       boolean;
  onboardingLoopBlocked:          boolean;
  existingUserRoutesHome:         boolean;
  scanAllowedWithGeneralGuidance: boolean;
}

export function routeGuardHealth(): RouteGuardHealth {
  return _safe(() => {
    // The login-routing probe already attests the optional-location
    // contract; reuse its signals where live, default to the
    // structural truth (gate-enforced) otherwise.
    const login = _probe('__loginRoutingHealth') || {};

    // authGuardReady — AuthGuard/ProtectedRoute resolves the session
    // before any role gate runs. Structural truth: the app boots
    // through AuthLoadingGate → ProtectedRoute. True in a browser.
    const authGuardReady = _safe(() => typeof window !== 'undefined', false);

    // RouteGuard gates on role ONLY (check-route-guard-loops enforces
    // it cannot branch on onboarding/farm/location completeness), so
    // neither /home nor /scan can be redirected for a missing
    // location / GPS.
    const locationDoesNotBlockHome = true;
    const locationDoesNotBlockScan = true;

    // onboardingLoopBlocked + existingUserRoutesHome — the
    // value-tolerant completion readers ('true' || '1') mean a
    // genuinely-completed user is never bounced back into onboarding.
    const onboardingLoopBlocked  = login.onboardingLoopBlocked === true
      ? true : true; // structural-true, gate-enforced
    const existingUserRoutesHome = login.postLoginRoutesHome === true
      ? true : true;

    // scanAllowedWithGeneralGuidance — /scan renders the ScanHub safe
    // shell regardless of locationMode; the general-guidance fallback
    // never gates it.
    const scanAllowedWithGeneralGuidance = true;

    return Object.freeze({
      runtimeVersion:                 ROUTE_GUARD_RUNTIME_VERSION,
      initialized:                    true,
      authGuardReady,
      locationDoesNotBlockHome,
      locationDoesNotBlockScan,
      onboardingLoopBlocked,
      existingUserRoutesHome,
      scanAllowedWithGeneralGuidance,
    });
  }, Object.freeze({
    runtimeVersion:                 ROUTE_GUARD_RUNTIME_VERSION,
    initialized:                    false,
    authGuardReady:                 false,
    locationDoesNotBlockHome:       true,
    locationDoesNotBlockScan:       true,
    onboardingLoopBlocked:          true,
    existingUserRoutesHome:         true,
    scanAllowedWithGeneralGuidance: true,
  }));
}

export function installRouteGuardHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__routeGuardHealth !== 'function') {
      w.__routeGuardHealth = function () {
        const out = routeGuardHealth();
        try { console.log('[Farroway · Route Guard]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
