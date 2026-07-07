# SYSTEM_ARCHITECTURE.md — Farroway

> Generated 2026-07-06 by a multi-agent read-only repository audit (6 parallel evidence agents + 2 synthesis agents, 226 tool-uses). Every claim is traceable to cited file paths; items not verifiable end-to-end are marked UNVERIFIED. No source was modified to produce this — it is an analysis artifact. Four headline findings were independently spot-verified before publishing (dead backend/ app, 18 PrismaClient instantiations, unmounted intelligenceV2, duplicate admin/issues route).

---

## Application Layers

Farroway is a two-tree system: a Vite/React frontend (`src/`) and an Express API server (`server/src/`), backed by PostgreSQL via Prisma. The canonical deploy entry is `server/src/server.js` (confirmed in `Dockerfile:45`, `render.yaml:15`).

| Layer | Path | Responsibility |
|---|---|---|
| Frontend SPA | `src/` (60+ top-level dirs) | Vite/React client. Largest sub-layer is `src/runtime/` (776 files, 137 subdirs) — the FarmBrainState event→state→screen engine owning most client domain logic (auth, buyer, scan, analytics, notifications, onboarding). Curated knowledge in `src/knowledge/` (runtime reads here, gate-enforced). |
| API server (canonical) | `server/src/` | ESM Express app. `app.js` (~3,300 lines) wires all routes plus inline scan endpoints; `server.js` boots the app and starts crons. Sub-layers: `modules/` (~70 feature modules), `ml/` (scan pipeline), `services/`, `core/`, `middleware/`, `config/`, `lib/`. |
| Legacy route layer (V2) | `server/routes/` (41–44 files) | Cookie-based "v2 enterprise" routers, mounted mostly under `/api/v2/*`. Imported into `app.js` as `v2*Routes` (e.g. `app.js:135-176`, `3224-3268`). |
| TS intelligence subsystem | `server/intelligence/` | Self-contained TypeScript pest-risk/admin/ingest service, compiled to `intelligence/dist/`, mounted as `intelligenceRouter` at `/api/v2` (`app.js:186, 3270`). Built via root `tsc -p intelligence/tsconfig.json`. |
| Data layer | `server/prisma/` | `schema.prisma` (postgresql, 131 models + 35 enums), `migrations/`, `_pending-migrations/` (staged enterprise tables, not yet applied), seed scripts. |
| Build/gate scripts | `scripts/` (500 files) | `build:safe` = `scripts/run-build-safe-checks.mjs` runs the `check-*.mjs` gate suite + Vite build (`package.json:249`). |
| CI | `.github/workflows/` (4 workflows) | `release-gate.yml` (build:safe + security), `production-safety.yml`, `commit-hygiene.yml`, `build-ios.yml`. |

**Two parallel API tracks coexist by design** (wired together in `app.js`):

- **V1** — Bearer JWT + module system. Routers under `server/src/modules/*/routes.js`, mounted mostly at `/api/*` and `/api/v1/*`. Auth = `Authorization: Bearer <jwt>`.
- **V2** — httpOnly-cookie sessions. Routers under `server/routes/*.js`, mounted at `/api/v2/*`. Auth = `access_token`/`refresh_token` cookies.

The V1 `authenticate` middleware (`server/src/middleware/auth.js:59-89`) deliberately accepts **both** a Bearer token (`config.jwt.secret`) and a V2 cookie (`env.ACCESS_TOKEN_SECRET`), so a V2 cookie session can reach V1 endpoints — a documented bridge (in-code at lines 75-86).

**Stray / non-canonical top-level dirs (flagged):**
- `backend/` — a separate, abandoned NestJS + TypeORM app (`agripilot-backend`, `@nestjs/*`, `agripilot.sqlite`). Not referenced by any deploy command (Dockerfile/railway/render all run `server/src/server.js`). Dead second backend.
- `app/onboarding/` — two empty dirs (`farm-profile/`, `farmer-type/`). Stray.
- `mobile/`, `ml/`, `android/`, `ios/`, `website/` — platform/aux, out of scope.

## Ownership Map

| Domain | Server owner | Client owner |
|---|---|---|
| Auth | `server/src/modules/auth/` (routes, service, admin-routes, federation, smsVerification) + `modules/mfa/`. Mounted `/api/auth`, `/api/mfa`. V2: `server/routes/auth.js` | `src/runtime/auth*`, `src/auth/authKeys.js`, `src/context/AuthContext.jsx` |
| Farmers | `server/src/modules/farmers/` + `farmProfiles/` + `modules/farmers/partnerImportRoutes.js`. Mounted `/api/farmers`, `/api/v1/farms` | `src/runtime/farmer*` (farmerCompletion, farmerSuccess) |
| NGO / Organizations | Fragmented across multiple modules (see Module Dependency Graph): `organizations/` (`/api/organizations`), `ingest/ngoRoutes.js` (`/api/ngo`), `enterprise/` (`/api/enterprise`), `ngoAdmin/` (engines used, routes NOT mounted), `ngoImport/` + `ngoReports/` (cron only), plus `organization/` (singular, onboarding-only). V2: `routes/ngoDashboard.js`, `routes/ngoV2.js` (`/api/v2/ngo`) | `src/ngo/*`, `src/runtime/*` |
| Buyers | V2 track (admin-managed): `server/routes/buyers.js` + `buyer-links.js` + `buyer-trust.js` (`/api/v2/buyers*`). V1: `modules/buyerInterest/` (`/api/buyer-interest`) | `src/runtime/buyer*`, `buyerTrust` |
| Scan | No `scan` module — endpoints inline in `server/src/app.js` (`/api/scan/analyze`, `app.js:1037`), delegating to `server/src/ml/*`. Provider health at `server/src/routes/scanProviderHealth.js`; canonical engine also at `services/scan/` | `src/runtime/scan*` (20+ subdirs), `src/features/scan/`, `src/knowledge/` |
| Notifications | `server/src/modules/notifications/` (service, deliveryService, smartAlertDispatcher, `dedupStore.js`) + `autoNotifications/` (cron). Channel providers in top-level `server/services/*` (SMS/email/whatsApp/voice) | `src/notifications/*`, `src/runtime/notifications` |
| Analytics | `server/src/modules/analytics/` (`/api/v1/analytics`) + v2 `routes/analytics*.js` + `pilotMetrics/`, `benchmarking/`, `impact/`, `modules/events/` (`/api/events`) | `src/analytics/*`, `src/runtime/analytics` |
| Intelligence | 3 layers: `server/intelligence/` (TS, `/api/v2`), `modules/intelligence/` (`/api/intelligence`), `modules/intelligenceV2/` (orphan) | `src/intelligence/` (89 files), `src/runtime/intelligence*` |

## Module Dependency Graph

Scope: the ~70 server modules under `server/src/modules/*`. Edges were derived from static `from '../<sibling>/'` grep, excluding shared infra (`config/lib/core/utils/middleware/services/domain/db/cache/queue/ml`). Dynamic `await import()` inside `app.js` scan handlers was spot-checked but not exhaustively followed.

**Direction is consistent and mostly acyclic** — feature modules depend *downward* on a small set of foundational modules. The overall shape is: **orchestration (applications, decisionV2, auth, seasons) → leaf/shared (audit, regionConfig, notifications, soil/satellite/region)**. This is a healthy layered graph.

**Foundation sinks (depended on, depend on nothing back):**
- `audit` — universal sink; ~25 modules import `../audit/` (auth, security, invites, farmers, tasks, reports, marketplace, …). Correct foundation module.
- `regionConfig` — second sink; imported by seasons (×5), postHarvest, marketGuidance, verification, fraud, decision, reminders, activities, benchmarking, buyerInterest.
- `notifications` — imported by farmers, issues, system, postHarvest, buyerInterest, activities, autoNotifications.

**Representative edges (importer → dependency):**
- `applications/` → verification, intelligence, fraud, farmProfiles, decision, benchmarking, audit (the top orchestration module — imports the most siblings; nothing imports it back).
- `auth/` → audit, security, regionConfig, notifications, farmProfiles, email.
- `seasons/` → regionConfig (×5), lifecycle, security, reminders, farmProfiles, audit.
- `decisionV2/` → soil, satellite, region, aiTask (composes the signal modules; wired at `app.js:3141-3144` as separate `/api/soil`, `/api/satellite`, `/api/region` routers).
- `autonomousActions/` → autoNotifications; `autoNotifications/` → risk, notifications, audit.

**Circular dependencies:**
- `risk` ↔ `trust` — **not a true cycle (module-level only).** At file granularity: `risk/service.js:35` imports `computeSeasonTrust` from `trust/service.js`; `trust/routes.js:24` imports `computeSeasonRisk, computeFarmerRisk` from `risk/service.js`; and `trust/service.js` imports only `config/database.js` (no back-edge to risk). The two *service* files form a DAG (`risk/service → trust/service`); the reverse edge lives in `trust/routes.js`, a leaf importer never imported by `risk`. No actual import cycle, but fragile — moving one function between service files would create one. Note, not a fix.
- No other cycles found among the sampled edges. False positives ruled out: `recommendations → recommendations` (`biasAdapter.js:14`) and `ingest → server` (`maintenance.js:36`) are JSDoc comment examples, not imports.

**Orphan modules (no routes mounted, no non-test importer):**
- `intelligenceV2/` — **TRUE ORPHAN.** Only `__tests__/intelligenceV2.test.js` references it. `learningLogger.js`, `recommendationEngine.js`, `riskModel.js` have zero production importers.
- `ngoAdmin/routes.js` + `ngoImport/routes.js` — **route files are orphaned** (never imported into `app.js`; only appear in `.git/index`). However, `ngoAdmin/`'s *engine* files (fundingEngine, riskEngine, scoreEngine, yieldEngine, interventionEngine, programService) **are used** by `core/contextService.js` and `organizations/exportService.js`. Engines live, HTTP surface dead.

**Not orphans (wired via non-route paths):**
- `autonomousActions/`, `ngoReports/` — background crons started in `server.js` (`cronRunner.js`, `weeklyReportCron.js`).
- `region/`, `soil/`, `satellite/` — mounted via `decisionV2` composition (`app.js:3141-3144`).
- `recommendations/`, `risk/`, `farmMetrics/`, `organization/` — imported as service libs by other modules (`organization/` only by `farmers/partnerImportRoutes.js`).

## API Graph

The API is assembled in one large ESM file, `server/src/app.js` (~3,270 lines). There are four mounting patterns (all intentional, not duplication):

**a) Inline handlers in `app.js`** — 55 `app.<verb>('/api…')` handlers defined directly in the file, almost entirely the scan/intelligence-analysis surface (deliberately centralized rather than split into a module):
- `POST /api/scan/analyze` (`app.js:1037`) — canonical scan entry; `POST /api/scan` (`:885`) 307-redirects to it.
- Scan lifecycle/ops: `/api/scan/{history,feedback,follow-up,escalate,statistics,providers,review,bulk}` and a large `/api/admin/scan-*` + `/api/admin/scan-validation/*` cluster (`:704`–`:2966`).

**b) Modular routers (V1)** — 59 `routes.js` files under `server/src/modules/*/`, one canonical router per domain, imported and mounted under `/api/*` and `/api/v2/*` (`app.js:3053`–3207). Examples: `/api/auth`, `/api/farmers`, `/api/applications`, `/api/decision`, `/api/intelligence`, `/api/marketplace`, `/api/organizations`, `/api/notifications`, `/api/issues`, `/api/onboarding`, `/api/mfa`, `/api/security`, `/api/trust`, `/api/pilot`, `/api/insights`.

**c) Legacy flat routers (V2)** — 44 files in `server/routes/*.js` (`farmProfile.js`, `weeklySummary.js`, `cropSuggestions.js`, `issueReports.js`, `buyers.js`, `harvests.js`, `market.js`, …), imported as `v2*Routes` and mounted mostly under `/api/v2/*` (`app.js:3224`–3268). A parallel V2 REST surface over the same DB.

**d) Compiled TS subsystem** — `server/intelligence/dist/index.js` imported at `app.js:186` and mounted at `/api/v2` (`app.js:3270`), where the V2 pest/satellite/drone intelligence models are consumed.

**Totals and version bands:** 114 `app.use('/api…')` mounts; `/api` (base), `/api/v1`, `/api/v2` bands; `/api/uploads` served with auth (`app.js:572`); tiered rate-limiters keyed by path family (scan/funding/sell) at `app.js:566-568`.

**Main API groups:** auth/MFA/federation · farmers · farm profiles/seasons · applications & review workflow · decision/soil/satellite/region engines (V2) · scan + scan-admin (inline) · intelligence (pest/satellite, TS subsystem) · marketplace/buyers/supply-readiness · organizations/programs/NGO dashboards · notifications/reminders/auto-notifications · issues/feedback/community · analytics/insights/pilot-metrics · trust/verification/fraud.

**Worth a closer look (unverified as true duplication):** two NGO surfaces (`modules/ngoAdmin`, `modules/ngoImport`, `routes/ngoDashboard.js`, `routes/ngoV2.js`) sharing `/api/v2/ngo`, and overlapping decision routers (`modules/decision`, `modules/decision/engine`, `modules/decisionV2`, plus the soil/satellite/region split at `app.js:3141-3145`). Their handlers were not diffed line-by-line — redundancy is **unverified**.

## Database Graph

`server/prisma/schema.prisma` (postgresql, `prisma-client-js`): **131 models + 35 enums.** Major clusters, anchored by verified relations:

- **Org / program hierarchy** — `Organization` (schema:21) → `User[]`, `Farmer[]`, `Program[]`, `Cohort`, `Issue[]`, `ApprovalRequest[]`, `PilotChecklistItem[]`.
- **User / auth** — `User` (:257) with `PasswordResetToken`, `UserSession`, `EmailVerificationToken`, `FederatedIdentity`, MFA fields; self-relations to `Farmer`/`Application` (creator, assigned officer, approver, reviewer).
- **Farmer domain** — `Farmer` (:423) → `Application[]`, `FarmActivity[]`, `FarmSeason[]`, `Reminder[]`, `FarmerNotification[]`, `ProduceStorageStatus[]`, `BuyerInterest[]`, `FarmProfile[]`.
- **Application / review workflow** — `Application` (:533) → `EvidenceFile[]`, `ReviewAssignment[]`, `ReviewNote[]`, `AuditLog[]`, `FieldVisit[]`; plus `VerificationResult`, `FraudResult`, `DecisionResult`, `BenchmarkResult`, `IntelligenceResult`.
- **Farm season / progress** — `FarmSeason` (:966) → `SeasonProgressEntry[]`, `StageConfirmation[]`, `OfficerValidation[]`; `HarvestReport`, `ProgressScore`, `CredibilityAssessment`.
- **FarmProfile intelligence hub** — `FarmProfile` (:1362) is the fan-out root for the V2 intelligence graph: `V2Season`, `RecommendationRecord`, `WeatherSnapshot`, `FarmFinanceScore`, `V2SupplyReadiness`, `V2LandBoundary`, `V2SeedScan`, `V2LandInsight`, `V2CropCycle`, and `V2PestImage/PestReport/SatelliteScan/FieldStressScore/HotspotZone/DroneScan/TreatmentAction/FarmPestRisk`.
- **Scan / observability** — `ScanTrainingEvent`, `ScanObservabilityEvent`, `ScanProviderCertification`, `ScanProviderMetric`, `ScanValidation`, `ScanFeedback`, `ScanAccuracy`, `PhotoComparison`, `FarmStateRecord`.
- **Decision / action layer** — `DecisionContext`, `DailyDecision`, `ActionCompletion`, `OutcomeFeedback`, `TaskInteraction`, `TaskOutcome`, `RecommendationOutcome`, `TodaysActionEvent`, `FarmHealthScore`, `InsightAggregate`.
- **Issues / notifications** — `Issue` (:1613) → `IssueComment[]`, `IssueAttachment[]`; plus `StaffNotification`, `Notification`, `FarmerNotification`, `AutoNotification`, `EventLog`.
- **Marketplace** — `CropListing`, `ProduceListing`, `MarketInterest`, `BuyerProfile`, `BuyerRequest`, `MarketplacePayment`, `BuyerInterest`.
- **Analytics / telemetry** — `AnalyticsEvent`, `V2AnalyticsEvent`, `ClientEvent`, `FarmEvent`, `FarmMetrics`, `ActionLog`, `AdminAuditLog`, `RiskSnapshot`, `PilotDailySnapshot`, `OnboardingEvent`, `EmailLog`.

**Model usage:** 130 of 131 models are referenced by real Prisma-client calls in runtime code. The V2 pest/satellite/drone models are consumed by the `server/intelligence/dist/` subsystem — not dead.

**Genuinely unused — 5 models (schema-only, verified by `\baccessor\b` word-boundary search returning 0 non-schema/non-migration hits):**

| Model | schema.prisma | Notes |
|---|---|---|
| `V2BoundaryPoint` | :1863 | Child of `V2LandBoundary` (cascade); never created/read in code (parent `V2LandBoundary` is used). |
| `V2LandInsight` | :1905 | Declared as `FarmProfile.landInsights[]` relation (schema:1362) but never written/read. Clearest schema-drift signal. |
| `V2Job` | :2697 | No callers; only a schema-existence assertion in `src/__tests__/intelligence.test.js:521`. |
| `V2ScoringConfig` | :2716 | Has a `User` relation; no callers; same test-only mention. |
| `TaskInteraction` | :3540 | Table `task_interactions` with 3 indexes; zero references of any kind. |

Confidence HIGH for these 5. `V2Job` and `V2ScoringConfig` appear only inside a test asserting the schema *text* contains their `model` declaration — consistent with provisioned-but-not-wired tables.

**Unverified / caveats:** Reference detection covers Prisma-client accessors and bare-name usage in `.js/.ts/.mjs`. Models used **only** via raw SQL (`$queryRaw`/`$executeRaw` against the `@@map` table name, e.g. `task_interactions`) would not be caught. "Unused" here means "no Prisma-client usage found" — strong but not a raw-SQL guarantee.

## Event Flow

Farroway has multiple event/telemetry write-paths, targeting **different tables for different consumers** — an intentional split, not duplication.

- **V1 app analytics** — `modules/analytics/routes.js` (`/api/v1/analytics`, `app.js:3220`): `POST /track` (any authed user), admin-gated `GET /counts` + `/voice-summary` → `analytics/service.js`.
- **V2 event beacon** — `routes/analytics.js` (`/api/v2/analytics`, `app.js:3256`): `POST /events` → canonical `EventLog` via `src/services/analytics/eventLogService.js:logEvent` (allowlist-validated, always 202); `POST /track` → `V2AnalyticsEvent`.
- **Soft-launch ingestion** — `modules/events/routes.js` mounted at API root (`app.js:3074`): `POST /api/events`, `POST /api/errors`, admin `GET /api/admin/metrics`, writing `ClientEvent` rows. Rate-limit hits also land here (`app.js:459-489`).
- **Rollups** — `routes/analytics-summary.js` (`/api/v2/analytics-summary`, `app.js:3260`); onboarding analytics in `onboarding/service.js:164`; org dashboards in `organizations/*Service.js`.

The three write-paths target distinct tables: `v2AnalyticsEvent`, `EventLog`, `ClientEvent`.

**Client-side event stores (frontend):** Two separate stores with distinct callers (not copies) — `src/runtime/events/eventRuntime.js` (used by `weatherAndLanguageDiagnostics.js`, `continuity/continuityRuntime.js`) and `src/runtime/flywheel/eventStore.js` (used by `plants/PlantMemoryGraph.ts`). Whether these two should be unified is **unverified** — flagged as overlap, not confirmed duplication. A `src/runtime/v13/events/` cluster (`EventContract.ts`, `EventIdempotency.ts`, `EventReplayReadiness.ts`, `EventSourcingRuntime.ts`) is a *readiness-declaration* namespace installed as `__v13Health` probes (`App.jsx:1150`), not a live event bus.

**Background job systems (server) — two parallel mechanisms that do not share queue names or storage:**
- `server/src/queue/queueClient.js` — BullMQ/in-memory; queues `risk_scoring`, `autonomous_actions`, `notifications`, `scan_jobs`, `sync_jobs`.
- `server/intelligence/infra/jobs.ts` — Postgres `v2_jobs` polling workers (`startWorker`), used at `server.js:100-113` for `satellite_ingest`/`score_farm`/`send_alert`.

**Known wiring gap (real bug):** `queue/farmProcessingCron.js:88` enqueues onto `QUEUES.RISK_SCORING` (`'risk_scoring'`), but no processor is ever registered for that queue in production code (`registerProcessor(QUEUES.RISK_SCORING, …)` appears only in `__tests__/scaleInfra.test.js`). With `REDIS_URL` unset, enqueued batches land in the in-memory `deferredJobs` list and are never drained (`queueClient.js:168-175`). The actual farm-scoring worker is registered under a *different* queue name `'score_farm'` in the *other* job system. Whether this is a deliberate migration-in-progress or a wiring bug is **unverified**; evidence points to a bug.

## Authentication Flow

Two implementations, one per track — intentional.

| Track | Entry route | Token issue | Verify middleware |
|---|---|---|---|
| V1 | `POST /api/auth/login` → `modules/auth/routes.js` → `authService.login` (`modules/auth/service.js:115`) | `generateToken` signs `{sub,email,role,tv}` with `config.jwt.secret` (`service.js:279-291`) | `authenticate` → `verifyUserFromPayload` (`middleware/auth.js:59,94`) |
| V2 | `POST /api/v2/auth/login` → `routes/auth.js:157` | `createSessionAndCookies` → `signAccessToken`/`signRefreshToken`, persists a `UserSession` row, `setAuthCookies` (`routes/auth.js:45-67`) | `middleware/authenticate.js:4` (cookie-only) |

- **`verifyUserFromPayload`** (`server/src/middleware/auth.js:94-147`) is the canonical V1 identity resolver: 60s in-memory user cache, `tokenVersion` (`tv`) revocation check, DB role as source of truth, and the load-bearing **`id` aliased to `sub`** (lines 114, 141 — documented at 96-101 as the fix for scan-history 401s). Sets `req.user = {...payload, id, role, organizationId}`.
- **MFA gate** — both tracks branch to a short-lived challenge token when `isMfaRequired(role)` (V1 `service.js:168-189`; V2 `routes/auth.js:194-219` + `POST /mfa/verify`).
- **Revocation** — V1 logout bumps `tokenVersion` (`service.js:243-251`); V2 logout/reset revokes `UserSession` rows (`routes/auth.js:367-392, 811-859`).
- **Phone-OTP login** — `loginViaPhone` (`service.js:66-113`) via Twilio Verify, wired through `routes/auth.js:887-963`.
- OTP/reset **aliases** in `routes/auth.js` and `modules/auth/routes.js` explicitly forward to one shared service (documented "no parallel implementation", `routes/auth.js:877-885, 883-919`).
- Client bootstrap: `src/context/AuthContext.jsx` (bootstrap + redirect-to-`/login`) calling `src/lib/api.js`.

## Authorization Flow

RBAC, ownership guards, and org scoping, applied at multiple layers.

- **V1 role gate** — `authorize(...roles)` (`middleware/auth.js:154-168`): strict allowlist, logs `role_denied`.
- **V2 role gate** — `requireRole(...roles)` + `requireOwnershipOrRole` + `blockRoles` (`server/middleware/rbac.js:36,67,87`); `admin`/`super_admin` always bypass (`SUPER_ROLES`, line 18).
- **Ownership guards (V1)** — `requireFarmerOwnership`, `requireApplicationAccess` (`middleware/auth.js:212,253`); generic `requireOwnership` in `middleware/requireOwnership.js`.
- **Org scoping** — `middleware/orgScope.js`: `extractOrganization` (line 54) attaches `req.organizationId`/`req.isCrossOrg` (super_admin = cross-org, optionally `?orgId`); helpers `orgWhereFarmer`/`orgWhereApplication`/`orgWhereUser` and per-record `verifyOrgAccess` (lines 122-168); 60s org cache.
- **Defence-in-depth router factory** — `middleware/protectedRouter.js`: auto-applies `authenticate`, and at *registration time* refuses any `:id`-shaped route lacking a recognized guard, substituting an `unguarded_route_blocked` terminator (`protectedRouter.js:143-170, 234-256`); `GUARD_NAMES` set at 69-89. This is the runtime complement to the `security:routes` static scanner.

Note the two tracks use different `req.user` shapes (`.sub` vs `.id`) and different bypass semantics — `authorize` (V1) vs `requireRole` (V2) are intentionally distinct, not duplicated.

## Lifecycle Flows

### Farmer

Two entry paths into a farmer account:
- **Staff invite** → `POST /api/farmers` (`modules/farmers/routes.js:110`, staff-only) calls `inviteFarmer` (`modules/auth/farmer-registration.js`, imported at `routes.js:19`). Creates a `Farmer` row with `inviteToken` + `inviteExpiresAt` (7-day expiry, `farmer-registration.js:36-43`).
- **Self-register** → `farmerSelfRegister` (`farmer-registration.js:50`) creates `User(role=farmer, active=false)` + `Farmer(pending_approval)`.

**Invite acceptance (public, token-authenticated)** — `modules/invites/routes.js`:
- `GET /api/invites/:token/validate` (line 35) — non-consuming prefill.
- `POST /api/invites/:token/accept` (line 89) — atomic `$transaction` creating the `User`, linking to `Farmer`, consuming the token (`inviteToken: null`, `inviteAcceptedAt`), notifying `createdById` staff (lines 159-203).
- Admin resend/status: `modules/invites/adminRoutes.js` (mounted before public router, `app.js:3196-3197`).

**Onboarding state machine** — `modules/onboarding/service.js`: states `not_started → in_progress → completed | abandoned` (`VALID_TRANSITIONS`, lines 13-18); every transition writes an `OnboardingEvent` row inside a `$transaction` (`recordOnboardingEvent`, line 23). `startOnboarding` fires non-blocking from V2 register (`routes/auth.js:141-143`). Analytics: `getOnboardingAnalytics` (line 164).

**Approval gate** — `requireApprovedFarmer` (`middleware/auth.js:176-204`) blocks farmer-role users whose `Farmer.registrationStatus !== 'approved'`.

**Farm profile + lifecycle state** — `modules/farmProfiles/routes.js` (`/api/v1/farms`, `app.js:3210`) → `getFarmerLifecycleState` (`utils/farmerLifecycle.js`): states `NEW → SETUP_INCOMPLETE → ACTIVE`, derived from required-field completeness (`farmerLifecycle.js:13-54`). V2 equivalent: `routes/farmProfile.js`.

**Season lifecycle** — `modules/seasons/` (`/api/seasons`, `app.js:3189`; V2 `routes/seasons.js`): router stacks `authenticate → extractOrganization → requireApprovedFarmer` (`seasons/routes.js:57-60`) plus ownership guards `requireSeasonAccess`/`requireFarmerOrgAccess` (lines 27-49, 64+). Status machine in `seasons/statusTransitions.js`: `active → harvested|abandoned|failed`, `harvested → completed|active`, etc. (`VALID_TRANSITIONS`, lines 29-35), with per-transition role permissions (`TRANSITION_PERMISSIONS`, lines 41-50) and staleness rules (lines 52-54). Progress = images (`imageValidation.js`), officer validation (`officerValidation.js`), scoring (`scoring.js`), credibility (`credibility.js`).

### NGO

- **Organization CRUD + dashboard** — `modules/organizations/routes.js` (`/api/organizations`, `app.js:3190`). Stack `authenticate → extractOrganization`; list gated `authorize('super_admin','institutional_admin')` with own-org narrowing (`routes.js:20-49`). Services: `dashboardService.js`, `exportService.js`, `pilotMetricsService.js`.
- **NGO admin analytics** — `modules/ngoAdmin/routes.js`: a factory (`createNgoAdminRouter({prisma, requireAdmin})`, line 36; CommonJS `require`) exposing `/summary`, `/farmers`, `/risk`, `/export` off the `farmEvent` table via pure aggregators (`farmEventsService.js`) + engines (`riskEngine`, `yieldEngine`, `interventionEngine`, `scoreEngine`, `fundingEngine`, `programService`). **Note: this router is NOT mounted into `app.js`** — its engines are consumed by other modules, but the HTTP surface is dead.
- **NGO read/ingest APIs** — `modules/ingest/ngoRoutes.js` (`/api/ngo`, `app.js:3070`); NGO import at `modules/ngoImport/`, reports at `modules/ngoReports/` (cron).
- **V2 NGO track** — `routes/ngoDashboard.js` (`/api/v2/ngo`) + `routes/ngoV2.js` (decision endpoints, same `/api/v2/ngo`, `app.js:3239,3251`).
- **Enterprise org platform** — `modules/enterprise/routes.js` (`/api/enterprise`); writes return 503 pending a staged migration (documented `app.js:79-83`).

There are three org-ish module dirs — `organizations/` (canonical CRUD), `organization/` (singular, onboarding-only), and `ngoAdmin/`. Whether `organization/` and `organizations/` are truly redundant is **unverified** (singular dir contents not opened) — flagged as worth a closer look.

### Buyer

Entirely V2/cookie, admin-managed catalogue — **there is no buyer end-user role**; ownership is `createdBy`/`linkedBy` admin (documented `routes/buyers.js:9-15`, `routes/buyer-links.js:9-17`).

- **Buyer catalogue** — `routes/buyers.js` (`/api/v2/buyers`, `app.js:3265`). List open to any authenticated user; `GET /:id` gated `requireAdmin` (`buyers.js:52`).
- **Buyer ↔ supply linking (the actual lifecycle)** — `routes/buyer-links.js` (`/api/v2/buyer-links`, `app.js:3266`). Status machine `buyer_linked → buyer_contacted → in_discussion → matched → closed|cancelled` (`VALID_STATUSES`, line 19); links join `V2BuyerLink` ↔ `V2Buyer` ↔ supply/profile with trust enrichment (lines 30-60).
- **Buyer trust** — `routes/buyer-trust.js` (`/api/v2/buyer-trust`, `app.js:3267`).
- **V1 buyer-interest surface** — `modules/buyerInterest/routes.js` (`/api/buyer-interest`, `app.js:3164`): a separate farmer-facing "a buyer is interested" signal, rate-limited by `sellLimiter`. Distinct concern, not a duplicate of the V2 admin catalogue.

### Scan

Defined **inline in `server/src/app.js:1037`** (not a module router). Chain: `authenticate → scanUserLimiter → handler`. An IP-keyed `scanLimiter` also applies via regex mount (`app.js:566`), plus a per-user cap `scanUserLimiter` (60/min, `app.js:524-541`).

Pipeline (all lazy-imported from `server/src/ml/`):
1. **Daily quota** — `checkDailyScanLimit` (`ml/scanLimitGuard.js`), returns 429 before any provider spend (`app.js:1068-1097`).
2. **Preprocess** — `preprocessImage` (`ml/preprocessImage.js`): validate/size/EXIF (`app.js:1099`).
3. **History + context signals** — recent `scanTrainingEvent` (line 1117), satellite snapshot `getLatestSatelliteSnapshot` (line 1139), farm coords (line 1185).
4. **Inference / consensus** — `runConsensus` (`ml/scanConsensusEngine.js`, line 1157) firing Plant.id + PlantNet in parallel; plus `detectInsect`, `detectCropHealth`, `detectMushroom`, `fetchFieldHealth`, `fetchSoilProfile` (`ml/providers/*`, lines 1162-1172); `deriveGrowthStage`, `getRegionalIntelligence`, `getMarketIntelligence` (lines 1177-1179).
5. **Fuse** — `fuseContext` (`ml/contextFusionEngine.js`).
6. **Safety** — `applySafetyFilter` (`ml/scanSafetyFilter.js`).
7. **Tier + questions** — `tierPolicy`, `verificationQuestions` (`app.js:1299-1302`).
8. **Persist (fire-and-forget)** — `scanTrainingEvent.create` (line 1314); `recordScanObservation` (`ml/scanObservability.js`, line 1341); per-provider `recordProviderMetric` + `classifyProviderFailure` (`services/scan/certification/*`, lines 1366-1406).
9. **Normalize + return** — `normalizeToSpecShape`/`normalizeToFullSpecShape`/`normalizeToDecisionShape` → `verdictV2`/`verdictV3`/`decision` envelopes (`ml/scanResultNormalizer.js`, from line 1414). Every failure branch returns `SPEC_FALLBACK_*` so the client never null-checks.

Provider keys are server-side secrets (never called from the browser). Aliases/observability/admin endpoints (`/api/scan`, `/api/scan/statistics`, `/api/scan/providers`, `/api/scan/review`, `/api/admin/scan/*`) are also inline in `app.js:883-1035`.

### Notification

Multiple complementary layers (not copies):
- **Farmer notifications (V1 store)** — `modules/notifications/service.js`: `createNotification` writes `FarmerNotification` (line 10), also reused as a generic store (e.g. Farroway-score snapshots, lines 30-70). Routes: `modules/notifications/routes.js` (`/api/notifications`, `app.js:3159`), stack `authenticate → requireApprovedFarmer`, farmer-scoped list/unread/mark-read with `requireFarmerOwnership` (lines 15-45). Delivery: `deliveryService.js` (email/SMS), `smartAlertDispatcher.js`.
- **Staff notifications** — `StaffNotification` rows (e.g. invite-accepted, `invites/routes.js:194`).
- **Automated triggers** — `modules/autoNotifications/`: `triggerEngine.js` runs 6 rules (invite_reminder, no_first_update, stale_farmer, validation_pending, reviewer_backlog, high_risk_alert; lines 1-31), fed by `cron.js` (daily 08:00 UTC), throttled by `rateLimiter.js`, rendered via `templates.js`, dispatched by `sender.js`. Mounted `/api/auto-notifications` (`app.js:3206`).

**Dormant piece:** `notifications/dedupStore.js` is inert (no live callers; its own header and a 2026-07-06 note say so; references a phantom `AutoNotification.metadata` column). Safe to leave until `insightNotificationAdapter` is wired live.

### Analytics

Three intentional surfaces, each writing to a different table for a different consumer (see Event Flow for detail): V1 app analytics (`modules/analytics/routes.js` → `analytics/service.js`), the V2 event beacon (`routes/analytics.js` → `EventLog` + `V2AnalyticsEvent`), and soft-launch ingestion (`modules/events/routes.js` → `ClientEvent`). Rollups in `routes/analytics-summary.js`; onboarding analytics in `onboarding/service.js:164`; org dashboards in `organizations/*Service.js`.

---

## Notes on Intentional Patterns vs. Duplication

These are documented as **intentional** and should not be mistaken for defects:
- V1-module vs. V2-route tracks (different auth/token models; bridged on purpose in `middleware/auth.js`).
- Per-router relative routes each re-declaring `authenticate`/`extractOrganization` (the `router.use(...)` convention; `protectedRouter.js` exists to make it safe).
- `authorize` (V1) vs. `requireRole` (V2) — different `req.user` shapes and bypass semantics.
- OTP/reset aliases forwarding to one shared service.
- Notification layers (farmer/staff/auto) and analytics surfaces (v1/v2/events) — distinct tables/consumers.
- Two Prisma import paths (`config/database.js` vs `lib/prisma.js`) — the latter re-exports the same singleton (`server/lib/prisma.js:2`); one canonical client, two aliases.
- `server/intelligence/dist/*` — compiled build artifact of the TS sources, not a source duplicate.
- `src/runtime/v13/` vs `src/runtime/farmos13/` — coexisting namespaces, no symbol collision.
- `enableHindiLocale: false` — an intentional founder decision, not a defect.

Items explicitly marked **unverified** in the evidence (and not to be treated as settled fact): whether `modules/organization/` (singular) truly overlaps `organizations/` (plural); whether `decision`/`decisionV2` and `intelligence`/`intelligenceV2` v1 variants are live or legacy; whether `eventRuntime.js` and `flywheel/eventStore.js` should be unified; and whether the `risk_scoring` vs `score_farm` queue-name mismatch is a deliberate migration or a wiring bug (evidence points to bug).
