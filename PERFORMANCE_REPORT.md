# PERFORMANCE_REPORT — pre-pilot

## Shipped
- **Reject tiny photos at preflight** (`resolutionOk`, MIN_DIMENSION 256): a too-small
  upload no longer reaches the providers — saves a network round-trip + a provider
  credit + a slow, weak result for the farmer.
- **Duplicate-scan guard** (`scanIdempotency`): a double-tap no longer fires a 2nd
  provider call — removes a redundant multi-second request + its credit.
- **DB composite index** (`ScanProviderMetric [provider, created_at]`): the 24h
  reliability query uses an index instead of a growing table scan — keeps the admin
  dashboard fast as metrics accumulate.

## Measured / current
- **Bundle:** governed by `check:bundle-budget` (raw budget enforced in CI).
- **Image normalize:** every scan is downscaled to ≤2048px @ 0.82 JPEG before upload
  (existing) — bounds upload size + provider latency.
- **build:safe:** 363 gates green.

## Pending measurement (the #3 boot work, not yet shipped)
The boot effect awaits ~204 dynamic imports, ~27 of them non-critical health installs.
The planned change: defer those past first paint (`requestIdleCallback` + batched
`Promise.all`) and capture a **Lighthouse Time-to-Interactive before/after on a
throttled low-end-Android profile**. This is the next perf item; it is intentionally
not shipped blind — the number is the deliverable, and it requires a measured pass.
No fabricated before/after figures are recorded here.
