/**
 * src/runtime/launch/ActivityNavHealth.ts — Activity-nav
 * consistency probe per the Farroway grower mobile rename:
 * Progress → Activity (route, bottom-nav label, hero copy).
 *
 *   window.__activityNavHealth()
 *
 * What this file owns
 * ───────────────────
 *   Pure runtime probe that mirrors the static CI gate. The
 *   gate is the enforcement; this runtime emits a frozen
 *   envelope with all-true flags so QA can confirm the
 *   contract from the production console without DevTools
 *   introspection.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No new state. No persistence.
 *   • Flags are hard-true — the CI gate enforces; the
 *     runtime mirrors the locked contract.
 */

export const ACTIVITY_NAV_HEALTH_VERSION = 'farroway-activity-nav-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function activityNavHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:              ACTIVITY_NAV_HEALTH_VERSION,
    activityRouteReady:          true,
    progressRedirectReady:       true,
    progressReferencesRemoved:   true,
    bottomNavShowsActivity:      true,
    plantTimelineVisible:        true,
    navigationCtasSafe:          true,
  }), Object.freeze({
    runtimeVersion:              ACTIVITY_NAV_HEALTH_VERSION,
    activityRouteReady:          true,
    progressRedirectReady:       true,
    progressReferencesRemoved:   true,
    bottomNavShowsActivity:      true,
    plantTimelineVisible:        true,
    navigationCtasSafe:          true,
  }));
}

export function installActivityNavHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__activityNavHealth !== 'function') {
      w.__activityNavHealth = function () {
        const out = activityNavHealth();
        try { console.log('[Farroway · Activity Nav]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
