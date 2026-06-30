# Scan Production Certification Report

**Goal:** move the scan pipeline from PARTIAL toward PRODUCTION_CERTIFIED via *real-metric*
verification — no engine redesign, no refactor of working code.

## Current automatic verdict: **DEVELOPMENT**
Computed by `certifyScanLifecycle()` from real metrics. It is DEVELOPMENT because **zero real
production scans have been recorded** — the engine refuses to report anything higher without live
volume. This is the honest state, and it will auto-advance the moment real scans accrue.

## What this sprint added (the keystone)
- **`scanLifecycleCertification.ts`** — automatic state ladder from real metrics:
  **DEVELOPMENT → PILOT → STAGING → PRODUCTION_CERTIFIED**, plus `percentiles()`, `scanAlerts()`,
  and `buildScanCertificationReport()`. Composes the existing reliability data (does not recompute).
- **Honesty invariant (gate-locked):** PRODUCTION_CERTIFIED is **impossible** without real volume
  (≥5000), every quality threshold, AND measured accuracy. Zero volume → DEVELOPMENT; production
  volume + great rates but *unverified accuracy* → STAGING, never certified. 12-assertion test +
  `check:scan-lifecycle-certification` gate (in build:safe).

### Lifecycle thresholds (real metrics, not manual flags)
| State | Volume | Success | p95 | Timeout | Crash-free | Verified accuracy |
|---|---|---|---|---|---|---|
| PILOT | ≥50 | ≥85% | — | — | ≥97% | — |
| STAGING | ≥500 | ≥92% | ≤6s | ≤5% | ≥99% | — |
| PRODUCTION_CERTIFIED | ≥5000 | ≥95% | ≤4s | ≤2% | ≥99.5% | **≥90% (measured)** |

## The 6 requested capabilities — status (Build Once)
1. **Provider performance (p50/p95/p99, timeout/retry/success/uptime)** — **already exists**:
   `server/.../providerReliability.js` (`getReliabilityScorecard`) computes all of these; served by
   the admin reliability endpoint. The new ladder consumes it.
2. **Production telemetry** — **mostly exists** (`scanObservabilityEvent`: scanId/provider/
   confidenceBand/durationMs/success/failureReason; `scanProviderMetric`: latency/retryCount/
   httpStatus). Gaps under the spec's exact names (`user_abandoned`, `diagnosis_accepted`,
   `provider_selected`) are **not all wired** — wiring them is the field-pending telemetry task.
3. **Daily certification report** — `buildScanCertificationReport()` produces the shape (volume /
   provider health / latency / crash-free / accuracy-or-"unverified" / confidence distribution).
4. **Alerting** — `scanAlerts()` flags SUCCESS_RATE_DROP / TIMEOUT_SPIKE / CRASH_RATE_HIGH /
   LATENCY_EXCEEDED. (Delivery channel — push/email — is an ops wiring step.)
5. **Visual dashboard** — read-only provider/observability data is already exposed via the existing
   admin endpoints + `/internal` observability pages; the lifecycle state is computable there.
   A dedicated rendered view is the next UI increment (needs the authed app to verify).
6. **Certification gate (auto-mark)** — **delivered**: `certifyScanLifecycle` + its build gate.

## What actually moves DEVELOPMENT → PRODUCTION_CERTIFIED (honest)
Not code — **data**. The ladder needs real production scans:
1. Run real scans (start with the internal-test acceptance run) so `volume`, `successRate`, `p95`,
   `timeoutRate`, `crashFreeRate` populate from `scanProviderMetric` / `scanObservabilityEvent`.
2. **Measure accuracy** against ground truth (verified scans) to populate `verifiedAccuracy` — the
   one input that gates the top rung and cannot be inferred from the pipeline.
3. Wire the remaining telemetry events (#2) so the dashboard is complete.

Until then the verdict is, correctly, **DEVELOPMENT** — and it will move on its own as the metrics
arrive, with no manual flag flip. That is the point: the certification is now automatic and honest.
