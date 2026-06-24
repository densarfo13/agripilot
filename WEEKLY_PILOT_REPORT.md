# WEEKLY_PILOT_REPORT.md

**Farroway pilot — weekly report.** Week ending: 2026-06-23.
Generated read-only by `scripts/generate-weekly-pilot-report.mjs`.
Pilot Execution Mode: architecture/intelligence/satellite/marketplace FROZEN.

## North-star metrics

| Metric | This week | Source |
|---|---|---|
| Users Activated | **NEEDS_DATA** | `__pilotMetrics()` · /admin/pilot-analytics (event: signup_completed) |
| Farms Created | **NEEDS_DATA** | `__pilotMetrics()` · /admin/pilot-analytics (event: farm_created) |
| First Scan % | **NEEDS_DATA** | `__pilotMetrics()` · /admin/pilot-analytics (event: scan_started/activated) |
| First Task % | **NEEDS_DATA** | `__pilotMetrics()` · /admin/pilot-analytics (event: task_created/activated) |
| Outcome Capture % | **NEEDS_DATA** | `__pilotMetrics()` · /admin/pilot-analytics (event: outcome_recorded/task_completed) |
| D1 Retention % | **NEEDS_DATA** | `__pilotMetrics()` · /admin/pilot-analytics (event: return_visit@24h) |
| D7 Retention % | **NEEDS_DATA** | `__pilotMetrics()` · /admin/pilot-analytics (event: return_visit@7d) |

_NEEDS_DATA = no pilot users yet. The metrics are instrumented
(events wired #188/#189/#213, funnel #217) and populate live on
the admin page the moment the cohort starts. This script cannot
read client-side analytics, so it never fabricates these numbers._

## Top 10 drop-off points (activation funnel)

Ranked once data flows by `FirstFiveMinutesEngine.dropOffStep`.
Candidate points (the funnel steps), in order:

1. signup — _% drop NEEDS_DATA_
2. language — _% drop NEEDS_DATA_
3. farm — _% drop NEEDS_DATA_
4. crop — _% drop NEEDS_DATA_
5. plantingDate — _% drop NEEDS_DATA_
6. location — _% drop NEEDS_DATA_
7. firstScan — _% drop NEEDS_DATA_
8. firstResult — _% drop NEEDS_DATA_
9. firstTask — _% drop NEEDS_DATA_

## Top 10 errors

Source: client error boundaries + server logs. **NEEDS_DATA** —
no pilot traffic yet. (Build-time error surface = 0: build:safe
311 gates green.)

## Top 10 requested features

Source: pilot feedback channel. **NEEDS_DATA** — collect from the
first cohort. Per Pilot Mode, any request is triaged against the 5
KPIs before it becomes work; everything else is rejected/deferred.

## Translation completion (real, this build)

| Locale | Coverage |
|---|---:|
| en | 100% |
| sw | 96.6% |
| ha | 96.5% |
| tw | 96.2% |
| fr | 95.1% |
| hi | 53% |

Hindi hidden until translated (enableHindiLocale=false). Total keys: 6567.

## Recommendation — Keep / Fix / Remove

| Verdict | Item |
|---|---|
| **KEEP** | The whole engineering stack — scan trust gate, Farm Brain, dedupers, activation funnel, retention engine. All gate-locked (311 green). |
| **FIX** | Nothing code-side is a confirmed blocker. The only "fix" is non-code: finish the Twi/regional translator queue (#211) for the visible locales. |
| **REMOVE** | Nothing. No feature is proven harmful — there is no usage data to prove anything yet. |

## The one recommendation that matters

Every north-star metric reads NEEDS_DATA for one reason: **no pilot
users**. The single action that improves all five at once is
onboarding the Phase-1 cohort (10-20 farmers). That is the next
step — not another code change.
