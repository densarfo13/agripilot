# PRODUCTION_RELIABILITY_REPORT

## What proves reliability automatically
- **Metrics**: every provider call records latency/status/confidence/FarmBrain
  acceptance/retry/cache into `scan_provider_metrics`.
- **24h scorecard**: uptime, latency p50/p95/p99, error breakdown, health score +
  status — computed from rows (admin endpoint).
- **Auto-failover** (never crashes scanning): plant.id → backup (PlantNet);
  crop.health → continue without; insect.id timeout → retry then continue;
  mushroom → disable (optional). Verified: no provider failure is blocking.
- **Accuracy regression**: golden-dataset harness rejects a deploy whose accuracy
  decreased (once the dataset is populated).

## Honest gaps (operator)
- Live metrics + health scores are NO_DATA until real scans run on Railway.
- The golden dataset is PENDING population (1000+ verified images).

## Verdict
Framework: **READY** — reliability is measured + failover is non-blocking + accuracy
regression is gated. The numbers populate from real production traffic; nothing is
fabricated.
