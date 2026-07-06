# JARVIS_COMPILER_V2_REPORT.md — Prisma Field Validation Gate (2026-07-06)

**Goal:** make it impossible for an invalid Prisma query, schema-drift bug, or model-field
mismatch to ship again — as a **build-time safety gate**, not a runtime wrapper or app kernel.

No runtime code path, Scan flow, Jarvis UI, farmer app, or admin color was touched.

---

## Root Cause

`GET /api/v2/analytics-summary` 500'd in production because it filtered
`prisma.officerValidation.count({ where: { status: 'approved' } })` — but the
`OfficerValidation` model has **no `status` field**. Prisma raises
`PrismaClientValidationError: Unknown argument 'status'` at query time, which the route
did not catch → the admin dashboard crashed.

This is a whole **class** of bug: any query filtering on a field the model lacks. It is
invisible to ESLint (the field name is a plain object key), invisible to unit tests that
don't hit that exact code path, and — where the call is wrapped in `try/catch` — invisible
in production too (the feature just silently returns nothing). The only durable defense is a
build-time check that parses the **real** schema and rejects any statically-visible `where`
key that isn't a real field/relation.

---

## Invalid Queries Fixed (8 real drift bugs across 6 files)

The gate, run across `server/routes`, `server/src`, and `src`, surfaced 8 genuine schema-drift
queries (plus 2 false positives it was then hardened against — see *New Safety Gate*).

| # | File:line | Model.key (invalid) | Fix | Was it live? |
|---|-----------|---------------------|-----|--------------|
| 1 | `server/src/modules/auth/federated.js:349` | `FederatedIdentity.provider_uq_fed_provider_account` | → `provider_providerAccountId` | **Yes** — federated OAuth login lookup |
| 2 | `server/src/modules/auth/federated.js:535` | same (link provider) | → `provider_providerAccountId` | **Yes** — provider linking |
| 3 | `server/routes/ngoDashboard.js:74` | `IssueReport.farmProfile` | org-scope via `farmProfileId IN (org profiles)` + fixed the whole `/overview` FarmProfile scoping | Crashed for org-scoped NGO admins |
| 4 | `server/src/modules/autonomousActions/decisionEngine.js:106` | `Issue.severity` | dropped (use `status: escalated`) | `try/catch` — silent dead feature |
| 5 | `server/src/modules/ngoReports/weeklyReportEngine.js:270` | `Issue.severity` | dropped (use `status: escalated`) + fixed `reason`/`priority` output | `try/catch` — silent dead feature |
| 6 | `server/src/modules/autonomousActions/decisionEngine.js:63` | `Application.acceptedAt` | → `status: { notIn: [approved, conditional_approved, rejected, disbursed] }` | `try/catch` — silent dead feature |
| 7 | `server/src/modules/pilotQA/service.js:167` | `CredibilityAssessment.score` | → `credibilityScore` | `try/catch` — silent dead feature |
| 8 | `server/src/modules/notifications/dedupStore.js:101` | `AutoNotification.metadata` | dropped phantom JSON-path filter (coarse dedup on real fields) | **Dormant** — no live callers, test-only |

### Notable finds

- **`FederatedIdentity` (bugs 1–2)** — the schema declares
  `@@unique([provider, providerAccountId], map: "uq_fed_provider_account")`. The `map:`
  argument names the **database constraint**, *not* the Prisma Client accessor. With no
  `name:`, the client accessor is the auto-generated `provider_providerAccountId` (confirmed
  against the generated `index.d.ts`). The code used the `map` name → every federated login /
  link call would throw `Unknown argument`. The gate's compound-unique parser correctly models
  Prisma's `map`-vs-`name` semantics, so it caught this real latent auth crash.
- **`ngoDashboard /overview` (bug 3)** — `FarmProfile` has no `organizationId` column; its org
  path is `farmer.organizationId`. The endpoint spread a `Farmer`-shaped flat `{ organizationId }`
  filter onto `FarmProfile`/`V2CropCycle` queries, so **every org-scoped NGO admin crashed**
  (super_admin was unaffected because the filter is `{}` there). Fixed to scope via the canonical
  `farmer: { organizationId }` relation, and `IssueReport` (which has no org relation at all) via
  its org's resolved farm-profile IDs. Same bug class as the analytics-summary crash.
- **`Application.acceptedAt` (bug 6)** — no such field; the model carries a `status` enum. Mapped
  "stalled onboarding" to "not in a terminal state after 7 days".
- **`AutoNotification.metadata` (bug 8)** — `AutoNotification` has no `metadata` JSON column at
  all. The `dedupStore` module (persistent-dedup *foundation*, per its own header) has **no live
  callers** — only a mocked unit test exercises it, so it was inert in production. The flagged
  `where` was made schema-valid; per-key persistence is **deferred to a follow-up** (needs an
  `AutoNotification.metadata Json?` migration — not shipped under the release freeze for dormant
  code). Flagged as a background task.

**Not touched (correctly):** approved-farmer counts still come from `Farmer.registrationStatus`,
never inferred from `OfficerValidation`. No diagnosis, price, yield, or approval value was
fabricated to satisfy the gate.

---

## Prisma Models Parsed

The gate parses `server/prisma/schema.prisma` **line-based** (robust to formatting), capturing
for every `model`:

- scalar **fields** and **relations** (`<name> <Type> …`),
- **compound-unique / id accessors** — `@@unique([a, b])` → `a_b`, or the `name:` if given
  (Prisma's real client-accessor rule; `map:` is *not* used as an accessor),
- excluding block attributes (`@@index`, `@@map`, …) and comments.

Current parse: **131 models** — the schema is the single source of truth; the gate never uses a
hand-maintained field list.

---

## Generated Schema Map

`src/generated/prismaModelFields.json` — `{ ModelName: [sorted field/relation/accessor names] }`
for all 131 models, generated from the schema:

```
node scripts/check-prisma-fields.mjs --write
```

The header of that file is machine-generated; **do not hand-edit**. On every run (without
`--write`) the gate rebuilds the map from the live schema and fails if the committed JSON is out
of sync — so the map can never silently drift from `schema.prisma`.

---

## New Safety Gate — `scripts/check-prisma-fields.mjs`

Scans `server/routes`, `server/src`, `src` for `prisma.<model>.<op>(…)` calls
(`findMany/findFirst/findUnique(+OrThrow)/count/aggregate/groupBy/update/updateMany/create/
createMany/upsert/delete/deleteMany`) and validates every **statically-visible top-level `where`
key** against the model's real members. On any mismatch it prints
`file:line  Model.where.<key>` + a suggested correction and exits non-zero.

**Conservative by design — favours zero false positives over completeness:**

- only calls whose argument is an inline `{ … }` literal are inspected (a `.count()` with no
  object, or `op(buildArgs())`, is skipped — no brace-wandering);
- a clause containing a spread (`...x`) is skipped (keys not statically known);
- **string / template-literal contents are skipped** — so `title: \`Storage alert: ${x}\``
  never leaks `alert` as a phantom key (this was one of the 2 false positives found + fixed
  during hardening; the other was the `map`-vs-`name` compound-key case, now modeled correctly);
- computed keys (`{ [k]: v }`) and bare shorthand (`{ farmerId }`) are out of scope (documented —
  shorthand's value/key ambiguity makes it false-positive-prone, and the crash class is the
  `key: value` form);
- scoped to `where` deliberately: `select`/`data`/`orderBy` have relation-selects, `_count`,
  nested creates and aggregate helpers whose key-space makes static validation noisy (that's a
  type-level concern) — documented as a remaining risk rather than guessed at.

**Wiring (P4):** `"check:prisma-fields": "node scripts/check-prisma-fields.mjs"` added to
`package.json` and inserted into both `build:safe:steps` and `build:safe:legacy` (right after the
Prisma cluster, before the final build). `build:safe` **fails** on any validation failure.

---

## CI Integration (P5)

`.github/workflows/production-safety.yml`:

- **`guards` job** (pure-Node, no install, runs on every push/PR to master) now runs
  `node scripts/check-prisma-fields.mjs` immediately after the existing prisma-safety guard —
  blocking the deploy *before* build if any query drifts from the schema.
- **`tests` job** now includes `checkPrismaFieldsGate.test.js` + `analyticsSummaryPrismaFix.test.js`
  in the vitest run.

---

## Tests Added (P6) — `server/src/__tests__/checkPrismaFieldsGate.test.js` (12 tests)

Runs under `npm test` (server vitest). The gate module is import-safe (its CLI is guarded by an
`isMain` check), and the test passes absolute paths + runs the gate as a subprocess, so it's
cwd-independent.

- `OfficerValidation` has **no** `status` (the exact crash) and **no** `registrationStatus`;
- `OfficerValidation` **does** expose `validatedAt` + `completedAt` (allowed);
- `Farmer.registrationStatus` **is** a real field (allowed only because the schema confirms it);
- locks the drift facts behind this sprint's fixes (`Issue.severity`, `CredibilityAssessment.score`
  → `credibilityScore`, `Application.acceptedAt`, `AutoNotification.metadata` all absent);
- captures the compound-unique **client accessor** `provider_providerAccountId`, not the `map`
  name `uq_fed_provider_account`;
- `topKeys` extracts `key: value` filters, skips **string/template contents** (no `alert`/`warning`
  leak), and flags spreads;
- **generated map is in sync** with the schema;
- **end-to-end:** the gate runs clean against the current repo (exit 0, PASS).

Existing regression tests updated where the drift fix changed behavior:
`ngoWeeklyReport` XSS-escaping test now injects via the real `description` field (Issue has no
`severity`/`issueType`). Full touched-module suite: **106 tests pass** (gate 12, dedupStore 5,
analytics 6, autonomousActions/decisionEngine, ngoWeeklyReport, federated, pilotQA).

---

## Build Results

- `npm run check:prisma-fields` → **PASS** (131 models; 0 invalid `where` keys).
- Targeted vitest (7 touched-module files) → **106/106 pass**.
- `npm run build:safe` → see commit (full gate chain + Vite production build).
- `npm run typecheck` → **no such script in this repo** (stated honestly, as in prior sprints).

---

## Remaining Risks (honest)

1. **Scope = `where` only.** `select` / `data` / `orderBy` keys are not statically validated (they
   are a Prisma-generated-types concern; validating them statically is false-positive-prone). A
   drift there would still reach runtime.
2. **Static visibility only.** Dynamically-built args (`op(buildWhere())`), spread clauses, and
   bare shorthand keys are skipped by design — a wrong field hidden behind those forms is not
   caught. This is the price of zero false positives.
3. **`dedupStore` persistence remains inert** against the live schema (no `AutoNotification.metadata`
   column). The dormant module's `where` is now schema-valid, but per-key persistence needs a
   migration before the (currently-unwired) insight-notification path goes live — flagged as a
   follow-up.
4. **`ngoDashboard` — all four endpoints fixed.** `/overview`, `/risk-summary`, `/crop-analytics`,
   and `/harvest-analytics` all shared the same latent org-admin crash (flat `Farmer`-shaped
   `organizationId` spread onto `FarmProfile`/`V2CropCycle`, which lack that column). All four now
   scope via the canonical `farmer: { organizationId }` relation (and `IssueReport` via resolved
   farm-profile IDs), with cross-org isolation regression tests in `ngoDashboardOrgScope.test.js`.
   Residual: the org-profile-ID resolution `findMany` calls in `server/routes` are unbounded by
   design (they resolve an org's full profile set for scoping) — acceptable at closed-beta pilot
   scale; a `take:` cap / keyset pagination is worth adding before large-org rollout.

None of these are new regressions — they are the documented boundaries of a deliberately
conservative gate. The gate closes the exact production crash class that motivated it and every
real drift it could see.
