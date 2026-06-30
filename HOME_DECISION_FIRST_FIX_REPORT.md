# Home Decision-First Fix — Report

**Verdict:** the Home is already decision-first (built across sprints #113/#141/#192/#209/#212).
This sprint fixed the one **live** defect in that system and locked it — it did **not** redesign
the working Home.

## Code Changed
- **`src/components/home/resolveCompletionCrop.js`** (new) — one pure resolver for "does this
  farm have a crop?", checking every field the app uses (`cropName` / `crop` / `cropType` /
  `cropDisplayName` / `cropId`), `''` when none.
- **`src/pages/Home.jsx`** — the onboarding ladder's completion input now uses
  `resolveCompletionCrop(local.farm)` instead of the incomplete `local.farm?.crop || cropId`.

## Tests Added
- **`resolveCompletionCrop.test.js`** (11 assertions) — every crop field recognized; missing → empty;
  **a crop under `cropName` no longer triggers a stale "Add your crop"** (the regression, proven).
- **`homeNextStep.test.js`** extended (now 17 assertions) — explicit spec invariants: *crop exists →
  never `add_crop`* (all combinations), *location exists → never `add_location`*, *first-scan CTA
  opens `/scan`*.
- **`check-home-next-step.mjs`** gate hardened — runs both tests + fails the build if Home regresses
  to the `crop||cropId`-only check.

## Build Results
`npm run build:safe` → **PASS, 392 steps green** (lint/typecheck/tests run in-chain).

## UX Improved
The real bug behind the spec's §2 complaint: a farm whose crop is stored under `cropName` (the
*primary* field per `_resolveCrop`) reported `cropSelected:false`, so Home kept showing **"Add
your crop" even though a crop existed**. Now every crop-storage path is recognized, so the ladder
correctly advances (crop → add location → first scan) and never shows a stale setup step.

## Already Decision-First (verified, not rebuilt)
- **§3 Today's Priority is the top card** — `DecisionHero` renders first after the header
  (`Home.jsx:1024`), reading the canonical FarmBrainState; empty-state shows a CTA, never fabricated advice.
- **§2 state ladder** — `homeNextStep(buildFarmerCompletion(...))` is the single source of truth
  (create farm → add crop → add location → first scan → defer to hero).
- **§1 / §5 consolidation** — `FarmBrainBelowFold` carries Timeline + Farm Quality together;
  competing recommendation cards are demoted into the collapsed "More for today" disclosure.

## Remaining Risks
- **The location completion signal** (`hasLocation`, derived from weather resolution) wasn't changed;
  it's a heuristic, not a stored-coords check. Lower impact than the crop bug, but worth auditing later.
- **Card consolidation / spacing / copy (§1, §6, §7)** were *not* re-touched — the Home is heavily
  gated (canonical-home guard, design-system gate) and already consolidated; cosmetic churn there
  risks regressions for little gain. Flag specific surviving duplicates if any remain on a real device.
- Like all Home work, the visual hierarchy is unverified on a real device this sprint (field-pending).

## Pilot Readiness Impact
Closes a genuine trust/productivity bug (stale setup prompt) on the critical onboarding path, with a
regression test + gate so it can't return. Certification verdict unchanged: **GO_FOR_INTERNAL_TEST** —
this removes one real defect from Gate 1 (core journey); device verification of the visual hierarchy
remains the field-pending item.
