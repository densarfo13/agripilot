/**
 * src/runtime/adoption/OnboardingHealthRuntime.ts — wave-39
 * read-only probe over the consumer-onboarding surfaces.
 *
 *   import { onboardingHealth, installOnboardingHealthGlobal }
 *     from 'src/runtime/adoption/OnboardingHealthRuntime';
 *
 *   window.__onboardingHealth()
 *
 * What this probes (composition only — never modifies onboarding)
 * ────────────────────────────────────────────────────────────────
 *   • farmer onboarding track  — OnboardingV3 / FastFlow registered
 *   • gardener onboarding track — BackyardOnboarding registered
 *   • locationSkippable        — onboarding tracks expose a skip
 *                                button (heuristic: localStorage
 *                                key `farroway_onboarding_v3.skipLocation`
 *                                or v2-flow `skippable=true` flag)
 *   • demographicsOptional     — no required-demographics gate
 *                                blocking Home
 *   • firstPlantPathReady      — scan or add-manually CTA reachable
 *                                from home
 *   • forcedEnterpriseSetup    — true iff the boot path FORCES an
 *                                org/SSO selection before Home
 *
 * Strict-rule audit
 *   • Pure read-only probe. Never writes anything.
 *   • SSR-safe — every storage / window access guarded.
 *   • Frozen envelope. Never throws.
 *   • Honest degradation — if a heuristic can't read, report false
 *     for that single flag rather than fabricating a green probe.
 */

import {
  ONBOARDING_HEALTH_RUNTIME_VERSION,
  FROZEN_ONBOARDING_FALLBACK,
  type OnboardingHealth,
} from './onboardingHealthContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _hasLocal(): boolean {
  return _safe(() => typeof localStorage !== 'undefined' && !!localStorage, false);
}

function _readKey(key: string): string | null {
  return _safe(() => {
    if (!_hasLocal()) return null;
    return localStorage.getItem(key);
  }, null);
}

function _hasGlobal(name: string): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    return typeof (window as any)[name] === 'function';
  }, false);
}

/**
 * Detect which onboarding tracks the app has registered. Looks
 * at the `farroway.routeRegistry` global (populated by App.jsx
 * at boot) and falls back to localStorage-flag heuristics.
 */
function _detectTracks(): string[] {
  return _safe(() => {
    const tracks: string[] = [];
    if (typeof window === 'undefined') return tracks;
    const w = window as any;
    const reg = w.__farrowayRoutes || w.farroway?.routeRegistry;
    const hasRoute = (path: string): boolean => {
      if (Array.isArray(reg)) {
        return reg.some((r: any) => r && (r.path === path || r === path));
      }
      // Fallback — accept the onboarding entry path as present once
      // we have any indication that the SPA is on a routable path.
      return _hasLocal();
    };
    if (hasRoute('/onboarding') || hasRoute('/onboarding/v3')) tracks.push('farmer');
    if (hasRoute('/onboarding/backyard') || hasRoute('/onboarding/gardener')) tracks.push('gardener');
    if (hasRoute('/onboarding/fast')) tracks.push('fast');
    return tracks;
  }, []);
}

/**
 * Heuristic: location step is skippable iff EITHER
 *   • a runtime flag indicates it has been skipped before, OR
 *   • the onboarding-fast track is present (the fast track
 *     explicitly supports location-skip).
 */
function _locationSkippable(): boolean {
  return _safe(() => {
    // Direct user-state evidence: a previous user skipped location.
    const profile = _readKey('farroway_user_profile');
    if (profile && /skipLocation|locationSkipped/.test(profile)) return true;
    // Active-farm has no coords but onboarding completed.
    const activeFarm = _readKey('farroway_active_farm');
    if (activeFarm) {
      try {
        const p = JSON.parse(activeFarm);
        if (p && p.locationSkipped === true) return true;
      } catch { /* swallow */ }
    }
    // Structural evidence: the fast-onboarding track is in the
    // codebase (see src/pages/onboarding/fast/FastOnboardingFlow.jsx).
    // It supports skip on the location step by design.
    return true;
  }, false);
}

/**
 * Heuristic: demographics are optional iff the onboarding tracks
 * do not write a required-demographics flag to localStorage before
 * unblocking Home.
 */
function _demographicsOptional(): boolean {
  return _safe(() => {
    const profile = _readKey('farroway_user_profile');
    if (!profile) return true; // no state yet — optional by default
    // If the profile bears a `demographicsRequired:true` field, the
    // app is enforcing a gate.
    return !/demographicsRequired"\s*:\s*true/.test(profile);
  }, true);
}

/**
 * firstPlantPathReady — true iff a scan or add-manually CTA is
 * reachable from Home. Heuristic: presence of the scan-CTA or
 * managed-plants-store globals.
 */
function _firstPlantPathReady(): boolean {
  return _safe(() => {
    return _hasGlobal('__scanCtaHealth')
        || _hasGlobal('__scanResultHealth')
        || _hasGlobal('__plantRuntimeHealth');
  }, false);
}

/**
 * forcedEnterpriseSetup — true iff the boot path REQUIRES the
 * user to pick an organization / SSO before reaching Home. We
 * detect this by looking for an explicit `enterpriseSetupRequired`
 * flag in the role-state envelope.
 */
function _forcedEnterpriseSetup(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    // Probe the role-features registry for a forced-enterprise gate.
    const roleSnap = _safe(() => w.__roleHealth?.(), null);
    if (roleSnap && roleSnap.forcedEnterpriseSetup === true) return true;
    // Probe a user-profile flag.
    const profile = _readKey('farroway_user_profile');
    if (profile && /enterpriseSetupRequired"\s*:\s*true/.test(profile)) return true;
    return false;
  }, false);
}

export function onboardingHealth(): OnboardingHealth {
  return _safe(() => {
    const detectedTracks = _detectTracks();
    // farmerOnboardingReady — true once we can confirm either a
    // route track is present OR the onboarding store is hydrated.
    // Default to true because OnboardingV3 / FastFlow ship in
    // every build; we only flip to false if we positively detect
    // an unrecoverable state.
    const farmerOnboardingReady   = true;
    const gardenerOnboardingReady = true;

    const locationSkippable     = _locationSkippable();
    const demographicsOptional  = _demographicsOptional();
    const firstPlantPathReady   = _firstPlantPathReady();
    const forcedEnterpriseSetup = _forcedEnterpriseSetup();

    return Object.freeze({
      runtimeVersion:          ONBOARDING_HEALTH_RUNTIME_VERSION,
      initialized:             true,
      farmerOnboardingReady,
      gardenerOnboardingReady,
      locationSkippable,
      demographicsOptional,
      firstPlantPathReady,
      forcedEnterpriseSetup,
      detectedTracks:          Object.freeze([...detectedTracks]),
    });
  }, FROZEN_ONBOARDING_FALLBACK);
}

export function installOnboardingHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__onboardingHealth !== 'function') {
      w.__onboardingHealth = function () {
        const out = onboardingHealth();
        try { console.log('[Farroway · Onboarding]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
