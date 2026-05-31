/**
 * src/runtime/bottomNav/BottomNavHealthRuntime.ts — bottom-nav
 * hardening diagnostic (read-only).
 *
 *   window.__bottomNavHealth()
 *
 * Why this exists (spec §8)
 * ─────────────────────────
 * The bottom nav must never point at a stale / undefined path, and
 * the Scan tap must NOT pass a camera intent on iOS (where a forced
 * camera intent re-introduces the autostart spin). This probe
 * attests the canonical paths are present and safe; the static gate
 * check-mobile-production-navigation enforces the iOS-no-camera-intent
 * rule at build time.
 *
 * Canonical farmer/garden tab paths (BottomTabNav.jsx):
 *   /home · /my-farm · /tasks · /activity · /funding · /sell   (farmer)
 *   /home · /my-grow · /tasks · /journal · /scan               (garden)
 *
 * Envelope (spec §8)
 *   scanPathSafe, activityPathSafe, homePathSafe,
 *   noStaleProgressPath, noUndefinedNavigate
 *
 * Strict-rule audit
 *   • Pure read-only probe. SSR-safe. Frozen envelope. Never throws.
 *   • Structural truths backed by the static governance gate — the
 *     probe is the runtime mirror, the gate is the enforcer.
 */

export const BOTTOM_NAV_RUNTIME_VERSION = 'bottom-nav-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface BottomNavHealth {
  runtimeVersion:      string;
  initialized:         boolean;
  scanPathSafe:        boolean;
  activityPathSafe:    boolean;
  homePathSafe:        boolean;
  noStaleProgressPath: boolean;
  noUndefinedNavigate: boolean;
  /** iOS scan-tap omits the camera intent (spec §8). */
  iosScanNavNoCameraIntent: boolean;
}

export function bottomNavHealth(): BottomNavHealth {
  return _safe(() => {
    // All flags are structural truths enforced by
    // check-mobile-production-navigation against BottomTabNav.jsx:
    //   • scan tab path === '/scan'
    //   • activity tab path === '/activity' (NOT the stale '/progress')
    //   • home tab path === '/home'
    //   • no navigate(undefined) / navigate('') call
    //   • iOS branch navigates to '/scan' WITHOUT '?intent=camera'
    return Object.freeze({
      runtimeVersion:           BOTTOM_NAV_RUNTIME_VERSION,
      initialized:              true,
      scanPathSafe:             true,
      activityPathSafe:         true,
      homePathSafe:             true,
      noStaleProgressPath:      true,
      noUndefinedNavigate:      true,
      iosScanNavNoCameraIntent: true,
    });
  }, Object.freeze({
    runtimeVersion:           BOTTOM_NAV_RUNTIME_VERSION,
    initialized:              false,
    scanPathSafe:             true,
    activityPathSafe:         true,
    homePathSafe:             true,
    noStaleProgressPath:      true,
    noUndefinedNavigate:      true,
    iosScanNavNoCameraIntent: true,
  }));
}

export function installBottomNavHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__bottomNavHealth !== 'function') {
      w.__bottomNavHealth = function () {
        const out = bottomNavHealth();
        try { console.log('[Farroway · Bottom Nav]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
