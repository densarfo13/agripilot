# DUPLICATES_REPORT.md — Farroway

> Generated 2026-07-06 by a multi-agent read-only repository audit (6 parallel evidence agents + 2 synthesis agents, 226 tool-uses). Every claim is traceable to cited file paths; items not verifiable end-to-end are marked UNVERIFIED. No source was modified to produce this — it is an analysis artifact. Four headline findings were independently spot-verified before publishing (dead backend/ app, 18 PrismaClient instantiations, unmounted intelligenceV2, duplicate admin/issues route).


## Summary

This audit identifies **13 true-duplication findings** plus a set of adjacent structural concerns (orphans, dead code, flag conflicts) surfaced during the same read-only sweep. Findings are drawn only from verified static evidence (import-path greps, md5 clustering, route-mount tracing, Prisma-accessor searches); no dynamic/lazy-import graph was exhaustively followed, and items that could not be traced end-to-end are marked UNVERIFIED rather than asserted.

**Severity spread of true-duplication findings:**

| Severity | Count | Findings |
|---|---|---|
| High | 3 | Prisma singleton bypass; org-scope filter re-implementation; Twilio SMS send/config |
| Medium | 6 | Audit-log writers; `maskPhone`; frontend flag registries; `EmptyState`; two HTTP-client stacks; outbreak-cluster algorithms |
| Low | 4 | `asyncHandler`; email-validation regex; redundant health route; crop-taxonomy fragmentation |

A large amount of *apparent* duplication was verified as **intentional** — the V1-module vs V2-route two-track API architecture, spec-facade re-export shims, per-router `authenticate` re-declaration, the shared Prisma re-export in `server/lib/prisma.js`, and the versioned `HealthRuntime`/`CapabilityRegistry` kernels (distinct globals, no collision). These are called out in-line so they are not mistaken for consolidation targets.

---

## 1. Server logic / queries / validation

### 1.1 — Multiple `new PrismaClient()` pools bypass the singleton — **HIGH**
**Duplicated:** ~16 files instantiate their own `new PrismaClient()`, each opening a separate connection pool, despite the canonical singleton at `server/src/config/database.js:3` (re-exported by `server/lib/prisma.js:2`).
**Evidence:** `server/routes/adminBasic.js:23`, `analytics.js:6`, `harvests.js:22`, `issueReports.js:21`, `market.js:39`, `ngoDashboard.js:29`, `ngoV2.js:27`, `pricingSuggest.js:37`, `recommendations.js:35`, `support.js:5`, `trustScore.js:39`, `verification.js:13`; plus `server/src/services/cropCycles/cropCycleService.js:39` and `server/src/services/market/marketService.js:33`.
**Why it's a real defect (not style):** extra pools waste DB connections and defeat the singleton's shared log config.
**Recommendation:** replace each `const prisma = new PrismaClient()` with an import of the singleton.
**Effort:** Low (mechanical, ~16 one-line edits). **Risk:** Low. **Rollback:** per-file revert; behavior is identical since the singleton wraps the same client.

### 1.2 — Org-scope where-filter logic re-implemented ~30× — **HIGH**
**Duplicated:** canonical helpers `orgWhereFarmer`/`orgWhereApplication`/`orgWhereUser` (`server/src/middleware/orgScope.js:122,132,142`) are used by only ~4 modules; the identical org-scoping ternary is copy-pasted across the service layer everywhere else. `pilotMetrics/service.js:31-45` and `pilotQA/service.js:115-117` each define their **own private copies** of the same four helpers.
**Evidence:** `{ farmer: { organizationId } }` variant in `pilotMetrics/service.js:36,44,155,1033`, `pilotQA/service.js:116,117,150,323,364`, `portfolio/service.js:152`, `seasons/statusTransitions.js:240`, `tasks/service.js:278,368`, `organizations/routes.js:40,70`; bare `organizationId ? { organizationId } : {}` variant in `farmers/service.js:107`, `performance/benchmarks.js:42,289,336`, `performance/service.js:298`, `pilotMetrics/service.js:32,609`, `pilotQA/service.js:115,141,322`, `tasks/service.js:179,367`; legacy `req`-based form inline in `routes/analytics-summary.js:64`, `exports.js:79,114`, `ngoDashboard.js:67,98,122,165,196,228,273,306,318,346`.
**Why it matters:** security-sensitive tenancy logic with no single source of truth — one missed copy is a cross-org data leak.
**Recommendation:** add plain `(organizationId)`-signature variants to `orgScope.js` (e.g. `farmerOrgFilter`, `farmerRelationFilter`, `seasonProgressFilter`) and import them everywhere, deleting the per-file copies.
**Effort:** Medium (~30 call sites, plus new helpers + tests). **Risk:** Medium — tenancy logic; must not change filter semantics. **Rollback:** helpers are additive; revert per-file imports to restore inline forms.

### 1.3 — Twilio SMS send + config-check implemented 3× — **HIGH**
**Duplicated:** the canonical SMS provider is `server/services/smsService.js` (`sendSMS:239`, `isSmsMessagingConfigured:54`), but the Twilio client-construction + `messages.create` block and the "is Twilio configured" env-triple check each appear three times.
**Evidence:** `server/src/modules/notifications/deliveryService.js:190-199` (inline `twilio(...).messages.create(...)`) with its own `isSmsConfigured:30-36`; `server/src/modules/autoNotifications/sender.js:30-40` (private `sendSms()` repeating the same sequence). `notificationService.js` already delegates correctly — good template.
**Why it matters:** honesty/reliability-sensitive (SMS delivery); divergent config checks can silently disagree on whether SMS is enabled.
**Recommendation:** route `deliveryService.sendInviteSms` and `sender.sendSms` through `services/smsService.sendSMS`; keep one `isSmsConfigured`.
**Effort:** Low-Medium (2 call sites + delete 2 config checks). **Risk:** Medium — touches live delivery path; verify env-var precedence matches. **Rollback:** re-inline the two senders.

### 1.4 — Two live `writeAuditLog` writers + a third dead one — **MEDIUM**
**Duplicated:** two writers `prisma.auditLog.create` on the same table with divergent signatures; a third is dead.
**Evidence:** `server/lib/audit.js:17` (`writeAuditLog(req, {...})`, folds fields into `details`; 9 importers) vs `server/src/modules/audit/service.js:11` (`writeAuditLog({applicationId,...})`; 38 importers). Dead: `server/src/core/auditLog.js:72` (`logAuditAction` + `ALLOWED_ACTIONS`; 0 importers). `lib/audit.js`'s own header (`:10`) acknowledges it is aligning with the sister writer.
**Recommendation:** pick `modules/audit/service.js` as canonical, add a `req`/entity-folding adapter for the 9 legacy callers, delete `lib/audit.js` and dead `core/auditLog.js`.
**Effort:** Medium (adapter + migrate 9 callers). **Risk:** Low-Medium — audit rows must keep the same shape. **Rollback:** keep `lib/audit.js` until callers verified in staging.

### 1.5 — `asyncHandler` defined twice, byte-identical — **LOW**
**Duplicated:** same `(fn) => (req,res,next) => Promise.resolve(fn(...)).catch(next)`.
**Evidence:** `server/src/middleware/asyncHandler.js:4` (2 importers) and `server/src/middleware/errorHandler.js:188` (57 importers).
**Recommendation:** delete `asyncHandler.js`, repoint its 2 importers to `errorHandler.js`.
**Effort:** Trivial. **Risk:** Zero. **Rollback:** restore file + 2 imports.

### 1.6 — `maskPhone` copy-pasted verbatim in 3 files (+2 reinvented) — **MEDIUM**
**Duplicated:** byte-for-byte identical `maskPhone(raw)` in three files, plus two divergent reinventions.
**Evidence:** identical in `server/services/notificationService.js:37`, `smsService.js:219`, `voiceAlertService.js:107`; variants `invites/adminRoutes.js:88` (`_maskPhone`) and `auth/smsVerification/service.js:116` (`redactPhone`).
**Recommendation:** move one `maskPhone` into `server/src/utils/phoneUtils.js` (already the phone-helper home) and import everywhere; reconcile the two variants.
**Effort:** Low. **Risk:** Low (log-masking only; PII exposure if a variant masks differently). **Rollback:** re-inline.

### 1.7 — Email validation regex/logic duplicated — **LOW**
**Duplicated:** same regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` in two shared validators, plus three ad-hoc copies.
**Evidence:** `server/src/middleware/validate.js:20` (`isValidEmail`) and `server/lib/validation.js:17` (`validateEmail`); ad-hoc in `community/routes.js:51`, `ngoImport/ngoImportService.js:108`, `utils/insightNormalize.js:96`.
**Recommendation:** export one `isValidEmail` from `validate.js`; have `lib/validation.js` (legacy) import it.
**Effort:** Low. **Risk:** Low. **Rollback:** per-file revert.

### 1.8 — Redundant DB-ping health route — **LOW**
**Duplicated:** `server/routes/monitoring.js:6` (`/health` → `$queryRaw SELECT 1`), mounted `/api/v2/monitoring/health` (`app.js:3253`), duplicates the DB ping in canonical `/api/health` (`app.js:671`) and richer `/api/system/health` (`modules/system/routes.js:31`).
**Recommendation:** drop `monitoring.js`; point consumers at `/api/health`. (Per-module `/health` probes in `analytics/v2/routes.js:62`, `decision/engine/routes.js:50`, `ingest/routes.js:34`, `pilotQA/routes.js:70` are intentional liveness pings — not dup.)
**Effort:** Trivial. **Risk:** Low — confirm no uptime monitor pins the `/api/v2/monitoring/health` URL first. **Rollback:** restore route + mount.

**Intentional (NOT duplication):** V1 `/api/*` vs V2 `/api/v2/*` operate on *different data models* (e.g. `routes/tasks.js`→`V2Task` vs `modules/tasks/routes.js`→`FarmSeason`) — a migration concern, not a dedup target. Email provider layering (`services/emailService.js` canonical; `modules/email/provider.js:15` and `deliveryService.js:21` delegate) is deliberate. `server/lib/prisma.js:2` correctly re-exports the singleton. OTP/reset aliases in `routes/auth.js` forward to one shared service (documented `:877-885`).

---

## 2. Frontend components / utilities

*Baseline: zero byte-identical files across 2,300+ `src/` files (md5-verified) — duplication here is structural or orphaned-parallel.*

### 2.1 — `EmptyState` — three parallel primitives, two dead — **MEDIUM**
**Duplicated:** three empty-state components with divergent prop names (`message`/`body`/`subtitle`); two are orphaned.
**Evidence:** `src/components/EmptyState.jsx` (live, 10 importers) vs `src/components/ui/EmptyState.jsx` (0 direct importers; only referenced by the consumer-less `components/ui/index.js:24` barrel) and `src/components/intelligence/EmptyState.jsx` (0 importers).
**Recommendation:** delete `ui/EmptyState.jsx` + `intelligence/EmptyState.jsx` and the dead barrel line, or make them re-export the live one.
**Effort:** Low. **Risk:** Low (zero-importer verified). **Rollback:** restore files.

### 2.2 — `LanguageSuggestionBanner` — one dead copy — **LOW**
**Evidence:** `src/components/locale/LanguageSuggestionBanner.jsx` (live, 2 importers) vs `src/components/language/LanguageSuggestionBanner.jsx` (217L, 0 importers, verified dead).
**Recommendation:** delete the `language/` copy. **Effort:** Trivial. **Risk:** Low. **Rollback:** restore file.

### 2.3 — `relativeTime` — near-identical, one dead — **LOW**
**Evidence:** `src/lib/time/relativeTime.js#formatRelativeTime` (live, 2 importers) vs `src/lib/relativeTime.js#formatRelativeUpdate` (0 importers, verified dead).
**Recommendation:** delete `lib/relativeTime.js`. **Effort:** Trivial. **Risk:** Low. **Rollback:** restore file.

### 2.4 — Two competing HTTP-client stacks — **MEDIUM**
**Duplicated:** an axios trio (layered by design) plus a separate fetch-based client implementing the same concern.
**Evidence:** `src/api/client.js` (canonical axios) with layered `src/api/apiClient.js` and re-export `src/core/api/client.js` (intentional) — but `src/services/apiClient.ts` (165L) is a parallel **fetch** client whose own header calls `api/client.js` "legacy."
**Recommendation:** converge on one transport; if `services/apiClient.ts` is the intended future, track migration off axios rather than maintaining both.
**Effort:** High (transport migration). **Risk:** Medium-High (touches every network call). **Rollback:** N/A until migration executed; interim is status quo.

### 2.5 — `outbreakClusterEngine` — overlapping cluster algorithms — **MEDIUM**
**Duplicated:** two geographic disease/pest clusterers with genuine algorithm overlap.
**Evidence:** `src/outbreak/outbreakClusterEngine.js` (441L; `detectOutbreakClusters`, `detectActiveClusters`) vs `src/ngo/outbreakClusterEngine.js` (318L; `detectClusters`, `isFarmInCluster`, 2 importers).
**Recommendation:** extract a shared core clusterer; keep NGO/outbreak-specific thresholds as thin wrappers.
**Effort:** Medium. **Risk:** Medium (clustering output feeds NGO views). **Rollback:** keep both until wrapper output is diffed against originals.

### 2.6 — Crop taxonomy fragmentation — **LOW** (large scope)
**Duplicated:** ≥3 `CROPS`-style constants and 3+ `normalize*`/`*Label` functions across parallel sources.
**Evidence:** `src/utils/crops.js` (canonical, ~69 importers), `src/config/crops.js`, `src/constants/crops.js`, `src/core/agriculture/canonicalCropMap.js`, `src/utils/localization.js`, `config/crops/cropRegistry.js`, `config/crops/cropAliases.js`. Dead helper: `src/utils/cropLabel.js` (0 importers, superseded by `config/crops.js#getCropLabel`).
**Recommendation:** delete dead `utils/cropLabel.js`; fold `constants/crops.js` and the normalize helpers into one taxonomy module anchored on `utils/crops.js` + `config/crops.js`. Verify `canonicalCropMap`'s marketplace-category role before merging.
**Effort:** Medium-High (many importers). **Risk:** Medium (crop-key normalization touches i18n + marketplace). **Rollback:** module-by-module; delete of `cropLabel.js` is independently safe.

**Intentional (NOT duplication):** spec-facade shims (`src/modes/simple/*`, `src/modes/standard/*` re-exporting `components/simpleMode/*`; `core/yield/yieldPredictionEngine.js`; `core/marketplace/*Engine.js` `export *` aliases; `core/api/client.js`). Same-name-different-purpose Card/`ErrorBoundary` pairs are documented as distinct roles (server- vs client-driven; full-page vs Sentry wrapper) — legitimately separate, though the naming collisions hurt discoverability.

---

## 3. Cron / workers / event-handlers

The four named crons — `autoNotifications/cron.js` (daily 08:00), `autonomousActions/cronRunner.js` (daily 07:00), `queue/farmProcessingCron.js` (30 min), `ngoReports/weeklyReportCron.js` (Mon 08:00), wired once each in `server.js:79-91` — have **no schedule/concern overlap and are NOT duplicates.** The concerns below are structural/wiring defects surfaced in the same sweep.

### 3.1 — Two parallel job systems; farm-scoring pipeline orphaned — **HIGH (wiring defect)**
**Duplicated concern:** farm scoring is *enqueued* in one job system and *executed* in another, with no bridge.
**Evidence:** `farmProcessingCron.js:88` enqueues `QUEUES.RISK_SCORING` (`'risk_scoring'`) via `server/src/queue/queueClient.js`, but `registerProcessor(QUEUES.RISK_SCORING, …)` appears only in tests (`__tests__/scaleInfra.test.js`) — zero non-test consumers. With `REDIS_URL` unset, batches land in the in-memory `deferredJobs` list and are never drained (`queueClient.js:168-175`). The actual scorer runs under a different queue name `'score_farm'` in a different system (`server/intelligence/infra/jobs.ts`, Postgres `v2_jobs`, wired `server.js:100-113`). The two systems share no queue names or storage.
**Recommendation:** either register a `risk_scoring` consumer in the BullMQ/in-memory system, or repoint `farmProcessingCron` to enqueue `score_farm` on the Postgres job system. Document which job system is canonical and retire the other's overlap.
**Effort:** Medium. **Risk:** Medium (activating a dormant scoring sweep changes load). **Rollback:** the sweep is currently a no-op, so gating the new wiring behind a flag makes rollback a flag flip. **UNVERIFIED:** whether the `score_farm`/`risk_scoring` mismatch is a deliberate migration-in-progress vs a bug — evidence points to bug, intent not documented in code.
*Note:* `server/intelligence/dist/*` is the compiled build artifact of `intelligence/*.ts`, **not** a source duplicate — do not "consolidate."

### 3.2 — Hidden self-starting workers inside a route module — **LOW-MEDIUM**
**Evidence:** `server/src/modules/issues/routes.js` starts background timers at import time outside the cron registry: `:69` unconditional `setInterval` SSE-ticket GC that **runs even under `NODE_ENV=test`** (no env guard); `:982-994` `startSlaEscalation()` (30 min); `:1049-1059` `startDigestCron()` (hourly + 10s boot run). Distinct SLA/digest concern (not a duplicate), but an inconsistent worker location and absent from the shutdown path.
**Recommendation:** move these into the central cron registry in `server.js`; add the test env-guard to the `:69` interval.
**Effort:** Low-Medium. **Risk:** Low. **Rollback:** restore module side-effects.

### 3.3 — Shutdown leak: `stop*` imported but never called — **LOW-MEDIUM**
**Evidence:** `server.js:222-223` graceful-shutdown calls only `stopNotificationCron()` + `stopAllWorkers()`. Imported `stopAutonomousActionCron`, `stopFarmProcessingCron`, `stopWeeklyReportCron` (`server.js:13,16,19`) are never called; the two `setInterval` timers at `server.js:116` (`expireStaleAlerts`) and `:119` (`pruneJobs`) are never cleared; `issues/routes.js`'s `stopSlaEscalation`/`stopDigestCron` are never invoked.
**Recommendation:** call every `stop*` and `clearInterval` in the SIGTERM handler.
**Effort:** Low. **Risk:** Low. **Rollback:** revert handler.

**Event handlers:** **No true duplicate handlers found.** Two event stores (`src/runtime/events/eventRuntime.js` and `src/runtime/flywheel/eventStore.js`) have distinct callers; the `src/runtime/v13/events/*` cluster is a readiness-declaration namespace, not a live bus. **UNVERIFIED** whether `eventRuntime.js` and `flywheel/eventStore.js` should be unified — flagged as overlap only.

---

## 4. Feature flags

### 4.1 — Two frontend flag registries, both exporting `isFeatureEnabled`, overlapping scan flags — **MEDIUM**
**Duplicated:** two independent registries expose an identically-named predicate with different precedence and naming, and overlap on the same concept.
**Evidence:** `src/config/features.js` (camelCase keys, env `VITE_FARROWAY_FEATURE_*`, `isFeatureEnabled:554`, ~44 flags) vs `src/utils/featureFlags.js` (`FEATURE_*` keys, env `VITE_FEATURE_*` + `window.__FARROWAY_FLAGS__` + localStorage, `isFeatureEnabled:305`, 41 flags). Scan overlap: `FEATURE_SCAN` (`featureFlags.js:130`) vs `scanDetection`/`scanApiEnabled` (`features.js:65,74`). Server mirror `server/src/config/features.js` (2 flags) is a separate, legitimate concern.
**Recommendation:** designate one frontend registry canonical, migrate the other's keys, and re-export a single `isFeatureEnabled` to preserve call sites.
**Effort:** Medium. **Risk:** Medium (flag precedence changes can flip shipped behavior). **Rollback:** keep both predicates until all call sites migrate.

### 4.2 — Dead flags defined but never read — **MEDIUM**
**Evidence:** the six "Invisible Intelligence Layer" flags in `src/config/features.js:534-539` (`enableAnalyticsEngine`, `enablePredictionEngine`, `enableAiAdapter`, `enableSatelliteEngine`, `enableScoringEngine`, `enableRiskEngine`) are never passed to `isFeatureEnabled()` or read via `FEATURES.*`. `enableAnalyticsEngine` has zero references outside its definition; the rest appear only in a doc-comment (`src/intelligence/getPrimaryGuidance.ts:20-21`). The only live `isFeatureEnabled('enable…')` call reads `enableHindiLocale`.
**Recommendation:** delete the six dead flags (they gate nothing) or wire them to their intended consumers.
**Effort:** Low. **Risk:** Low. **Rollback:** restore definitions.

### 4.3 — Stale comment-vs-default contradictions — **LOW**
**Evidence:** in `src/config/features.js`, `fundingHub` comment (`:25-27`) says "Off by default" but value is `true` (`:28`); `guidedFundingApplication` comment (`:177-179`) says "DEFAULT ON — ships unconditionally" but value is `false` (`:180`). Stale comments, not runtime conflicts — they misrepresent the shipped default.
**Recommendation:** correct the comments to match values (or the values, if the comments express intent).
**Effort:** Trivial. **Risk:** None (comments). **Rollback:** revert.
*Not a defect:* `enableHindiLocale: false` (`:93`) is an intentional, documented founder decision.

---

## 5. Hidden kernels

No hidden kernel causes a runtime collision. The one structural-duplication finding here is shape-cloning, not behavior duplication.

### 5.1 — Per-version CapabilityRegistry/HealthRuntime kernels are structural clones — **LOW**
**Duplicated (shape, not behavior):** `V13CapabilityRegistry.ts` / `V14CapabilityRegistry.ts` (and `V15`) share the same `C()` builder, `Capability` shape, and `vNNCapabilityHealth()` + `installVNNCapabilityHealth()` template, each pinning a distinct global (`__v13CapabilityHealth`, `__v14CapabilityHealth`, …). Installed from `src/App.jsx:2065,2070,2075`. The `HealthRuntime` kernels (`v7:1086`, `v8:1120`, `v13:1160`, `os:2247`) follow the same pattern. Because globals differ, **there is no runtime collision** — this is the capability-registry over-accumulation the `farroway-v10-v14-honest-ceiling` memo warns about.
**Recommendation:** extract one shared `CapabilityRegistry` base (builder + envelope + install template) and have each version import it, passing only its version tag and capability list. Do **not** merge the globals.
**Effort:** Medium. **Risk:** Low (probes are read-only diagnostics). **Rollback:** per-version revert. **Caveat:** several HealthRuntime headers advertise a "zero imports / self-contained" constraint — confirm no gate forbids cross-imports before extracting a base.
*Related note (frontend scaffolding):* 464 files redefine the same inline `const _safe = <T,>(fn,fb)=>{try{…}catch{…}}` and 124 hardcode the `'Decision support, not a guarantee.'` tail. Extracting `_safe` + `GUIDANCE_TAIL` into one base would remove ~460 copies — blocked only if the "zero imports" constraint is intentional.

**Not defects (verified):** `src/runtime/v13/` (gated readiness namespace) vs `src/runtime/farmos13/` (farm-agent) coexist without symbol collision, consistent with the `farroway-v13-namespace-collision` memo. `src/runtime/notifications/NotificationRuntime.ts` (health probe) vs `notificationRuntime.js` (push-governance runtime) are a near-name collision with different responsibilities — an import hazard, not duplicated logic.

---

## 6. Dead code / unused models / unreachable routes

### 6.1 — `intelligenceV2/` module — TRUE ORPHAN — **MEDIUM**
**Evidence:** only `__tests__/intelligenceV2.test.js` references it; `learningLogger.js`, `recommendationEngine.js`, `riskModel.js` have zero production importers.
**Recommendation:** delete the module (and its test), or wire it if it is intended future work.
**Effort:** Low. **Risk:** Low. **Rollback:** restore from VCS.

### 6.2 — `ngoAdmin/routes.js` + `ngoImport/routes.js` — orphaned HTTP surface — **MEDIUM**
**Evidence:** neither route file is imported into `app.js` (they appear only in `.git/index`). Their *engine* files, however, **are used** — `ngoAdmin/`'s `fundingEngine`/`riskEngine`/`scoreEngine`/`yieldEngine`/`interventionEngine`/`programService` are consumed by `core/contextService.js` and `organizations/exportService.js`. So: engines live, HTTP surface dead.
**Recommendation:** delete the two unmounted route files; keep the engines.
**Effort:** Low. **Risk:** Low (routes are unreachable already). **Rollback:** restore files. **Caution:** do not touch the engine files.

### 6.3 — Duplicate `admin/issues` route — second component unreachable — **MEDIUM**
**Evidence:** `src/App.jsx` declares `path="admin/issues"` twice in one `<Routes>` block: `:4057`→`<AdminIssuesPage />` and `:4080`→`<AdminIssueDashboardPage />`. React Router v6 renders the first match, so `AdminIssueDashboardPage` (line 4080) is unreachable — dead route + dead mount. (Only exact-duplicate path in the 230-route table.)
**Recommendation:** remove the duplicate, or give `AdminIssueDashboardPage` a distinct path if it is meant to be reachable.
**Effort:** Trivial. **Risk:** Low — confirm which page is intended before deleting. **Rollback:** restore the route line.

### 6.4 — Five schema-only Prisma models (unused) — **LOW**
**Evidence (of 131 models, 130 referenced; these 5 have zero non-schema/non-migration references via `\baccessor\b` word-boundary search):** `V2BoundaryPoint` (`schema.prisma:1863`), `V2LandInsight` (`:1905`, declared as `FarmProfile.landInsights[]` but never read/written — clearest schema-drift signal), `V2Job` (`:2697`, only a test string-assertion at `intelligence.test.js:521`), `V2ScoringConfig` (`:2716`, same test-only mention), `TaskInteraction` (`:3540`, table `task_interactions`, zero references of any kind).
**Recommendation:** treat as provisioned-but-not-wired; drop via migration once confirmed no raw-SQL consumer exists, or wire them.
**Effort:** Low (per model). **Risk:** Low-Medium — dropping a table is destructive; needs a migration + backup. **Rollback:** migration-down. **UNVERIFIED:** reference detection covered Prisma-client accessors and bare names in `.js/.ts/.mjs`; models used **only** via raw `$queryRaw`/`$executeRaw` against the `@@map` table name (e.g. `task_interactions`) would not be caught. Treat "unused" as "no Prisma-client usage found," strong but not a raw-SQL guarantee — grep the 5 table names in SQL string literals before any drop.

### 6.5 — `dedupStore.js` — dormant module — **LOW**
**Evidence:** `server/src/modules/notifications/dedupStore.js` has no live importers (self-reference only); its own header (`:29-32`, `:101-107` note dated 2026-07-06) and the `farroway-dedupstore-deferred` memo confirm dormancy; references a phantom `AutoNotification.metadata` column.
**Recommendation:** leave until `insightNotificationAdapter` is wired to a live channel (per the standing memo), then make it real or delete. **Effort:** N/A now. **Risk:** None (inert). **Rollback:** N/A.

### 6.6 — `core/auditLog.js` — dead writer — **LOW**
**Evidence:** `server/src/core/auditLog.js:72` (`logAuditAction` + `ALLOWED_ACTIONS`) has 0 importers (see 1.4).
**Recommendation:** delete alongside the audit-writer consolidation. **Effort:** Trivial. **Risk:** Zero. **Rollback:** restore file.

### 6.7 — Abandoned second backend `backend/` — **LOW** (large weight)
**Evidence:** `backend/` is a separate NestJS + TypeORM app (`agripilot-backend`, `@nestjs/*`, `agripilot.sqlite`) not referenced by any deploy command (Dockerfile/railway/render all run `server/src/server.js`). Dead second backend.
**Recommendation:** delete the directory (or archive out of the deploy repo) after confirming no CI/tooling references it.
**Effort:** Trivial to remove; the confirmation is the work. **Risk:** Low. **Rollback:** restore from VCS. Also stray: empty `app/onboarding/{farm-profile,farmer-type}/` dirs.

---

## Architecture Validation

| Check | Verdict | Basis |
|---|---|---|
| **Circular dependencies?** | **PASS** | The `risk ↔ trust` pair is NOT a true cycle at file granularity: `risk/service.js:35`→`trust/service.js`, but `trust/service.js` imports only `config/database.js`; the reverse edge lives in the leaf `trust/routes.js:24` (never imported by `risk`). Service files form a DAG. Fragile but not cyclic. No other cycles among sampled edges; the two apparent hits (`recommendations→recommendations`, `ingest→server`) are JSDoc examples, not imports. Module graph is healthy top→down (orchestration → shared `audit`/`regionConfig`/`notifications`). |
| **Orphan modules?** | **CONCERN** | `intelligenceV2/` is a true orphan (6.1); `ngoAdmin/routes.js` + `ngoImport/routes.js` are orphaned HTTP surfaces though their engines are live (6.2). Non-orphans correctly ruled out: `autonomousActions`/`ngoReports` (crons), `region`/`soil`/`satellite` (mounted via `decisionV2` composition, `app.js:3141-3144`). |
| **Dead code?** | **CONCERN** | Unreachable duplicate route `admin/issues` (6.3); dead `core/auditLog.js` (6.6); dormant `dedupStore.js` (6.5); abandoned `backend/` app and empty `app/onboarding/*` dirs (6.7); dead frontend helpers `utils/cropLabel.js`, `lib/relativeTime.js`, `components/language/LanguageSuggestionBanner.jsx`, two `EmptyState` copies (§2). |
| **Unused models?** | **CONCERN** | 5 of 131 Prisma models are schema-only with zero Prisma-client references: `V2BoundaryPoint`, `V2LandInsight`, `V2Job`, `V2ScoringConfig`, `TaskInteraction` (6.4). Raw-SQL usage not exhaustively excluded — flagged UNVERIFIED for raw SQL before any drop. |
| **Duplicate ownership?** | **CONCERN** | NGO/org domain is fragmented across 6 modules (`organization` singular vs `organizations` plural, `ngoAdmin`, `ngoImport`, `ngoReports`, `ingest/ngoRoutes`); the singular/plural split is the clearest naming hazard. True-dup ownership confirmed for Prisma-client instantiation (1.1), org-scope filters (1.2), Twilio send/config (1.3), audit writers (1.4). Whether `organization/` vs `organizations/` and `decision`/`decisionV2`, `intelligence`/`intelligenceV2` are redundant vs intentional versioning is **UNVERIFIED** (handlers not diffed line-by-line). |
| **Hidden kernels?** | **PASS (with note)** | No hidden kernel collides at runtime — versioned `CapabilityRegistry`/`HealthRuntime` globals are distinct; `v13` vs `farmos13` namespaces are separate; `NotificationRuntime.ts` vs `notificationRuntime.js` differ in responsibility. Structural shape-cloning across versions is real but non-colliding (5.1) — a maintenance concern, not a defect. |
| **Conflicting flags?** | **CONCERN** | Two frontend registries both export `isFeatureEnabled` with different precedence and overlap on scan flags (4.1); 6 intelligence-engine flags are defined but read nowhere (4.2); 2 flags have comments contradicting their shipped defaults (4.3). `enableHindiLocale=false` is intentional, not a conflict. |

**Overall:** No circular dependencies and no runtime-colliding hidden kernels (both PASS). The recurring theme is **accumulation** — dead HTTP surfaces, provisioned-but-unwired models/flags, and copy-pasted cross-cutting logic (Prisma client, org-scope, Twilio) — rather than structural rot. The three HIGH findings (1.1, 1.2, 1.3) plus the orphaned scoring pipeline (3.1) are the highest-value, lowest-regret consolidations.