# FIRST_FIVE_MINUTES_REPORT.md

**Sprint #217 — first-5-minutes activation funnel.** Date: 2026-06-19.

`FirstFiveMinutesEngine.buildFirstFiveMinutes(events)` measures the
9-step success path from the pilot events the app already records:

| # | Step | Marked by event |
|--:|---|---|
| 1 | signup | signup_completed |
| 2 | language | language_selected |
| 3 | farm | farm_created |
| 4 | crop | crop_added |
| 5 | plantingDate | planting_date_added |
| 6 | location | location_added |
| 7 | firstScan | scan_started |
| 8 | firstResult | scan_completed |
| 9 | firstTask | task_created |

Output per session: `steps[]` (reached + ms-from-previous),
`completionPct`, `avgStepMs`, `totalMs`, and `dropOffStep` (the first
step not reached — the actionable signal). A missing event is "not
reached", never fabricated.

## Pre-pilot reading
**NEEDS_DATA** — no farmer has run the funnel yet. The engine + the
`Top Drop-Off Screen` it feeds the Pilot Command Center are wired and
gate-locked; the numbers populate the moment the cohort starts.

Health: `__firstFiveMinutesHealth().firstScanReachable`.
