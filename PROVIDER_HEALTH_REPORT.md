# Provider Health Report

## Measurement architecture (real, live)
- **Registry:** `server/src/ml/providerRuntimeStatus.js` — wired-vs-keyed measured **at Railway
  runtime** (never inferred from local env): plant.id, crop.health, insect.id, mushroom, field,
  soil adapters.
- **Reliability:** `providerReliability` — p50/p95/p99 latency, success/timeout rates, uptime,
  SUCCESS_RATE_DROP / TIMEOUT_SPIKE alerts. Surfaced on `/admin/scan-health` (latency dashboard)
  and per-scan via `/api/admin/scan/last-trace` (+ correlationId).
- **Failure classification → circuit behavior:** auth/credits are **terminal** (no wasteful retry —
  the credit-protecting half of a circuit breaker); timeout/5xx/429 retry transient-only with
  backoff; sustained failure → the recovery chain routes to secondary → queue automatically.

## Current measured state (honest)
**NOT_CERTIFIED — all providers DEGRADED** (the live machine-generated
SCAN_PRODUCTION_CERTIFICATION.md). This is correct by design: certification READY comes only from
real scan traffic accumulating provider health stats. Keys are set; zero production scans have run.
**One real scan begins flipping this.**

## Failover priority — reality vs the requested list
| Requested | Status |
|---|---|
| 1. Plant.id | ✅ wired (`PLANT_ID_API_KEY` → v3 endpoint) |
| 2. Pl@ntNet | ❌ no key/contract — stub = fake failover, declined |
| 3. Flora Incognita | ❌ same |
| 4. Local ML model | ❌ no trained artifact — faking it is gate-blocked (`check:v13-no-fake-ml`) |
| Actual chain | plant.id → transient retry → hybrid/heuristic secondary → offline queue → review (`ScanRecoveryChain`, tested) |

Provider *scoring/selection* logic becomes meaningful with a second wired identification provider;
the health data to drive it already accumulates.
