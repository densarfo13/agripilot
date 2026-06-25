# ENVIRONMENT_PROVIDER_HEALTH_REPORT

## Soil (first production provider) — hardened
`ambeeSoilService.js` now records telemetry without changing its calm
4-field-or-null contract (pinned tests preserved):
- failure taxonomy: `auth_failed_401 / forbidden_403 / rate_limited_429 / timeout
  / provider_error / mapping_error / ready`
- 6s AbortController timeout; latency + call/failure/cacheHit counters
- `getSoilProviderDiagnostics()` — fingerprint (6 chars) only, never the secret
- Verified by direct exercise: missing-key→null; 401→null + `auth_failed_401`;
  success→4-field + `status: ready`.

## Runtime readiness (measured on Railway, not assumed)
`GET /api/environment/diagnostics` (admin) reports per provider:
`envPresent / keyLength / keyFingerprint / status / httpStatus / failureReason /
latencyMs / cache`. If `AMBEE_API_KEY` is set, soil reports `envPresent:true` and
a real call resolves `ready` or the precise failure.

## Pollen
Honestly `ambeePollenConfigured:false`, `failureReason:no_pollen_provider` — a
disabled stub, never a fabricated signal.

## Verdict
**ENVIRONMENT_READY_FOR_PILOT** — orchestrator + Soil hardening are production-ready
and gated; no farmer workflow depends on Ambee; FarmBrain degrades (confidence
down) rather than blocking. Live Soil readiness is measured on Railway via the
diagnostics endpoint.
