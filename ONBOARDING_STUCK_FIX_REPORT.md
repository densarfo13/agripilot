# ONBOARDING_STUCK_FIX_REPORT.md (2026-07-05)

## 1. Root cause
On the location step (FastOnboarding), a successful GPS fix (`geoStatus === 'granted'`) flips the
Continue button label to "Continuing…" and schedules `finishLocation('auto')`. `finishLocation`
set `finishedRef.current = true` and then called `navigate('/home', { replace: true })` exactly
once. If that navigation was bounced or blocked (a route guard re-evaluating a not-yet-flushed
onboarding flag, or navigate throwing), the user stayed on the page with the button permanently
reading "Continuing…"; every subsequent tap hit the `finishedRef` guard and did nothing — a
permanent stuck state.

## 2. Files changed
- `src/pages/onboarding/FastOnboarding.jsx` — `finishLocation` now routes through a resilient
  `_leaveToHome()`; the weather/geo failure paths (manual entry, general guidance) were already
  present and are unchanged.
- **NEW** `src/pages/onboarding/leaveGuard.js` — pure `isOnboardingPath(pathname)` watchdog
  condition (testable).
- **NEW** `src/pages/onboarding/__tests__/leaveGuard.test.js`.

## 3. Onboarding fix
`_leaveToHome()`: try `navigate('/home')` → on throw `navigate('/dashboard')` → then a **1.2 s
watchdog**: if still on an onboarding path (navigation didn't take), hard-redirect via
`window.location.assign('/home')`. The farmer can no longer be trapped on "Continuing…".
Existing behavior preserved: GPS success auto-continues (~1.8 s); GPS failure reveals manual entry;
a town/ZIP search saves a real location; typing nothing marks general-guidance mode. Continue is
always tappable — geo never gates it.

## 4. Tests added
`isOnboardingPath` — true for `/onboarding*` and `/fast-onboarding` (watchdog fires), false for
`/home`, `/dashboard`, `/farmers/*` (navigation succeeded → no redirect), null/empty safe.

## 5. Production verification
Grant location → farm preview → auto-continues to Home within ~2 s (no stuck "Continuing…").
Simulate a blocked navigation → within ~1.2 s the watchdog hard-redirects to Home. Deny location →
"Enter manually" appears immediately; Continue still advances.
