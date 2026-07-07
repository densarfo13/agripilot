# RELEASE_READINESS.md — Farroway

> Generated 2026-07-06 by a multi-agent read-only audit (5 evidence agents + 2 synthesis, 178 tool-uses), grounded in measured LOC + import-coupling metrics. Every finding cites source (file:line). Large DATA files (i18n columns, plant knowledge) are excluded from complexity risk. No source modified.

---

## Scope & method

This scorecard consolidates four read-only audits of the live Farroway tree (server subsystems, frontend/AI subsystems, large-module complexity, coupling/cycles, and runtime bottlenecks). Every cell is grounded in cited source; scores were not inflated to clear the release. Scale is 1–5 (1 = release blocker, 3 = ships with known debt, 5 = mature). Dimensions: Maintainability, Testability, Scalability, Security, Performance, Operational.

Two facts frame the whole board and are the reason the verdict is "engineering-complete, operational blockers remain":
- The code side is honest and largely consolidated. Duplication is mostly already behind a shared org-scope helper (`server/src/middleware/orgScope.js`), coupling is bounded (the only feature-module cycle is `risk↔trust`, and it is service-level-clean), and no rewrite is warranted anywhere.
- The remaining blockers are operational, not architectural: a confirmed dead risk-scoring pipeline, an unfinished PrismaClient singleton migration in the legacy route layer, one un-scoped analytics tenancy gap, and oversized orchestration files that carry ML/route logic (the ML models themselves are honest zeroed scaffolds that fall back to the rule engine).

## Per-subsystem scorecard

| Subsystem | Maint. | Test. | Scal. | Sec. | Perf. | Ops |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Server — auth | 4 | 4 | 4 | 5 | 4 | 4 |
| Server — scan pipeline + ml/ | 3 | 5 | 4 | 4 | 4 | 5 |
| Server — notifications | 4 | 4 | 3 | 4 | 3 | 5 |
| Server — seasons | 4 | 3 | 4 | 4 | 4 | 3 |
| Server — farmers | 3 | 4 | 4 | 4 | 3 | 4 |
| Server — ngo (orgs/reports) | 3 | 4 | 3 | 4 | 3 | 3 |
| Server — marketplace | 4 | 3 | 4 | 3 | 4 | 3 |
| Server — analytics | 3 | 4 | 3 | **2** | 3 | 3 |
| Frontend — App shell (`App.jsx` + boot) | **2** | **2** | 3 | 4 | 3 | 4 |
| Frontend — Scan client runtime | 4 | 4 | 4 | 5 | 4 | 4 |
| Frontend — Intelligence / FarmBrain | **2** | **2** | 3 | 4 | 3 | 4 |
| Frontend — i18n / localization | 3 | 3 | 4 | 4 | 4 | 3 |

## Justification per subsystem

### Server — auth (`server/src/modules/auth/`)
Best-hardened subsystem. Clean file split (`service.js`, `routes.js`, `farmer-registration.js`, `federated.js`, `resetService.js`, `smsVerification/`) on the singleton prisma (`service.js:3`). Security scores 5: bcrypt cost 10 (`service.js:14`), a role allow-list that rejects unknown roles (`service.js:17-22`), and `JWT_SECRET` enforced at ≥32 chars with a FATAL prod exit (`config/index.js:21`), plus MFA and an SoD guard. 14 test files cover login hardening, MFA, SMS verification, and step-up retry. Stateless JWT with a Redis-backed rate-limit store that falls back in-memory (`app.js:417-443`) keeps scalability at 4.

### Server — scan pipeline + ml/ (`server/src/app.js` scan endpoints + `server/src/ml/`)
Most-tested subsystem: **41 scan tests** (orchestrator, consensus, pipeline enforcement, timeout audit, state machine, safety filter). Operational maturity is exemplary (5): 109 defensive guards across consensus/inference/providers, every optional signal wrapped in try/catch with honest `ok:false` and "never block scan" contracts (`app.js:1128-1176`), plus dedicated `/api/ops/health`, `/api/ops/metrics`, `scan/certify`, and `scan/last-trace`. Security 4: all scan routes authenticated, provider keys server-side only (health route exposes booleans only, `app.js:674-678`), daily quota enforced before any provider spend (`app.js:1077-1097`). Maintainability is held to 3: `app.js` is 3,413 lines / 29 scan endpoints / 72 authenticated handlers, and the single `POST /api/scan/analyze` handler spans ~695 lines (`app.js:1037-1732`) fusing ~8 responsibilities — though the heavy ML sub-steps are already lazy-imported modules. Caveat: shipped `ml/model_exports/{pest,drought}_model.json` have zeroed weights, `datasetRows: 0`, `trainedAt: 1970`; the README states "not production ML" and the runtime falls back to the rule engine. This is an honest scaffold, not a live model, and must not be scored as a functioning capability.

### Server — notifications (`server/src/modules/notifications/` + `autoNotifications/`)
Operational maturity scores 5 for a best-in-class honesty contract: delivery never reports success unless it happened and returns `manual_share_ready` when unconfigured (`deliveryService.js:8-64`). Channels are split (email/sms/voice/whatsApp) with 12 tests. Scalability and performance sit at 3 (async delivery, `rateLimiter.js` + `cron.js`, external SendGrid/Twilio) — fine at pilot scale. Caveat: `notifications/dedupStore.js` is dormant (references a phantom `AutoNotification.metadata` column, no live callers) — not a release blocker, and must not be wired without the migration.

### Server — seasons (`server/src/modules/seasons/`)
Cleanest decomposition: 13 focused files (scoring, comparison, credibility, harvest, statusTransitions, trustSummary, adviceAdherence). Security 4 via shared `extractOrganization` + `verifyOrgAccess`, `sodGuard`, `requireFarmerOwnership`, idempotency (`routes.js:2-24`). Testability is held to 3 — 5 tests is lighter than auth/scan relative to 13 files. Operational maturity 3: workflow-event logging exists (`harvest.js:2`) but there is no dedicated health surface. The only structural debt is the 32KB `routes.js`, an extract candidate, not a rewrite.

### Server — farmers (`server/src/modules/farmers/`)
Solid leaf feature module (its high "fan-in" is a metric artifact — `farmers/service.js` has zero cross-module importers). Testability 4 (12 tests, injectable prisma); Security 4 (shared org-scope helpers, `sodGuard`, `writeAuditLog`, `markExecuted` on mutations). Maintainability and performance are held to 3 by a genuine large-logic file: `routes.js` is 45KB with 29 routes in one file, which makes hot-path review harder. Recommended fix is to split the route file by concern — extract, not rewrite.

### Server — ngo (`organizations/`, `ngoAdmin/`, `ngoReports/` + legacy `routes/ngo*.js`)
Cross-org isolation is correctly implemented and tested (Security 4): scoping via the `farmer.organizationId` relation with a super_admin bypass and a documented prior-bug fix (`ngoDashboard.js:57-66`), backed by a real isolation regression suite (`ngoDashboardOrgScope.test.js`). Structure is scattered across 4 modules + 2 route files, holding Maintainability to 3, with `organizations/pilotMetricsService.js` at 34KB the largest logic file in the group. Scalability/Performance/Ops sit at 3: on-the-fly rollups documented as "cheap enough at NGO scale," no materialized views, and a `new PrismaClient()` at `ngoDashboard.js:28` (pool duplication).

### Server — marketplace (`server/src/modules/marketplace/` + legacy `routes/market.js`)
Clean DI-prisma service (`marketplaceService.js`, 29KB) with ranking extracted to `core/marketplaceMatch.js` and single-source status maps. Scalability 4 (`sellLimiter` on sell/listing/buyer-interest routes). Two debts hold scores down: Testability 3 — only 3 tests for a 29KB service, thinner than the surface warrants; Security 3 — the module service is DI-clean but legacy `server/routes/market.js` does `new PrismaClient()` and hand-rolls org filters. There is also a request-path N+1: `routes.js:307` awaits `buildPriceInsight` serially per lot (~1 + 2·N queries), and `routes.js:384-388` creates notifications one row at a time instead of `createMany`.

### Server — analytics (`server/src/modules/analytics/` + legacy route files)
Weakest tenancy on the board and the one item warranting a decision before multi-NGO GA. Security scores **2**: `analytics/service.js` has zero `organizationId` references, so any `institutional_admin` sees global cross-org event counts (`analytics/routes.js:20-28` is authed/admin-gated but not org-scoped), and legacy `server/routes/analytics.js` also does `new PrismaClient()`. Logic is split across three places (module + two legacy route files), holding Maintainability to 3. Testability 4 (6 tests, including one that exists because of a prior Prisma bug now stabilized).

### Frontend — App shell (`src/App.jsx` + runtime boot)
Ships only with a caveat. Maintainability scores **2**: 4,143 lines with 234 `<Route>` and 206 `lazy()` calls, plus a boot sequence that references `install*Health`/`__*Health` 378 times, each in its own swallowing try/catch (`App.jsx:2126-2160`) — a ~2,000-line install block inlined in the composition root. Testability **2**: only 51 test files across 2,989 source files (~1.7%), with no route-level render tests; role-gating correctness rests on the `check:role-route-guards` CI gate. Security holds at 4 — RBAC is centralized (`STAFF_ROLES`/`ADMIN_ROLES` from `utils/roles.js:574`, applied via `<RoleRoute>` on every admin route) with no `dangerouslySetInnerHTML` in scan/intelligence; only a DRY smell (inline role-array literals repeat 6×). Operational maturity 4: layered error boundaries and 419 `check:` gate scripts. Fix is mechanical — extract the boot/health block to a `bootHealthRuntimes()` module.

### Frontend — Scan client runtime (`src/runtime/scan`, `src/features/scan`)
Strongest frontend subsystem and release-grade. Security 5: no provider API keys in the client (grep confirms empty), output policy enforced (`sanitizeScanText` strips forbidden "confirmed" claims, results frozen). Maintainability 4: `ScanOrchestrator/index.js` uses a single 7-adapter intent table with one normalize path rather than a god-file. Testability 4: 17 test files and pure DI (`runScan` takes an injectable `analyzeFn`, unit-testable without the backend). Operational maturity 4: `never throws` contracts honored via `_fallbackEnvelope`, with `certification/` and `ScanAcceptanceGate.ts`.

### Frontend — Intelligence / FarmBrain (`src/runtime/intelligence`, `src/runtime/farmBrain`, `src/intelligence`)
Ships with a caveat: the logic is honest but the kernel is sprawling and thinly tested. Maintainability **2**: the HealthRuntime kernel (`_safe`/`_probe`/`_ready`/`_install`) is copy-pasted rather than imported — the `_safe` signature appears in 250 files and 135 files register a `window.__*Health()` global — and the `V13/V14/V15CapabilityRegistry.ts` trio share an identical skeleton. Testability **2**: only 4 test files across the combined layer, the weakest coverage on the board despite being the highest-stakes fabrication-risk surface. Security holds at 4: honesty invariants are gate-enforced (`nothingFabricatedAsLive` hard-asserted for market/satellite/yield/credit in V13/V14/V15), and the Fabric adds no data (`noFakeFabric: true`). The clones use distinct window globals, so there is no runtime collision — this is a maintainability concern, deferrable, resolved by hoisting one shared kernel module (no behavior change).

### Frontend — i18n / localization (`src/i18n`, `src/utils/i18n.js`)
Ships. The 6,857-line `T-en.js` is a DATA column (auto-generated flat key→string map), not a complexity defect, and per-locale column loading keeps Scalability/Performance at 4. Security 4 (no `dangerouslySetInnerHTML` in the sampled render path; Hindi intentionally gated per doctrine). Operational maturity is held to 3 by a verified module-resolution fragility: `App.jsx:2138` imports an extensionless `'./runtime/i18n/LanguageHealthRuntime'` while `App.jsx:2700` imports the explicit `.js`; two different files (`.js` diagnostics vs `.ts` DOM-readiness) collide on that specifier, and which one resolves depends on Vite's `resolve.extensions` order. Disambiguate before scale.

## Priority items — the 5 lowest-scoring cells

1. **Frontend App shell — Maintainability (2).** `src/App.jsx` is 4,143 lines with a ~2,000-line, 378-call boot/health-install block inlined in the composition root (`App.jsx:2126-2160`). Extract to `bootHealthRuntimes()` / `bootstrap/installRuntimeLayers.js` — mechanical, behavior-preserving, removes roughly half the file.
2. **Frontend App shell — Testability (2).** 51 test files across 2,989 source files (~1.7%); no route-level render tests, RBAC correctness resting on a CI gate. Add render/route tests for the role-gated routes.
3. **Frontend Intelligence / FarmBrain — Maintainability (2).** HealthRuntime kernel copy-pasted across ~250 files; V13/V14/V15 registries clone one skeleton. Hoist a single `healthProbe` kernel and a `makeCapabilityRegistry` factory — no runtime risk (distinct globals), highest-leverage frontend cleanup.
4. **Frontend Intelligence / FarmBrain — Testability (2).** Only 4 test files across the combined intelligence/farmBrain/runtime layer — the weakest coverage despite being the fabrication-risk surface. Raise coverage on the honesty-invariant paths.
5. **Server analytics — Security (2).** `analytics/service.js` has zero org-scoping, so `institutional_admin` sees global cross-org event counts (`analytics/routes.js:20-28`). Add tenancy scoping (mirror `orgScope.js`) before multi-NGO GA — the single security decision required before scale-out.

## Overall readiness verdict

**Engineering-complete; operational blockers remain. Ship to controlled pilot, not to multi-NGO GA.**

The evidence supports an honest, consolidated codebase: the scan and auth subsystems are release-grade (scan is the most-tested subsystem with exemplary graceful degradation; auth is the best-hardened), duplication is largely already behind `orgScope.js`, and the only feature-module cycle (`risk↔trust`) is service-level-clean and merely fragile. No rewrite is justified anywhere — every recommendation is an extract/consolidate backed by an existing in-repo pattern.

What blocks GA is operational, and none of it is architectural:
- **Correctness/operational:** the orphaned `risk_scoring` pipeline is a confirmed silent no-op (`farmProcessingCron.js:88` enqueues `risk_scoring`, but `server.js:104` only starts a `score_farm` worker) — any dashboard assuming fresh FarmMetrics is serving stale data until this is wired or the enqueue is stopped.
- **Tenancy:** the analytics org-scoping gap (Security 2) must be decided before multiple NGOs share the instance.
- **Infrastructure hygiene:** the PrismaClient singleton migration is unfinished in ~14 legacy `server/routes/*` files (pool-duplication cascade risk), and import-side-effect timers in `modules/issues/routes.js` (`:69`, `:989/991`, `:1051/1053`) start background work on import with no matching shutdown path.
- **Maintainability debt (non-blocking):** the frontend App shell and intelligence kernel (four of the five lowest cells) are extract-only cleanups with no runtime risk, and the shipped ML models are honest zeroed scaffolds, not live capabilities.

Consistent with the pilot-gate doctrine, the honest ceiling here is a real device-verified pilot, not another capability layer. Clear the five priority items — closing analytics tenancy and the risk-scoring pipeline first — and Farroway is ready to move from controlled pilot to general availability.
