# COMPLEXITY_REPORT.md — Farroway

> Generated 2026-07-06 by a multi-agent read-only audit (5 evidence agents + 2 synthesis, 178 tool-uses), grounded in measured LOC + import-coupling metrics. Every finding cites source (file:line). Large DATA files (i18n columns, plant knowledge) are excluded from complexity risk. No source modified.

---

## Scope & Method

Read-only audit of the Farroway tree. Every finding cites source that was read (`file:line`). Metrics were re-measured against the live tree, not inherited from prior reports. **Large data files are explicitly excluded from complexity risk** per the hard rule; they are listed once in "Largest Modules" only to record that they were checked and dismissed.

Every recommendation is **EXTRACT** or **EXTEND**. **REWRITE** is used only where duplication or coupling is demonstrated (none qualified — the one place duplication is quantified, the shared-kernel cleanup, is still an extraction).

---

## 1. Largest Modules (logic vs data)

### 1a. Logic files (real complexity surface)

| File | Lines | What it is | Verdict |
|---|---|---|---|
| `src/App.jsx` | 4143 | Route registry + boot side-effects | Justified hub, one extractable seam |
| `server/src/app.js` | 3413 | Express wiring + 56 inline handlers | Hybrid god-file — **EXTRACT** |
| `src/pages/ScanPage.jsx` | 2423 | Scan capture/flow page | Justified |
| `src/pages/Dashboard.jsx` | 2346 | Home/dashboard composition | Justified (loop already extracted) |
| `src/pages/farmer/FarmerTodayPage.jsx` | 2055 | Farmer daily-loop page | Mixed orchestration — **EXTRACT a hook** |
| `src/pages/MyFarmPage.jsx` | 2037 | Farm detail page | Justified (lowest hook density) |

**`server/src/app.js` (3413L) — the highest-priority large logic file.** Not a pure wiring hub. It does clean delegation (63 `app.use(...)` router mounts, concentrated at `server/src/app.js:3125`+) **and** carries ~2460 lines of inline handler logic that bypasses that same module pattern — 56 inline route handlers with real business logic (`server/src/app.js:671`–`3130`). The standout is `POST /api/scan/analyze`, one handler spanning `server/src/app.js:1037`→`1732` (~695 lines). The heavy ML sub-steps are already lazy-imported as modules (`server/src/app.js:1048`–`1068`), but the handler body still fuses ~8 responsibilities (quota `1077`–`1097`, preprocess/reject `1099`–`1111`, inference, context fusion, safety filter, multi-shape normalization, persistence, per-scan observability threaded from `_obsT0` at `1038` to the 500-fallback at `1730`).
- *Why it matters:* a 695-line, 8-concern request handler is a testing and maintenance hazard, and this file is the top of the dependency graph over the `modules/*` that carry the confirmed risk↔trust and org-scope fragilities — a fragile root.
- *Recommendation — EXTRACT (mechanical, behavior-preserving):* move each inline cluster (scan 13 handlers, admin scan-validation/observability 16, outcomes 8, daily-action 5, ops 4, remainder) into its existing/parallel `modules/{scan,outcomes,dailyAction,ops,admin}/routes.js` and replace with `app.use()` mounts — the pattern already used 63× in this same file. Split the analyze body into a `modules/scan/analyzeController.js` orchestrator. **Effort: high (largest single file). Risk: low-medium** (behavior-preserving; matches an existing in-file pattern).

**`src/App.jsx` (4143L) — justified hub with one over-large seam.** Line count is dominated by two mechanical, low-complexity regions: ~230 one-line `lazy()` route imports (`src/App.jsx:126`–`572`) and a 233-`<Route>` declarative `<Routes>` block (`src/App.jsx:3132`–`4096`). Cyclomatic complexity is low (9 `useEffect`s total). The one genuine smell is the boot side-effect `useEffect` at `src/App.jsx:824`–`~2900` — a ~2000-line install/telemetry sequence of `try { await import('./lib/...'); installX() } catch {}` blocks (378 `install*Health`/`__*Health` references on this file), each swallowed.
- *Why it matters:* ~half the file is one cohesive-but-inlined responsibility ("install runtime layers on boot"), inflating the composition root and complicating startup review.
- *Recommendation — EXTRACT:* lift the boot block into `src/bootstrap/installRuntimeLayers.js` (or `bootHealthRuntimes()`) and call it once. Removes ~2000 of 4143 lines with zero behavior change. **Effort: medium. Risk: low.**

**`src/pages/farmer/FarmerTodayPage.jsx` (2055L) — mixed orchestration.** Highest effect-density page: 16 `useEffect` + 16 `useState`, each a distinct concern (deadlock detector `225`+/`233`, behavior tracking `254`, visit marking `276`/`355`, offline drain `280`, done-event listener `311`, first-action timer `347`, engagement/monetisation `363`, weather `661`, journey persistence `750`, notification checks `770`, daily-trigger `879`, reminder scheduling `927`, second-visit `949`, async loads `1023`). It imports three task engines plus a decision engine (`generateTasks`, `generateDailyTasks`, `dailyTaskEngine`, `decideToday`/`ultimateDecisionEngine` — `src/pages/farmer/FarmerTodayPage.jsx:85`, `130`–`131`).
- *Why it matters:* page-level orchestration is interleaved with rendering, making the daily-loop logic hard to test in isolation.
- *Recommendation — EXTEND an existing pattern:* extract a `useFarmerToday()` hook mirroring the in-repo `useFarmerLoop()` precedent Dashboard already uses. Move the 16 effects + derived state into the hook; leave JSX in the page. **Effort: medium. Risk: low** (proven in-repo pattern).

**Justified as-is (no extraction mandated):**
- `src/pages/Dashboard.jsx` (2346L) — 63 imports / ~44 rendered card components; core data pipeline already extracted to `useFarmerLoop()` (`src/pages/Dashboard.jsx:158`); the 21 `useState` are mostly modals/pickers. Composition, not tangled logic.
- `src/pages/ScanPage.jsx` (2423L) — 15 useState / 8 useEffect for a capture-and-flow screen; below the FarmerToday threshold. Candidate for the same hook pattern later, not urgent.
- `src/pages/MyFarmPage.jsx` (2037L) — lowest hook density (6 useState, 0 useEffect); size is breadth of farm sections, not logic.

### 1b. Data files — checked and excluded (NOT complexity risk)

Per the hard rule these are large **data**, and their size is correct:
- `src/i18n/columns/T-{en,fr,ha,hi,sw,tw}.js` — 6857L each (~6421 keys). `T-en.js:1` header: *"AUTO-GENERATED by scripts/split-translations.mjs — do not edit by hand."* Flat `export default { "key": "string", ... }` map (`T-en.js:6`–`14`), zero control flow. `T-hi.js` is 6854L (3 keys short — consistent with the intentional `enableHindiLocale=false`).
- `src/data/plants/knowledge.js` — 3740L. Own header (`1`–`22`) describes a *"Knowledge join layer"* / plant catalog (PLANT_DB + DISEASE_DB/PEST_DB + growth/care maps) behind a thin `composePlantEntry()` / `findPlantKnowledge()` lookup. Catalog rows, not branching.
- Also data-shaped: `src/i18n/productionGapTranslations.js` (2867L), `src/i18n/hi.js` (930L), `src/i18n/contextEngineTranslations.js` (596L).

Flagging any of these as complexity risk would be a false positive.

---

## 2. Highest Coupling

The import graph was rebuilt by resolving every relative edge; fan-in was counted at both file and module granularity. **The reported "high fan-in" feature modules are metric artifacts.**

### 2a. Real hubs are all clean shared foundations (appropriate — no action)

| Module | Importing modules | Importing files | Verdict |
|---|---|---|---|
| `core:config` (database.js) | 60 | 112 | Foundation ✓ |
| `core:middleware` (auth.js) | 58 | 76 | Foundation ✓ |
| audit | 33 | 40 | Foundation ✓ |
| `core:utils` | 23 | 46 | Foundation ✓ |
| regionConfig | 14 | 20 | Foundation ✓ |

- **audit** — `server/src/modules/audit/service.js` is a 44-line leaf: imports only prisma (`:1`), exports one `writeAuditLog` (`:11`), zero outgoing feature edges. Fan-in of 33 is exactly what a cross-cutting audit utility should look like.
- **regionConfig** — `server/src/modules/regionConfig/service.js` is 128 lines of pure in-memory reference data (`const regionDefaults` at `:9`) + 8 stateless getters, **zero imports** (not even prisma). Data-backed foundation; not a defect.
- **middleware/auth** — `server/src/middleware/auth.js` (285L, 63 importers) imports only jsonwebtoken/config/env/prisma/opsLogger (`:1`–`5`). No feature fan-out.

None of the real hubs reach *back into* feature modules, so none can sit inside a cycle. *Why it matters:* confirms the coupling surface is bounded — the graph is a clean tree at the foundation layer. **No action.**

### 2b. "seasons(21) / farmers(17) / auth(15)" — metric artifact, NOT coupling

These are named-import-statement and route-wiring counts, not distinct dependents:
- `farmers/service.js` (738L) has **zero** cross-module importers.
- `seasons/service.js` (437L) is imported by exactly one file — `src/app.js` (route registration).
- "auth(15)" is dominated by `modules/auth/farmer-registration.js`, imported by a single file (`farmers/routes.js:4`) pulling 18 named exports in one statement — **one edge, not 18**. The genuine auth hub is the middleware (§2a), which the raw metric folded in.

*Why it matters:* these are large **leaf feature modules** (their size is logic, addressed in §1/§6), not everyone-reaches-in smells. **No coupling action** — do not "decouple" a module nothing depends on.

### 2c. Hand-rolled tenancy filter — the one real diffuse-coupling item

`organizationId` appears in a `where` at ~110 sites across 58 files — the hand-rolled tenancy filter (confirms the prior "org-scope re-implemented ~30×"). This is **partly mitigated**: a well-designed shared helper exists at `server/src/middleware/orgScope.js` (cache, `orgWhereFarmer`, `orgWhereApplication`, `verifyOrgAccess`, audit logging), and modern `server/src/modules/*` routes import it (e.g. `farmers/routes.js:14`, `seasons/routes.js:2`–`24`). Only the legacy `server/routes/*` layer still hand-rolls.
- *Why it matters:* every un-migrated site is an independent place a tenancy bug can be introduced (a correctness/security-adjacent coupling, not just style).
- *Recommendation — EXTEND:* migrate the remaining legacy `server/routes/*` call sites onto `orgScope.js`. **Effort: medium (many small edits). Risk: low-medium** (tenancy-sensitive — migrate with the existing isolation tests, e.g. `ngoDashboardOrgScope.test.js`, as the guard). No rewrite — the canonical helper already exists.

---

## 3. Circular Dependencies

Module-level and file-level Tarjan SCC were run across the tree (excluding the `app.js`/`server.js` wiring hub, which produces an artifact 60-node SCC that is not a real dependency cycle).

### 3a. risk ↔ trust — CONFIRMED, service-layer-clean (fragile, not broken)

The **only** feature-module cycle.
- Forward (real, service level): `server/src/modules/risk/service.js:35` imports `computeSeasonTrust` from `../trust/service.js`, consumed at `risk/service.js:81` as a risk signal.
- Reverse (closes the loop): **only** `server/src/modules/trust/routes.js:24` imports `computeSeasonRisk`, `computeFarmerRisk` from `../risk/service.js`.
- `server/src/modules/trust/service.js` imports **only prisma** (`:28`) — it does not import risk.

*Why it matters:* at the **service layer** this is a one-directional DAG (`risk/service → trust/service`); the cycle exists only because the trust *route* composes both engines. It is safe today but fragile: if anyone adds a `risk` import to `trust/service.js`, it becomes a true runtime import cycle.
- *Recommendation — EXTEND (keep the DAG explicit):* add a one-line guard comment in `trust/service.js` against importing risk; if the area is revisited, extract the shared season-fetch primitive so trust never reaches back into risk. **Effort: trivial (comment) / low (extract). Risk: low.** No refactor required now.

### 3b. email templateRenderer ↔ templates — benign, function-hoisted

One additional file-level SCC (8 files), entirely inside the `email` module: `templateRenderer.js` ↔ `templates/{welcome,otp,pestAlert,regionalWatch,feedback,onboardingReminder,passwordReset}.js`. `templateRenderer.js:9`–`15` imports each `render*`; each template imports `wrapLayout` back (`templates/welcome.js:1`).
- *Why it matters:* it is a real circular import, but **verified safe** — `wrapLayout` is a hoisted function declaration (`templateRenderer.js:43`) called only inside each `render*` body at runtime (`templates/welcome.js:10`), never at module-eval time. ESM resolves it cleanly.
- *Recommendation — EXTRACT (only if this area is touched):* move `wrapLayout` into a leaf `email/layout.js` to invert the edge. **Effort: low. Risk: low.** Deferrable — latent fragility, not a defect.

**No other cross-module or file cycles exist.**

---

## 4. Runtime Bottlenecks

Measured baselines (ground truth, excl. tests/dist): `findMany` total **245**; bounded (`take:` present) **134**; **unbounded (no `take:`) 111** — the at-risk set. `new PrismaClient()` singleton bypasses: **2** on the `server/src` working tree (plus a larger legacy `server/routes/*` cohort, §4d).

### 4a. Orphaned `risk_scoring` pipeline — dead no-op (CONFIRMED, highest blast radius)

Two job systems that never connect:
- `server/src/queue/farmProcessingCron.js:88` enqueues to `QUEUES.RISK_SCORING` (= `'risk_scoring'`, `server/src/queue/queueClient.js:32`).
- The **only** `registerProcessor(QUEUES.RISK_SCORING, …)` calls are in tests (`__tests__/scaleInfra.test.js:145,185,338`) — no production consumer.
- Meanwhile `server/src/server.js:104` registers `startWorker('score_farm', …)` from the separate Postgres-`v2_jobs` job system — keyed `'score_farm'`, which nothing enqueues for scoring.

*Why it matters:* the 30-min roster sweep (itself bounded/paged, fine) drops jobs into a queue with no reader; the registered worker polls a table no producer writes. **Risk scores are never computed by this path** — a whole-feature silent failure. Any dashboard/report assuming FarmMetrics freshness serves stale/empty data.
- *Recommendation:* either wire a `risk_scoring` worker or stop enqueuing. **Effort: medium. Risk: medium** (touches scoring freshness — verify downstream consumers first).

### 4b. `impact/service.js:74` — unbounded roster load with nested fan-out

`prisma.farmer.findMany({ where, select:{ …, farmSeasons:{ …, progressEntries, officerValidations } } })` with **no `take:`** and an only-optionally-filtered `where`. On a large org this pulls the entire farmer roster + every active season + all progress + all validation rows in one query, then aggregates in JS.
- *Why it matters:* the most dangerous single unbounded query — grows unbounded with the largest tenant; nested selects multiply row volume.
- *Recommendation — EXTEND:* paginate / stream the aggregation, or push counts into `groupBy`/`_count` instead of loading child rows. **Effort: medium. Risk: low-medium** (result-shape change — keep the aggregate output identical).

### 4c. `modules/issues/routes.js` — self-starting timers as an import side-effect

Three timers start on import, not via central lifecycle: SSE-ticket GC `setInterval(…,60000)` unconditional with no stop path (`server/src/modules/issues/routes.js:69`); `startSlaEscalation()` auto-started (`:989`/`:991`); `startDigestCron()` + a 10s `setTimeout` auto-started (`:1051`/`:1053`). None are stopped in graceful shutdown (`server/src/server.js:219`–`234` only stops `notificationCron` + workers). `runDigestIfDue` (`:1023`) also does an unbounded `user.findMany` of all admins then a per-admin `staffNotification.findMany` + email (scheduled N+1, `:1030`–`1048`).
- *Why it matters:* merely importing the router (boot, or any test touching it) starts background DB/email work; timers survive shutdown and **stack** under multi-import/HMR/test contexts.
- *Recommendation — EXTRACT to lifecycle:* move timer registration to `server.js` alongside the other crons, with matching `stop*` in shutdown. **Effort: low-medium. Risk: low.**

### 4d. `PrismaClient` singleton bypass — connection-pool cascade risk

`server/src/services/cropCycles/cropCycleService.js:39` and `server/src/services/market/marketService.js:33` each `new PrismaClient()` at module scope. The larger legacy cohort is in mounted `server/routes/*` (14 files: `ngoDashboard.js:28`, `market.js`, `analytics.js`, `harvests.js`, `issueReports.js`, `trustScore.js`, `recommendations.js`, `ngoV2.js`, `adminBasic.js`, …), all imported live via `server/src/app.js:141`–`162`.
- *Why it matters:* module-scope construction opens extra pools at import; under load these compound the footprint and pool exhaustion cascades to every handler. (Not a security hole — org-scoping still applies.)
- *Recommendation — EXTEND:* import the `config/database.js` singleton (the pattern already applied to the other 18 sites). **Effort: low per file, medium in aggregate. Risk: low.**

### 4e. Marketplace request-path N+1 fan-out

`GET bulk-lots` loops `for (const lot of lots)` awaiting `buildPriceInsight` serially (`server/src/modules/marketplace/routes.js:307`); each call issues up to 2 `produceListing.findMany` (`priceInsights.js:287,306`, each `take:500`) → ≈ `1 + 2·N` serial queries on a buyer-facing GET. Second N+1: POST bulk-lot request loops `lot.contributors` awaiting `farmerNotification.create` one row at a time (`:384`–`388`).
- *Why it matters:* individual queries are bounded (no unbounded scan), but serial round-trips scale with lot count on an authed request path.
- *Recommendation — EXTEND:* `Promise.all` the price lookups (or batch-aggregate once); `createMany` the notifications. **Effort: low. Risk: low.**

### 4f. `triggerEngine.js` — serial per-season risk recompute (self-admitted, cron)

The auto-notification cron loops `activeSeasons` (loaded at `:312`, `take:500`) and awaits `computeSeasonRisk(season.id)` serially (`server/src/modules/autoNotifications/triggerEngine.js:339`); each call re-fetches the same season (`risk/service.js:58` findUnique) + a trust query — redundant re-reads of rows already in hand. Bounded by `BATCH_LIMIT=500` (`:29`); the comment at `:333` admits it "cannot be batched without major refactor."
- *Why it matters:* ~500 serial 2-query round-trips per cron run; moderate blast radius (cron, not live request), but wholly avoidable redundancy.
- *Recommendation — EXTEND (no refactor needed):* pass the already-loaded `season` object into `computeSeasonRisk`, which already accepts an object (`risk/service.js:56`), to kill the redundant findUnique. **Effort: low. Risk: low.** (The comment's "major refactor" is unnecessary for this specific win.)

### 4g. `app.js:2987` — synchronous filesystem walk in a request handler

`GET /api/ops/orphaned-files` calls `listDiskFiles()` (`server/src/utils/uploadHealth.js:78`–`99`) doing `fs.readdirSync` + per-file `fs.statSync` — unbounded synchronous IO over the entire uploads dir on the event-loop thread.
- *Why it matters:* on a large uploads dir this blocks all concurrent requests for the walk's duration. Admin-only + rare → low blast radius, but the event-loop-stall mechanism is real.
- *Recommendation — EXTEND:* switch to `fs.promises.readdir`/`stat` or offload. **Effort: low. Risk: low.**

### 4h. Full-table / uncapped scans — lower severity

Genuine unfiltered scans: `app.js:2991` (`evidenceFile.findMany` all filenames, admin orphan check), `analytics/v2/prismaStore.js:103` (`feedbackTable.findMany({})`, expected-small learning table), `organizations/routes.js:27` (all orgs, but `where.id` is scoped for non-super_admin at `:24`). A further ~12 sites pass a `where` variable but lack `take:` — scoped but uncapped (`activities:102`, `buyerInterest:62/119`, `reminders:71`, `reviews:62`, `seasons:283`, `issues:698`); part of the 111-unbounded set.
- *Recommendation — EXTEND:* add `take:` pagination caps as tenant data grows. **Effort: low each. Risk: low.** Below §4b in individual severity.

**Explicitly not flagged:** `ml/providers/*` `setTimeout` (per-request AbortController timeouts — correct pattern); `config/database.js` (the singleton is the correct cascade root); `computeSeasonRisk`/`computeFarmerRisk` internals (single-entity, bounded — the risk is only in how callers loop them, §4f).

---

## 5. High-Risk Modules (ranked by blast radius)

Ranked by how many consumers a defect can silently reach, most-severe first. Every remediation is extract/extend/fix — no rewrite is justified by the evidence.

**1. Orphaned `risk_scoring` pipeline (whole-feature silent failure).** Producer (`farmProcessingCron.js:88` → `queueClient.js:32`) and consumer (`server.js:104`, keyed `score_farm`) never meet; the only `risk_scoring` processor is in tests. Blast radius: every risk-dependent dashboard/report serves stale data with no error. *Fix: wire a `risk_scoring` worker or stop enqueuing (§4a).* **Effort medium / Risk medium.**

**2. `server/src/app.js` (3413L) — fragile root of the graph.** 56 inline handlers atop 63 router mounts; the 695-line `scan/analyze` (`:1037`–`1732`) fuses 8 concerns. It is the composition root over the modules carrying the risk↔trust and org-scope fragilities. Blast radius: a change here can affect scan, outcomes, ops, admin, and daily-action simultaneously. *Fix: EXTRACT handlers into the `modules/*` routers already mounted 63× (§1).* **Effort high / Risk low-medium.**

**3. Hand-rolled tenancy filter (~110 sites / 58 files).** Cross-cutting `organizationId` `where` clauses; canonical helper `orgScope.js` exists but the legacy `server/routes/*` layer still hand-rolls. Blast radius: tenant-isolation correctness — a miss leaks cross-org data. Mitigated in modern modules, tested by `ngoDashboardOrgScope.test.js`. *Fix: EXTEND remaining legacy sites onto `orgScope.js` (§2c).* **Effort medium / Risk low-medium (tenancy-sensitive).**

**4. `PrismaClient` singleton bypass (2 in `server/src`, 14 legacy `server/routes/*`).** Module-scope `new PrismaClient()` at `cropCycleService.js:39`, `marketService.js:33`, and the mounted legacy cohort. Blast radius: pool exhaustion cascades to every handler app-wide. *Fix: EXTEND onto the `config/database.js` singleton (§4d).* **Effort low-medium / Risk low.**

**5. `impact/service.js:74` — single largest unbounded query.** Unbounded `farmer.findMany` with nested `farmSeasons/progressEntries/officerValidations`. Blast radius: memory/latency on the largest tenant; degrades the whole process under load. *Fix: paginate / `groupBy` aggregation (§4b).* **Effort medium / Risk low-medium.**

**6. `modules/issues/routes.js` — import-side-effect timers outside lifecycle.** GC/SLA/digest timers auto-start on import and are not stopped in shutdown (`server.js:219`–`234`); they stack under HMR/test. Blast radius: background DB/email work in every context that imports the router, including tests. *Fix: EXTRACT timer registration to `server.js` with matching `stop*` (§4c).* **Effort low-medium / Risk low.**

**7. `FarmerTodayPage.jsx` (2055L) — 16-effect orchestration in the render layer.** Highest client effect density, driving progress/journey/paywall/notification subsystems inline. Blast radius: the farmer daily loop (a north-star surface); tangling makes regressions likely and hard to unit-test. *Fix: EXTRACT `useFarmerToday()` mirroring `useFarmerLoop()` (§1).* **Effort medium / Risk low.**

**8. `src/App.jsx` boot block (~2000L `useEffect`).** 378 swallowed `install*Health` imports in the composition root. Blast radius: app startup for every route; a swallowed failure hides a broken runtime layer. *Fix: EXTRACT to `bootstrap/installRuntimeLayers.js` (§1).* **Effort medium / Risk low.**

**9. risk↔trust route-level cycle (fragile, not broken).** DAG at the service layer (`trust/service.js:28` prisma-only); the cycle exists only via `trust/routes.js:24`. Blast radius: latent — one future import in `trust/service.js` turns it into a true runtime cycle. *Fix: guard comment now; extract shared season-fetch if revisited (§3a).* **Effort trivial / Risk low.**

**10. Marketplace request-path N+1s.** Serial `buildPriceInsight` per lot (`routes.js:307`) and per-contributor `create` (`:384`–`388`). Blast radius: buyer-facing latency scaling with lot/contributor count; bounded queries so no scan risk. *Fix: `Promise.all` + `createMany` (§4e).* **Effort low / Risk low.**

**Clean categories (stated explicitly):** Coupling foundations (§2a) are all clean shared leaves — appropriate, no action. Circular dependencies beyond the two documented (risk↔trust route-level, email hoisted) — **none exist**; both documented cycles are safe today. Large data files (§1b) are correctly sized data and carry **no** complexity risk.

---

## Priority Summary (extract/extend/fix — no rewrites)

| # | Action | Type | Effort | Risk |
|---|---|---|---|---|
| 1 | Wire or remove orphaned `risk_scoring` pipeline | Fix | Medium | Medium |
| 2 | Split `server/src/app.js` inline handlers into `modules/*` routers | Extract | High | Low-Med |
| 3 | Migrate legacy `server/routes/*` tenancy onto `orgScope.js` | Extend | Medium | Low-Med |
| 4 | Move `impact/service.js:74` to paginated/`groupBy` aggregation | Extend | Medium | Low-Med |
| 5 | Adopt `config/database.js` singleton in the 16 bypass sites | Extend | Low-Med | Low |
| 6 | Move `issues/routes.js` timers into `server.js` lifecycle | Extract | Low-Med | Low |
| 7 | Extract `useFarmerToday()` hook from `FarmerTodayPage.jsx` | Extract | Medium | Low |
| 8 | Extract App.jsx boot block to `installRuntimeLayers.js` | Extract | Medium | Low |
| 9 | Pass loaded `season` into `computeSeasonRisk` (trigger cron) | Extend | Low | Low |
| 10 | `Promise.all` + `createMany` in marketplace bulk-lots | Extend | Low | Low |

No rewrite is warranted anywhere in the tree: duplication is already consolidated behind shared helpers (`orgScope.js`, `useFarmerLoop`, the module routers), the only feature-module cycle is service-layer-clean, and every large logic file has an in-repo extraction pattern to follow.
