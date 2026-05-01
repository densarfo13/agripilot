# Farroway — Safe-Launch Backyard As Farm Type

**Date:** 2026-05-01
**Status:** Shipped
**Verdict:** **READY**

Safe-launch alignment: keep the existing single `farms[]` data
model, but make backyard / home-garden rows surface as a garden
experience throughout the UI without rewriting storage.

---

## 1. Files modified

```
src/pages/MyFarmPage.jsx                      (adaptive header + 3 adaptive buttons)
src/store/multiExperience.js                  (getActiveExperience derives from farmType)
src/i18n/translations.js                      (5 new keys × 6 launch languages)
scripts/ci/check-mobile-readiness.mjs         (+2 → 49 total)
src/docs/BACKYARD_AS_FARM_TYPE.md             (this file)
```

No data-model migration. Farms continue to live in
`farroway.farms` (with dot) tagged by `farmType`. Backyard
rows have `farmType:'backyard'` (or legacy `'home_garden'`),
farm rows have `'small_farm'` or `'commercial'`.

---

## 2. Spec § coverage

### §1 farmType=backyard treated as garden — ALREADY SHIPPED
- `multiExperience.isGarden(row)` partitions on `farmType`
- `shouldUseBackyardExperience(country, farmType)` gates US
  garden flow
- `useExperience()` exposes the partition to React surfaces
- `BottomTabNav` flips between FARM_TABS and BACKYARD_TABS
  based on the active row's farmType

### §2 UI labels — SHIPPED (NEW for MyFarmPage)
| Surface | Backyard label | Farm label | Where |
|---|---|---|---|
| Header title | My Garden | My Farm | `MyFarmPage.Header` (NEW) |
| Primary action | Edit Garden | Edit Farm | `MyFarmPage` action stack (NEW) |
| Secondary action | Add Farm | Add Garden | `MyFarmPage` action stack (NEW) |
| Tertiary action | Switch to Farm | Switch to Garden / Switch Farm | `MyFarmPage` action stack (NEW) |
| Setup title | Set up your garden | Add New Farm | `gardenSetup.title` / `newFarm.title` — already shipped |
| Nav crop label | Plant | Crop | `getBackyardLabel('photo.scanCrop')` etc. — already shipped |
| Scan label | Take Plant Photo | Scan Crop | `nav.scan` + per-key i18n — already shipped |

### §3 Backyard navigation — ALREADY SHIPPED
`BACKYARD_TABS = [Home, My Garden, Tasks, Progress, Ask, Scan]`
in `BottomTabNav.jsx`. Funding + Sell are NOT in the list.

### §4 Farm navigation — ALREADY SHIPPED
`FARM_TABS = [Home, My Farm, Tasks, Progress, Funding, Sell]`.

### §5 My Farm / My Garden screen — SHIPPED (NEW)
Active row's `farmType` flips the entire surface:

| State | Header | Action 1 | Action 2 | Action 3 |
|---|---|---|---|---|
| backyard | My Garden | **Edit Garden** | **Add Farm** → `/farm/new?intent=farm` | **Switch to Farm** (when other type exists) |
| farm     | My Farm   | **Edit Farm**   | **Add Garden** → `/onboarding/backyard` | Switch to Garden / Switch Farm |

The "Add" button intentionally NEVER edits the active row —
backyard tap-Add-Farm creates a new non-backyard record at
`/farm/new?intent=farm` so the existing garden stays intact.
Farm tap-Add-Garden routes to the backyard onboarding flow
which writes a new `farmType:'backyard'` row.

### §6 Don't overwrite existing farms — ALREADY SHIPPED
- `multiExperience.addGarden(payload)` forces
  `farmType:'backyard'` and writes a NEW row via
  `farrowayLocal.saveFarm`. Never patches an existing row.
- `multiExperience.addFarm(payload)` rejects
  `farmType:'backyard'` cross-writes (falls back to
  `'small_farm'`). Always writes a new row.

### §7 Switch logic — ALREADY SHIPPED
Same `farms[]` list, partitioned at read-time:
- `getGardens()` filters `isGarden(row)`
- `getFarmsOnly()` filters `isFarm(row)`
- `setActiveExperience(target)` flips the pin + repairs the
  active id pointer + emits `farroway:experience_switched`

### §8 On-load derivation — SHIPPED (NEW behaviour)
`getActiveExperience()` now also reads
`farroway_active_farm.farmType` as a derivation step (after the
explicit pin check, before the count-based fallback). So a row
saved as backyard surfaces the garden experience even when no
explicit `farroway_active_experience` pin has been written yet.

### §9 Acceptance — all met
- Existing farm remains intact after adding backyard ✓ (addGarden never patches farms)
- Backyard appears as My Garden ✓ (header + buttons adapt)
- Farm appears as My Farm ✓
- Nav changes correctly ✓ (BottomTabNav reads useExperience)
- Sell/Funding hidden for backyard ✓ (BACKYARD_TABS doesn't list them)
- Sell/Funding visible for farm ✓ (FARM_TABS lists them)
- No onboarding loop ✓ (existing repairSession + explicit-logout flag)
- No data overwrite ✓ (addGarden / addFarm always create new rows)

---

## 3. CI lock-in

```
guard:mobile         ✓  49/49 (2 new this commit)
guard:telemetry      ✓  15/15
guard:ios-quirks     ✓  3/3
guard:i18n           ✓  100% across 6 launch languages
guard:crop-render    ✓  522 JSX files
guard:crops          ✓  272 (baseline)
launch-gate:final    ✓
build                ✓  → 1.0.2-483b582a
```

2 new mobile-readiness assertions:
- `MyFarmPage` adapts header + buttons to backyard farmType
- `getActiveExperience` derives from active farm farmType

A regression that drops either fails CI before the user sees
"My Farm" on a garden screen.

---

## 4. Verdict

**READY.**

Backyard works cleanly for launch using the existing single
`farms[]` data model — the garden experience is a presentation
layer that reads `farmType` and adapts headers, buttons, and
navigation. No storage migration. Future move to dedicated
`gardens[]` + `farms[]` arrays remains a clean refactor when
the team is ready.
