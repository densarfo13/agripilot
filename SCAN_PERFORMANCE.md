# SCAN_PERFORMANCE — v12

## Orchestrator
`analyzeScanV12` is a pure, synchronous composition over already-fetched context
(provider identification, calendar, weather, soil). It performs no network I/O
itself — keyed provider calls stay server-side — so its own cost is sub-millisecond
and it never blocks the scan UI. Total, never throws (falls back to an all-honest
envelope on any error).

## Measured vs PENDING (no fabricated benchmarks)
- **Composition latency:** negligible (in-memory map building).
- **End-to-end scan latency / >99% accuracy / 99.9% crash-free:** measured by the
  existing reliability + golden-dataset gates against the deployed app — reported
  PENDING field population, never a made-up figure.
- **Coverage:** 98 fields / 11 sections, each independently audited by the 517-
  assertion test.

Performance claims that require the live pilot are flagged PENDING, consistent with
the no-fabrication rule.
