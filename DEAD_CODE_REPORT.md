# DEAD_CODE_REPORT.md — Farroway (Tier 1)

> 2026-07-06 · Branch `chore/dead-code-tier1`. Tier 1 approved; Tier 2/3 untouched.
> **Every deletion was verified against all 9 conditions AND proven by a real build + test
> baseline** — not by static grep alone (see "False positives caught" below).

## Deleted (5 files + 1 edit) — ~1,064 LOC

| File | LOC | Kind | Verification |
|------|-----|------|--------------|
| `server/src/modules/ngoAdmin/routes.js` | 526 | Unmounted NGO route file | 0 refs in `server/` (all forms); engines kept |
| `server/src/modules/ngoImport/routes.js` | 159 | Unmounted NGO route file | 0 refs in `server/`; engine kept |
| `src/components/language/LanguageSuggestionBanner.jsx` | 217 | Dead twin of `locale/` version | 0 importers; frontend build clean |
| `src/components/ui/EmptyState.jsx` | 92 | Orphan `EmptyState` #2 | 0 importers; barrel export removed |
| `src/components/intelligence/EmptyState.jsx` | 70 | Orphan `EmptyState` #3 | 0 importers; frontend build clean |
| **edit** `src/components/ui/index.js` | −1 | Removed `EmptyState` export line | barrel parses; had no consumers |

- **Deleted routes:** 0 *live* routes (both files were unmounted — never registered in `app.js`).
- **Deleted services / engines:** 0 — the NGO `*Engine`/`*Service` files in those two modules are
  **used** (`core/contextService.js`, `organizations/exportService.js`) and were **kept**.
- **Deleted components:** 2 orphan `EmptyState` copies + 1 dead `LanguageSuggestionBanner`.
- **Deleted utilities:** 0.
- **Deleted models:** 0 (Prisma schema untouched, per requirement 3).
- **Deleted tests:** 0 (nothing tested these files — test count unchanged).

## False positives caught (this is the important part)

The static audit (`DUPLICATES_REPORT.md`) and my initial greps flagged **7** candidates. The
mandated **build + test verification caught 2 that are actually LIVE** and they were **restored**:

| Falsely flagged "dead" | Reality | Caught by |
|---|---|---|
| `src/utils/cropLabel.js` | imported by `FarmSummaryCard`, `SmartSuggestionsCard`, `MarketActivity` | dangling-ref sweep |
| `src/lib/relativeTime.js` | imported by `src/pages/AllTasksPage.jsx` (`.js` extension my regex missed) | **`vite build` failed** |

→ **29% of the "verified dead" list was wrong.** Only the compile + test gate is trustworthy for
deletion. Every remaining deletion survived a passing `vite build` and a byte-identical test baseline.

## Verification results (requirement 4)

| Check | Result |
|---|---|
| `vite build` (production frontend) | ✅ PASS — 3,316 modules, built in 42.1s, no unresolved imports |
| Server suite (`vitest run`) | ✅ **0 new failures** — `50 failed / 14495 passed`, byte-identical to the pre-deletion baseline (the 50 are pre-existing, unrelated — see note) |
| `check:prisma-fields` (Prisma gate) | ✅ PASS (131 models) |
| `server/src/app.js` parse | ✅ OK |
| Runtime behavior | ✅ Unchanged — all deleted code had zero runtime references (dead by definition) |

**Note on the 50 pre-existing failures + a corrupted large JSON:** present *before* this change
(baseline-confirmed identical), from the concurrent background sessions churning the shared tree.
Not introduced here. Full `build:safe` deferred until that tree is quiet, so its verdict is trustworthy.

## Rollback
```bash
git revert <this-branch-merge-commit>        # whole change
# or per file:
git checkout master -- <path>                # restore a single file
```

## Not done (per plan / requirement 3)
- Tier 2 (`core/auditLog.js`, `intelligenceV2/`) — have test deps; awaiting separate approval.
- `backend/` — untracked local NestJS scaffold; your local `rm -rf` call, not a repo change.
- `admin/issues` duplicate route — needs a "which page is canonical" decision.
- 5 unused Prisma models — a destructive migration, out of scope.
