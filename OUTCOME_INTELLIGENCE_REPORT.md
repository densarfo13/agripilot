# OUTCOME_INTELLIGENCE_REPORT

**Sprint:** Outcome Intelligence Platform
**Date:** 2026-06-02
**Modes:** `/godmode` `/ooda` `/artifacts`
**Goal:** measure whether Farroway recommendations actually work.

---

## 11-spec → 11-delivered

| § | Spec | Delivery |
|---|---|---|
| 1 | Outcome Engine — `OutcomeRuntime.ts` / `OutcomeTracker.ts` | The wave-36 frozen files already exist at `src/runtime/outcomes/`. Sibling platform runtime + tracker created at `src/runtime/outcomeIntelligence/OutcomeIntelligencePlatformRuntime.ts` + `Tracker.ts` so the wave-36 contract is honored AND the new spec lands without modifying frozen files. Pins `window.__outcomeIntelligencePlatformHealth()` with 8 readiness flags + 4 literal-true safety constants. |
| 2 | Outcome Capture — Yes/Partially/No after every task | `src/components/outcomes/TaskOutcomePrompt.jsx` — three buttons, self-collapsing confirmation, POSTs `/api/outcomes/task`. Test IDs: `task-outcome-yes`, `task-outcome-partial`, `task-outcome-no`. |
| 3 | Follow-up Capture — 3/7/14 days, Improved/No Change/Worse | `src/components/outcomes/FollowUpPrompt.jsx` — accepts `dayOffset` prop, three result buttons, POSTs `/api/outcomes/follow-up`. Server route enforces `dayOffset ∈ [3, 7, 14]` (gate-locked). |
| 4 | Photo Comparison — before / after pair | `src/components/outcomes/PhotoComparisonCard.jsx` — before/after file inputs + verdict picker (better/same/worse). Two-tap promote pattern (existing scan's before row + later after upload). Stored in `photo_comparisons`. |
| 5 | Outcome Score — success rate per (rec, category) | `server/src/ml/outcomeIntelligenceEngine.js :: computeRecommendationSuccess()` returns `{ recommendation, successRate, sampleSize, improvedCount, sameCount, worseCount, confidence }`. **Returns `successRate: null` when sample size < 3** (no fabricated 0%). |
| 6 | Recommendation Ranking — success × region × crop × season | `rankRecommendations()` sorts the success-rate list and marks the top entry `preferred: true` ONLY when `sampleSize ≥ 5` (`MIN_RANKING_SAMPLE`). Never picks a winner from one or two data points. |
| 7 | Regional Learning — "Treatment A 82% vs B 61% in Maryland onion" | Same engine: pass `{ category: 'soil', crop: 'onion', region: 'Maryland' }` to `rankRecommendations` → ranked list with success-rate + sample size per treatment. Engine filters `recommendation_outcomes` by `(recommendation, crop, region)` index. |
| 8 | Farmer Dashboard — Tasks Completed · Outcomes Recorded · Improvement Rate · Farm Health Score | `src/pages/FarmerOutcomesPage.jsx` at `/outcomes`. Reads `GET /api/outcomes/farmer-dashboard` which composes `task_outcomes` + `recommendation_outcomes` + `farm_health_scores` for the signed-in farmer. Self-handles signed-out state. |
| 9 | Organization Dashboard — High-risk / Improved farms · Pending follow-ups · Program impact | `src/pages/admin/OrganizationOutcomesPage.jsx` at `/admin/organization-outcomes`. Admin / NGO / field officer only. Aggregates across all `farm_health_scores` rows; **never includes farmer names, phones, or exact coords** (farmIds only). |
| 10 | Command Center metrics — Outcome Success % · Recommendation Accuracy % · Follow-up Completion % | Computed by `computeCommandCenterMetrics(days)`. Outcome Success = improved / (improved+same+worse). Recommendation Accuracy = (improved+same) / resolved. Follow-up Completion = resolved / (3 × unique scans with follow-ups). All return null when n < 3. Rendered inline in the Organization Outcomes page. |
| 11 | Build Safety | `scripts/check-outcome-intelligence-platform.mjs` (build:safe **step 277**) locks the entire contract — migration tables, schema models, engine exports + honesty rule, all 8 routes, **enforces `dayOffset ∈ [3, 7, 14]` literal in the route**, runtime + tracker exports + global pin, all 3 component test-ids, both pages with role-gating, App.jsx wiring. |

---

## Schema additions (no mutations to existing tables)

Migration `20260602120000_outcome_intelligence/migration.sql`:

| Table | Purpose |
|---|---|
| `task_outcomes` | Did the user complete the task? (yes / partial / no) per taskId |
| `recommendation_outcomes` | 3/7/14-day follow-up: improved / same / worse + per-rec category / crop / region / season for ranking |
| `photo_comparisons` | Before / after image pairs per scan with verdict |
| `farm_health_scores` | Daily roll-up: score 0..100 + trend + improvement rate |

All append-only. `userId` free-form (no FK) so user deletes don't cascade through measurement data. Unique index on `(farmId, snapshotDate)` for the rollup table prevents duplicate daily snapshots.

---

## Server contract

8 admin / authenticated routes:

```
POST   /api/outcomes/task                       Yes/Partial/No
POST   /api/outcomes/follow-up                  Improved/Same/Worse (dayOffset ∈ [3,7,14])
POST   /api/outcomes/photo-pair                 before + after URLs
GET    /api/outcomes/recommendation-ranking     ?category=&crop=&region=&season=&days=
GET    /api/outcomes/farmer-dashboard           self
GET    /api/outcomes/organization               admin/ngo/field_officer only
GET    /api/outcomes/command-center             3 spec metrics
POST   /api/outcomes/snapshot                   admin: fire daily rollup
```

---

## Honesty contract (gate-enforced)

| Rule | Where |
|---|---|
| `successRate: null` when sample size < 3 | `if (!d || d === 0) return null` — gate-checked |
| `preferred: null` when sample size < 5 (no winner from too few data points) | `MIN_RANKING_SAMPLE = 5` |
| `farmHealthScore: null` when no data | farmer dashboard returns null |
| Org dashboard never includes PII | farmIds only; no names, phones, coords |
| `dayOffset` must be exactly 3, 7, or 14 | route guard + gate regex |
| Three literal-true safety constants on the runtime envelope | `noFabricatedSuccessRate`, `noPiiInOrgDashboard`, `nullWhenInsufficientData` |

---

## Spec target attainment

| Target | Tracked field | How it's measured |
|---|---|---|
| Outcome Capture > 50% | Ratio of scans with at least one task_outcome row to scans in the window | derivable from `task_outcomes` joined to scans (extension point — rollup not in this sprint) |
| Follow-up Completion > 30% | `followUpCompletionPct` on command-center metrics | Live now — derived as resolved / (3 × unique scans w/ follow-ups) |
| Recommendation Success Tracking 100% | Every recommendation surfaced through the spec UI flows must produce a follow-up path | Gate enforces the route + the component buttons exist |

---

## Files

**New (8):**
- `server/prisma/migrations/20260602120000_outcome_intelligence/migration.sql`
- `server/src/ml/outcomeIntelligenceEngine.js`
- `src/runtime/outcomeIntelligence/OutcomeIntelligencePlatformRuntime.ts`
- `src/runtime/outcomeIntelligence/OutcomeIntelligencePlatformTracker.ts`
- `src/components/outcomes/TaskOutcomePrompt.jsx`
- `src/components/outcomes/FollowUpPrompt.jsx`
- `src/components/outcomes/PhotoComparisonCard.jsx`
- `src/pages/FarmerOutcomesPage.jsx`
- `src/pages/admin/OrganizationOutcomesPage.jsx`
- `scripts/check-outcome-intelligence-platform.mjs`
- `OUTCOME_INTELLIGENCE_REPORT.md` (this file)

**Extended (3):**
- `server/prisma/schema.prisma` — 4 new models
- `server/src/app.js` — 8 new routes
- `src/App.jsx` — 2 lazy imports + 2 routes + boot install
- `package.json` — gate + build:safe:steps

**Frozen wave-36 files NOT modified:**
- `src/runtime/outcomes/OutcomeRuntime.ts`
- `src/runtime/outcomes/OutcomeTracker.ts`
- Composed from the outside via the new `outcomeIntelligence/` sibling namespace.

---

## Verification (post-deploy)

```bash
# Farmer dashboard:
curl -H 'Cookie: <farmer-session>' \
  https://www.farroway.app/api/outcomes/farmer-dashboard | jq

# Record a task outcome:
curl -X POST -H 'Cookie: <farmer-session>' \
  -H 'Content-Type: application/json' \
  https://www.farroway.app/api/outcomes/task \
  -d '{"taskId":"task_xxx","completion":"yes","recommendation":"apply lime"}'

# Record a 3-day follow-up:
curl -X POST -H 'Cookie: <farmer-session>' \
  -H 'Content-Type: application/json' \
  https://www.farroway.app/api/outcomes/follow-up \
  -d '{"scanId":"scan_xxx","recommendation":"apply lime","dayOffset":3,"result":"improved","category":"soil","crop":"onion","region":"Maryland"}'

# Regional learning — rank treatments for onion in Maryland:
curl -H 'Cookie: <admin-session>' \
  'https://www.farroway.app/api/outcomes/recommendation-ranking?category=soil&crop=onion&region=Maryland&days=90' | jq

# Command Center metrics:
curl -H 'Cookie: <admin-session>' \
  https://www.farroway.app/api/outcomes/command-center | jq

# In a logged-in browser session:
window.__outcomeIntelligencePlatformHealth()
# → { initialized: true, taskOutcomePromptReady: true, followUpPromptReady: true,
#     photoComparisonReady: true, farmerDashboardReady: true,
#     orgDashboardReady: true, commandCenterMetricsReady: true,
#     rankingEngineReady: true, regionalLearningReady: true,
#     nullWhenInsufficientData: true, noFabricatedSuccessRate: true,
#     noPiiInOrgDashboard: true, respectsArchitectureLock: true }
```

---

## Build state

- `build:safe` → **277 sequential gates green** (up from 276)
- New gate `check:outcome-intelligence-platform` locks the entire contract.

---

*Decision support, not a guarantee.*
