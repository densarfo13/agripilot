# Scan Health Dashboard

**Exists:** `/admin/scan-health` (`src/pages/admin/ScanHealthPage.jsx`) — per the spec's own rule
("I do NOT want another debug page"), no new dashboard was built. It reads the real observability
runtimes:

- **Provider uptime + latency** — `providerReliability` (p50/p95/p99, success/timeout rate, uptime,
  SUCCESS_RATE_DROP / TIMEOUT_SPIKE alerts).
- **Scan success / failure %** — `scanObservability` (per scan: provider, confidence band,
  durationMs, success, failureReason) + Failure % + credits consumed.
- **Retry + queue** — retry counts + `scan.queued`/`scan.drained` events.
- **Per-scan trace** — `/api/admin/scan/last-trace` (now with correlationId) + `/admin/scan-debug`
  15-step export for a single failing scan.

## Honest gaps (need real traffic, not code)
- **Accuracy panels** (flower/crop/fruit/disease accuracy, false-positive %) require **verified
  outcomes at volume** — the farmer-confirmation dataset (`/api/scan/feedback`) is the source, and
  it is empty until the pilot runs. Displaying accuracy numbers today would be fabrication; the
  panels light up as real corrections accumulate.
- **Offline usage %** — measurable only from live sessions.
