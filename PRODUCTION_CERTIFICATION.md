# PRODUCTION_CERTIFICATION

Converts the scan subsystem from READY_FOR_PILOT toward PRODUCTION_CERTIFIED —
by **measuring**, never asserting. No architecture redesign, no new providers.

## How readiness is decided (live evidence only)
A provider is **READY** only when a real call proves ALL of:
✓ key exists · ✓ auth succeeds (200) · ✓ schema valid · ✓ parsed correctly ·
✓ confidence ≥ threshold · ✓ latency under SLA · ✓ FarmBrain accepted the payload.
Otherwise: **NOT_CONFIGURED** (no key) · **DEGRADED** (keyed, not yet proven) ·
**FAILED** (auth/credits/http error) · **DISABLED** (optional, not integrated).
Key-present alone is NEVER READY. The gate fails the build on hardcoded READY,
fabricated confidence, or skipped auth/validation/FarmBrain.

## Run it (live, on the deployed server)
`POST /api/admin/scan/certify` (admin-auth) runs every provider, captures
latency/confidence/auth/payload-validity/FarmBrain-acceptance, stores rows in
`scan_provider_certifications`, and returns the scorecard + overall verdict.

## Files (server-side — keys are secrets)
`server/src/services/scan/certification/`: providerCertification · providerValidator ·
providerHealthMonitor · providerScorecard · productionCertification.

## Sentinel Hub
OPTIONAL. `required:false` — it can never reduce the overall verdict.

## Current verdict (from the sandbox): **NOT_CERTIFIED**
No provider keys are loaded here, so every required provider is honestly
NOT_CONFIGURED. On Railway with keys + a live certify run, the verdict recomputes
from real evidence toward PRODUCTION_CERTIFIED (every REQUIRED provider READY).
A simulated all-green live run DOES certify (proven by the gate) — so the path is
real, not stubbed.
