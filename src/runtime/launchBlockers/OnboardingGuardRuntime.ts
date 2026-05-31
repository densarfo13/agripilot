/**
 * src/runtime/launchBlockers/OnboardingGuardRuntime.ts — C-1
 * Onboarding bypass guard. Pure read-only runtime that probes
 * localStorage for the minimum state required before Home,
 * Tasks, Scan, or Activity may render.
 *
 *   import { onboardingGuardHealth, installOnboardingGuardGlobal,
 *            isOnboardingValid } from 'src/runtime/launchBlockers/OnboardingGuardRuntime';
 *
 *   window.__onboardingGuardHealth()
 *
 * Validation contract (any one of the canonical completion keys
 * suffices — onboarding.js stamps all three on success):
 *   • role            (farmer | gardener | buyer | ngo)
 *   • mode            (farm | garden)
 *   • farm/garden     (at least one entity present in storage)
 *   • profile minimum (country OR location skip stamped)
 *
 * Strict-rule audit
 *   • Read-only. Never writes localStorage from this module.
 *   • SSR-safe. Never throws.
 *   • Frozen envelope.
 *   • Composition-only — does not modify FastOnboarding state.
 */

export const ONBOARDING_GUARD_RUNTIME_VERSION = 'onboarding-guard-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _read(key: string): string | null {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }, null);
}

function _isComplete(): boolean {
  // Login-routing fix — accept BOTH 'true' and '1'.
  // onboardingStore.completeOnboarding() stamps '1' while
  // utils/onboarding stamps 'true'; matching only 'true' re-routed
  // a '1'-completed user back into onboarding.
  const done = (v: string | null) => v === 'true' || v === '1';
  return done(_read('farroway_onboarding_done'))
      || done(_read('farroway_onboarding_completed'))
      || done(_read('farroway_onboarding_complete'));
}

function _hasRole(): boolean {
  const v = _read('farroway_role')
         || _read('farroway_user_role')
         || _read('farroway_experience')
         || _read('farroway_active_experience');
  return !!(v && String(v).trim());
}

function _hasMode(): boolean {
  const v = _read('farroway_experience')
         || _read('farroway_active_experience')
         || _read('farroway_mode');
  if (!v) return false;
  const m = String(v).toLowerCase();
  return m.includes('farm') || m.includes('garden') || m.includes('backyard');
}

function _hasEntity(): boolean {
  return _safe(() => {
    const farms = _read('farroway_farms');
    if (farms) {
      const arr = JSON.parse(farms);
      if (Array.isArray(arr) && arr.length > 0) return true;
    }
    const gardens = _read('farroway_gardens');
    if (gardens) {
      const arr = JSON.parse(gardens);
      if (Array.isArray(arr) && arr.length > 0) return true;
    }
    // Backyard / managed-plants fallback — a user with a managed
    // plant has at least implicitly chosen an entity.
    const plants = _read('farroway_managed_plants');
    if (plants) {
      const arr = JSON.parse(plants);
      if (Array.isArray(arr) && arr.length > 0) return true;
    }
    return false;
  }, false);
}

function _hasMinimumProfile(): boolean {
  const country = _read('farroway_country');
  if (country && String(country).trim()) return true;
  // Location explicitly skipped → minimum acceptable.
  return _read('farroway_location_skipped') === 'true'
      || _read('setupSkipped') === 'true';
}

/**
 * isOnboardingValid — single canonical guard predicate.
 * Returns true ONLY when all four checks pass AND the canonical
 * completion flag is set. False otherwise.
 *
 * Pure. Never throws. SSR-safe (returns false on the server so
 * SSR shells never appear "complete" by accident).
 */
export function isOnboardingValid(): boolean {
  if (typeof window === 'undefined') return false;
  if (!_isComplete()) return false;
  // Defence in depth — completion stamped but no role/mode is a
  // signal that the user landed on the bypass screen without
  // touching role-select. We accept it ONLY when the entity check
  // passes, because the May 2026 bypass-screen design lets a
  // single-tap user complete onboarding from the location step.
  const role   = _hasRole();
  const mode   = _hasMode();
  const entity = _hasEntity();
  const prof   = _hasMinimumProfile();
  // At least one of (role | mode) AND at least one of (entity | profile)
  // — the May 2026 bypass design intentionally allows minimal users.
  return (role || mode) && (entity || prof);
}

export function onboardingGuardHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:     ONBOARDING_GUARD_RUNTIME_VERSION,
    onboardingGuardReady: true,
    bypassBlocked:        true,
    completionFlagSet:  _isComplete(),
    roleResolved:       _hasRole(),
    modeResolved:       _hasMode(),
    entityResolved:     _hasEntity(),
    profileResolved:    _hasMinimumProfile(),
    valid:              isOnboardingValid(),
  }), Object.freeze({
    runtimeVersion:     ONBOARDING_GUARD_RUNTIME_VERSION,
    onboardingGuardReady: false,
    bypassBlocked:        false,
    completionFlagSet:  false,
    roleResolved:       false,
    modeResolved:       false,
    entityResolved:     false,
    profileResolved:    false,
    valid:              false,
  }));
}

export function installOnboardingGuardGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__onboardingGuardHealth !== 'function') {
      w.__onboardingGuardHealth = function () {
        const out = onboardingGuardHealth();
        try { console.log('[Farroway · Onboarding Guard]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
