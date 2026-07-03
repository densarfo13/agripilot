# Load Test Report

## Status: NOT EXECUTED — reported honestly, not simulated

The requested 1k–100k simultaneous-scan load test was **not run**, for three real reasons:
1. **Environment** — this sandbox cannot generate meaningful distributed load; numbers produced
   here would be fabricated evidence.
2. **Provider credits** — each real scan consumes paid plant.id credits; 100k synthetic scans would
   burn the credit pool with zero informational value (the provider path can be load-modeled with
   mocked provider responses instead).
3. **Production safety** — load-testing the live Railway deployment without provisioning/isolation
   is a self-inflicted outage risk.

## What IS measured today
Per-scan latency (p50/p95/p99), success/timeout rates, and uptime via `providerReliability` —
populated by real traffic. Rate limiting (`scanUserLimiter`) bounds per-user load.

## The honest load plan (when scale approaches)
1. Stand up a staging Railway service with a mocked provider adapter (fixed-latency responses).
2. k6/Artillery ramp: 100 → 1k → 5k concurrent against `/api/scan/analyze` (mock mode), measuring
   p95, error rate, DB pool saturation, queue depth.
3. Gate: p95 < 3s and error rate < 1% at the target tier before raising the launch ladder past
   READY_FOR_1000 (the ladder's own thresholds).
4. 10k+ concurrency is a post-1,000-farmers concern — the modular monolith's extraction seams
   (PLATFORM_ARCHITECTURE.md) are the designed response if a tier fails.

**Claiming a passed 100k load test today would be fabrication.** The pilot (≤100 farmers) is orders
of magnitude below any capacity concern for the current deployment.
