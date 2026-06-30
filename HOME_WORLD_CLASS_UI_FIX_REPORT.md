# Home World-Class UI Fix — Report

The user asked twice to make Home feel premium. The real, charter-violating defect — found this
sprint — was **internal/engineering jargon rendered as farmer-facing text** on Home, in *every*
language. Fixed at the source and locked. The decision-first structure was already shipped in
prior sprints (DecisionHero top card, homeNextStep ladder, FarmBrain below-fold) and was not
redesigned.

## Code Changed
- **`src/i18n/columns/T-{en,fr,ha,hi,sw,tw}.js`** — 24 strings (4 keys × 6 locales) cleaned of jargon:
  - `farmBrain.confidence.title`: **"FarmBrain Confidence" → "Recommendation confidence"** (§4 — was a charter violation; "FarmBrain" must never reach a farmer)
  - `farmQuality.title`: **"Farm data quality" → "Farm readiness"** (§4)
  - `farmQuality.subtitle`: "Better data means better advice" → **"Complete a few steps to improve your recommendations."** (§10)
  - `farmQuality.improveBy`: "Improve by" → **"Next"** (§10)
- **`src/components/farmBrain/FarmBrainBelowFold.jsx`** — the four matching JS fallbacks updated so a missing key still renders clean copy.
- **`scripts/check-home-no-internal-terms.mjs`** (new gate, wired into build:safe) — fails the build if any backend term (`FarmBrain`, `Farm data quality`, `evidence tier`, `confidence engine`, "Better data means better advice") appears as a farmer-facing string in Home components **or any locale value**.

## Screens Changed
- **Home** (below-fold cards): the Recommendation-confidence card, Farm-readiness card, and their
  microcopy now read in plain farmer language across all six locales (the non-English columns had
  been showing the English jargon verbatim).

## Tests Added
- `check-home-no-internal-terms` gate (scans 3 Home components + 6 locale columns). Existing gates
  `check-farm-brain` and `check-empty-state-guidance` re-run green (keys + testids unchanged).

## Build Results
`npm run build:safe` → **PASS, 393 steps green** (lint/typecheck/tests in-chain).

## UX Improvements
A farmer (in any language) no longer sees "FarmBrain Confidence" or "Farm data quality" — they
see "Recommendation confidence" and "Farm readiness" with plain next-step copy. That jargon was
the single most "unfinished/internal-looking" thing on the screen, and it's now gone and gated.

## Remaining Risks
Honest about what I did **not** do, and why:
- **§1/§5 full card consolidation** (collapse Farm Setup + Recommendation confidence + Farm
  readiness into ONE card) was **not** done. Those three sections are required (by testid) by two
  existing gates (`check-empty-state-guidance`, `check-farm-brain`) that encode the sprint-#209
  contract. Collapsing them means rewriting those gate contracts — that is the "redesign" the
  spec forbids and is risky to do without seeing the real device. **This is the top follow-up.**
- **§9 visual polish (spacing/shadows/contrast) and §1 hero ordering** are unverified from code —
  the Home has competing hero surfaces (DecisionHero + ImmersiveHomeHero + CommandCenterDeck) that
  a device screenshot would let me target precisely. Send a screenshot and I'll fix the exact issue.
- Microcopy in §10 referencing a specific crop ("Scan your onion") is data-driven and already
  template-resolved elsewhere; not hardcoded here.

## Pilot Readiness Impact
Removes a real trust/credibility defect (internal jargon shown to farmers, in every language),
locked by a gate so it can't return. Certification verdict unchanged: **GO_FOR_INTERNAL_TEST** —
the device-level visual polish + card consolidation remain the field-pending / next-sprint items.
