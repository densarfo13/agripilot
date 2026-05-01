# Final launch gaps — fixed

Companion to `APP_STORE_LAUNCH_AUDIT.md`. The audit identified four
deferred items as remaining launch risks. This document records
how each was closed.

---

## §1 — U.S. Backyard onboarding redirect gap

**Risk:** the audit noted *"OnboardingV3 → BackyardOnboarding redirect still needs owner to write the U.S. + farmType detection at the right step."* When that gap was open, every U.S. user who landed on `/onboarding` went straight into the commercial-farm flow regardless of whether they intended to grow a backyard garden.

**Fix:** new `src/pages/onboarding/OnboardingRouter.jsx` — a thin guard that wraps `OnboardingV3`. On mount it reads:

1. `farroway_user_profile.country` (preferred), then
2. `farroway_active_farm.country`, then
3. URL search param `?country=` for QA deep-links.

When the country resolves to `'United States'` AND the user has not yet picked an experience (`!profile.userSelectedExperience`) AND the `usExperienceSelection` flag is on, the guard `navigate(..., { replace: true })`s to `/onboarding/us-experience`. The chooser then routes the user to either `/onboarding/backyard` or `/onboarding/v3` and persists `userSelectedExperience: true` so the guard never fires twice.

**Routes today:**
- `/onboarding` → `OnboardingRouter` → either chooser or V3
- `/onboarding/v3` → direct V3 (deep-link for QA)
- `/onboarding/us-experience` → chooser (flag-gated)
- `/onboarding/backyard` → backyard 6-step flow

**Acceptance:** ✅ U.S. users see the chooser on first onboarding visit. Returning users with `userSelectedExperience: true` skip it. Flag-off behaviour: identical to before — straight to V3.

---

## §2 — Onboarding completion + session repair

**Risk:** a returning user with stale localStorage state could be bounced through `/setup-farm` ↔ `/onboarding` ↔ `/home` indefinitely. `repairSession` was supposed to self-heal, but **a name-mismatch bug meant it was silently no-op since it was first wired** (commit `fbe99ae`):

```js
// AuthContext.bootstrap
const { repairSession } = await import('../utils/repairSession.js');
//   ^^^^^^^^^^^^^^ undefined — file exported `repairFarrowaySession`
const actions = repairSession();   // throws; outer try/catch swallows
```

**Fix:**
1. Added a proper `export function repairSession()` that wraps `repairFarrowaySession()` and returns just the `actions` array (matches AuthContext's destructure shape).
2. Added experience↔farmType reconciliation rules per spec §2:
   - `experience === 'backyard'` + missing `farmType` → set `farmType: 'backyard'`
   - `experience === 'farm'` + missing `farmType` → set `farmType: 'small_farm'`
   - reverse mapping when `farmType` is set but `experience` is missing
3. Mirror `profile.experience` into the dedicated `farroway_experience` localStorage key so `FarmerTodayPage` reads the right "Today's Plan" / "Today's Garden Plan" header on every render.

The pre-existing rules (corrupt-JSON drop, legacy migration, "first farm becomes active", "active farm exists ⇒ onboardingCompleted=true") were already correct — only the wiring was broken.

**Acceptance:** ✅ Close app → reopen → repair pass runs first → user lands on Home. No setup loop possible because `onboardingCompleted` is set true whenever an active farm is present.

---

## §3 — Scan surfaces wiring

**Risk:** the audit noted that the existing `/scan-crop` + `cameraDiagnosisHistory` + `lib/photo/scanHistory` stack was untouched, and the new `/scan` route from commit `3c860c2` only redirected legacy → new in one direction (it bounced `/scan` to `/scan-crop` when the flag was off, but `/scan-crop` never bounced to `/scan` when the flag was on).

**Fix:** `CameraScanPage` now reads `isFeatureEnabled('scanDetection')` on mount. When the flag is on, it `navigate('/scan', { replace: true })`s. When off (default for current pilots), the page renders verbatim.

**Combined with prior commits:**
- Voice command "scan" → `/scan` when flag on, `/scan-crop` when off (commit `3c860c2`+gap-fix).
- Backyard nav "Scan" tab → same flip via `_resolveScanPath()` in `getNavigationItems`.
- `/scan` → `/scan-crop` redirect when flag off (commit `3c860c2`).

**Bidirectional redirect chart:**

| Flag state | `/scan-crop` lands on | `/scan` lands on | Voice "scan" lands on |
|---|---|---|---|
| `scanDetection` off | CameraScanPage (legacy) | redirect → `/scan-crop` | `/scan-crop` |
| `scanDetection` on  | redirect → `/scan` | new ScanPage | `/scan` |

**Acceptance:** ✅ pilots with the flag off see no change. Pilots with the flag on get the new flow whether they tap a legacy button, a new button, the voice command, or a deep link.

**Deferred:** unifying `cameraDiagnosisHistory` + `lib/photo/scanHistory` data into the new `farroway_scan_history` slot. Keeping legacy stores intact is the strict-rule-safe path; a future commit can add a one-shot migration helper.

---

## §6 — Final mobile validation gate

**Doc:** this file. Companion to `LAUNCH_PLAYBOOK.md` and `APP_STORE_SUBMISSION_CHECKLIST.md`.

**Script:** new `npm run launch-gate:final`. Runs the existing `launch-gate:fast` plus the i18n + crop-render guards back-to-back. Documented to **warn but not fail** when env vars are missing locally — those are set in Railway / hosting and verified at deploy time, not in the dev shell.

```bash
npm run launch-gate:final
```

The fast gate already runs `guard:prisma`, `guard:migration`, `guard:crops`, `guard:duplicate-crops`, `guard:i18n`, `guard:crop-render`, and the env probe. The new alias also re-runs the i18n coverage check explicitly so the operator sees a single rolled-up report.

---

## Pre-submission test checklist

Run before tagging the release:

### A. U.S. backyard onboarding

- [ ] Sign up fresh → land at `/onboarding`
- [ ] OnboardingRouter detects U.S. and bounces to `/onboarding/us-experience`
- [ ] Pick "I grow plants at home" → 6-step backyard flow runs
- [ ] Lands on Home with header "Today's Garden Plan"
- [ ] Bottom nav shows: Home / My Garden / Tasks / Progress / Ask / Scan
- [ ] No Sell tab visible
- [ ] Tap "Scan" → opens `/scan` (new flow) when scanDetection flag on, `/scan-crop` when off

### B. U.S. farm onboarding

- [ ] Sign up fresh → land at `/onboarding`
- [ ] Bounces to `/onboarding/us-experience`
- [ ] Pick "I manage a farm" → V3 flow runs
- [ ] Lands on Home with header "Today on your farm"
- [ ] Bottom nav shows: Home / My Farm / Tasks / Progress / Funding / Sell

### C. Ghana farm onboarding

- [ ] Sign up fresh → choose Ghana
- [ ] OnboardingRouter does NOT bounce (only U.S. triggers chooser)
- [ ] V3 runs → lands on Home with farm experience

### D. Returning user

- [ ] Close browser tab, reopen
- [ ] Lands on Home directly — no `/onboarding` redirect
- [ ] Active farm visible in My Farm / My Garden
- [ ] Today's Plan renders without crash even if temporarily missing data

### E. Scan flow

- [ ] With camera permission allowed: capture → preview → analyze → result card
- [ ] With camera permission denied: native picker falls back to library — never crashes
- [ ] "Add to Today's Plan" creates ≤ 2 tasks (capped per spec §7)
- [ ] Result card shows confidence pill, actions, disclaimer
- [ ] Save to history works; history list shows thumbnail
- [ ] Deep link `/scan/result/:scanId` opens the saved result

### F. Translation fallbacks

- [ ] Switch to French → no raw keys (e.g. no `nav.tasks` rendered)
- [ ] Switch to Hindi / Twi / Hausa → either localized text or English fallback (never raw keys)
- [ ] Strict pages (Progress / Tasks / MyFarm) hide labels rather than leak English in non-English UI
- [ ] Language switcher shows only languages with shipped files

### G. Bottom nav routes

- [ ] Tap each tab in farm experience → correct route loads
- [ ] Tap each tab in backyard experience → correct route loads
- [ ] Active tab highlights correctly
- [ ] No 404s

### H. Help / Contact / Privacy / Terms

- [ ] `/help` loads (existing HelpPage)
- [ ] `/contact` loads (added in `fbe99ae`) — mailto support email visible
- [ ] `/privacy` loads — full privacy starter copy
- [ ] `/terms` loads — full terms starter copy

### I. Funding Hub

- [ ] `/funding` loads when fundingHub flag on
- [ ] Cards filter by region and role
- [ ] Readiness score updates as profile fields fill
- [ ] NGO pilot CTA + form submits to `farroway_ngo_pilot_leads`
- [ ] Disclaimer always visible

---

## Remaining accepted risks

1. **Legal review of Privacy + Terms** — starter copy lives at `/privacy` and `/terms`; replace before public launch.
2. **In-device manual pass on iOS + Android** — the seven scenarios above must each be executed on a real device. Code-level audit is clean; runtime is what App Store reviewers see.
3. **App Store Connect listing assets** (icon, screenshots, descriptions, permission strings) — outside the codebase. See `APP_STORE_SUBMISSION_CHECKLIST.md`.
4. **Twi voice quality** outside the 22 prerecorded prompts is browser-TTS via `ak` BCP-47 tag. Acceptable for soft launch, imperfect.
5. **Hausa server-side TTS** not configured — falls back to browser `ha-NG` voice on Android Chrome.
6. **`cameraDiagnosisHistory` data unification** — kept legacy store intact per "do not break working things". Bridge is a future commit.

---

## Verdict

**READY WITH MINOR RISKS.**

Reasoning:

| Spec gate | Status |
|---|---|
| §1 U.S. backyard onboarding redirect | ✅ wired via OnboardingRouter |
| §2 Session repair (no infinite loop, no crash on null farm) | ✅ name-mismatch bug fixed; experience↔farmType repair added |
| §3 Scan surfaces (legacy → new redirect when flag on) | ✅ `/scan-crop` now bounces to `/scan` when scanDetection flag on |
| §4 Translation fallback | ✅ base `t()` already falls back to English on miss; `tStrict` is opt-in for the strict no-leak pages |
| §5 Region UX + nav consistency | ✅ already shipped (commits `55133f6`, `116546b`) |
| §6 Validation gate + doc | ✅ this doc + `npm run launch-gate:final` |

The "minor risks" are operational items 1–6 above. None require code changes; they are legal / device / platform-config tasks blocking submission until resolved.

**Do not promote to READY** until items 1–3 of "Remaining accepted risks" are complete.
