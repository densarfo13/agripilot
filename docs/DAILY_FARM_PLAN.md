# Farroway Daily Farm Plan Production Fix

The day-to-day operating loop that tells farmers AND gardeners what to do —
from setup → planting → care → scan → harvest → post-harvest. Pure, read-only,
composition-only, honest (approximate, never exact), and it NEVER blocks Home,
Scan, or boot. No fabricated agronomy, no exact yield, no chemical dosage, no
fake market price. Works with NO weather, NO GPS and NO scan.

> Decision support, not a guarantee.

---

## 1. Files created

Runtimes — `src/runtime/dailyPlan/` (self-contained, zero imports, SSR-safe,
frozen envelopes, never throw):

- `GrowTimeframeEngine.ts` → `growTimeframe(crop, region?)` + `__growTimeframeHealth`.
  Approximate crop calendars (cassava 8–12 months, tomato 10–14 weeks, maize,
  beans, cowpea, rice, pepper, onion + general fallback). Every duration is a
  RANGE string; region is a note only; `isApproximate`/`noExactHarvest`.
- `CropLifecycleEngine.ts` → `estimateLifecycle(cropKey, plantingDate?)` +
  `__cropLifecycleHealth`. 12 ordered stages (pre_planting → selling_ready);
  `weeksSincePlanting` by relative date arithmetic; `approximateOnly` +
  `userCorrectable`; honest "Not enough data" without a planting date.
- `PostHarvestEngine.ts` → `postHarvestGuidance(crop, {sellEnabled})` +
  `__postHarvestHealth`. Harvest checklist / sorting / drying / storage /
  spoilage / selling readiness; `noFakeMarketPrice` + `noUnsafeChemical`;
  buyer listing prompt only when selling is enabled.
- `DailyFarmPlanRuntime.ts` → `buildDailyPlan(ctx?)` + `__dailyFarmPlanHealth`.
  Composes managed plants / scan history / cached tasks / event log + the 3
  engines + optional `__weatherRiskHealth`/`__dailyDecisionHealth`. New- vs
  existing-grower flow; tasks HARD-CAPPED at three (`.slice(0, 3)`);
  `worksWithoutWeather`/`worksWithoutScan`/`worksWithoutGps`; `dataGaps[]`.
- `DailyPlanIntegrationRuntime.ts` → `installDailyPlanIntegrationGlobals()`
  pinning `__dailyPlanTaskHealth` / `__dailyPlanScanHealth` /
  `__dailyPlanWeatherHealth` / `__dailyPlanOutcomeHealth` — all `nonBlocking`;
  `extendsExistingTasks` / `noDuplicateTasks` / `skippedTracked` /
  `completedFeedsOutcome`.

UI + i18n:

- `src/components/home/DailyFarmPlanCard.jsx` — the Home "Today's Farm Plan"
  section. Error-boundary guarded; builds the plan via a never-throwing
  dynamic import; Mark Done / Skip / Add Note / Scan Plant / View Full Plan.
- `src/i18n/dailyPlanTranslations.js` — 5 namespaces (dailyPlan / lifecycle /
  postHarvest / taskActions / gardenCare), English base, registered in index.js.

Gates — `scripts/`:
`check-daily-farm-plan`, `check-crop-lifecycle`, `check-post-harvest`,
`check-daily-plan-task-sync`, `check-gardener-copy`, `check-daily-plan-i18n`,
`check-daily-plan-safety` — all wired into `build:safe`.

## 2. Files modified
- `src/App.jsx` — boot installs for the 5 daily-plan runtimes (engines first,
  composite + integration last; try/catch; never blocks boot).
- `src/pages/Home.jsx` — renders `<DailyFarmPlanCard />` as a top section.
- `src/i18n/index.js` — imports + empty-slot-merges the daily-plan overlay.
- `src/runtime/launchBlockers/GoLiveHealthRuntime.ts` — additive warn-only
  `dailyPlanReady` (never a blocker; fail-open when the probe is absent).
- `package.json` — 7 gates wired into `build:safe`.

## 3. Honesty + safety contract
- Approximate, user-correctable RANGES only — never an exact harvest date,
  yield, tons/acre, revenue, or market price.
- No chemical / fertilizer / storage dosages — care guidance stays generic.
- No fabrication: no `Math.random`, no `fetch`. Every envelope is frozen.
- Works without weather / GPS / scan; missing data → honest `dataGaps`.
- Gardener mode uses garden wording (gardenCare namespace), never farm-only.
- Every guidance string carries "Decision support, not a guarantee."

## 4. Integration (extend, do not replace)
- Tasks: the Home card records Mark Done / Skip / Add Note through the
  canonical `logEvent` (`task_completed` / `task_skipped` / `task_feedback`),
  source-tagged `daily_plan`, mirrored to the outcome log the loop reads.
- Scan: a disease/pest finding in scan history surfaces a follow-up task.
- Weather: adjusts when `__weatherRiskHealth` is present, general when not.
- Outcome: completed/skipped/note actions feed the existing outcome loop.

## 5. Diagnostics (8 globals)
`__dailyFarmPlanHealth`, `__cropLifecycleHealth`, `__growTimeframeHealth`,
`__postHarvestHealth`, `__dailyPlanTaskHealth`, `__dailyPlanScanHealth`,
`__dailyPlanWeatherHealth`, `__dailyPlanOutcomeHealth`. `__goLiveHealth` now
reports `dailyPlanReady` (warn-only).

## 6. Result
The Daily Farm Plan is wired, explainable, honest, localizable, and
non-blocking. Scan / boot / Home loading are untouched. All 7 gates green in
`build:safe`.
