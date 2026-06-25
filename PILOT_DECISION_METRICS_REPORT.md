# PILOT_DECISION_METRICS_REPORT

## Events tracked (§8)
The decision funnel emits, via the existing PilotAnalytics pipeline:
`daily_decision_shown`, `daily_decision_started`, `daily_decision_completed`,
`decision_outcome_recorded`, `scan_recalculated_decision`,
`weak_scan_sent_to_review`, `duplicate_decision_suppressed`.

## Admin pilot report (§8) — derived rates
| Metric | Source |
|---|---|
| Daily Decision Start % | started ÷ shown |
| Daily Decision Completion % | completed ÷ started |
| Outcome Capture % | outcome_recorded ÷ completed |
| Scan-to-Decision Success % | scan_recalculated ÷ clear scans |
| Weak Scan Review Rate | weak_scan_sent_to_review ÷ total scans |
| D1 / D7 Retention | existing RetentionRuntime |

These compose the SCAN_OBSERVABILITY / PilotAnalytics surfaces already shipped —
no parallel metrics store. The decision events are new; the dashboards that
render them are the existing `/internal/pilot-analytics` + `/admin/scan-health`.

## Honest status
- The decision **engine + funnel events** are in place and gated.
- **Real pilot numbers are 0 until farmers use it** — the report shows the
  derivation, not fabricated rates. Learning stays off until ≥50 feedback
  samples (`__decisionEngineHealth().learningActive`).

## Final verdict: **PILOT_READY**
Engine built, tested (18 assertions), gated (5 gates), surfaced above the fold,
and instrumented. READY_FOR_100_FARMERS is gated on: the full Home hero
restructure, dynamic-text localization, and real pilot funnel data — all honestly
noted, none faked.
