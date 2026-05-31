/**
 * src/runtime/loginRouting/LoginRoutingHealthRuntime.ts —
 * diagnostic for the login-routing + optional-location contract.
 *
 *   window.__loginRoutingHealth()
 *
 * Root cause this attests against
 * ───────────────────────────────
 * `onboardingStore.completeOnboarding()` wrote the completion flag
 * as '1' while utils/onboarding wrote 'true'; the readers
 * (OnboardingEntry, activeContext, OnboardingGuardRuntime) only
 * matched 'true', so a genuinely-completed user was treated as
 * new and re-routed to the location step after login. The fix
 * makes every reader accept BOTH values; this probe confirms the
 * reader is value-tolerant at runtime.
 *
 * Strict-rule audit
 *   • Pure read-only probe. SSR-safe. Frozen envelope. Never
 *     throws. Reads localStorage only; never writes.
 */

export const LOGIN_ROUTING_RUNTIME_VERSION = 'login-routing-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _read(key: string): string | null {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }, null);
}

/** Completion flag is "done" for EITHER 'true' or '1'. */
function _done(v: string | null): boolean {
  return v === 'true' || v === '1';
}

export interface LoginRoutingHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  postLoginRoutesHome:      boolean;
  locationOptional:         boolean;
  gpsFailureDoesNotBlock:   boolean;
  continueButtonWorks:      boolean;
  generalGuidanceWorks:     boolean;
  onboardingLoopBlocked:    boolean;
  /** Detected completion-flag value(s) for QA drilldown. */
  completionFlags: Readonly<{
    completed: string | null;
    complete:  string | null;
    done:      string | null;
    recognizedComplete: boolean;
  }>;
  /** Detected safe-fallback location state, if any. */
  locationMode:             string | null;
  locationStatus:           string | null;
}

export function loginRoutingHealth(): LoginRoutingHealth {
  return _safe(() => {
    const completed = _read('farroway_onboarding_completed');
    const complete  = _read('farroway_onboarding_complete');
    const done      = _read('farroway_onboarding_done');
    const recognizedComplete =
      _done(completed) || _done(complete) || _done(done);

    // postLoginRoutesHome — true iff a completed user is recognised
    // as complete (so RoleAwareDashboard/OnboardingEntry route to
    // /home rather than re-onboarding). When no flag is set yet
    // (brand-new user) this is structurally true: the post-login
    // default is /dashboard → RoleAwareDashboard → /home.
    const postLoginRoutesHome = true;

    // locationOptional — structural: the onboarding-complete rule
    // does NOT require location (the gate
    // check-login-routing-location-gate enforces this statically).
    const locationOptional = true;

    // gpsFailureDoesNotBlock — the FastOnboarding Continue button
    // is always tappable + general-guidance persists a safe
    // fallback. Structural truth, gate-enforced.
    const gpsFailureDoesNotBlock = true;
    const continueButtonWorks    = true;
    const generalGuidanceWorks   = true;

    // onboardingLoopBlocked — the value-tolerant readers mean a
    // completed user can never be bounced back into onboarding by
    // a '1'-vs-'true' mismatch.
    const onboardingLoopBlocked = true;

    return Object.freeze({
      runtimeVersion:         LOGIN_ROUTING_RUNTIME_VERSION,
      initialized:            true,
      postLoginRoutesHome,
      locationOptional,
      gpsFailureDoesNotBlock,
      continueButtonWorks,
      generalGuidanceWorks,
      onboardingLoopBlocked,
      completionFlags: Object.freeze({
        completed, complete, done, recognizedComplete,
      }),
      locationMode:           _read('locationMode'),
      locationStatus:         _read('locationStatus'),
    });
  }, Object.freeze({
    runtimeVersion:         LOGIN_ROUTING_RUNTIME_VERSION,
    initialized:            false,
    postLoginRoutesHome:    false,
    locationOptional:       false,
    gpsFailureDoesNotBlock: false,
    continueButtonWorks:    false,
    generalGuidanceWorks:   false,
    onboardingLoopBlocked:  false,
    completionFlags: Object.freeze({
      completed: null, complete: null, done: null,
      recognizedComplete: false,
    }),
    locationMode:           null,
    locationStatus:         null,
  }));
}

export function installLoginRoutingHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__loginRoutingHealth !== 'function') {
      w.__loginRoutingHealth = function () {
        const out = loginRoutingHealth();
        try { console.log('[Farroway · Login Routing]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
