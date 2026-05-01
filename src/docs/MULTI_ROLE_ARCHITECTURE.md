# Farroway — Multi-Role Architecture Migration

**Date:** 2026-05-01
**Status:** Shipped
**Verdict:** **READY FOR TESTING**

Separates Gardens and Farms as first-class entities while
preserving every existing reader of the legacy
`farroway.farms` partition. Single boot-time orchestrator
chains migration → experience repair → landsize repair, all
bailing on the explicit-logout flag.

---

## 1. Files added

```
src/utils/migrateLegacyFarms.js          (one-time backup + split + sentinel)
src/core/activeContext.js                 (unified resolver across all roles)
src/utils/repairActiveContext.js          (single boot-time orchestrator)
src/docs/MULTI_ROLE_ARCHITECTURE.md       (this file)
```

## 2. Files modified

```
src/store/farrowayLocal.js                (dual-write to new arrays after migration)
src/context/AuthContext.jsx               (single repairActiveContext call replaces ad-hoc chain)
scripts/ci/check-mobile-readiness.mjs     (+5 → 54 total)
```

No breaking changes. Legacy `farroway.farms` still written.
NGO dashboards, sync engine, demo seeder, scan history — all
existing readers stay green.

---

## 3. Migration summary

**One-time `migrateLegacyFarms()`** runs on every AuthContext
bootstrap until the sentinel is set:

```
farroway.farms          (legacy partition)
  ├── { farmType: 'backyard',   ... }   ┐
  ├── { farmType: 'home_garden', ... }  ├ farroway_gardens
  ├── { farmType: 'small_farm', ... }   ┐
  └── { farmType: 'commercial', ... }   ├ farroway_farms
                                         
  → farroway_legacy_farms_backup        (verbatim snapshot)
  → farroway_full_architecture_migrated = 'true'   (sentinel)
```

After migration, every `saveFarm` / `updateFarm` call ALSO
writes the row to `farroway_gardens` (backyard rows) or
`farroway_farms` (every other type) via `_dualWriteToNewArrays`.
Legacy `farroway.farms` continues to be written too — both
shapes stay in sync.

### Action tags emitted

```
migrate:skipped_explicit_logout        — boot is past Logout
migrate:skipped_already_migrated       — sentinel already set
migrate:skipped_no_legacy_data         — empty legacy store
migrate:backup_written                 — legacy snapshot saved
migrate:gardens_written:N
migrate:farms_written:N
migrate:sentinel_set
experience:*                           — from repairExperience
landsize:*                             — from repairLandSizeBase
```

Each step is **self-bailing** on the explicit-logout flag.

### Old-data backup location

```
localStorage['farroway_legacy_farms_backup']
```

Verbatim copy of `farroway.farms` taken BEFORE any new array
is written. Survives until cleared manually or by
`clearFarrowayCache()`.

---

## 4. Active-context resolver

`getActiveContext({ user })` returns:

```js
{
  role,                                  // 'farmer' | 'super_admin' | 'buyer' | …
  activeExperience,                      // 'garden' | 'farm' | 'buyer' |
                                         //  'ngo_admin' | 'platform_admin'
  activeGardenId,
  activeFarmId,
  gardens,
  farms,
  onboardingCompleted,
  needsOnboarding,
  loggedOut,                             // true when explicit_logout set
}
```

Resolution rules (spec §3):

| Role | activeExperience |
|---|---|
| `farmer` (or unknown) with backyard active | `'garden'` |
| `farmer` (or unknown) with farm active | `'farm'` |
| `buyer` | `'buyer'` |
| `ngo_admin` / `program_admin` / `reviewer` / `field_officer` / `institutional_admin` / `agent` | `'ngo_admin'` |
| `super_admin` / `investor_viewer` | `'platform_admin'` |
| explicit-logout flag set | `null` (loggedOut: true) |

For grower roles the resolver **prefers the post-migration
arrays** (`farroway_gardens` / `farroway_farms`) and **falls
back to the legacy partition** when the migration hasn't run
yet. So the same code works pre- and post-migration without
branching.

---

## 5. Boot-time chain

`AuthContext.bootstrap` runs (in order, each step bails on
explicit-logout):

```
1. repairSession            (already shipped)
2. repairActiveContext      (NEW — single entry chains:)
     ├── migrateLegacyFarms()
     ├── repairExperience()
     └── repairLandSizeBase()
3. cached profile restore   (already shipped)
4. /me validate             (already shipped)
```

Replaces the previous ad-hoc inline chain of three separate
imports + three separate try/catch blocks.

---

## 6. CI lock-in

```
guard:mobile         ✓  54/54 (5 new this commit)
guard:telemetry      ✓  15/15
guard:ios-quirks     ✓  3/3 categories within baseline
guard:i18n           ✓  100% across 6 launch languages
guard:crop-render    ✓  522 JSX files
guard:crops          ✓  272 (baseline)
launch-gate:final    ✓  all of the above
build                ✓  → 1.0.2-aa292be3
```

5 new mobile-readiness assertions:
- `migrateLegacyFarms` ships dual-store split + backup + sentinel
- `activeContext` resolver covers grower + non-grower roles
- `repairActiveContext` orchestrates migrate + repair + landsize
- `AuthContext` bootstrap calls `repairActiveContext`
- `farrowayLocal` dual-writes new arrays after migration

---

## 7. Acceptance tests — all addressable from this commit

| # | Test | How addressed |
|---|---|---|
| A | Old backyard farm migrates to garden | `migrateLegacyFarms` splits by `farmType`; backup preserves originals |
| B | Old real farm migrates to farm | Same — non-backyard rows go to `farroway_farms` |
| C | Switch between garden + farm | `useExperience` + `ExperienceSwitcher` (already shipped) |
| D | Garden nav shows no Sell/Funding | `BACKYARD_TABS` (already shipped) |
| E | Farm nav shows Sell/Funding | `FARM_TABS` (already shipped) |
| F | Garden tasks isolated from farm | Tasks attach to `farmId`; switch flips the active id |
| G | Farm tasks isolated from garden | Same |
| H | Scan saves under correct entity | Scan writes use the active id (already shipped) |
| I | Logout doesn't auto-login | `farroway_explicit_logout` flag + bootstrap bail (already shipped) |
| J | Returning user loads last context | `getActiveContext` reads pin → derives → falls through |
| K | No setup loop | `repairSession` stamps `onboardingCompleted` when farm exists (already shipped) |
| L | Buyer / admin routes work | `FarmerEntry` per-role redirect map (already shipped) |

---

## 8. Risks

**Medium:**
- The dual-write pattern doubles storage usage for farm rows
  until full cutover. Acceptable: legacy `farroway.farms` is
  capped at 200 rows by the existing market-store helper, and
  the new arrays are bounded by the same data.
- A botched migration leaves `farroway_legacy_farms_backup`
  and the sentinel un-set — backup-then-sentinel ordering
  ensures retry on next boot picks up where it left off.

**Low:**
- The resolver assumes `farroway_user_profile` is the
  canonical user shape for grower roles. Non-grower roles
  pass through `getActiveContext({ user })` cleanly.

**None:**
- No unrelated features added.
- No backend changes.
- No new feature flags.

---

## 9. Verdict

**READY FOR TESTING.**

The migration is idempotent, sentinel-guarded, backup-first,
explicit-logout-aware, and CI-locked. Existing readers see no
breaking change. New consumers can target the first-class
arrays via `getActiveContext` whenever they're ready to
migrate.
