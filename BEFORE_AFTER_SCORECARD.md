# BEFORE_AFTER_SCORECARD.md — Dead Code Tier 1

> 2026-07-06 · Branch `chore/dead-code-tier1`. Honest metrics — no fabricated numbers.

| Metric | Before | After | Δ |
|---|---|---|---|
| Tracked files | 5,329 | 5,324 | **−5** |
| React components (`src/**/*.jsx`) | 815 | 812 | **−3** |
| Server route files | 112 | 110 | **−2** |
| Lines of code (deleted) | — | — | **−1,064** (+ 1 barrel export line) |
| Frontend build | ✅ passes | ✅ passes (3,316 modules, 42.1s) | no regression |
| Server tests | 50 fail / 14,495 pass (pre-existing) | 50 fail / 14,495 pass | **0 new failures / 0 tests removed** |
| Prisma gate (`check:prisma-fields`) | PASS | PASS | unchanged |

## Honest reading of the "improvement" metrics the spec asked for

- **Bundle reduction: ≈ 0 KB.** The deleted frontend files had **zero importers**, so they were
  **already tree-shaken out of the production bundle** — removing them shrinks the repo, not the
  shipped bundle. The 2 server route files never affected the frontend bundle at all.
- **Startup improvement: ≈ 0 ms.** The deleted code never executed at startup (unmounted routes /
  unimported components). No boot path changed.
- **Memory improvement: ≈ 0 MB.** Same reason — dead code was never loaded into any running process.
- **Runtime compatibility: 100%.** All deleted code had zero runtime references; behavior is
  provably unchanged (test baseline byte-identical).

**The real, honest win is maintainability:** −1,064 LOC, −5 files, 3 fewer duplicate `EmptyState`/
`LanguageSuggestionBanner` sources removing "which one is live?" ambiguity, and 2 dead route files
gone. I will not report bundle/startup/memory gains that do not exist — that would be the fabrication
this whole engagement has avoided.

## Deployability
`master` was never touched; every commit on `chore/dead-code-tier1` leaves the tree building
(`vite build` green) — deployable at each step. Merge via PR through the release-guard.
