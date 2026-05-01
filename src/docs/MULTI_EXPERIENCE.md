# Farroway — Multi-Experience System

**Date:** 2026-05-01
**Status:** Shipped

Allows a single user to own BOTH a backyard garden AND a small /
commercial farm at the same time, switch contexts safely, and
never overwrite one with the other.

---

## 1. Problem

Before this change, the codebase modeled "experience" as a
one-time-per-user flag (`farroway_experience` = 'backyard' |
'farm'). The bottom-tab nav, home dashboard, and data hooks all
read the active profile's `farmType`. That worked for the 95%
case (a user has either a garden OR a farm) but broke for a
real subset: U.S. users who run a backyard plot AND a small
field plot, or NGO-pilot farmers who keep a kitchen garden
alongside their commercial crop.

Spec ask: support both, store separately, switch cleanly,
never overwrite.

---

## 2. Design

**Storage stays untouched.** Gardens and farms continue to live
in `farroway.farms` (the canonical row store) tagged by
`farmType`. Backyard rows have `farmType === 'backyard'`; farm
rows are `'small_farm'` or `'commercial'`. Every existing reader
(NGO dashboards, sync engine, demo seeder, repairSession) keeps
working with no migration.

A thin **selector layer** over that store partitions rows into
gardens vs farms and tracks the user's active pointer for each:

```
┌─────────────────────────────────────────────────────────┐
│  farroway.farms                                          │
│   ├── { id: 'g1', farmType: 'backyard', ... }    ┐      │
│   ├── { id: 'g2', farmType: 'home_garden', ... } ├ getGardens()
│   ├── { id: 'f1', farmType: 'small_farm', ... }  ┐      │
│   └── { id: 'f2', farmType: 'commercial', ... }  ┴ getFarmsOnly()
└─────────────────────────────────────────────────────────┘
        ↑                                  ↑
        │                                  │
   active garden id                  active farm id
   farroway_active_                  farroway.activeFarmId
   garden_id                         (existing key)
        ↑                                  ↑
        └──── farroway_active_experience ──┘
                ('garden' | 'farm')
```

---

## 3. New storage keys

| Key | Type | Notes |
|---|---|---|
| `farroway_active_experience` | `'garden'` \| `'farm'` | Pinned context; resolution falls back to the only available experience |
| `farroway_active_garden_id` | string | Active garden row id |
| `farroway.activeFarmId` | string | Existing key — active farm row id |

Resolution rule for `getActiveExperience()`:
1. Pinned + has rows of that type → use pin
2. Only gardens exist → 'garden'
3. Only farms exist → 'farm'
4. Both exist, no valid pin → 'farm' (historical default)
5. Neither → null

A stale pin (e.g. user deleted their last garden) is ignored,
so the app never renders an empty surface because of a leftover
pointer.

---

## 4. API

### `src/store/multiExperience.js`

```js
import {
  EXPERIENCE,                 // { GARDEN: 'garden', FARM: 'farm' }
  SWITCH_EVENT,               // 'farroway:experience_switched'
  isGarden, isFarm,           // row classifiers
  getGardens, getFarmsOnly,   // partitioned arrays
  getActiveExperience,        // 'garden' | 'farm' | null
  getActiveGardenId, setActiveGardenId,
  getActiveEntity,            // current garden OR farm row
  setActiveExperience,        // pin + emit event
  switchExperience,           // alias for setActiveExperience
  addGarden, addFarm,         // forced-type writers
  removeExperience,           // delete + repair active pointer
  getExperienceSnapshot,      // single-read for hooks
} from '../store/multiExperience.js';
```

### `src/hooks/useExperience.js`

```js
import useExperience from '../hooks/useExperience.js';

const {
  experience,        // 'garden' | 'farm' | null
  activeEntity,
  gardens, farms,
  hasGarden, hasFarm, hasBoth,
  switchTo,          // (target) => void
  addGarden, addFarm,
  removeExperience,
  EXPERIENCE,
} = useExperience();
```

The hook subscribes to:
- The `farroway:experience_switched` window event (in-tab updates)
- The `storage` event (cross-tab updates — switching in tab A
  re-renders tab B without a manual reload)

### `src/components/system/ExperienceSwitcher.jsx`

A small chip (`Garden` / `Farm` pills) mounted in the
ProtectedLayout header. **Self-suppresses** when the user has
only one experience or none — single-experience pilots see no
visual change. Tapping the inactive pill:
1. Calls `switchTo(target)` → flips `farroway_active_experience`
2. Repairs the active id pointer for the target experience
3. Fires `farroway:experience_switched` (BottomTabNav, home
   surfaces, data hooks listen and re-render)
4. Emits `experience_switch_tap` analytics with `{ from, to }`

---

## 5. Invariants

| Rule | Enforcement |
|---|---|
| `addGarden` writes `farmType: 'backyard'` | Hard-coded in store; can't be overridden |
| `addFarm` rejects `farmType: 'backyard'` | Cross-type writes fall back to `'small_farm'` |
| `setActiveGardenId` only accepts garden rows | Validated against `getGardens()` before write |
| Empty experience can't be pinned | `setActiveExperience` returns false if target has no rows |
| Same-experience writes are no-ops | No spurious events |
| Deleted active row repairs pointer | `removeExperience` clears the pointer + re-derives |

---

## 6. Edge cases handled

1. **No active experience** — `getActiveEntity()` returns null;
   home surfaces render their existing empty states.
2. **Missing data** — `getExperienceSnapshot()` always returns a
   well-shaped object even with zero rows (`{ gardens: [],
   farms: [], activeExperience: null, ... }`).
3. **Deleted experience** — `removeExperience(id)` strips the row,
   clears any active pointer that referenced it, and re-derives
   the active experience.
4. **Cross-tab switching** — `useExperience` listens for
   `storage` events on the new keys, so a switch in tab A also
   re-renders tab B.
5. **Race during profile load** — the hook reads localStorage
   directly, not via ProfileContext, so it doesn't block on
   network requests.

---

## 7. Wiring summary

| Consumer | How it reacts |
|---|---|
| `BottomTabNav` | Reads `useExperience().activeEntity.farmType` first; falls back to profile when no active entity |
| `ProtectedLayout` header | Mounts `<ExperienceSwitcher />` |
| Home / data hooks | Subscribe to `farroway:experience_switched` (existing pattern) |

No backend changes. No feature flags. No migration.

---

## 8. CI lock-in

Two existing CI guards now assert the system stays wired:

**`guard:mobile`** (`scripts/ci/check-mobile-readiness.mjs`)
adds 4 new assertions:
- `multiExperience` exports core actions (getActiveExperience,
  setActiveExperience, switchExperience, addGarden, addFarm,
  removeExperience, SWITCH_EVENT)
- `useExperience` subscribes to SWITCH_EVENT
- `ExperienceSwitcher` is mounted in ProtectedLayout
- `BottomTabNav` reacts to active experience

Now 21/21 mobile-readiness checks pass.

**`guard:telemetry`** (`scripts/ci/check-launch-telemetry.mjs`)
adds `experience_switch_tap` to the launch-day event monitoring
list. Now 10/10 telemetry checks pass.

A regression that drops any of these wires fails CI before the
launch dashboard would notice.

---

## 9. Files added

```
src/store/multiExperience.js                           (new — 295 lines)
src/hooks/useExperience.js                             (new — 105 lines)
src/components/system/ExperienceSwitcher.jsx           (new — 96 lines)
src/docs/MULTI_EXPERIENCE.md                           (new — this file)
```

## 10. Files modified

```
src/layouts/ProtectedLayout.jsx                        (+import + <ExperienceSwitcher />)
src/components/farmer/BottomTabNav.jsx                 (+useExperience override of farmType)
src/i18n/translations.js                               (+experience.garden + experience.farm × 6 langs)
scripts/ci/check-mobile-readiness.mjs                  (+4 assertions → 21 total)
scripts/ci/check-launch-telemetry.mjs                  (+experience_switch_tap → 10 total)
```
