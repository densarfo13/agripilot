/**
 * leaveGuard.js — pure helper for the onboarding "Continuing…" stuck-state failsafe
 * (2026-07-05 fix). Extracted so the watchdog condition is unit-testable. No I/O.
 */

/** True when the given pathname is still an onboarding route (navigation didn't take). */
export function isOnboardingPath(pathname) {
  return /\/onboarding|\/fast-onboarding/.test(String(pathname || ''));
}

export default { isOnboardingPath };
