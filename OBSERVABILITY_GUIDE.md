# Observability Guide

What each domain exports for health/metrics/traces — **as implemented today**. Live production
telemetry is field-pending (no real traffic yet); the *plumbing* exists.

## Per-domain health
Most domains expose a health runtime (`*HealthRuntime` / `__*Health` global) composed into the
top-level readiness. Examples: scan startup/permanent-stability, auth startup/refresh, persistence,
queue, offline, bottom-nav, backup, security, enterprise-readiness. `window.__startupHealth()` and
the GoLive composite aggregate them.

## Scan + provider observability
- `scanObservability` — per scan: scanId, provider, confidence band, durationMs, success,
  failureReason.
- `providerReliability` — p50/p95/p99 latency, success/timeout rate, uptime; alerts
  (SUCCESS_RATE_DROP / TIMEOUT_SPIKE).
- Server: `/api/scan/diagnostics`, `/api/admin/scan/last-trace` (per-scan trace).

## Recommendation traceability
Every recommendation is explainable: FarmBrain carries the evidence + reason string; the decision
trace + timeline record what was surfaced and whether the farmer acted (`recommendation.acted`).

## Launch / pilot observability
`launchGateDecision` computes the Pilot Health Score (5 components) + the go/no-go state; the scan
lifecycle ladder classifies DEVELOPMENT→…→PRODUCTION_CERTIFIED from real volume.

## Honest gaps (field-pending)
- Only a subset of the spec's telemetry events are wired; **zero production events recorded** (no
  pilot yet).
- No distributed tracing (not needed for a modular monolith).
- Latency/FPS/cold-start are **not runtime-measured** — see PILOT_READINESS.md. This is the
  operational blocker, not a code gap.
