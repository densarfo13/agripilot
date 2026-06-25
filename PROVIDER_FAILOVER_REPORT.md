# PROVIDER_FAILOVER_REPORT

## Priority + failover order
`weather (20) · soil (10, first production) · air_quality (30, open) ·
pollen (40, disabled stub) · satellite (50, open)`
(Lower priority number runs first; soil is the first PRODUCTION provider.)

## Failover + degradation rules
- Each provider runs through `_callWithResilience`: **1 retry** on transient
  failures (timeout / 429 / 5xx / circuit), then a **circuit breaker** — 3
  consecutive failures → skip that provider for **60s** (`circuit_open`).
- A failed, timed-out, or throwing provider yields an honest `unavailable`
  result. It is dropped from the merge; it never throws up the stack.
- `runEnvironment()` ALWAYS returns a recommendation, even with zero providers.

## Confidence reduction (not blocking)
Overall confidence scales with provider coverage:
`confidence ≈ avgProviderConfidence × (0.5 + 0.5 × contributing/considered)`.
Fewer contributing providers → lower confidence, never a blocked screen.

## Hard invariants (gate-enforced)
- `blocksFarmBrain: false` — the environment layer can never block FarmBrain,
  Scan, Home, or the daily decision.
- If Ambee Soil fails → FarmBrain continues on weather + crop stage + scan +
  task history, with reduced confidence.
- Pollen is a disabled stub — no fabricated pollen/allergy data, ever.

## Verdict
**READY_FOR_PILOT** — failover, retry, circuit breaker, and graceful degradation
are implemented, tested (15 assertions), and gated. Live Soil readiness is
measured on Railway via `/api/environment/diagnostics`.
