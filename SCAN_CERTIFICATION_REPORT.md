# SCAN_CERTIFICATION_REPORT

## What is certified (real, deterministic — no mocks)
- **Pipeline resilience (Phase 3):** a failing provider does not crash the run or
  ingest weak data (verified via the real ingestion gate).
- **Unknown/non-plant rejection (Phase 5):** shoe/person/table/wall/vehicle →
  `unknown`/review; no FarmBrain diagnosis, no disease prediction.
- **FarmBrain validation (Phase 4):** confidence degrades with evidence; no invented
  diagnoses; weak/unknown held for review.
- **Provider safety:** mushroom never claims edible; soil hardened (telemetry/
  timeout/circuit breaker); environment never blocks FarmBrain.
`__scanCertificationHealth()` exposes all of the above.

## What is NOT certified here (and why)
- **Live crop-photo provider accuracy (Phase 2):** requires real photos against the
  live providers. The sandbox has no photos and no live execution path, and the
  spec forbids fabricating provider responses. Status: **PENDING_OPERATOR_RUN**.
  Harness: `scripts/run-scan-acceptance.mjs` (crops/fruits/flowers/mushroom/unknown/
  non-plant) — run it against production with keys + a photo dir.
- **Sentinel Hub:** not integrated (no provider; excluded by pilot doctrine).

## Verdict
Per-provider: see PROVIDER_SCORECARD.md. **Overall: READY_FOR_PILOT.**
PRODUCTION_READY is intentionally **not** claimed — it requires the live photo run
+ multi-provider accuracy, which cannot be certified from the sandbox without
fabricating results.
