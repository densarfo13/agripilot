# AMBEE_SOIL_HARDENING_REPORT

Soil is the real (and only) Ambee dependency in this repo. It is now the first
production provider behind the EnvironmentOrchestrator, hardened without changing
its calm public contract.

## What was already solid
6h cache (per ~1km grid), graceful `null` on every failure, injectable fetcher,
raw Ambee response never surfaced (4-field output only: soilMoisture /
soilTemperature / moistureRisk / farmingHint).

## What this sprint added (non-breaking)
- **Telemetry** — every call records status, httpStatus, latency, failure reason,
  and call/failure/cacheHit counters into `_diag`.
- **Failure taxonomy** — `auth_failed_401 / forbidden_403 / rate_limited_429 /
  timeout / provider_error / mapping_error / ready`.
- **Timeout** — 6s AbortController; a hung Ambee call can never stall the caller.
- **Diagnostics** — `getSoilProviderDiagnostics()` returns safe info only:
  envPresent, keyLength, keyFingerprint (first 6 chars — never the secret),
  endpoint, status, latency, cache stats.
- **Retry + circuit breaker** live in the orchestrator layer (so the pinned
  call-count tests on `fetchSoilFromAmbee` stay green): 1 transient retry, then
  3 consecutive failures open the circuit for 60s.

## Contract preserved (verified by direct exercise)
- missing key → `null`
- 401 → `null` + diagnostics `failureReason: auth_failed_401`
- success → 4-field shape + `status: ready`
The existing pinned-contract test (exact call counts, 4-field output, raw never
surfaced) is unaffected — telemetry + timeout-signal do not change returns/counts.

## Secrets
Never logged. Fingerprint is first 6 chars only; the public health endpoint
exposes no key data at all.
