# Farroway — Full Architecture Go-Live Audit

**Date:** 2026-05-01
**Status:** Shipped
**Verdict:** **READY FOR TESTING**

Comprehensive 21-section audit of every entity, route, role,
and surface after the multi-role architecture migration. No
new features. Surgical fixes only.

---

## 1. Summary

The architecture migration (commit `9f61eff`) split the legacy
single `farroway.farms` partition into first-class
`farroway_gardens` + `farroway_farms` arrays with a one-time
migration + sentinel + verbatim backup. This audit closes the
4 remaining surface-level gaps that didn't fit in that commit.

| § | Gap | Status |
|---|---|---|
| §7 Navigation | Buyer + NGO had no mobile bottom nav | **FIXED** — `BuyerBottomNav` + `NgoBottomNav` mounted in ProtectedLayout by role |
| §15 Buyer empty state | Wrong copy on `marketplace.empty` / `market.browse.noResults` | **FIXED** — both keys now match spec verbatim (6 launch langs) |
| §17 Language audit | `useScreenTranslator` had no in-tree consumer | **FIXED** — wired into `AllSetForTodayCard` |
| §19 Privacy policy | Missing marketplace + localStorage + data-rights sections | **FIXED** — two new `<h2>` sections added |

Every other §-section was already shipped via prior commits in
this session. See the matrix below.

---

## 2. Files changed in this audit

```
src/components/buyer/BuyerBottomNav.jsx                (new — buyer mobile nav)
src/components/admin/NgoBottomNav.jsx                  (new — NGO mobile nav)
src/layouts/ProtectedLayout.jsx                        (role-aware nav switch)
src/i18n/translations.js                               (+11 new keys × 6 langs; spec empty-state copy)
src/components/home/AllSetForTodayCard.jsx             (useScreenTranslator wire)
src/pages/PrivacyPolicy.jsx                            (+marketplace + storage sections)
scripts/ci/check-mobile-readiness.mjs                  (+5 → 58 total)
src/docs/FULL_ARCHITECTURE_GO_LIVE_AUDIT.md            (this file)
src/docs/FULL_ARCHITECTURE_GO_LIVE_CHECKLIST.md        (sibling pass/fail walkthrough)
```

---

## 3. Per-section verdict matrix

| § | Section | Verdict | Anchor |
|---|---|---|---|
| §1 | Architecture audit | ✓ shipped | `MULTI_ROLE_ARCHITECTURE.md` |
| §2 | Data model | ✓ shipped | `migrateLegacyFarms` decorates `experience` + `userId` |
| §3 | Legacy migration | ✓ shipped | sentinel + backup + idempotent (commit `9f61eff`) |
| §4 | Active context | ✓ shipped | `src/core/activeContext.js` + `repairActiveContext` |
| §5 | Session + logout | ✓ shipped | `farroway_explicit_logout` flag + bootstrap bail (`3dfb27f`) |
| §6 | Role routing | ✓ shipped | `FarmerEntry` per-role redirect map |
| §7 | Navigation | **FIXED** | `BuyerBottomNav` + `NgoBottomNav` (this audit) |
| §8 | Experience switcher | ✓ shipped | `ExperienceSwitcher` + `ExperienceManageCard` (`53d4d25`) |
| §9 | Label consistency | ✓ shipped | `getExperienceLabels` + adaptive MyFarmPage (`5352d34`) |
| §10 | Task isolation | ✓ shipped | tasks read active id; switch flips it |
| §11 | Scan context | ✓ shipped | scan attaches via active id; canonical `/scan` route |
| §12 | Farm size / unit | ✓ shipped | `landSizeBase.js` single sqft base (`e60c9fe`) |
| §13 | Funding access | ✓ shipped | `BackyardGuard` redirects garden users |
| §14 | Sell / marketplace | ✓ shipped | `BackyardGuard` + `LISTING_STATUS` taxonomy |
| §15 | Buyer flow | **FIXED** | empty-state copy now matches spec (this audit) |
| §16 | NGO / admin flow | ✓ shipped | `NgoDashboard` empty state (`b0cca60`) |
| §17 | Language audit | **FIXED** | `useScreenTranslator` consumer (this audit) |
| §18 | Mobile + error | ✓ shipped | RecoveryErrorBoundary 4-button card + safe-area + scroll-margin |
| §19 | Legal / support | **FIXED** | privacy now mentions marketplace + localStorage + data rights (this audit) |
| §20 | Test checklist | NEW | `FULL_ARCHITECTURE_GO_LIVE_CHECKLIST.md` (this audit) |
| §21 | Final verdict | **READY FOR TESTING** | see §6 below |

---

## 4. Migration issues fixed

None — the migration shipped clean in `9f61eff`. Reconfirmed
this audit:
- Sentinel-guarded (`farroway_full_architecture_migrated`) → no
  re-runs after first success
- Backup-first (`farroway_legacy_farms_backup`) → roll-back path
  exists
- Bails on explicit-logout flag → never runs against a
  logged-out session
- Action tags emitted: `migrate:backup_written`,
  `migrate:gardens_written:N`, `migrate:farms_written:N`,
  `migrate:sentinel_set`

---

## 5. Routing / session issues fixed

None this audit — all closed in earlier commits:
- Logout auto-relogin loop → `3dfb27f` (explicit-logout flag)
- Stale active pointer → `repairExperience` rules 1–6
- Land-size double conversion → `e60c9fe` (sqft single base)
- Crash on null farm → `d821a50` (ExperienceFallback wraps
  /dashboard + /my-farm)
- Onboarding loop → `repairSession` stamps
  `farroway_onboarding_completed` when farm exists
- Per-role redirect map → `FarmerEntry`

---

## 6. Role / navigation issues fixed (THIS AUDIT)

**§7 — Buyer + NGO mobile bottom nav.**

Before this audit, ProtectedLayout rendered
`{isFarmer && <BottomTabNav />}` only. Buyer + NGO/staff users
had no mobile navigation — they could only navigate via direct
URL or the desktop sidebar (V1 admin Layout, hidden on phones).

Fix:
- `src/components/buyer/BuyerBottomNav.jsx` — Buy / Saved /
  Interests / Contact / Profile (5 tabs, spec §7)
- `src/components/admin/NgoBottomNav.jsx` — Dashboard / Farmers
  / Programs / Reports / Funding Leads / Settings (6 tabs,
  spec §7, horizontally scrollable on narrow screens)
- ProtectedLayout role switch:
  ```jsx
  if (isFarmer || role === 'farmer')   return <BottomTabNav />;
  if (role === 'buyer')                return <BuyerBottomNav />;
  if (role in NGO_STAFF_ROLES)         return <NgoBottomNav />;
  return null;  // platform admin uses V1 desktop sidebar
  ```
- 11 new i18n keys × 6 launch languages
  (`buyer.nav.*`, `ngo.nav.*`)
- Both new navs honor `safe-area-inset-bottom` and skip the
  same setup-path blocklist `BottomTabNav` uses

Platform admin continues to use the V1 desktop sidebar
(`Layout.jsx`) which already covers Overview / Users / Audit /
Portfolio / Reports / Intelligence / Operations.

---

## 7. Data integrity risks remaining

**Low.**

1. **Dual-write storage doubles farm rows** until the team
   chooses to fully cut over from the legacy `farroway.farms`
   array. Capped at 200 rows by the existing market-store
   helper. Acceptable.

2. **Migration assumes `farroway_user_profile` is the
   canonical user shape** for grower roles. Non-grower roles
   pass through `getActiveContext` cleanly.

3. **Live iOS device walk-through** remains as the only
   manual gate. `guard:ios-quirks` (3 categories at baseline)
   shrinks the surface a real iPhone has to verify.

**No high or medium risks.** No backend changes. No new
feature flags. No unrelated features.

---

## 8. CI lock-in

```
launch-gate:final  ✓
guard:i18n         ✓  100% across 6 launch languages
guard:crop-render  ✓  522 JSX files
guard:crops        ✓  272 (baseline)
guard:mobile       ✓  58/58 (5 new this audit)
guard:telemetry    ✓  15/15
guard:ios-quirks   ✓  3/3 categories within baseline
build              ✓  → 1.0.2-808a2cf4
```

5 new mobile-readiness assertions added this audit:
- `BuyerBottomNav` + `NgoBottomNav` exist and are mounted
- `PrivacyPolicy` mentions marketplace + localStorage + data
  rights
- `useScreenTranslator` wired into a canonical home surface
- Buyer empty-state copy matches spec sentence

---

## 9. Final verdict

**READY FOR TESTING.**

All 21 audit sections are green. No data overwrite. No login
loop. Garden ↔ farm switch works without mixing tasks or scans.
Buyer + NGO + platform admin routes work. Mobile + error
recovery hardened. Legal pages reachable + comprehensive.
Migration is idempotent + backup-first + explicit-logout-aware.

The only outstanding gate is the manual physical-iPhone
walk-through documented in
`FULL_ARCHITECTURE_GO_LIVE_CHECKLIST.md`.
