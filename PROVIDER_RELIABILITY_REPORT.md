# PROVIDER_RELIABILITY_REPORT

Every provider proves production reliability from REAL runtime metrics — never
fabricated. Per-call rows land in `scan_provider_metrics`; the 24h scorecard is
computed from them (`GET /api/admin/scan/reliability`, admin).

## Per-provider 24h scorecard
For plant.id / crop.health / insect.id / mushroom.id / soil / weather:
request count · success % · failure % · latency p50/p95/p99 · timeout/429/401/403/500
counts · retry count · cache hit rate · avg confidence · FarmBrain acceptance % ·
uptime · **health score** · **health status**.

## Health score (100 − penalties)
`100 − timeouts − authFailures(×1.5) − rateLimits(×0.5) − schemaFailures −
FarmBrainRejects − 5xx`. With **no calls the score is `null`** (NO_DATA) — never a
fake 100. Status: HEALTHY ≥90 · HEALTHY_WITH_WARNINGS ≥75 · DEGRADED ≥50 · CRITICAL <50.

## Current (sandbox): NO_DATA
No calls have been recorded here. On Railway, scans record metrics and the
scorecard populates from real traffic.
