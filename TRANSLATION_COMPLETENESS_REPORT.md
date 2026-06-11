# TRANSLATION_COMPLETENESS_REPORT.md

**Sprint #190 — engine + dynamic-content translation completeness.**
Date: 2026-06-13

---

## Coverage by locale

| Locale | Total keys | Real translations | Pending review | Coverage % |
|---|---:|---:|---:|---:|
| en (source) | 6430 | 6430 | 0 | 100% |
| fr | 6430 | 6421 | 9 | 100%* |
| sw | 6430 | 6421 | 9 | 100%* |
| ha | 6430 | 6421 | 9 | 100%* |
| tw | 6430 | 6421 | 9 | 100%* |
| **hi** | 6430 | 3487 | **2943** | **54%** |

\* The 9 pending keys per locale are this sprint's new scan-language
keys (English stubs awaiting translator review — see below). Rounded
coverage stays 100% (9 / 6430 < 0.1%).

The full pending list per locale lives in
`src/i18n/columns/_translator-review-pending.json` — hand it to the
translator partner.

---

## Audit finding: the spec's premise was mostly already solved

The sprint brief said task/action/milestone engines render English.
The audit found the engine layer was **already key-based**:

| Spec string | Key | Status |
|---|---|---|
| Pick a crop to grow | `dailyPlan.setup.pickCrop` | already localized |
| Add your planting date | `dailyPlan.setup.addPlantingDate` | already localized |
| Prepare your ground | `dailyPlan.prepareGround` | already localized |
| Mark done | `taskActions.markDone` | already localized |
| Skip | `taskActions.skip` | already localized |
| Add note | `taskActions.addNote` | already localized |
| View full plan | `dailyPlan.viewFullPlan` | already localized |
| Scan plant | `taskActions.scanPlant` | already localized |
| Recommended this week | `dailyPlan.recommendedWeek` | already localized |
| Next milestone | `dailyPlan.nextMilestone` | already localized |
| Approximate time to harvest | `dailyPlan.timeframeToHarvest` | already localized |
| Today's best action | composed from keyed engine output | already localized |
| **Watch / Monitor** | — | **WAS hardcoded — fixed this sprint** |

### Engine key architecture (spec §5 — already in place)

- `src/runtime/dailyPlan/DailyFarmPlanRuntime.ts` — every task
  carries `titleKey` + English fallback
- `src/core/primaryActionEngine.js` — emits `titleKey`,
  `titleFallback`, `detailKey`
- `src/runtime/dailyPlan/CropLifecycleEngine.ts` — lifecycle tasks
  carry `titleKey`
- `src/utils/taskTranslations.js:640` — `getLocalizedTaskTitle()`
  two-tier resolver: 130+ entry `TASK_TITLES` id-map (full 6-locale
  coverage) + phrase-map fallback for legacy titles

The engines were converted to keys in prior sprints (#112-#114
daily-plan wave). The spec's `task.titleKey` requirement is the
shipping architecture.

---

## Fixed this sprint

### `src/lib/scanResultLanguage.js` — 9 hardcoded strings externalized

The scan-result language module (urgency labels + calm statuses)
was the one real gap. All 9 strings now route through
`tSafe(key, fallback)` and re-resolve at lookup time on language
switch (getter-based map, not frozen boot-time constants):

| Key | English |
|---|---|
| `scan.calm.crop` | Leaf condition may need review |
| `scan.calm.garden` | This plant may need attention |
| `scan.calm.grass` | This area may need a closer look |
| `scan.calm.nonPlant` | Try scanning a leaf, fruit, or plant stem |
| `scan.calm.unclear` | More detail needed |
| `scan.urgency.stable` | Looks stable |
| `scan.urgency.monitor` | **Monitor** (the spec's Watch/Monitor item) |
| `scan.urgency.attention` | Attention needed |
| `scan.urgency.urgent` | Urgent review recommended |

Keys added to `T-en.js` and parity-stubbed into all 5 other locales
(flagged for translator review per the repo's honest-fallback
contract — no machine translations).

### `scripts/fill-language-parity.mjs` — sidecar clobber bug fixed

Re-running the parity filler used to OVERWRITE the translator-review
sidecar with only that run's fills — silently dropping the 2934-key
Hindi queue. The script now merges with the prior sidecar, drops
keys that have since received real translations, and reports honest
per-locale pending counts.

---

## Build-safe validation (spec §6)

`npm run audit:i18n` is live:

```sh
npm run audit:i18n
# [audit:i18n] PASS — 10 findings ≤ baseline 10
```

- Scans 16 grower-facing surfaces for hardcoded English (JSX text
  nodes + copy-bearing props).
- **Ratcheted baseline of 10** = the 5 deferred true positives + 5
  known false positives documented in HARDCODED_STRINGS_AUDIT.md.
- Any NEW hardcoded English string pushes the count past 10 and
  **fails the build**. Fixing deferred items lets the baseline
  ratchet down.

Existing complementary gates already in `build:safe`:
`check:translations`, `check:i18n-coverage`, `check:i18n-compliance`,
`check:grower-i18n-hardcoded`, `check:hardcoded-grower-copy`,
`check:language-selector` (incl. §9b key-parity assertion).

---

## Remaining manual translations required

| Locale | Keys | What |
|---|---:|---|
| hi | 2943 | 2934 from the #186 parity fill + 9 new scan keys |
| fr / sw / ha / tw | 9 each | This sprint's scan keys only |

All enumerated in `_translator-review-pending.json`. Until
translated, these render the English fallback — stable strings,
never `{key}` leaks or blanks.

---

## Verdict

- **Engine architecture**: already key-based (spec §5 satisfied by
  prior sprints) — no refactor needed.
- **12 of 13 spec strings**: already localized.
- **1 real gap (Monitor/urgency/calm-status)**: fixed, 9 new keys.
- **audit:i18n**: live with ratcheted enforcement.
- **Parity**: 6/6 locales structurally complete at 6430 keys.
- **Honest pending queue**: 2943 hi + 9×4 other-locale keys awaiting
  the translator partner.
