# PILOT_COMMAND_CENTER_REPORT.md

**Sprint #195 (spec #190) — Pilot Success Optimization.**
Date: 2026-06-13
Mode: PILOT EXECUTION (per FARROWAY_EXECUTION_POLICY).

## KPI Impact declaration (policy-required)

This sprint is the **measurement instrument** the Execution Policy's
"Daily Dashboard" section mandates — it does not directly move a
KPI, it makes all five visible so the next fixes can. Expected
change: enables founder to see Today's Action Started/Completed %,
Scan Success %, Outcome Capture %, Follow-Up Completion %, D1/D7 —
the precondition for every future +X% claim.

## What shipped (policy-compliant: NO new dashboard)

The frozen-work list forbids "Additional Dashboards." The existing
`/internal/pilot-analytics` page (#157/#188/#189) already owned this
surface, so:

1. **Extended the existing page** (`src/pages/internal/PilotAnalyticsPage.jsx`):
   - **North-star KPI cards** (`pilot-kpi-cards`): Today's Action
     Started · Completed · Scan Success % · Unknown Scan % ·
     Outcome Capture % · Follow-Up Completion % · D1 % · D7 % —
     all straight from `window.__pilotMetrics()` (#188). Null rates
     render **NEEDS_DATA**, never a fake number.
   - **Top user drop-offs** (`pilot-drop-offs`): derived from the
     existing 8-stage funnel (signup → farm/garden → crop/plant →
     action started → action completed → scan → outcome →
     follow-up). Stage pairs ranked by absolute loss; stages with
     zero entrants are skipped, not zero-divided.
   - Title now reads "Pilot Command Center."
2. **Route alias** `/admin/pilot-command-center` → same page, same
   `RoleRoute ADMIN_ROLES` gate (mirror of the #189 alias pattern).
   Three paths, one page: `/internal/pilot-analytics`,
   `/admin/pilot-analytics`, `/admin/pilot-command-center`.

Vanity metrics intentionally absent per the policy.

## Drop-off model

`lost(stage i) = max(0, count(stage i-1) − count(stage i))`,
ranked descending. `lossPct = lost ÷ count(stage i-1)`. Stages with
no entrants are skipped (honest NEEDS_DATA, no division by zero).
This is a within-window count comparison, not per-user cohort
tracking — per-user funnels need the server-side tables already
queued as the #189 follow-up.

## Current readings (pre-pilot, honest)

Every KPI: **NEEDS_DATA / 0**. Drop-offs: **NEEDS_DATA**. This is
correct — no pilot users yet. The instrument is armed.

## Recommended next fixes (ranked)

### Critical
1. **Onboard Phase-1 farmers (10–20).** Nothing on this dashboard
   can move until real users generate events. This is the only
   Critical item and it is not code.

### High
2. **Server-side event ingestion + cohort tables** (queued since
   #188). localStorage-only events die with the device; D1/D7 are
   client-side proxies until cohorts are server-side. Improves:
   D7 Retention measurement fidelity.
3. **Wire the remaining ~16 event call sites** (today_action_shown/
   started/completed, farm/garden_created, crop/plant_added,
   outcome_recorded, followup_*). Until today_action_* fire, the
   two leading KPI cards undercount. Improves: Today's Action
   Started/Completed % measurement.

### Medium
4. **Real-device mobile spot-check** (M4.1 from #185) — 1 hour,
   protects Scan Success % on iOS Safari.
5. **Gardener onboarding copy branch** (M6.1 from #185) — reduces
   the signup → farm/garden-created drop-off for garden-mode users.
6. **5 deferred hardcoded strings** (#187) — localization
   completion (P0), minor D7 effect for non-English users.

## Build-gate note (honest)

The spec asks for a gate that "rejects changes that do not improve
one KPI." A static script cannot judge KPI impact — that's an
editorial judgment. The enforcement is procedural and already in
force: PILOT EXECUTION MODE requires a **KPI Impact declaration in
every commit** (recorded in standing memory + the Execution Policy
doc), and out-of-scope work is declined with a citation. The 286
existing gates protect the surfaces the KPIs depend on.
