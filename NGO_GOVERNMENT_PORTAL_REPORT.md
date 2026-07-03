# NGO + Government Portal Report

## NGO portal — ALREADY BUILT (verified, not regenerated)
`src/runtime/organization/` + enterprise runtime: programs/cohorts (BulkOnboardingRuntime,
BulkAssignmentRuntime, CSVImportEngine), farmer invites (server `/api/invites` + `/activate`),
field-officer views (FieldOfficerViewRuntime + follow-up surfaces), onboarding/scan/task/risk
monitoring dashboards (`/internal/ngo-health`, pilot analytics), impact + outcome comparison,
exports, **tenant isolation + audit logging gate-enforced**. Roles map onto the existing RBAC
(NGO admin / field officer / viewer).

## Government portal — built to its honest ceiling
Regional/enterprise analytics surfaces exist; dashboards are **aggregated/anonymized by default**
(tenant isolation + no-private-leak gates). Food-security indicators, yield forecasts, and national
program tracking are honestly **`no_live_feed`** until a government data agreement supplies real
feeds — surfaces render honest empty/aggregate states, never fabricated national numbers.
Disease-outbreak monitoring gains signal only from real scan volume (pilot-gated).

## Privacy rules — already enforced
Individual farmer data only within the owning tenant; cross-tenant access blocked (gates +
runtime); audit events on provisioning/exports; coarse coordinates only (~1km).

## Nothing new shipped here on purpose
Rebuilding these under `src/domains/ngo|government/` would duplicate a working, gate-locked
platform (Build Once). The Phase-2 delta for these portals is **real data + real programs**, which
the pilot produces.
