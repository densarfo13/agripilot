# ANALYTICS_SUMMARY_FIX_REPORT.md — 2026-07-05

## Root Cause
`GET /api/v2/analytics-summary` (`server/routes/analytics-summary.js`) threw
`PrismaClientValidationError` and 500'd the admin dashboard. Two distinct schema-invalid
arguments, both on the same `Promise.all` (original lines 61–64):

1. **`status` on OfficerValidation** — `prisma.officerValidation.count({ where: { status: 'approved' } })`
   and `{ status: 'pending' }`. `OfficerValidation` has **no `status` field**. Real fields:
   `validationType`, `confirmedStage`, `confirmedCondition`, `confirmedHarvest`,
   `validatedAt` (non-null, `@default(now())`), `completedAt` (nullable), `createdAt`.
   → fired for the reported super-admin path (org-unscoped).
2. **`farmSeason` relation key** — `seasonOrgFilter = { farmSeason: { farmer: {...} } }`.
   Both `OfficerValidation` and `SeasonProgressEntry` name their season relation **`season`**,
   not `farmSeason`. → a *second*, latent crash that hit org-scoped admins
   (institutional_admin with an organizationId), independent of the `status` bug.

## Files Changed
- `server/routes/analytics-summary.js` — both invalid arguments fixed + defensive envelope.
- `server/src/__tests__/analyticsSummaryPrismaFix.test.js` — **NEW** regression guard (6 tests).

## Invalid Query Removed
```js
// BEFORE (crashed):
const seasonOrgFilter = { farmSeason: { farmer: { organizationId } } };   // wrong relation key
prisma.officerValidation.count({ where: { ...seasonOrgFilter, status: 'approved' } });  // no such field
prisma.officerValidation.count({ where: { ...seasonOrgFilter, status: 'pending'  } });  // no such field
```

## Replacement Logic
```js
// AFTER (schema-valid):
const seasonOrgFilter = req.organizationId
  ? { season: { farmer: { organizationId: req.organizationId } } }   // real relation field
  : {};
prisma.officerValidation.count({ where: { ...seasonOrgFilter, validatedAt: { not: null } } }); // validatedUpdates
prisma.officerValidation.count({ where: { ...seasonOrgFilter, completedAt: null } });          // pendingValidations
```
- **validatedUpdates** → `validatedAt: { not: null }` (a recorded validation; `validatedAt` is
  always set, so this counts all validations — the honest "validated" signal).
- **pendingValidations** → `completedAt: null`. **Honest deviation from the literal request
  mapping:** `validatedAt: null` would always be `0` here because `validatedAt` is non-nullable
  with a default, so `completedAt: null` (recorded-but-not-completed) is the meaningful "pending".
- **approved *farmers*** already comes from `prisma.farmer.count({ where: { registrationStatus:
  'approved' } })` — NOT inferred from OfficerValidation (per the request).

## Defensive Error Handling
The whole handler is wrapped in `try/catch`. Any failure now returns **HTTP 200** with:
```json
{ "ok": false, "error": "analytics_summary_failed",
  "message": "Unable to load analytics summary",
  "metrics": { /* zeroed safe defaults incl. profileCompleteness/pesticideCompliance/periodUpdates */ } }
```
so the admin dashboard degrades gracefully instead of crashing (spec §5).

## Tests Added (6, all green)
- officerValidation is **not** filtered by a `status` field (the exact crash).
- `validatedUpdates` uses `validatedAt`, not `status`.
- `pendingValidations` uses `completedAt: null`.
- season scoping uses the real `season` relation, not `farmSeason`.
- handler returns the `analytics_summary_failed` safe envelope at 200 on failure.
- approved farmers come from `Farmer.registrationStatus`, not OfficerValidation.

Also verified: no other route in `server/src` or `server/routes` carries either bug class
(grep clean); route imports without syntax error.

## Build Results
- `server` targeted tests: analyticsSummaryPrismaFix **6/6**; auth suite **30/30** (unaffected).
- `npm run build:safe`: frontend gate chain — see commit (server routes aren't in the frontend
  eslint scope; server behavior is covered by the vitest suite above).
- `npm run typecheck`: no such script in this repo (stated honestly, as in prior sprints).

## Production Verification
1. Deploy; as **super_admin** (no org) call `GET /api/v2/analytics-summary` → expect **200** with
   populated `validatedUpdates` / `pendingValidations` (previously 500).
2. As **institutional_admin** (org-scoped) call the same → expect **200** (previously the
   `farmSeason` key would have 500'd once org scope engaged).
3. Force a DB error (or inspect logs) → response is `{ ok:false, error:"analytics_summary_failed" }`
   at 200, admin dashboard renders its empty state, no crash.
