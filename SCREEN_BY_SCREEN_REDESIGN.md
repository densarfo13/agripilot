# SCREEN_BY_SCREEN_REDESIGN.md

**Sprint #181 — Before / after wireframes for 6 grower screens.**
Date: 2026-06-03

Wireframes are ASCII (no screenshots possible from a static review).
Each screen shows the CURRENT render order and the TARGET per Design
System v1. Annotations call out what changes.

Legend: `┃` = card edge · `█` = primary action · `▢` = secondary
action · `…` = collapsed/demoted content.

---

## 1. Home

### Before

```
┌────────────────────────────────────────────┐
│  Good Morning Dennis    [🔥 7-day streak]  │
├────────────────────────────────────────────┤
│  ┃ Farm / Garden profile · switcher       ┃│
├────────────────────────────────────────────┤
│  ┃ [photo]                                 │
│  ┃ Weather pill · Location prompt          │
│  ┃ Land health pill                        │
├────────────────────────────────────────────┤
│  ┃ Today's task — Inspect leaves           │
│  ┃ Reason · Heavy rainfall                 │
│  ┃ Time · 3 min            [█ Done]        │
├────────────────────────────────────────────┤
│  ┃ Scan row                  [▢ Scan]      │
├────────────────────────────────────────────┤
│  ┃ TodaysActionCard         [█ Start]      │ ← competing
├────────────────────────────────────────────┤
│  ┃ TopActionCard            [█ Open]       │ ← competing
├────────────────────────────────────────────┤
│  ┃ DailyFarmPlanCard        [▢ View]       │ ← competing
└────────────────────────────────────────────┘
```

### After (target — Design System §1.1, §1.3)

```
┌────────────────────────────────────────────┐
│  Good Morning Dennis                       │
│                                            │
│  ┏━━━ TODAY'S ACTION ━━━━━━━━━━━━━━━━━┓   │
│  ┃ Inspect Onion Leaves                ┃   │
│  ┃                                     ┃   │
│  ┃ Why · Rainfall increased disease    ┃   │
│  ┃        pressure                     ┃   │
│  ┃ Time · 3 minutes                    ┃   │
│  ┃                                     ┃   │
│  ┃              █ Start                ┃   │ ← ONE primary
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
├────────────────────────────────────────────┤
│  ┃ Weather                              ┃   │
│  ┃ 28°C · Rain expected today           ┃   │
│  ┃ Action · Delay spraying       [▢]    ┃   │
├────────────────────────────────────────────┤
│  ┃ Crop Health                          ┃   │
│  ┃ Healthy 8 · Needs attention 2 [▢ View]│   │
├────────────────────────────────────────────┤
│  ┃ Tasks                                ┃   │
│  ┃ 3 due today                  [▢ Open]│   │
├────────────────────────────────────────────┤
│  More for today  ▾                         │ ← demoted
└────────────────────────────────────────────┘
```

**Diff:**
- TodaysActionCard merged with weatherTask into the single Today's
  Action hero block.
- TopActionCard + DailyFarmPlanCard demoted to "More for today"
  collapsible section.
- Scan row removed (Scan is the bottom-nav primary; redundant here).

---

## 2. Scan result

### Before

```
┃ Voice header                  [🔊 Listen]
┃ Photo quality (cond)
┃ Plant identification — Pepper · 82%
┃ Top matches — Pepper / Tomato / Eggplant
┃ What we noticed · Why it matters
┃ Flower (cond)
┃ Crop health — Leaf stress · Low
┃ Treatment list
┃ Region · Soil · Satellite (cond)
┃ Action row — █ Create task · ▢ Scan again · ▢ Save review
┃ Needs Review (cond)
```

### After (target)

```
┏━━━ PHOTO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃   [thumbnail]                          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━ PEPPER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 82% confidence                         ┃
┃                                        ┃
┃ Possible issue · Leaf stress           ┃
┃ Severity · Low                         ┃
┃                                        ┃
┃ What we noticed                        ┃
┃ Yellowing along leaf edges.            ┃
┃                                        ┃
┃ Recommended action                     ┃
┃ Check soil moisture today.             ┃
┃                                        ┃
┃ Next review · 3 days                   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┃ Top matches
┃ 1. Pepper       82%
┃ 2. Tomato       11%
┃ 3. Eggplant      4%

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃    █ Create Task                      ┃
┃    ▢ Save Plant                       ┃
┃    ▢ Scan Again                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**Diff:**
- The "Photo / Plant / Confidence / Issue / Action" sequence becomes
  the canonical above-the-fold block.
- Treatment + Region + Soil + Satellite demote below the action row.
- Save Plant promoted to the action row (sprint #178 wired it in).
- Plant: — and Unknown Plant impossible by gate (sprint #179).

---

## 3. Tasks

### Before

```
┃ Current task — Inspect onion leaves
┃ Reason · Heavy rainfall · 3 min
┃ [█ Complete] [▢ Skip] [▢ Add note]
├──────────────────────────────────────
┃ Next up
┃   • Water tomatoes (5 min)
┃   • Check pepper transplants (4 min)
├──────────────────────────────────────
┃ View all  ▾
├──────────────────────────────────────
┃ Completed today (3)
```

### After (target — already matches user spec)

```
┏━━━ TASK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Inspect onion leaves                  ┃
┃                                       ┃
┃ Reason · Heavy rainfall               ┃
┃ Duration · 3 minutes                  ┃
┃                                       ┃
┃            █ Complete                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┃ Next up  ▾  (2)
┃ Completed today  ▾  (3)
```

**Diff:** Skip / Add note demoted into a `⋯` overflow menu on the
card. Card pattern already matches spec; only chrome cleanup needed.

---

## 4. My Farm

### Before

```
┃ My Farm                          [+ icon]
┃ ▾ Farm switcher
┃ ┌────────────────────────────────┐
┃ │  [photo]   Farm name           │
┃ │            Location            │
┃ │            [Upload photo]      │
┃ └────────────────────────────────┘
┃ Setup card (cond — fill missing)
┃ Details · Crop · Location · Size · Stage
┃ [█ Edit]  [▢ Add new]  [▢ Switch]
┃ Help · Contact support →
```

### After (target — already aligned)

```
┃ My Farm
┃ ▾ Farm switcher
┃
┃ ┏━━━ FARM SNAPSHOT ━━━━━━━━━━━━━━━━┓
┃ ┃  [photo]   Farm name            ┃
┃ ┃            Location · 0.5 ha    ┃
┃ ┃            Crop · Tomato        ┃
┃ ┃            Stage · Vegetative   ┃
┃ ┃                                 ┃
┃ ┃            🟢  3 crops          ┃
┃ ┃            ⚠️  2 alerts          ┃
┃ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
┃
┃ Recent scans · 5 in last week  [▢ View]
┃ Upcoming tasks · 3 today        [▢ Open]
┃
┃            █ Edit
```

**Diff:**
- Snapshot card merges identity + crop count + alerts.
- Recent scans + upcoming tasks become inline rows (tap to drill in).
- Add new / Switch demote into the farm-switcher dropdown.

---

## 5. Garden / My Grow

### Before

```
┃ My Grow
┃ Device-persist hint
┃ ┌───┬───┬───┐
┃ │ 8 │94%│ 2 │   plants / avg health / alerts
┃ └───┴───┴───┘
┃ ┌──────┬──────┬──────┬──────┐
┃ │Flower│ Veg  │Fruit │ Herb │
┃ ├──────┼──────┼──────┼──────┤
┃ │House │ Crop │ Tree │Shrub │
┃ └──────┴──────┴──────┴──────┘
┃ [▢ Scan — empty state]
```

### After (target)

```
┃ My Grow
┃
┃ ┏━━━ SNAPSHOT ━━━━━━━━━━━━━━━━━━━┓
┃ ┃  8 plants                       ┃
┃ ┃  94% healthy · 2 need attention ┃
┃ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
┃
┃ ┌──────┬──────┬──────┐
┃ │Flower│ Veg  │ Herb │     ← collapse to 3 visible
┃ │  3   │  2   │  3   │     ← rest under "More"
┃ └──────┴──────┴──────┘
┃ More categories  ▾
┃
┃            █ Scan
```

**Diff:**
- 8-section grid → 3 visible + "More categories" collapsible.
- One primary action: Scan.

---

## 6. Notification dropdown

### Before

```
┌─ Notifications ──────── [Mark all read] ─┐
│ 📋 Task due — Inspect onion leaves        │
│    Heavy rainfall · 3 min · 14:02         │
│ ────────────────────────────────────────  │
│ 🎯 Funding application status             │
│    Reviewed · view details · yesterday    │
│ ────────────────────────────────────────  │
│ 🛒 Buyer message                          │
│    "When is the next harvest?" · 2d ago   │
└──────────────── [View all] ───────────────┘
```

### After (target — already aligned, plus "View all" footer when > 20)

```
┌─ Notifications ──────── [Mark all read] ─┐
│ ● 📋 Inspect onion leaves                 │ ← unread dot
│      Heavy rainfall · 3 min · 14:02       │
│ ───                                       │
│ 🎯 Funding application reviewed           │
│      view details · yesterday             │
│ ───                                       │
│ 🛒 "When is the next harvest?"            │
│      buyer message · 2d ago               │
└────────────── View all (24) →  ───────────┘
```

**Diff:**
- "View all" link surfaces COUNT when > 20.
- Hairline divider (not full border) between items.
- No other change — surface already clean.

---

## Rollout order

1. **Home** consolidation (1 day) — biggest UX win.
2. **My Farm** snapshot merge (½ day) — visual polish.
3. **My Grow** category collapse (½ day) — reduce density.
4. **Notification footer count** (1 hour) — small but visible.
5. **Tasks** overflow menu cleanup (½ day) — gentle polish.
6. **Scan** NeedsReview render order (1 hour) — narrow-viewport fix.

Total: ≈ 3 days of focused UI work for the entire redesign.

---

## Gate compliance roadmap

`scripts/check-ui-design-system.mjs` is registered as
`npm run check:ui-design-system` but is **not yet wired into
`build:safe:steps`** — that wiring is the final step once the 5
existing violations land. Running the gate today returns 5 known
violations (preserved here so future PRs see the rollout work):

| Surface | Violation | Concrete unblock |
|---|---|---|
| `src/pages/Home.jsx` | No primary-action testid | Add `data-testid="home-start"` to the Today's Action card's primary button |
| `src/pages/AllTasksPage.jsx` | No primary-action testid + 15 distinct non-semantic hexes | Add `data-testid="task-complete"` to the first task's Complete button + consolidate the bespoke category tint palette into the brand tokens (`#1F4D2C` / `#F6F1E7` / `#C8944D` + semantic severity) |
| `src/pages/MyPlants.jsx` | No primary-action testid | Add `data-testid="myplants-scan"` to the empty-state CTA + the bottom-of-list "Add plant" / Scan link |
| `src/pages/ScanResultPage.jsx` | No primary-action testid | Surface the existing `scan-intel-create-task` testid at this level (or add `data-testid="scanresult-create-task"` to the wrapper) |

Once these land in sprint #182, the gate gets added to
`build:safe:steps` and becomes a permanent merge condition.

The gate is structured so that **NEW** screens added after this
sprint cannot ship without compliance — the dev runs the gate
during PR review and sees the failure immediately. Existing
screens get the 3-day rollout window above.
