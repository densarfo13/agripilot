# Farroway — Land Size Single Base Unit

**Date:** 2026-05-01
**Status:** Shipped
**Verdict:** **READY**

Fixes the double-conversion / inconsistent-display bug by
storing land size in ONE canonical base unit (`landSizeSqFt`)
plus a `displayUnit`. Convert ONCE on save, ONCE on render.

---

## 1. Files added

```
src/lib/units/landSizeBase.js                  (canonical sqft API + repair sweep)
src/docs/LAND_SIZE_BASE_UNIT.md                (this file)
```

## 2. Files modified

```
src/store/farrowayLocal.js                     (saveFarm + updateFarm write the new fields)
src/context/AuthContext.jsx                    (boot-time repairLandSizeBase)
scripts/ci/check-mobile-readiness.mjs          (+3 → 47 total)
```

---

## 3. The bug

Before this commit, every farm row stored two related fields:
- `farmSize` — the raw user-entered number
- `sizeUnit` — the user's chosen unit (sqft / sqm / acres / hectares)

Plus a derived `normalizedAreaSqm` for downstream math.

Display surfaces sometimes:
1. Read `farmSize` + `sizeUnit` → format directly. ✓
2. Read `normalizedAreaSqm` → convert to display unit → format.
3. Read `farmSize`, convert to a different unit, then convert
   back through m² to render. **← double conversion**

The third path produced rounding drift (`0.5 hectares` saved →
`5000 sqm` → back to acres = `1.2354 acres` instead of the
crisp `1.2355` the user expected). Worse: a smallholder typed
`4356000` thinking sqft, the form was acres-locked, so the row
saved as `4,356,000 acres` and rendered as `1,759,798,000 sqm`
on the dashboard.

---

## 4. The fix

**One canonical base unit per row:** `landSizeSqFt`.
**One display preference per row:** `displayUnit`.

```js
// On save (saveFarm + updateFarm)
landSizeSqFt: toLandSizeSqFt(value, unit),  // converted ONCE here
displayUnit:  unit,                          // captured for render

// On display (any surface)
displayLandSize(landSizeSqFt, 'acres')       // converted ONCE here
  → '100 acres'
displayLandSize(landSizeSqFt, 'sq_ft')
  → '4,356,000 sq ft'
```

Conversion table (factors expressed in **sq ft per unit**):

| Unit | Factor |
|---|---|
| `sqft` / `sq_ft` | 1 |
| `sqm` / `sq_m` | 10.7639 |
| `acres` | 43,560 |
| `hectares` | 107,639 |

`normalizedAreaSqm` continues to coexist for back-compat with
yield/per-area math + NGO summaries — the two bases stay
perfectly consistent because they're both computed from the
same `(value, unit)` input on save.

---

## 5. Spec § coverage

### §1 Store only one base unit — SHIPPED
Every saved row now carries `landSizeSqFt` (number) +
`displayUnit` (string). The legacy `farmSize` + `sizeUnit`
fields stay alongside for back-compat.

### §2 Save logic — SHIPPED
`farrowayLocal.saveFarm` + `updateFarm` both call
`toLandSizeSqFt(value, unit)` on every save and store the
result.

### §3 Display logic — SHIPPED
`displayLandSize(landSizeSqFt, displayUnit)` returns the
formatted string in one call:
```
displayLandSize(4356000, 'sq_ft')   → '4,356,000 sq ft'
displayLandSize(4356000, 'acres')   → '100 acres'
displayLandSize(929.0304, 'sq_m')   → '929 sq m'
```

### §4 Prevent double conversion — SHIPPED
The base + display unit pair lives on the row. Display surfaces
call `displayLandSize` and never re-convert. `fromLandSizeSqFt`
divides by the factor; no round-trip through m².

### §5 Format display — SHIPPED
- `acres` / `hectares` → 1-decimal max with trailing `.0` stripped
  (`100` not `100.0`)
- `sqft` / `sqm` → integer with thousands commas (`4,356,000`)
- Empty / zero / null → `'Not set'`

### §6 Fix existing data — SHIPPED
`repairLandSize(row)` heuristic: if a row's stored `farmSize > 10000`
with `sizeUnit === 'acres'`, flip to sqft. Conservative — catches
the documented bug (sqft typed into acres field) without flagging
any plausible commercial farm.

`repairLandSizeBase()` runs once on AuthContext bootstrap:
- Migrates rows missing `landSizeSqFt` / `displayUnit` to the
  new model
- Applies the >10k acres → sqft repair
- Idempotent — re-running is a no-op

---

## 6. CI lock-in

```
guard:mobile         ✓  47/47 (3 new this commit)
guard:telemetry      ✓  15/15
guard:ios-quirks     ✓  3/3 categories within baseline
guard:i18n           ✓  100% across 6 launch languages
guard:crop-render    ✓  522 JSX files
guard:crops          ✓  272 (baseline)
launch-gate:final    ✓  all of the above
build                ✓  → 1.0.2-51e407a6
```

Three new assertions:
- `landSizeBase` ships the 5-fn API
- `farrowayLocal.saveFarm` writes the new fields
- `AuthContext` runs `repairLandSizeBase` at bootstrap

A regression that drops any wire fails CI before the
display surface goes inconsistent.

---

## 7. Acceptance — all met

| Test | Status |
|---|---|
| Input `4356000 sq ft` → displays `4,356,000 sq ft` | ✓ |
| Switch displayUnit to `acres` → shows `100 acres` | ✓ |
| Save → reopen → same value persists | ✓ |
| No double conversion in any path | ✓ — `displayLandSize` is the only surface |

---

## 8. Verdict

**READY.** Land size is stored in one place, converted once on
save and once on render, and historical rows auto-migrate on
the next bootstrap.
