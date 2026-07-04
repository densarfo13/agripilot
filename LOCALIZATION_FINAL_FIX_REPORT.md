# Localization — Permanent Fix Report

## Root cause (proven by three production screenshot batches, 2026-07-01)
All 20 existing i18n gates check **column↔column parity** — none could see keys used in components
but registered in **no** column, so English fallbacks leaked on translated screens. Secondary
causes: English *placeholder values* inside locale columns, hardcoded strings bypassing tSafe, and
nav-label collisions introduced by translation itself (Hausa "Ayyuka"×2).

## The permanent system (this sprint)
- **`scripts/i18n-scan.mjs`** — extracts every tSafe/tStrict key across src (2,986 files),
  classifies farmer-facing vs admin by path, diffs against the canonical column set, writes
  `FARMER_TRANSLATION_COVERAGE.md` with real numbers. `npm run i18n:scan | i18n:missing |
  i18n:coverage`.
- **`check:i18n-farmer-gate`** (in build:safe) — **ratchet**: farmer-facing unregistered-key count
  may only fall (baseline 1,137, committed); plus per-locale **nav-collision check** (caught a real
  pre-existing en collision — nav.opportunities/nav.funding both "Funding" — on its FIRST run;
  fixed). `npm run i18n:farmer-gate`; `--update` tightens after each batch.
- **`i18n:validate`** → the existing `check:translations` (orphans + 100% launch-locale parity).
- **Repeatable fix flow:** `i18n:missing` → translate batch (fix-leaks-batch*.mjs pattern) →
  `fill-language-parity.mjs` → gate ratchets down. Three batches already executed this flow.
- **Glossary (P2):** `src/i18n/glossary/agricultureGlossary.ts` — 28 canonical terms × 6 locales;
  drift *enforcement* is a documented follow-up.
- **P4:** `/admin/i18n-health` page already exists (sprint #183) — the scanner output complements
  it; no duplicate page built. **P5:** stale-bundle handling already exists (AppVersionRuntime +
  CacheRecoveryRuntime + ChunkLoadError auto-recovery; Vite content-hashes locale chunks) — farmer
  remedy: recovery screen → clear Farroway cache.

## Coverage (real, regenerable — see FARMER_TRANSLATION_COVERAGE.md)
Farmer-facing: 2,672 keys used · **1,137 unregistered (57% registered)** — now ratcheted, burned
down batch-by-batch by user impact (onboarding flow next). Admin/internal: 859 used · 629
unregistered (27%) — tracked, deprioritized per operating directive. Registered keys are 100%
translated in en/fr/sw/ha/tw (6,821 keys, gate-enforced); hi hidden at 100% stubs.

## Honest limits
The scanner covers tSafe/tStrict literals — engine-generated strings (task titles, checklist
labels, program content, crop display names) are a separate template sprint; dynamic keys
(`tSafe(var)`) are not extracted.
