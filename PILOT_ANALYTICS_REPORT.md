# PILOT_ANALYTICS_REPORT.md

**Sprint #188 — pilot analytics measurement readiness.**
Generated: build-time (static contract surface).

## Pilot readiness summary

Farroway has moved from build mode to **proof mode**:
- 24 canonical pilot events defined (`PILOT_EVENT_CONTRACTS_VERSION`).
- Unified `trackPilotEvent({…})` write-side helper landed.
- localStorage event log persisted under `farroway.pilotEvents` (FIFO 5000 cap).
- `window.__pilotAnalyticsHealth()` + `window.__pilotMetrics(days?)` pinned at boot.
- Sanitizer rejects sensitive substrings and any metadata key not in the allow-list.
- Existing `/internal/pilot-analytics` dashboard (sprint #157) reads from the new aggregator.

When real pilot users land, `__pilotMetrics()` returns real numbers.
Until then, every count is `0` and every rate is `null` (renders
**NEEDS_DATA** in the UI — never a fake percentage).

## Canonical events tracked (24)

- `signup_started`
- `signup_completed`
- `login_completed`
- `language_selected`
- `farm_created`
- `garden_created`
- `crop_added`
- `plant_added`
- `today_action_shown`
- `today_action_started`
- `today_action_completed`
- `scan_started`
- `scan_completed`
- `scan_unknown_result`
- `scan_candidate_selected`
- `task_created`
- `task_completed`
- `outcome_recorded`
- `followup_created`
- `followup_completed`
- `notification_opened`
- `weekly_review_viewed`
- `sell_listing_created`
- `funding_viewed`

## Live metrics

Paste `JSON.stringify(window.__pilotMetrics(), null, 2)` here after
driving the journey:

```json
{ "runtimeVersion": "pilot-metrics-aggregator-v1", "windowDays": 7, "scansStarted": 0, "scansCompleted": 0, "tasksCreated": 0, "tasksCompleted": 0, "outcomesRecorded": 0, "followupsCreated": 0, "followupsCompleted": 0, "scanSuccessRate": null, "taskCompletionRate": null, "outcomeCaptureRate": null, "followupCompletionRate": null, "wau": 0, "mau": 0, "d1Retention": null, "d7Retention": null }
```

## Active users

Sourced from `countDistinctActiveDays()` in the last 7 / 30 days
(WAU / MAU). When zero events are persisted: WAU=0, MAU=0.

## Scan success

`scanSuccessRate = scansCompleted / scansStarted` (rate `null` when
`scansStarted == 0` — never `0%` or `100%` falsely).

## Task completion

`taskCompletionRate = tasksCompleted / tasksCreated` (rate `null` when
`tasksCreated == 0`).

## Outcome capture

`outcomeCaptureRate = outcomesRecorded / scansCompleted` (rate `null`
when `scansCompleted == 0`).

## Follow-up completion

`followupCompletionRate = followupsCompleted / followupsCreated`
(rate `null` when `followupsCreated == 0`).

## Retention

- D1: distinct active days in last 7, scaled to 7 (proxy until
  server-side cohort tables ship).
- D7: distinct active days in last 30, scaled to 30.
- Both return `null` when no events recorded.

## Language usage

Tally of `event.language` for every captured event in the window.
Reflects the locale the user had selected at event time. Renders as
NEEDS_DATA when no events recorded.

## Privacy safeguards

- Allowed metadata keys (21):
  - `fromRoute`
  - `destinationRoute`
  - `topCandidateCount`
  - `confidenceBand`
  - `objectType`
  - `issueType`
  - `hasImage`
  - `durationMs`
  - `taskKind`
  - `severity`
  - `urgency`
  - `outcomeStatus`
  - `daysAfter`
  - `followUpOffset`
  - `notificationType`
  - `listingCategory`
  - `fundingApplication`
  - `attempt`
  - `retry`
  - `cached`
  - `offline`
- Sensitive substrings rejected: `@`, `+`, `phone`, `token`,
  `password`, `pwd`. Values matching are dropped before write.
- Roles are enumerated only: farmer | gardener | field_officer |
  org_admin | admin. No raw user id / name / phone / email / coord /
  device id / IP / filename.
- Stored client-side only (localStorage); server-side ingestion is
  a sprint-#189 follow-up so no PII crosses the wire today.

## Top drop-off point

Computed at runtime from `funnel` keys (signup → farm/garden →
crop/plant → today-action → scan → outcome → follow-up). Until
pilot events flow, this card renders NEEDS_DATA.

## Recommended next 3 fixes

1. **Server-side ingestion**: `POST /api/analytics/pilot-event` so
   data survives device wipes and is queryable across farmers.
   Includes the `PilotEvent` / `PilotDailyMetric` /
   `PilotUserCohort` Prisma tables from the spec. Deferred from
   this sprint per safety contract (no auto-applied migrations
   to production).
2. **Wire remaining call sites**: 5 highest-impact event call sites
   are wired this sprint (signup, language, scan, task, outcome).
   Remaining ~17 wireup points are queued for sprint #189.
3. **Server-side cohort math**: proper D1/D7 retention needs a
   cohort table keyed by first-event date. Today's proxy is
   client-only and approximates from active-day counts.

---

_Static contract report; live values require a running app + pilot
events. Update this doc after driving the acceptance test journey._
