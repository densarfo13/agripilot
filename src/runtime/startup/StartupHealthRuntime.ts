/**
 * src/runtime/startup/StartupHealthRuntime.ts — single composite
 * startup probe (read-only).
 *
 *   window.__startupHealth()
 *
 * Why this exists (spec Phase 4)
 * ──────────────────────────────
 * One envelope answers "did the app actually start, and if not, where
 * did it stall?" — composed from the live sub-probes so a field
 * operator pastes ONE line instead of cross-referencing five globals.
 * Every value must become true OR enter a recovery state within 5s
 * (the recovery surfaces — SafeLoader / PageLoaderWithTimeout /
 * SafeRouteShell / LazyLoadErrorBoundary / ScanFallback — guarantee
 * the "enter recovery" half; the auth-gate hard-stop guarantees
 * authLoaded resolves within 8s).
 *
 * Envelope (spec Phase 4)
 *   { routeMatched, routeLoaded, suspenseResolved, authLoaded,
 *     profileLoaded, scanShellLoaded }
 *
 * Strict-rule audit
 *   • Pure read-only probe. SSR-safe. Frozen envelope. Never throws.
 *   • Composes __scanStartupHealth + __authStartupHealth + DOM +
 *     localStorage; never navigates or mutates.
 */

export const STARTUP_HEALTH_RUNTIME_VERSION = 'startup-health-v1';

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

function _domHas(testid: string): boolean {
  return _safe(() => {
    if (typeof document === 'undefined' || !document.querySelector) return false;
    return !!document.querySelector(`[data-testid="${testid}"]`);
  }, false);
}

export interface StartupHealth {
  runtimeVersion:   string;
  routeMatched:     boolean;
  routeLoaded:      boolean;
  suspenseResolved: boolean;
  authLoaded:       boolean;
  profileLoaded:    boolean;
  scanShellLoaded:  boolean;
  /** True once any value has reached its terminal/recovery state. */
  recoveryReady:    boolean;
}

export function startupHealth(): StartupHealth {
  return _safe(() => {
    const scan = _probe('__scanStartupHealth') || {};
    const auth = _probe('__authStartupHealth') || {};

    // route signals — the scan-startup probe DOM-polls these; on
    // non-scan routes they read false (the probe is scan-scoped), so
    // we also treat "the app shell has rendered content" as
    // routeLoaded/Matched for the general case.
    const appShellRendered = _safe(() => {
      if (typeof document === 'undefined') return false;
      const root = document.getElementById('root');
      return !!(root && root.children && root.children.length > 0
        && typeof root.innerText === 'string'
        && root.innerText.trim().length > 0);
    }, false);

    const routeMatched     = scan.routeMatched === true || appShellRendered;
    const routeLoaded      = scan.routeLoaded === true || scan.componentMounted === true
                          || appShellRendered;
    const suspenseResolved = scan.suspenseResolved === true || appShellRendered;

    // authLoaded — the auth bootstrap settled (or hit its hard-stop).
    const authLoaded = auth.authBootstrapSettled === true
                    || auth.timedOut === true;

    // profileLoaded — a profile/active-farm record exists locally OR
    // the session cache is present (degraded sessions still "loaded").
    const profileLoaded = _safe(() => {
      if (typeof localStorage === 'undefined') return false;
      return !!(localStorage.getItem('farroway_active_farm')
        || localStorage.getItem('farroway:session_cache')
        || localStorage.getItem('farroway_user'));
    }, false);

    // scanShellLoaded — the ScanHub safe shell (or plain upload
    // fallback, or a scan recovery surface) is on screen.
    const scanShellLoaded = scan.safeShellRendered === true
      || _domHas('scan-hub')
      || _domHas('plain-upload-fallback')
      || _domHas('scan-fallback')
      || _domHas('scan-fallback-blocked');

    // recoveryReady — a timeout-bearing recovery surface fired, so
    // the user is never left on an indefinite spinner.
    const recoveryReady = _safe(() => {
      if (typeof window === 'undefined') return false;
      const w = window as any;
      return w.__safeLoaderRecoveryRendered === true
        || typeof w.__lastLoaderTimeoutAt === 'string'
        || w.__scanSpinnerTimeoutFired === true;
    }, false);

    return Object.freeze({
      runtimeVersion:   STARTUP_HEALTH_RUNTIME_VERSION,
      routeMatched,
      routeLoaded,
      suspenseResolved,
      authLoaded,
      profileLoaded,
      scanShellLoaded,
      recoveryReady,
    });
  }, Object.freeze({
    runtimeVersion:   STARTUP_HEALTH_RUNTIME_VERSION,
    routeMatched:     false,
    routeLoaded:      false,
    suspenseResolved: false,
    authLoaded:       false,
    profileLoaded:    false,
    scanShellLoaded:  false,
    recoveryReady:    false,
  }));
}

export function installStartupHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__startupHealth !== 'function') {
      w.__startupHealth = function () {
        const out = startupHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Startup]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
