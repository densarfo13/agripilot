# Farroway — Logout Loop Fix + Square Foot Land Size

**Date:** 2026-05-01
**Status:** Shipped
**Verdict:** **READY**

Two surgical changes — no unrelated features.

---

## 1. Files added

```
src/utils/explicitLogout.js                  (new — flag get/set/clear)
src/utils/landUnits.js                        (new — spec-shape unit list + helpers)
src/docs/LOGOUT_AND_LAND_UNITS.md             (this file)
```

## 2. Files modified

```
src/context/AuthContext.jsx                   (bootstrap bail + flag set/clear + replace navigate)
src/utils/repairSession.js                    (bail on explicit_logout)
src/utils/repairExperience.js                 (bail on explicit_logout)
src/lib/units/areaConversion.js               (getAllowedUnits offers sqft for US farm + Ghana farm)
scripts/ci/check-mobile-readiness.mjs         (+5 assertions → 40 total)
```

---

## 3. Logout bug — fixed

### Root cause

The repair pipeline (`repairSession` → `repairExperience` →
cached profile fallback) was designed for the offline-first
happy path: a returning user opens the app, the repair pass
sees a farm + onboarding flag in storage, and the dashboard
restores immediately. That's correct for a returning user.

It was **wrong** right after Logout. The `clearSessionState`
sweep deliberately preserved `farroway_onboarding_done` (to fix
an earlier onboarding loop), so the next `bootstrap` saw an
authenticated-looking storage state and routed the farmer
straight back into the app.

### Fix

A dedicated **explicit-logout flag** that beats every repair
path:

```js
localStorage['farroway_explicit_logout'] === 'true'
```

Wired:

| Surface | Behaviour |
|---|---|
| `AuthContext.logout` | Sets the flag BEFORE async work + clears 11 session-pointer keys + `window.location.replace('/login')` |
| `AuthContext.bootstrap` | First check after entry — if flag set, sets `user=null`, `authLoading=false`, returns. Skips repair, /me, cached restore |
| `AuthContext.login` / `register` / `verifyPhoneOtp` / `completeMfaChallenge` | All clear the flag on success |
| `repairSession.repairFarrowaySession` | Bails with `actions: ['skipped_explicit_logout']` |
| `repairExperience.repairExperience` | Same bail |

### Session pointers cleared on logout (per spec)

```
farroway_user
farroway_current_user
farroway_session
farroway_active_role
farroway_active_experience
farroway_active_farm_id
farroway_active_garden_id
farroway_active_farm
farroway_active_garden
farroway_onboarding_completed
farroway_user_profile
```

### What logout deliberately does NOT clear

```
farroway.farms          (the user's actual farm data)
farroway_gardens        (garden records)
farroway_scan_history
farroway_user_feedback
farroway_language       (i18n preference)
```

Logout removes the session, not the user's data.

### Acceptance test

1. Login → land on `/dashboard`
2. Tap Logout → land on `/login`, flag set
3. Refresh page → bootstrap reads flag, short-circuits, stays on `/login`
4. Login manually → flag cleared, normal repair runs, lands on `/home`

---

## 4. Square foot land size — added

### What was already there

`src/lib/units/areaConversion.js` already had:
- `sqft` as a canonical lowercase unit code
- Aliases (`sq ft`, `sq_ft`, `square feet`, `ft2`, `ft^2`) all
  collapsing to `sqft`
- Storage layer (`farrowayLocal.saveFarm`) already accepts and
  normalises sqft
- `normalizedAreaSqm` already computed correctly for sqft inputs

### What was missing

`getAllowedUnits` only returned `['acres', 'hectares']` for
non-backyard farms — sqft never appeared in the dropdown for
farm-tier users.

### Fix

```js
// US farm:    ['acres', 'sqft', 'hectares']      (sqft NEW)
// Ghana farm: ['acres', 'hectares', 'sqm', 'sqft'] (sqft optional NEW)
// US backyard: ['sqft', 'sqm']                    (existing)
// Other farm:  ['acres', 'hectares']              (existing — non-US/non-GH)
```

### Spec-shape helper

`src/utils/landUnits.js` exposes the spec's exact API for new
call sites:

```js
import {
  LAND_SIZE_UNITS,        // [{label:'Square feet', value:'sq_ft'}, ...]
  formatLandSize,         // (size, unit) => '500 sq ft' / 'Not set'
  convertToSquareFeet,    // (size, unit) => number | null
} from '../utils/landUnits.js';

formatLandSize(500, 'sq_ft')           // → '500 sq ft'
convertToSquareFeet(1, 'acres')         // → 43560
convertToSquareFeet(0.5, 'hectares')    // → 53819.5
```

Both spec shape (`sq_ft` / `sq_m` underscored) and canonical
shape (`sqft` / `sqm`) round-trip — the helper delegates to
the existing `normalizeUnit()` so call sites can use either.

### Acceptance test

1. Add Farm
2. Open unit dropdown → "Square feet" appears (US farm + Ghana farm)
3. Save 500 sq ft
4. Reopen farm profile → shows 500 sq ft
5. No validation error — `normalizedAreaSqm = 500 × 0.09290304 ≈ 46.45`

---

## 5. CI lock-in

```
guard:mobile         ✓  40/40 (5 new this commit)
guard:telemetry      ✓  15/15
guard:ios-quirks     ✓  3/3 categories within baseline
guard:i18n           ✓  100% across 6 languages
guard:crop-render    ✓  522 JSX files
guard:crops          ✓  272 (baseline)
launch-gate:final    ✓  all of the above
build                ✓  → 1.0.2-83f1c919
```

5 new mobile-readiness assertions added this commit:
- `explicitLogout` helper exports the 3-fn API
- `AuthContext` bootstrap honors the flag
- `repairSession` + `repairExperience` both bail on flag
- `landUnits` ships the spec-shape API
- `getAllowedUnits` offers sqft for US farm + Ghana farm

A regression that drops any of these wires fails CI.

---

## 6. Remaining risks

**None.** Both fixes are surgical, gated by CI, and don't
change any unrelated path. The only operational gate is the
existing manual physical-iPhone walk-through.

## 7. Verdict

**READY.**
