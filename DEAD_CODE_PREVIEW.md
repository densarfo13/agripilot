# DEAD_CODE_PREVIEW.md — Farroway

> Generated 2026-07-06. **Nothing has been deleted.** Per the Dead Code Cleanup rules, this
> is a preview for approval. Each candidate was verified against all 8 conditions
> (runtime imports · dynamic imports · route registrations · feature-flag refs · CLI refs ·
> worker refs · scheduled-job refs · tests). Candidates are grouped by confidence tier.
>
> **Honest note on "bundle reduction":** files with zero importers are already tree-shaken out
> of the production bundle, so real **bundle / startup / memory reduction ≈ 0** for all of these.
> The genuine win is **LOC removed + repo clarity**, not runtime size. I will not fabricate
> startup/memory numbers in the post-cleanup scorecard.

---

## TIER 1 — CLEAN. Git-tracked, all 8 conditions met. Safe to delete on approval.

| # | File | LOC | Reason | Import graph | Replacement | Rollback |
|---|------|-----|--------|--------------|-------------|----------|
| 1 | `server/src/modules/ngoAdmin/routes.js` | 526 | Unmounted HTTP route file — never imported into `app.js`, never mounted. Its sibling **engines** (`fundingEngine`, `riskEngine`, `scoreEngine`, `yieldEngine`, `interventionEngine`, `programService`) ARE used (by `core/contextService.js`, `organizations/exportService.js`) and **stay**. | 0 importers, 0 mounts, 0 tests | none (engines remain) | `git checkout <sha>^ -- <path>` |
| 2 | `server/src/modules/ngoImport/routes.js` | 159 | Same — unmounted route file; the `ngoImportService` engine stays. | 0 importers, 0 mounts, 0 tests | none | `git checkout <sha>^ -- <path>` |
| 3 | `src/utils/cropLabel.js` | 89 | Superseded by `config/crops.js#getCropLabel`. | 0 importers | `config/crops.js#getCropLabel` | `git checkout <sha>^ -- <path>` |
| 4 | `src/lib/relativeTime.js` (`formatRelativeUpdate`) | 43 | Dead twin of the live `src/lib/time/relativeTime.js#formatRelativeTime`. | 0 importers | `lib/time/relativeTime.js` | `git checkout <sha>^ -- <path>` |
| 5 | `src/components/language/LanguageSuggestionBanner.jsx` | 217 | Dead copy; live one is `src/components/locale/LanguageSuggestionBanner.jsx`. | 0 importers | `locale/LanguageSuggestionBanner.jsx` | `git checkout <sha>^ -- <path>` |
| 6 | `src/components/intelligence/EmptyState.jsx` | 70 | Orphan third `EmptyState`; live one is `src/components/EmptyState.jsx`. | 0 importers | `components/EmptyState.jsx` | `git checkout <sha>^ -- <path>` |
| 7 | `src/components/ui/EmptyState.jsx` | 92 | Orphan second `EmptyState`. **Coupled edit:** also remove the export line `src/components/ui/index.js:24` (`export { default as EmptyState } from './EmptyState.jsx';`) — that barrel has no consumers. | 0 importers (only the unconsumed barrel) | `components/EmptyState.jsx` | `git checkout <sha>^ -- <both>` |

**Tier 1 total:** 7 files, **~1,196 LOC**. Import graph for all = zero. Dependency graph: files 1–2 import the NGO engines (which remain); 3–7 import only shared utils/React (edges simply drop). Bundle reduction ≈ 0 (already tree-shaken).

---

## TIER 2 — Dead in production, BUT a **test depends on it** (Rule 1 #8 fails). Delete requires also removing the test.

| # | File(s) | LOC | Blocker | If approved, also delete |
|---|---------|-----|---------|--------------------------|
| 8 | `server/src/core/auditLog.js` (`logAuditAction`, `ALLOWED_ACTIONS`) | 73 | 0 **production** importers, but `server/src/__tests__/consistencyHelpers.test.js` imports it and has a `describe('logAuditAction')` block (lines ~240–312). | the `logAuditAction` import + its describe block in `consistencyHelpers.test.js` (the rest of that test file stays). Canonical audit writer is `modules/audit/service.js`. |
| 9 | `server/src/modules/intelligenceV2/` — `learningLogger.js` (219), `recommendationEngine.js` (204), `riskModel.js` (301) | 724 | 0 production importers, but `server/src/__tests__/intelligenceV2.test.js` (311 LOC) exercises the whole module. | the entire `intelligenceV2.test.js`. |

**Recommendation:** these are genuinely dead in the shipped app, but deleting them means deleting/editing their tests — a slightly larger blast radius. **Approve Tier 2 explicitly** (separate yes) if you want the tests removed too; otherwise I leave them.

---

## TIER 3 — Flagged, NOT proposed for deletion this phase.

- **`backend/`** — an abandoned NestJS + TypeORM scaffold (`agripilot-backend`). **0 files are git-tracked** (only its `node_modules`); it's not in the repo, not in any deploy config or CI, not imported by the live app. It's **local untracked clutter** — you can `rm -rf backend/` locally to reclaim disk (~844 source files + heavy `node_modules`), but it is **not a repository concern** and has **no git rollback**. I will not touch it without you explicitly saying "remove backend/ locally."
- **`admin/issues` duplicate route** (`src/App.jsx`) — `path="admin/issues"` is declared twice; React Router renders the first (`AdminIssuesPage`, ~line 4057), making the second (`AdminIssueDashboardPage`, ~line 4080) **unreachable**. This is **not a clean deletion** — it needs your decision: *which page is the intended `admin/issues`?* Removing the loser (and then its now-unused page file + lazy import) is safe once you confirm which one wins.
- **5 schema-only Prisma models** (`V2BoundaryPoint`, `V2LandInsight`, `V2Job`, `V2ScoringConfig`, `TaskInteraction`) — no Prisma-client references, but **UNVERIFIED for raw `$queryRaw`** against their `@@map` table names, and dropping a model is a **destructive DB migration** (needs a backup + `pg_restore` plan). This is out of scope for *file* dead-code cleanup and should be its own migration change.

---

## Proposed deletion set for approval

- **Tier 1 (recommended):** 7 files, ~1,196 LOC, zero test/runtime risk. → PR `chore/dead-code-tier1`.
- **Tier 2 (needs explicit yes):** +2 units (auditLog, intelligenceV2) + their tests, ~1,108 LOC.
- **Tier 3:** no action (backend/ = your local call; admin/issues = needs a decision; Prisma models = separate migration).

## After approval I will
1. Delete the approved files on a fresh branch off `master` (governance-compliant, per-scope commits).
2. Run `npm test` (server) + parse-check + a baseline diff to prove **0 new failures**, and `build:safe` **once the tree is quiet** (it currently has 50 pre-existing failures + a corrupted JSON from the concurrent sessions — see the earlier note).
3. Generate `DEAD_CODE_REPORT.md` + `POST_CLEANUP_SCORECARD.md` with **honest** before/after (LOC real; bundle/startup/memory ≈ 0 with that stated, not faked).

**Paused. Reply with which tiers to delete (e.g. "Tier 1 only" or "Tier 1 + 2").**
